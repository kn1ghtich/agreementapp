const express = require('express');
const File = require('../models/File');

const router = express.Router();

// GET /api/files/:id — serve file (inline for images, download for docs)
router.get('/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'Файл не найден' });

    res.set('Content-Type', file.contentType);
    const isImage = file.contentType.startsWith('image/');
    const disposition = isImage ? 'inline' : 'attachment';
    res.set('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    res.send(file.data);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка получения файла' });
  }
});

// GET /api/files/:id/download — force download
router.get('/:id/download', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'Файл не найден' });

    res.set('Content-Type', file.contentType);
    res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    res.send(file.data);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка скачивания файла' });
  }
});

module.exports = router;
