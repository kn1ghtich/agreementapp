import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
        <h2>AgreementApp</h2>
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
