const express = require('express');
const multer = require('multer');
const path = require('path');
const Document = require('../models/Document');
const File = require('../models/File');
const { protect } = require('../middleware/auth');
const { DOCUMENT_TYPES } = require('../config/teams');
const { docxBufferToPdf } = require('../utils/docxToPdf');
const { addWatermark } = require('../utils/watermark');
const { appendAuditPage } = require('../utils/auditPage');

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

// Multer для файлов в комментариях — разрешаем широкий набор
const commentUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (/\.(jpeg|jpg|png|webp|gif|doc|docx|pdf|xls|xlsx|ppt|pptx|txt|rtf|odt|ods|odp|csv|zip|rar|7z)$/i.test(name)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый формат файла'));
    }
  }
});

const POPULATE_SENDER = 'fullName avatar department';
const POPULATE_MODIFIER = 'fullName';
const POPULATE_COMMENT_AUTHOR = 'fullName avatar department';
const POPULATE_DEPT_CHANGED_BY = 'fullName';
const POPULATE_HISTORY_CHANGED_BY = 'fullName department';

function populateDoc(query) {
  return query
    .populate('sender', POPULATE_SENDER)
    .populate('lastModifiedBy', POPULATE_MODIFIER)
    .populate('comments.author', POPULATE_COMMENT_AUTHOR)
    .populate('departmentStatuses.changedBy', POPULATE_DEPT_CHANGED_BY)
    .populate('statusHistory.changedBy', POPULATE_HISTORY_CHANGED_BY);
}

// GET /api/documents/types
router.get('/types', protect, (req, res) => {
  res.json(DOCUMENT_TYPES);
});

// GET /api/documents/stats
router.get('/stats', protect, async (req, res) => {
  try {
    const userDept = req.user.department;

    // Пользователи без отдела не видят статистику
    if (!userDept || userDept === 'Нет отдела') {
      return res.json({ total: 0, byType: [], byStatus: [], byDepartment: [] });
    }

    const { dateFrom, dateTo, period } = req.query;
    let matchFilter = {
      // Документы относятся к отделу, если он либо получатель, либо отправитель
      $or: [
        { departments: userDept },
        { 'departmentStatuses.department': userDept }
      ]
    };

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

    // По отделам-получателям (в рамках документов, относящихся к отделу пользователя)
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
    const { search, documentType, types, dateFrom, dateTo } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));

    const filter = {
      // Только утверждённые: непустой departmentStatuses, все элементы со статусом 'Утверждено'
      'departmentStatuses.0': { $exists: true },
      departmentStatuses: { $not: { $elemMatch: { status: { $ne: 'Утверждено' } } } }
    };

    if (search) filter.title = { $regex: search, $options: 'i' };
    if (documentType) filter.documentType = documentType;
    if (types) {
      const typeList = String(types).split(',').map(t => t.trim()).filter(Boolean);
      if (typeList.length > 0) filter.documentType = { $in: typeList };
    }
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    }

    const total = await Document.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const items = await populateDoc(
      Document.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
    );

    res.json({ items, total, page, pages, limit });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения архива' });
  }
});

