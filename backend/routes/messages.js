const express = require('express');
const multer = require('multer');
const path = require('path');
const Message = require('../models/Message');
const User = require('../models/User');
const File = require('../models/File');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Multer with memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (/\.(jpeg|jpg|png|webp|docx)$/i.test(name)) {
      cb(null, true);
    } else {
      cb(new Error('Допустимы только изображения и .docx файлы'));
    }
  }
});

// GET /api/messages/users
router.get('/users', protect, async (req, res) => {
  try {
    const { search } = req.query;
    let filter = { _id: { $ne: req.user._id } };

    if (search) {
      filter.fullName = { $regex: search, $options: 'i' };
    }

    const users = await User.find(filter)
      .select('fullName avatar department')
      .limit(20);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка поиска пользователей' });
  }
});

// GET /api/messages/chats
router.get('/chats', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const messages = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }]
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ['$sender', userId] }, '$receiver', '$sender']
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiver', userId] }, { $eq: ['$read', false] }] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } }
    ]);

    const chatIds = messages.map(m => m._id);
    const users = await User.find({ _id: { $in: chatIds } })
      .select('fullName avatar department');

    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    const chats = messages.map(m => ({
      user: userMap[m._id.toString()],
      lastMessage: {
        content: m.lastMessage.content,
        messageType: m.lastMessage.messageType,
        createdAt: m.lastMessage.createdAt,
        sender: m.lastMessage.sender
      },
      unreadCount: m.unreadCount
    })).filter(c => c.user);

    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения чатов' });
  }
});

// GET /api/messages/unread-count
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiver: req.user._id,
      read: false
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения непрочитанных' });
  }
});

// GET /api/messages/:userId
router.get('/:userId', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id }
      ]
    })
      .populate('sender', 'fullName avatar')
      .sort({ createdAt: 1 });

    await Message.updateMany(
      { sender: req.params.userId, receiver: req.user._id, read: false },
      { read: true }
    );

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка получения сообщений' });
  }
});

// POST /api/messages/:userId
router.post('/:userId', protect, upload.single('file'), async (req, res) => {
  try {
    const msgData = {
      sender: req.user._id,
      receiver: req.params.userId,
      content: req.body.content || '',
      messageType: 'text'
    };

    if (req.file) {
      const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      const ext = path.extname(originalName).toLowerCase();
      msgData.messageType = /\.(jpg|jpeg|png|webp)$/i.test(ext) ? 'image' : 'document';

      const fileDoc = await File.create({
        originalName,
        contentType: req.file.mimetype,
        data: req.file.buffer,
        size: req.file.size
      });

      msgData.file = { fileId: fileDoc._id, originalName };
      if (!msgData.content) {
        msgData.content = originalName;
      }
    }

    const message = await Message.create(msgData);
    const populated = await Message.findById(message._id)
      .populate('sender', 'fullName avatar');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка отправки сообщения' });
  }
});

module.exports = router;
