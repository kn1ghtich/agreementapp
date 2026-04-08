const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { DOCUMENT_TYPES } = require('../config/teams');

const router = express.Router();

// Fix multer latin1 encoding for non-ASCII filenames
function fixOriginalName(file) {
  return Buffer.from(file.originalname, 'latin1').toString('utf8');
}

// Helper: generate unique filename preserving original name
function getUniqueFilename(dir, originalName) {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  let filename = originalName;
  let counter = 1;

  while (fs.existsSync(path.join(dir, filename))) {
    filename = `${base}(${counter})${ext}`;
    counter++;
  }
  return filename;
}

// Multer for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/documents/');
  },
  filename: (req, file, cb) => {
    const originalName = fixOriginalName(file);
    const uniqueName = getUniqueFilename(
      path.join(__dirname, '..', 'uploads', 'documents'),
      originalName
    );
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.docx$/i;
    if (allowedTypes.test(path.extname(fixOriginalName(file)))) {
      cb(null, true);
    } else {
      cb(new Error('Допустимы только .docx файлы'));
    }
  }
});

const POPULATE_SENDER = 'fullName avatar team';
const POPULATE_MODIFIER = 'fullName';
const POPULATE_COMMENT_AUTHOR = 'fullName avatar';

// GET /api/documents/types
router.get('/types', protect, (req, res) => {
  res.json(DOCUMENT_TYPES);
});

// POST /api/documents
router.post('/', protect, upload.single('file'), async (req, res) => {
  try {
    const { title, description, documentType, team, deadline } = req.body;

    const docData = {
      title,
      description: description || '',
      documentType,
      team,
      deadline: new Date(deadline),
      sender: req.user._id,
      status: 'Входящие'
    };

    if (req.file) {
      docData.file = {
        originalName: fixOriginalName(req.file),
        fileName: req.file.filename,
        path: `/uploads/documents/${req.file.filename}`
      };
    }

    const doc = await Document.create(docData);
    const populated = await Document.findById(doc._id)
      .populate('sender', POPULATE_SENDER);

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
    const { status, documentType, search, sort } = req.query;
    const filter = {
      team: req.user.team,
      sender: { $ne: req.user._id }
    };

    if (status) filter.status = status;
    if (documentType) filter.documentType = documentType;
    if (search) filter.title = { $regex: search, $options: 'i' };

    let sortObj = { deadline: 1 };
    if (sort === 'newest') sortObj = { createdAt: -1 };
    if (sort === 'oldest') sortObj = { createdAt: 1 };

    const docs = await Document.find(filter)
      .populate('sender', POPULATE_SENDER)
      .populate('lastModifiedBy', POPULATE_MODIFIER)
      .populate('comments.author', POPULATE_COMMENT_AUTHOR)
      .sort(sortObj);

    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения документов' });
  }
});

// GET /api/documents/my
router.get('/my', protect, async (req, res) => {
  try {
    const { status, documentType, search } = req.query;
    const filter = { sender: req.user._id };

    if (status) filter.status = status;
    if (documentType) filter.documentType = documentType;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const docs = await Document.find(filter)
      .populate('sender', POPULATE_SENDER)
      .populate('lastModifiedBy', POPULATE_MODIFIER)
      .populate('comments.author', POPULATE_COMMENT_AUTHOR)
      .sort({ createdAt: -1 });

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

    const docs = await Document.find({
      team: req.user.team,
      sender: { $ne: req.user._id },
      deadline: { $gte: startDate, $lte: endDate }
    })
      .populate('sender', POPULATE_SENDER)
      .sort({ deadline: 1 });

    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения документов' });
  }
});

// GET /api/documents/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate('sender', POPULATE_SENDER)
      .populate('lastModifiedBy', POPULATE_MODIFIER)
      .populate('comments.author', POPULATE_COMMENT_AUTHOR);

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

    const { title, description, documentType, team, deadline } = req.body;
    if (title) doc.title = title;
    if (description !== undefined) doc.description = description;
    if (documentType) doc.documentType = documentType;
    if (team) doc.team = team;
    if (deadline) doc.deadline = new Date(deadline);

    if (req.file) {
      if (doc.file && doc.file.fileName) {
        const oldPath = path.join(__dirname, '..', 'uploads', 'documents', doc.file.fileName);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      doc.file = {
        originalName: fixOriginalName(req.file),
        fileName: req.file.filename,
        path: `/uploads/documents/${req.file.filename}`
      };
    }

    if (doc.status === 'Доработка') {
      doc.status = 'На рассмотрении';
      doc.lastStatusChange = new Date();
    }

    await doc.save();
    const populated = await Document.findById(doc._id)
      .populate('sender', POPULATE_SENDER)
      .populate('lastModifiedBy', POPULATE_MODIFIER)
      .populate('comments.author', POPULATE_COMMENT_AUTHOR);

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка обновления документа' });
  }
});

// PUT /api/documents/:id/status
router.put('/:id/status', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Документ не найден' });
    }

    if (doc.sender.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'Создатель не может менять статус своего документа' });
    }

    if (req.user.team !== doc.team) {
      return res.status(403).json({ message: 'Вы не являетесь получателем этого документа' });
    }

    const { status } = req.body;
    doc.status = status;
    doc.lastModifiedBy = req.user._id;
    doc.lastStatusChange = new Date();
    await doc.save();

    const populated = await Document.findById(doc._id)
      .populate('sender', POPULATE_SENDER)
      .populate('lastModifiedBy', POPULATE_MODIFIER)
      .populate('comments.author', POPULATE_COMMENT_AUTHOR);

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

    const populated = await Document.findById(doc._id)
      .populate('sender', POPULATE_SENDER)
      .populate('lastModifiedBy', POPULATE_MODIFIER)
      .populate('comments.author', POPULATE_COMMENT_AUTHOR);

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка добавления комментария' });
  }
});

module.exports = router;
