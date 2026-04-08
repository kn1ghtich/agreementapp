import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import '../styles/Profile.css';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    team: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [teams, setTeams] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [passwordMessage, setPasswordMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        team: user.team || ''
      });
    }
    API.get('/auth/teams')
      .then(res => setTeams(res.data))
      .catch(() => {});
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
      return `http://localhost:5000${user.avatar}`;
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
              <label htmlFor="team">Команда</label>
              <select
                id="team"
                name="team"
                value={formData.team}
                onChange={handleChange}
                required
              >
                {teams.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
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
        </div>
      </div>
    </div>
  );
};

export default Profile;
