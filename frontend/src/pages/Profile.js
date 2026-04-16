import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import '../styles/Profile.css';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [passwordMessage, setPasswordMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Admin login modal
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminCreds, setAdminCreds] = useState({ login: '', password: '' });
  const [adminError, setAdminError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    setIsLoading(true);

    try {
      const { data } = await API.put('/users/me', formData);
      updateUser(data);
      setMessage({ text: 'Профиль успешно обновлён', type: 'success' });
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Ошибка обновления', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMessage({ text: '', type: '' });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ text: 'Пароли не совпадают', type: 'error' });
      return;
    }

    try {
      await API.put('/users/me/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setPasswordMessage({ text: 'Пароль успешно изменён', type: 'success' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordMessage({ text: err.response?.data?.message || 'Ошибка смены пароля', type: 'error' });
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataFile = new FormData();
    formDataFile.append('avatar', file);

    try {
      const { data } = await API.post('/users/me/avatar', formDataFile, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateUser({ avatar: data.avatar });
      setMessage({ text: 'Аватар обновлён', type: 'success' });
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Ошибка загрузки аватара', type: 'error' });
    }
  };

  const getAvatarUrl = () => {
    if (user?.avatar) {
      return `http://localhost:5000/api/files/${user.avatar}`;
    }
    return null;
  };

  const getInitials = () => {
    if (user?.fullName) {
      const parts = user.fullName.split(' ');
      return parts.map(p => p[0]).slice(0, 2).join('').toUpperCase();
    }
    return '';
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminError('');
    try {
      const { data } = await API.post('/admin/login', adminCreds);
      localStorage.setItem('adminToken', data.token);
      setShowAdminLogin(false);
      navigate('/admin');
    } catch (err) {
      setAdminError(err.response?.data?.message || 'Неверные данные');
    }
  };

  return (
    <div className="profile-container">
      <h1 className="page-title">Профиль</h1>

      <div className="profile-content">
        <div className="avatar-section">
          <div className="avatar-wrapper" onClick={handleAvatarClick}>
            {getAvatarUrl() ? (
              <img src={getAvatarUrl()} alt="avatar" className="profile-avatar" />
            ) : (
              <div className="profile-avatar-placeholder">{getInitials()}</div>
            )}
            <div className="avatar-overlay">Изменить</div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
          />
          <p className="avatar-hint">Нажмите для загрузки аватара</p>
        </div>

        <div className="profile-forms">
          {message.text && (
            <div className={`profile-message ${message.type}`}>{message.text}</div>
          )}

          <form onSubmit={handleSubmit} className="profile-form">
            <h3>Личные данные</h3>

            <div className="form-group">
              <label htmlFor="fullName">ФИО</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Телефон</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+7 (777) 123-45-67"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Отдел</label>
              <input
                type="text"
                value={user?.department || ''}
                disabled
                className="input-disabled"
              />
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </form>

          <form onSubmit={handlePasswordSubmit} className="profile-form">
            <h3>Смена пароля</h3>

            {passwordMessage.text && (
              <div className={`profile-message ${passwordMessage.type}`}>{passwordMessage.text}</div>
            )}

            <div className="form-group">
              <label htmlFor="currentPassword">Текущий пароль</label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="newPassword">Новый пароль</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Подтвердите пароль</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-secondary">
              Изменить пароль
            </button>
          </form>

          <button className="btn-admin" onClick={() => setShowAdminLogin(true)}>
            Админ панель
          </button>
        </div>
      </div>

      {/* Admin login modal */}
      {showAdminLogin && (
        <div className="modal-overlay" onClick={() => setShowAdminLogin(false)}>
          <div className="modal-content modal-small" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAdminLogin(false)}>&times;</button>
            <div className="modal-body">
              <h2>Вход в Админ панель</h2>
              {adminError && <div className="create-message error">{adminError}</div>}
              <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                <div className="form-group">
                  <label>Логин</label>
                  <input
                    type="text"
                    value={adminCreds.login}
                    onChange={e => setAdminCreds({ ...adminCreds, login: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Пароль</label>
                  <input
                    type="password"
                    value={adminCreds.password}
                    onChange={e => setAdminCreds({ ...adminCreds, password: e.target.value })}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary">Войти</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
