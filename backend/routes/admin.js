const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Admin auth middleware
const protectAdmin = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Нет доступа' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.admin) return res.status(403).json({ message: 'Нет доступа' });
    next();
  } catch {
    res.status(401).json({ message: 'Невалидный токен' });
  }
};

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { login, password } = req.body;
  if (login === 'admin' && password === 'admin') {
    const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token });
  }
  res.status(401).json({ message: 'Неверный логин или пароль' });
});

// GET /api/admin/users
router.get('/users', protectAdmin, async (req, res) => {
  try {
    const users = await User.find().select('fullName email phone department avatar login createdAt');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка получения пользователей' });
  }
});

// PUT /api/admin/users/:id
router.put('/users/:id', protectAdmin, async (req, res) => {
  try {
    const { department } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { department },
      { new: true, runValidators: true }
    ).select('fullName email phone department avatar login createdAt');
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
    res.json(user);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Некорректный отдел' });
    }
    res.status(500).json({ message: 'Ошибка обновления' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', protectAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
    res.json({ message: 'Пользователь удалён' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка удаления пользователя' });
  }
});

module.exports = router;
