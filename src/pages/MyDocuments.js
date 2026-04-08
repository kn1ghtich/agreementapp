import { useState, useEffect } from 'react';
import API from '../api/axios';
import { DOCUMENT_COLORS } from '../components/DocumentModal';
import UserProfileModal from '../components/UserProfileModal';
import '../styles/MyDocuments.css';

const MyDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [docTypes, setDocTypes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [editDoc, setEditDoc] = useState(null);
  const [editData, setEditData] = useState({});
  const [editFile, setEditFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [viewProfileId, setViewProfileId] = useState(null);

  useEffect(() => {
    Promise.all([
      API.get('/documents/types'),
      API.get('/auth/teams')
    ]).then(([typesRes, teamsRes]) => {
      setDocTypes(typesRes.data);
      setTeams(teamsRes.data);
    }).catch(() => {});
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data } = await API.get('/documents/my');
      setDocuments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = documents.filter(doc => {
    if (search && !doc.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && doc.documentType !== filterType) return false;
    if (filterStatus && doc.status !== filterStatus) return false;
    return true;
  });

  const isOverdue = (doc) => new Date(doc.deadline) < new Date() && doc.status !== 'Выполнено';

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'Входящие': '#1a73e8', 'На рассмотрении': '#FB8C00',
      'Доработка': '#E53935', 'Согласование': '#8E24AA', 'Выполнено': '#43A047'
    };
    return colors[status] || '#666';
  };

  const openEdit = (doc) => {
    setEditDoc(doc);
    setEditData({
      title: doc.title,
      description: doc.description || '',
      documentType: doc.documentType,
      team: doc.team,
      deadline: doc.deadline ? new Date(doc.deadline).toISOString().split('T')[0] : ''
    });
    setEditFile(null);
    setMessage({ text: '', type: '' });
  };

  const handleEditChange = (e) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  const handleEditFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.name.endsWith('.docx')) {
      setEditFile(selected);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });

    try {
      const formData = new FormData();
      formData.append('title', editData.title);
      formData.append('description', editData.description);
      formData.append('documentType', editData.documentType);
      formData.append('team', editData.team);
      formData.append('deadline', editData.deadline);
      if (editFile) formData.append('file', editFile);

      const { data } = await API.put(`/documents/${editDoc._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setDocuments(prev => prev.map(d => d._id === data._id ? data : d));
      setMessage({ text: 'Документ обновлён!', type: 'success' });
      setEditDoc(null);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Ошибка', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-screen">Загрузка...</div>;

  return (
    <div className="mydocs-container">
      <h1 className="page-title">Мои документы</h1>

      <div className="mydocs-toolbar">
        <input
          type="text"
          placeholder="Поиск по названию..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="filter-select">
          <option value="">Все типы</option>
          {docTypes.map(t => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="filter-select">
          <option value="">Все статусы</option>
          <option value="Входящие">Входящие</option>
          <option value="На рассмотрении">На рассмотрении</option>
          <option value="Доработка">Доработка</option>
          <option value="Согласование">Согласование</option>
          <option value="Выполнено">Выполнено</option>
        </select>
      </div>

      {message.text && !editDoc && (
        <div className={`create-message ${message.type}`}>{message.text}</div>
      )}

      <div className="mydocs-list">
        {filteredDocs.length === 0 ? (
          <div className="mydocs-empty">
            <p>Вы ещё не создали ни одного документа</p>
          </div>
        ) : (
          filteredDocs.map(doc => (
            <div key={doc._id} className={`mydoc-card ${isOverdue(doc) ? 'overdue' : ''}`}>
              <div className="mydoc-main">
                <div className="mydoc-header">
                  <span
                    className="doc-type-badge-sm"
                    style={{ background: DOCUMENT_COLORS[doc.documentType] || '#666' }}
                  >
                    {doc.documentType}
                  </span>
                  <span className="status-badge" style={{ background: getStatusColor(doc.status) }}>
                    {doc.status}
                  </span>
                </div>
                <h3 className="mydoc-title">{doc.title}</h3>
                {doc.description && <p className="mydoc-desc">{doc.description}</p>}
                <div className="mydoc-meta">
                  <span>Команда: {doc.team}</span>
                  <span className={isOverdue(doc) ? 'overdue-text' : ''}>
                    Срок: {formatDate(doc.deadline)}
                  </span>
                </div>
                {doc.file && (
                  <div className="mydoc-file" onClick={() => window.open(`http://localhost:5000${doc.file.path}`, '_blank')}>
                    <span className="file-icon-sm">DOCX</span>
                    <span>{doc.file.originalName}</span>
                  </div>
                )}
                {doc.lastModifiedBy && (
                  <p className="mydoc-last-change">
                    Последнее изменение:{' '}
                    <span
                      className="clickable-name"
                      onClick={() => setViewProfileId(doc.lastModifiedBy._id)}
                    >
                      {doc.lastModifiedBy.fullName}
                    </span>
                  </p>
                )}
                {doc.comments && doc.comments.length > 0 && (
                  <div className="mydoc-comments">
                    <h4>Обратная связь ({doc.comments.length})</h4>
                    {doc.comments.map((c, i) => (
                      <div key={i} className="mydoc-comment">
                        <strong
                          className="clickable-name"
                          onClick={() => setViewProfileId(c.author?._id)}
                        >
                          {c.author?.fullName}:
                        </strong>{' '}{c.text}
                        <span className="comment-date">{formatDate(c.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn-edit" onClick={() => openEdit(doc)}>
                  Редактировать
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {editDoc && (
        <div className="modal-overlay" onClick={() => setEditDoc(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditDoc(null)}>&times;</button>
            <div className="modal-body">
              <h2>Редактирование документа</h2>

              {message.text && (
                <div className={`create-message ${message.type}`}>{message.text}</div>
              )}

              <form onSubmit={handleSave} className="create-form" style={{gap: '14px'}}>
                <div className="form-group">
                  <label>Название</label>
                  <input type="text" name="title" value={editData.title} onChange={handleEditChange} required />
                </div>
                <div className="form-group">
                  <label>Описание</label>
                  <textarea
                    name="description"
                    value={editData.description}
                    onChange={handleEditChange}
                    rows={3}
                    style={{padding: '12px 16px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit'}}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Тип документа</label>
                    <select name="documentType" value={editData.documentType} onChange={handleEditChange} required>
                      {docTypes.map(t => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Команда</label>
                    <select name="team" value={editData.team} onChange={handleEditChange} required>
                      {teams.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Срок рассмотрения</label>
                  <input type="date" name="deadline" value={editData.deadline} onChange={handleEditChange} required />
                </div>
                <div className="form-group">
                  <label>Заменить документ (.docx)</label>
                  <input type="file" accept=".docx" onChange={handleEditFileChange} />
                </div>
                <div style={{display: 'flex', gap: '10px'}}>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setEditDoc(null)}>
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {viewProfileId && (
        <UserProfileModal
          userId={viewProfileId}
          onClose={() => setViewProfileId(null)}
        />
      )}
    </div>
  );
};

export default MyDocuments;
