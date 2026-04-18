const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { DEPARTMENTS } = require('../config/teams');

const router = express.Router();


const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { login, email, password, fullName, phone } = req.body;

    const existingUser = await User.findOne({ $or: [{ login }, { email }] });
    if (existingUser) {
      const field = existingUser.login === login ? 'логином' : 'email';
      return res.status(400).json({ message: `Пользователь с таким ${field} уже существует` });
    }

    const user = await User.create({
      login, email, password, fullName, phone, department: 'Нет отдела'
    });

    res.status(201).json({
      _id: user._id,
      login: user.login,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      department: user.department,
      avatar: user.avatar,
      token: generateToken(user._id)
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ message: 'Введите логин и пароль' });
    }

    const user = await User.findOne({ login }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Неверный логин или пароль' });
    }

    res.json({
      _id: user._id,
      login: user.login,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      department: user.department,
      avatar: user.avatar,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/auth/departments
router.get('/departments', (req, res) => {
  res.json(DEPARTMENTS);
});

module.exports = router;