// POST /api/documents
router.post('/', protect, upload.array('files', 20), async (req, res) => {
  try {
    const { title, description, documentType, deadline } = req.body;
    let departments = req.body.departments;
    if (typeof departments === 'string') {
      departments = departments.split(',').map(d => d.trim()).filter(Boolean);
    }

    let links = req.body.links;
    if (typeof links === 'string' && links.trim()) {
      try { links = JSON.parse(links); } catch { links = []; }
    }
    if (!Array.isArray(links)) links = [];
    links = links
      .map(l => ({ url: String(l.url || '').trim(), title: String(l.title || '').trim() }))
      .filter(l => l.url);

    const now = new Date();
    const docData = {
      title,
      description: description || '',
      documentType,
      departments,
      senderDepartment: req.user.department,
      deadline: new Date(deadline),
      sender: req.user._id,
      links,
      departmentStatuses: departments.map(dept => ({
        department: dept,
        status: 'Входящие',
        changedAt: now
      })),
      statusHistory: departments.map(dept => ({
        department: dept,
        fromStatus: '',
        toStatus: 'Входящие',
        changedBy: req.user._id,
        changedAt: now
      }))
    };

    if (req.files && req.files.length > 0) {
      const savedFiles = [];
      for (const f of req.files) {
        const originalName = Buffer.from(f.originalname, 'latin1').toString('utf8');
        const fileDoc = await File.create({
          originalName,
          contentType: f.mimetype || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          data: f.buffer,
          size: f.size
        });
        savedFiles.push({ fileId: fileDoc._id, originalName });
      }
      docData.files = savedFiles;
      // Для обратной совместимости
      docData.file = savedFiles[0];
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
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const filter = {
      departments: req.user.department,
      // Скрываем полностью утверждённые документы, у которых дедлайн уже прошёл
      // (строго раньше сегодняшнего дня). Сегодняшние и будущие остаются видимыми.
      // Такие документы продолжают быть доступны в Архиве.
      $nor: [
        {
          deadline: { $lt: startOfToday },
          'departmentStatuses.0': { $exists: true },
          departmentStatuses: { $not: { $elemMatch: { status: { $ne: 'Утверждено' } } } }
        }
      ]
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
router.put('/:id', protect, upload.array('files', 20), async (req, res) => {
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

    // Полная замена набора ссылок (фронт всегда шлёт актуальный список)
    if (req.body.links !== undefined) {
      let links = req.body.links;
      if (typeof links === 'string') {
        try { links = JSON.parse(links); } catch { links = []; }
      }
      if (!Array.isArray(links)) links = [];
      doc.links = links
        .map(l => ({ url: String(l.url || '').trim(), title: String(l.title || '').trim() }))
        .filter(l => l.url);
    }

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

    // Удаление выбранных пользователем файлов
    let removeIds = req.body.removeFileIds;
    if (Array.isArray(removeIds)) removeIds = removeIds.join(',');
    if (typeof removeIds === 'string' && removeIds.trim()) {
      const idList = removeIds.split(',').map(s => s.trim()).filter(Boolean);
      doc.files = (doc.files || []).filter(f => !idList.includes(String(f.fileId)));
      if (doc.file?.fileId && idList.includes(String(doc.file.fileId))) {
        doc.file = doc.files[0] || undefined;
      }
      // Физически чистим File-документы из БД
      for (const id of idList) {
        try { await File.findByIdAndDelete(id); } catch (_) { /* ignore */ }
      }
    }

    if (req.files && req.files.length > 0) {
      const newFiles = [];
      for (const f of req.files) {
        const originalName = Buffer.from(f.originalname, 'latin1').toString('utf8');
        const fileDoc = await File.create({
          originalName,
          contentType: f.mimetype || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          data: f.buffer,
          size: f.size
        });
        newFiles.push({ fileId: fileDoc._id, originalName });
      }
      // Добавляем новые файлы к существующим (с учётом возможных удалений выше)
      doc.files = [...(doc.files || []), ...newFiles];
      // Для обратной совместимости: file = первый файл
      if (!doc.file?.fileId) {
        doc.file = doc.files[0];
      }
    }

    // If doc was in Доработка, move back to На рассмотрении
    const hasDor = doc.departmentStatuses.some(ds => ds.status === 'Доработка');
    if (hasDor) {
      const now = new Date();
      doc.departmentStatuses.forEach(ds => {
        const prev = ds.status;
        ds.status = 'На рассмотрении';
        ds.changedAt = now;
        doc.statusHistory.push({
          department: ds.department,
          fromStatus: prev,
          toStatus: 'На рассмотрении',
          changedBy: req.user._id,
          changedAt: now
        });
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

    // Delete associated files from MongoDB
    if (doc.files && doc.files.length > 0) {
      for (const f of doc.files) {
        if (f.fileId) await File.findByIdAndDelete(f.fileId);
      }
    } else if (doc.file?.fileId) {
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

    const userDept = req.user.department;
    if (!doc.departments.includes(userDept)) {
      return res.status(403).json({ message: 'Вы не являетесь получателем этого документа' });
    }

    const { status } = req.body;

    if (status === 'Утверждено') {
      // Only Президент / Вице-президент can set Утверждено
      if (userDept !== 'Президент' && userDept !== 'Вице-президент') {
        return res.status(403).json({ message: 'Только Президент или Вице-президент могут утвердить документ' });
      }
      // All departments must be on Согласование
      const allAgreed = doc.departmentStatuses.every(ds => ds.status === 'Согласование');
      if (!allAgreed) {
        return res.status(400).json({ message: 'Все отделы должны дать согласование перед утверждением' });
      }
      // Set ALL to Утверждено
      const approvedAt = new Date();
      doc.departmentStatuses.forEach(ds => {
        const prev = ds.status;
        ds.status = 'Утверждено';
        ds.changedBy = req.user._id;
        ds.changedAt = approvedAt;
        doc.statusHistory.push({
          department: ds.department,
          fromStatus: prev,
          toStatus: 'Утверждено',
          changedBy: req.user._id,
          changedAt: approvedAt
        });
      });

      // Сохраняем сейчас, чтобы populate подтянул свежую историю и комментарии
      doc.lastModifiedBy = req.user._id;
      doc.lastStatusChange = approvedAt;
      await doc.save();

      const populated = await populateDoc(Document.findById(doc._id));

      // Конвертируем прикреплённые .docx в .pdf, накладываем знак,
      // и в конце дописываем лист согласования.
      const currentFiles = (doc.files && doc.files.length > 0)
        ? doc.files
        : (doc.file?.fileId ? [doc.file] : []);

      const convertedFiles = [];
      for (const f of currentFiles) {
        const sourceDoc = await File.findById(f.fileId);
        if (!sourceDoc) {
          convertedFiles.push(f);
          continue;
        }
        const isDocx = /\.docx$/i.test(sourceDoc.originalName || '');
        if (!isDocx) {
          convertedFiles.push(f);
          continue;
        }
        const pdfBuf = await docxBufferToPdf(sourceDoc.data);
        if (!pdfBuf) {
          convertedFiles.push(f);
          continue;
        }
        const stampedBuf = await addWatermark(pdfBuf, approvedAt);
        const finalBuf = await appendAuditPage(stampedBuf, populated);
        const newName = sourceDoc.originalName.replace(/\.docx$/i, '.pdf');
        const pdfDoc = await File.create({
          originalName: newName,
          contentType: 'application/pdf',
          data: finalBuf,
          size: finalBuf.length
        });
        await File.findByIdAndDelete(sourceDoc._id);
        convertedFiles.push({ fileId: pdfDoc._id, originalName: newName });
      }

      doc.files = convertedFiles;
      doc.file = convertedFiles[0] || undefined;
      await doc.save();

      const finalPopulated = await populateDoc(Document.findById(doc._id));
      return res.json(finalPopulated);
    } else if (status === 'Доработка') {
      // Set ALL departments to Доработка
      const now = new Date();
      doc.departmentStatuses.forEach(ds => {
        const prev = ds.status;
        ds.status = 'Доработка';
        ds.changedBy = req.user._id;
        ds.changedAt = now;
        doc.statusHistory.push({
          department: ds.department,
          fromStatus: prev,
          toStatus: 'Доработка',
          changedBy: req.user._id,
          changedAt: now
        });
      });
    } else {
      // Set only user's department status
      const deptStatus = doc.departmentStatuses.find(ds => ds.department === userDept);
      if (deptStatus) {
        const prev = deptStatus.status;
        const now = new Date();
        deptStatus.status = status;
        deptStatus.changedBy = req.user._id;
        deptStatus.changedAt = now;
        doc.statusHistory.push({
          department: userDept,
          fromStatus: prev,
          toStatus: status,
          changedBy: req.user._id,
          changedAt: now
        });
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
router.post('/:id/comments', protect, commentUpload.array('files', 10), async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Документ не найден' });
    }

    const text = (req.body.text || '').trim();
    const hasFiles = req.files && req.files.length > 0;
    if (!text && !hasFiles) {
      return res.status(400).json({ message: 'Добавьте текст или файл' });
    }

    const commentData = {
      author: req.user._id,
      text
    };

    if (hasFiles) {
      const savedFiles = [];
      for (const f of req.files) {
        const originalName = Buffer.from(f.originalname, 'latin1').toString('utf8');
        const fileDoc = await File.create({
          originalName,
          contentType: f.mimetype,
          data: f.buffer,
          size: f.size
        });
        savedFiles.push({ fileId: fileDoc._id, originalName });
      }
      commentData.files = savedFiles;
      // Обратная совместимость
      commentData.file = savedFiles[0];
    }

    doc.comments.push(commentData);
    doc.lastModifiedBy = req.user._id;
    await doc.save();

    const populated = await populateDoc(Document.findById(doc._id));
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка добавления комментария' });
  }
});

module.exports = router;
