const express = require('express');
const multer = require('multer');
const path = require('path');
const Document = require('../models/Document');
const File = require('../models/File');
const { protect } = require('../middleware/auth');
const { DOCUMENT_TYPES } = require('../config/teams');

const router = express.Router();

// Multer with memory storage (files go to MongoDB)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (/\.docx$/i.test(name)) {
      cb(null, true);
    } else {
      cb(new Error('Допустимы только .docx файлы'));
    }
  }
});

const POPULATE_SENDER = 'fullName avatar department';
const POPULATE_MODIFIER = 'fullName';
const POPULATE_COMMENT_AUTHOR = 'fullName avatar';
const POPULATE_DEPT_CHANGED_BY = 'fullName';

function populateDoc(query) {
  return query
    .populate('sender', POPULATE_SENDER)
    .populate('lastModifiedBy', POPULATE_MODIFIER)
    .populate('comments.author', POPULATE_COMMENT_AUTHOR)
    .populate('departmentStatuses.changedBy', POPULATE_DEPT_CHANGED_BY);
}

// GET /api/documents/types
router.get('/types', protect, (req, res) => {
  res.json(DOCUMENT_TYPES);
});

// GET /api/documents/stats
router.get('/stats', protect, async (req, res) => {
  try {
    const { dateFrom, dateTo, period } = req.query;
    let matchFilter = {};

    if (dateFrom && dateTo) {
      matchFilter.createdAt = {
        $gte: new Date(dateFrom),
        $lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999))
      };
    } else if (period === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      matchFilter.createdAt = { $gte: d };
    } else if (period === 'month') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      matchFilter.createdAt = { $gte: d };
    }

    const byType = await Document.aggregate([
      { $match: matchFilter },
      { $group: { _id: '$documentType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const docs = await Document.find(matchFilter).select('departmentStatuses');
    const statusCounts = {};
    docs.forEach(doc => {
      const s = doc.status; // virtual
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const byStatus = Object.entries(statusCounts).map(([_id, count]) => ({ _id, count }));

    const total = docs.length;

    // Per-department stats
    const byDepartment = await Document.aggregate([
      { $match: matchFilter },
      { $unwind: '$departments' },
      { $group: { _id: '$departments', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({ total, byType, byStatus, byDepartment });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения статистики' });
  }
});

// GET /api/documents/archive
router.get('/archive', protect, async (req, res) => {
  try {
    const { search, documentType, dateFrom, dateTo } = req.query;
    const filter = {};

    if (search) filter.title = { $regex: search, $options: 'i' };
    if (documentType) filter.documentType = documentType;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    const docs = await populateDoc(Document.find(filter).sort({ createdAt: -1 }));
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения архива' });
  }
});

// POST /api/documents
router.post('/', protect, upload.single('file'), async (req, res) => {
  try {
    const { title, description, documentType, deadline } = req.body;
    let departments = req.body.departments;
    if (typeof departments === 'string') {
      departments = departments.split(',').map(d => d.trim()).filter(Boolean);
    }

    const docData = {
      title,
      description: description || '',
      documentType,
      departments,
      senderDepartment: req.user.department,
      deadline: new Date(deadline),
      sender: req.user._id,
      departmentStatuses: departments.map(dept => ({
        department: dept,
        status: 'Входящие',
        changedAt: new Date()
      }))
    };

    if (req.file) {
      const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      const fileDoc = await File.create({
        originalName,
        contentType: req.file.mimetype || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: req.file.buffer,
        size: req.file.size
      });
      docData.file = { fileId: fileDoc._id, originalName };
    }

    const doc = await Document.create(docData);
    const populated = await populateDoc(Document.findById(doc._id));

    res.status(201).json(populated);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Ошибка создания документа' });
  }
});

// GET /api/documents
router.get('/', protect, async (req, res) => {
  try {
    const { documentType, search, sort, dateFrom, dateTo } = req.query;
    const filter = {
      departments: req.user.department,
      sender: { $ne: req.user._id }
    };

    if (documentType) filter.documentType = documentType;
    if (search) filter.title = { $regex: search, $options: 'i' };
    if (dateFrom || dateTo) {
      filter.deadline = {};
      if (dateFrom) filter.deadline.$gte = new Date(dateFrom);
      if (dateTo) filter.deadline.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    let sortObj = { deadline: 1 };
    if (sort === 'newest') sortObj = { createdAt: -1 };
    if (sort === 'oldest') sortObj = { createdAt: 1 };

    const docs = await populateDoc(Document.find(filter).sort(sortObj));
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения документов' });
  }
});

// GET /api/documents/my
router.get('/my', protect, async (req, res) => {
  try {
    const { documentType, search } = req.query;
    const filter = { sender: req.user._id };

    if (documentType) filter.documentType = documentType;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const docs = await populateDoc(Document.find(filter).sort({ createdAt: -1 }));
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения документов' });
  }
});

// GET /api/documents/calendar
router.get('/calendar', protect, async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const docs = await populateDoc(
      Document.find({
        departments: req.user.department,
        sender: { $ne: req.user._id },
        deadline: { $gte: startDate, $lte: endDate }
      }).sort({ deadline: 1 })
    );

    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения документов' });
  }
});

// GET /api/documents/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await populateDoc(Document.findById(req.params.id));
    if (!doc) {
      return res.status(404).json({ message: 'Документ не найден' });
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения документа' });
  }
});

// PUT /api/documents/:id
router.put('/:id', protect, upload.single('file'), async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Документ не найден' });
    }

    if (doc.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Только создатель может редактировать документ' });
    }

    if (doc.status === 'Утверждено') {
      return res.status(403).json({ message: 'Утверждённый документ нельзя редактировать' });
    }

    const { title, description, documentType, deadline } = req.body;
    let departments = req.body.departments;
    if (typeof departments === 'string') {
      departments = departments.split(',').map(d => d.trim()).filter(Boolean);
    }

    if (title) doc.title = title;
    if (description !== undefined) doc.description = description;
    if (documentType) doc.documentType = documentType;
    if (deadline) doc.deadline = new Date(deadline);

    if (departments && departments.length > 0) {
      // Update departments and sync departmentStatuses
      const existingMap = {};
      doc.departmentStatuses.forEach(ds => { existingMap[ds.department] = ds; });

      doc.departments = departments;
      doc.departmentStatuses = departments.map(dept => {
        if (existingMap[dept]) return existingMap[dept];
        return { department: dept, status: 'Входящие', changedAt: new Date() };
      });
    }

    if (req.file) {
      const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      const fileDoc = await File.create({
        originalName,
        contentType: req.file.mimetype || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: req.file.buffer,
        size: req.file.size
      });
      doc.file = { fileId: fileDoc._id, originalName };
    }

    // If doc was in Доработка, move back to На рассмотрении
    const hasDor = doc.departmentStatuses.some(ds => ds.status === 'Доработка');
    if (hasDor) {
      doc.departmentStatuses.forEach(ds => {
        ds.status = 'На рассмотрении';
        ds.changedAt = new Date();
      });
    }

    await doc.save();
    const populated = await populateDoc(Document.findById(doc._id));
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка обновления документа' });
  }
});

// DELETE /api/documents/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Документ не найден' });
    }
    if (doc.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Только создатель может удалить документ' });
    }

    if (doc.status === 'Утверждено') {
      return res.status(403).json({ message: 'Утверждённый документ нельзя удалить' });
    }

    // Delete associated file from MongoDB
    if (doc.file?.fileId) {
      await File.findByIdAndDelete(doc.file.fileId);
    }

    await Document.findByIdAndDelete(req.params.id);
    res.json({ message: 'Документ удалён' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка удаления документа' });
  }
});

