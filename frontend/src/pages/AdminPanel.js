import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/AdminPanel.css';

const DEPARTMENTS = [
  'Президент',
  'Вице-президент',
  'Главный бухгалтер',
  'Главный экономист',
  'Руководитель HR-центра',
  'Руководитель центра корпоративного обучения',
  'Руководитель центра развития компетенции медицинских работников',
  'Руководитель службы развития цифровизации и искусственного интеллекта',
  'Юрист'
];

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const navigate = useNavigate();

  const adminToken = localStorage.getItem('adminToken');

  const adminAPI = axios.create({
    baseURL: 'http://localhost:5000/api/admin',
    headers: { Authorization: `Bearer ${adminToken}` }
  });

  useEffect(() => {
    if (!adminToken) {
      navigate('/profile');
      return;
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await adminAPI.get('/users');
      setUsers(data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('adminToken');
        navigate('/profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChange = async (userId, newDept) => {
    try {
      const { data } = await adminAPI.put(`/users/${userId}`, { department: newDept });
      setUsers(prev => prev.map(u => u._id === data._id ? data : u));
      setMessage({ text: 'Отдел обновлён', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 2000);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Ошибка', type: 'error' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/profile');
  };

  const getAvatarUrl = (u) => u?.avatar ? `http://localhost:5000/api/files/${u.avatar}` : null;
  const getInitials = (u) => {
    if (u?.fullName) {
      return u.fullName.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
    }
    return '?';
  };

  if (loading) return <div className="loading-screen">Загрузка...</div>;

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1 className="page-title">Админ панель</h1>
        <button className="btn-secondary" onClick={handleLogout}>Выйти из админ панели</button>
      </div>

      {message.text && (
        <div className={`create-message ${message.type}`}>{message.text}</div>
      )}

      <div className="admin-users-list">
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>ФИО</th>
              <th>Логин</th>
              <th>Email</th>
              <th>Телефон</th>
              <th>Отдел</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id}>
                <td>
                  {getAvatarUrl(u) ? (
                    <img src={getAvatarUrl(u)} alt="" className="admin-avatar" />
                  ) : (
                    <div className="admin-avatar-placeholder">{getInitials(u)}</div>
                  )}
                </td>
                <td className="admin-name">{u.fullName}</td>
                <td>{u.login}</td>
                <td>{u.email}</td>
                <td>{u.phone}</td>
                <td>
                  <select
                    value={u.department}
                    onChange={e => handleDepartmentChange(u._id, e.target.value)}
                    className="admin-dept-select"
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPanel;
