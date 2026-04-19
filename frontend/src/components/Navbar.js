import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import '../styles/Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const pollRef = useRef(null);

  const fetchUnread = async () => {
    try {
      const { data } = await API.get('/messages/unread-count');
      setUnreadCount(data.count);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    fetchUnread();
    pollRef.current = setInterval(fetchUnread, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  // Reset count when user navigates to chat
  useEffect(() => {
    if (location.pathname === '/chat') {
      const timeout = setTimeout(fetchUnread, 2000);
      return () => clearTimeout(timeout);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
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

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <img src="/cmtislogo.png" alt="ЦМТИС" className="navbar-logo" />
        <h2>
          <span className="brand-cmtis">ЦМТИС</span>
          <span className="brand-agreement"> Agreement</span>
        </h2>
      </div>

      <div className="navbar-links">
        <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} end>
          Главная
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Календарь
        </NavLink>
        <NavLink to="/create" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Создание
        </NavLink>
        <NavLink to="/my-documents" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Мои документы
        </NavLink>
        <NavLink to="/statistics" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Статистика
        </NavLink>
        <NavLink to="/archive" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Архив
        </NavLink>
        <NavLink to="/chat" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Чат
          {unreadCount > 0 && <span className="nav-unread-badge">{unreadCount}</span>}
        </NavLink>
      </div>

      <div className="navbar-user">
        <NavLink to="/profile" className="profile-link">
          {getAvatarUrl() ? (
            <img src={getAvatarUrl()} alt="avatar" className="navbar-avatar" />
          ) : (
            <div className="navbar-avatar-placeholder">{getInitials()}</div>
          )}
        </NavLink>
        <button onClick={handleLogout} className="btn-logout">Выйти</button>
      </div>
    </nav>
  );
};

export default Navbar;
