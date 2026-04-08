const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Введите название документа'],
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  documentType: {
    type: String,
    required: [true, 'Выберите тип документа'],
    enum: [
      'Приказы', 'Договора', 'Соглашения', 'Меморандумы',
      'Методика', 'Инструкция', 'Планы', 'Политика',
      'Правила', 'Программа', 'Иные внутренние нормативные документы'
    ]
  },
  file: {
    originalName: String,
    fileName: String,
    path: String
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  team: {
    type: String,
    required: [true, 'Выберите команду-получателя']
  },
  status: {
    type: String,
    enum: ['Входящие', 'На рассмотрении', 'Доработка', 'Согласование', 'Выполнено'],
    default: 'Входящие'
  },
  deadline: {
    type: Date,
    required: [true, 'Укажите срок рассмотрения']
  },
  comments: [commentSchema],
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastStatusChange: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Document', documentSchema);
