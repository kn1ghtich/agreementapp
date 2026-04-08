const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Multer config for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.user._id}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Допустимы только изображения (jpg, png, webp)'));
    }
  }
});

// GET /api/users/me — get current user profile
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/users/:id — get any user's profile
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('fullName email phone team avatar');
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/users/me — update current user profile
router.put('/me', protect, async (req, res) => {
  try {
    const { fullName, email, phone, team } = req.body;
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
    if (team) user.team = team;

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

// PUT /api/users/me/password — change password
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

// POST /api/users/me/avatar — upload avatar
router.post('/me/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Загрузите изображение' });
    }

    const user = await User.findById(req.user._id);

    if (user.avatar) {
      const oldPath = user.avatar.replace(/^\//, '');
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    user.avatar = `/uploads/avatars/${req.file.filename}`;
    await user.save();

    res.json({ avatar: user.avatar });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка загрузки аватара' });
  }
});

module.exports = router;
