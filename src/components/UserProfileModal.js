import { useState, useEffect } from 'react';
import API from '../api/axios';
import '../styles/UserProfileModal.css';

const UserProfileModal = ({ userId, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      API.get(`/users/${userId}`)
        .then(res => setProfile(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [userId]);

  if (!userId) return null;

  const getAvatarUrl = () => profile?.avatar ? `http://localhost:5000${profile.avatar}` : null;
  const getInitials = () => {
    if (!profile?.fullName) return '?';
    const parts = profile.fullName.split(' ');
    return parts.map(p => p[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div className="user-profile-overlay" onClick={onClose}>
      <div className="user-profile-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        {loading ? (
          <div className="user-profile-loading">Загрузка...</div>
        ) : profile ? (
          <>
            <div className="user-profile-avatar-section">
              {getAvatarUrl() ? (
                <img src={getAvatarUrl()} alt="" className="user-profile-avatar" />
              ) : (
                <div className="user-profile-avatar-placeholder">{getInitials()}</div>
              )}
            </div>
            <h2 className="user-profile-name">{profile.fullName}</h2>
            <div className="user-profile-details">
              <div className="user-profile-row">
                <span className="user-profile-label">Команда</span>
                <span className="user-profile-value">{profile.team}</span>
              </div>
              <div className="user-profile-row">
                <span className="user-profile-label">Email</span>
                <span className="user-profile-value">{profile.email}</span>
              </div>
              {profile.phone && (
                <div className="user-profile-row">
                  <span className="user-profile-label">Телефон</span>
                  <span className="user-profile-value">{profile.phone}</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="user-profile-loading">Пользователь не найден</div>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;
