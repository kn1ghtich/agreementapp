const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    default: ''
  },
  file: {
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    originalName: String
  },
  files: [{
    _id: false,
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    originalName: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const departmentStatusSchema = new mongoose.Schema({
  department: { type: String, required: true },
  status: {
    type: String,
    enum: ['Входящие', 'На рассмотрении', 'Доработка', 'Согласование', 'Утверждено'],
    default: 'Входящие'
  },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changedAt: { type: Date, default: Date.now }
}, { _id: false });

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
      'Правила', 'Программа', 'Техническая спецификация',
      'Иные внутренние нормативные документы'
    ]
  },
  file: {
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    originalName: String
  },
  files: [{
    _id: false,
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    originalName: String
  }],
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderDepartment: {
    type: String
  },
  departments: [{
    type: String
  }],
  departmentStatuses: [departmentStatusSchema],
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

documentSchema.virtual('status').get(function() {
  if (!this.departmentStatuses || this.departmentStatuses.length === 0) return 'Входящие';
  const statuses = this.departmentStatuses.map(ds => ds.status);
  if (statuses.some(s => s === 'Доработка')) return 'Доработка';
  if (statuses.every(s => s === 'Утверждено')) return 'Утверждено';
  if (statuses.every(s => s === 'Согласование')) return 'Согласование';
  if (statuses.some(s => s === 'На рассмотрении' || s === 'Согласование')) return 'На рассмотрении';
  return 'Входящие';
});

module.exports = mongoose.model('Document', documentSchema);