// PUT /api/documents/:id/status
router.put('/:id/status', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Документ не найден' });
    }

    if (doc.status === 'Утверждено') {
      return res.status(403).json({ message: 'Статус утверждённого документа нельзя изменить' });
    }

    if (doc.sender.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'Создатель не может менять статус своего документа' });
    }

    const userDept = req.user.department;
    if (!doc.departments.includes(userDept)) {
      return res.status(403).json({ message: 'Вы не являетесь получателем этого документа' });
    }

    const { status } = req.body;

    if (status === 'Утверждено') {
      // Only Президент can set Утверждено
      if (userDept !== 'Президент') {
        return res.status(403).json({ message: 'Только Президент может утвердить документ' });
      }
      // All departments must be on Согласование
      const allAgreed = doc.departmentStatuses.every(ds => ds.status === 'Согласование');
      if (!allAgreed) {
        return res.status(400).json({ message: 'Все отделы должны дать согласование перед утверждением' });
      }
      // Set ALL to Утверждено
      doc.departmentStatuses.forEach(ds => {
        ds.status = 'Утверждено';
        ds.changedBy = req.user._id;
        ds.changedAt = new Date();
      });
    } else if (status === 'Доработка') {
      // Set ALL departments to Доработка
      doc.departmentStatuses.forEach(ds => {
        ds.status = 'Доработка';
        ds.changedBy = req.user._id;
        ds.changedAt = new Date();
      });
    } else {
      // Set only user's department status
      const deptStatus = doc.departmentStatuses.find(ds => ds.department === userDept);
      if (deptStatus) {
        deptStatus.status = status;
        deptStatus.changedBy = req.user._id;
        deptStatus.changedAt = new Date();
      }
    }

    doc.lastModifiedBy = req.user._id;
    doc.lastStatusChange = new Date();
    await doc.save();

    const populated = await populateDoc(Document.findById(doc._id));
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка обновления статуса' });
  }
});

// POST /api/documents/:id/comments
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Документ не найден' });
    }

    doc.comments.push({
      author: req.user._id,
      text: req.body.text
    });
    doc.lastModifiedBy = req.user._id;
    await doc.save();

    const populated = await populateDoc(Document.findById(doc._id));
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка добавления комментария' });
  }
});

module.exports = router;
