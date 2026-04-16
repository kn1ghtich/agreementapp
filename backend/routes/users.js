const express = require('express');
const multer = require('multer');
const File = require('../models/File');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Multer with memory storage for avatar uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Допустимы только изображения (jpg, png, webp)'));
    }
  }
});

// GET /api/users/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/users/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('fullName email phone department avatar');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/users/me — update profile (no department change)
router.put('/me', protect, async (req, res) => {
  try {
    const { fullName, email, phone } = req.body;
    const user = await User.findById(req.user._id);

    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: 'Этот email уже используется' });
      }
      user.email = email;
    }

    if (fullName) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;

    const updatedUser = await user.save();
    res.json(updatedUser);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/users/me/password
router.put('/me/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Неверный текущий пароль' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Пароль успешно изменён' });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/users/me/avatar — upload avatar to MongoDB
router.post('/me/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Загрузите изображение' });
    }

    const user = await User.findById(req.user._id);

    // Delete old avatar file from MongoDB
    if (user.avatar) {
      await File.findByIdAndDelete(user.avatar);
    }

    // Save new avatar to MongoDB
    const fileDoc = await File.create({
      originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      contentType: req.file.mimetype,
      data: req.file.buffer,
      size: req.file.size
    });

    user.avatar = fileDoc._id;
    await user.save();

    res.json({ avatar: fileDoc._id });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка загрузки аватара' });
  }
});

module.exports = router;
