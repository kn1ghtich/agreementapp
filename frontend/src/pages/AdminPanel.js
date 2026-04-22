import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/AdminPanel.css';

const DEPARTMENTS = [
  'Нет отдела',
  'Президент',
  'Вице-президент',
  'Главный бухгалтер',
  'Главный экономист',
  'Руководитель HR-центра',
  'Руководитель центра корпоративного обучения',
  'Руководитель центра развития компетенции медицинских работников',
  'Руководитель службы развития цифровизации и искусственного интеллекта',
  'Менеджер по государственным закупкам',
  'Юрист'
];

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
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

  const handleDelete = async (userId) => {
    try {
      await adminAPI.delete(`/users/${userId}`);
      setUsers(prev => prev.filter(u => u._id !== userId));
      setDeleteConfirm(null);
      setMessage({ text: 'Пользователь удалён', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 2500);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Ошибка удаления', type: 'error' });
      setDeleteConfirm(null);
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
              <th>Email</th>
              <th>Телефон</th>
              <th>Отдел</th>
              <th>Действия</th>
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
                <td>
                  <button
                    className="btn-delete admin-delete-btn"
                    onClick={() => setDeleteConfirm(u)}
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: 'center', padding: '30px' }}>
              <h3>Удалить пользователя?</h3>
              <p style={{ color: '#666', margin: '12px 0 20px' }}>
                {deleteConfirm.fullName} — это действие нельзя отменить
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button className="btn-delete" onClick={() => handleDelete(deleteConfirm._id)}>
                  Удалить
                </button>
                <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
