const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  login: {
    type: String,
    required: [true, 'Введите логин'],
    unique: true,
    trim: true,
    minlength: [3, 'Логин должен содержать минимум 3 символа']
  },
  email: {
    type: String,
    required: [true, 'Введите email'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Введите корректный email']
  },
  password: {
    type: String,
    required: [true, 'Введите пароль'],
    minlength: [6, 'Пароль должен содержать минимум 6 символов'],
    select: false
  },
  fullName: {
    type: String,
    required: [true, 'Введите ФИО'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Введите номер телефона'],
    trim: true
  },
  team: {
    type: String,
    required: [true, 'Выберите команду'],
    enum: {
      values: [
        'Вице-президент',
        'Главный бухгалтер',
        'Главный экономист',
        'Руководитель HR-центра',
        'Руководитель центра корпоративного обучения',
        'Руководитель центра развития компетенции медицинских работников',
        'Руководитель службы развития цифровизации и искусственного интеллекта',
        'Юрист'
      ],
      message: 'Выберите корректную команду'
    }
  },
  avatar: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
