const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Message = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

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

// Multer for chat file uploads
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
    const allowedTypes = /jpeg|jpg|png|webp|docx/;
    if (allowedTypes.test(path.extname(fixOriginalName(file)).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Допустимы только изображения и .docx файлы'));
    }
  }
});

// GET /api/messages/users — search users for chat
router.get('/users', protect, async (req, res) => {
  try {
    const { search } = req.query;
    let filter = { _id: { $ne: req.user._id } };

    if (search) {
      filter.fullName = { $regex: search, $options: 'i' };
    }

    const users = await User.find(filter)
      .select('fullName avatar team')
      .limit(20);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка поиска пользователей' });
  }
});

// GET /api/messages/chats — get chat list with last messages
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
      .select('fullName avatar team');

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

// GET /api/messages/:userId — get messages with a specific user
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

// POST /api/messages/:userId — send message
router.post('/:userId', protect, upload.single('file'), async (req, res) => {
  try {
    const msgData = {
      sender: req.user._id,
      receiver: req.params.userId,
      content: req.body.content || '',
      messageType: 'text'
    };

    if (req.file) {
      const originalName = fixOriginalName(req.file);
      const ext = path.extname(originalName).toLowerCase();
      msgData.messageType = /\.(jpg|jpeg|png|webp)$/i.test(ext) ? 'image' : 'document';
      msgData.file = {
        originalName,
        fileName: req.file.filename,
        path: `/uploads/documents/${req.file.filename}`
      };
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
