import { useState, useEffect } from 'react';
import API from '../api/axios';
import { DOCUMENT_COLORS } from '../components/DocumentModal';
import UserProfileModal from '../components/UserProfileModal';
import '../styles/MyDocuments.css';

const MyDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [docTypes, setDocTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [editDoc, setEditDoc] = useState(null);
  const [editData, setEditData] = useState({});
  const [editFile, setEditFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [viewProfileId, setViewProfileId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    Promise.all([
      API.get('/documents/types'),
      API.get('/auth/departments')
    ]).then(([typesRes, deptsRes]) => {
      setDocTypes(typesRes.data);
      setDepartments(deptsRes.data);
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
    if (filterType.length > 0 && !filterType.includes(doc.documentType)) return false;
    if (filterStatus && doc.status !== filterStatus) return false;
    return true;
  });

  const isOverdue = (doc) => new Date(doc.deadline) < new Date() && doc.status !== 'Утверждено';

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'Входящие': '#1a73e8', 'На рассмотрении': '#FB8C00',
      'Доработка': '#E53935', 'Согласование': '#8E24AA', 'Утверждено': '#43A047'
    };
    return colors[status] || '#666';
  };

  const openEdit = (doc) => {
    setEditDoc(doc);
    setEditData({
      title: doc.title,
      description: doc.description || '',
      documentType: doc.documentType,
      departments: doc.departments || [],
      deadline: doc.deadline ? new Date(doc.deadline).toISOString().split('T')[0] : ''
    });
    setEditFile(null);
    setMessage({ text: '', type: '' });
  };

  const handleEditChange = (e) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  const handleFilterTypeToggle = (type) => {
    setFilterType(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleEditDeptToggle = (dept) => {
    setEditData(prev => ({
      ...prev,
      departments: prev.departments.includes(dept)
        ? prev.departments.filter(d => d !== dept)
        : [...prev.departments, dept]
    }));
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
      formData.append('departments', editData.departments.join(','));
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

  const handleDelete = async (docId) => {
    try {
      await API.delete(`/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d._id !== docId));
      setDeleteConfirm(null);
      setMessage({ text: 'Документ удалён', type: 'success' });
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Ошибка удаления', type: 'error' });
      setDeleteConfirm(null);
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
        <div className="filter-type-wrapper">
          <button
            className={`filter-type-btn ${filterType.length > 0 ? 'active' : ''}`}
            onClick={() => setShowTypeFilter(!showTypeFilter)}
          >
            {filterType.length === 0 ? 'Все типы' : `Типы (${filterType.length})`}
            <span className="filter-arrow">{showTypeFilter ? '▲' : '▼'}</span>
          </button>
          {showTypeFilter && (
            <div className="filter-type-dropdown">
              {filterType.length > 0 && (
                <button className="filter-clear-btn" onClick={() => setFilterType([])}>
                  Сбросить
                </button>
              )}
              {docTypes.map(t => (
                <label key={t.name} className={`filter-type-item ${filterType.includes(t.name) ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={filterType.includes(t.name)}
                    onChange={() => handleFilterTypeToggle(t.name)}
                  />
                  <span className="filter-type-dot" style={{ background: t.color }}></span>
                  <span>{t.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="filter-type-wrapper">
          <button
            className={`filter-type-btn ${filterStatus ? 'active' : ''}`}
            onClick={() => setShowStatusFilter(!showStatusFilter)}
          >
            {filterStatus || 'Все статусы'}
            <span className="filter-arrow">{showStatusFilter ? '▲' : '▼'}</span>
          </button>
          {showStatusFilter && (
            <div className="filter-type-dropdown">
              <label
                className={`filter-type-item ${!filterStatus ? 'checked' : ''}`}
                onClick={() => { setFilterStatus(''); setShowStatusFilter(false); }}
              >
                <span className="filter-type-dot" style={{ background: '#999' }}></span>
                <span>Все статусы</span>
              </label>
              {['Входящие', 'На рассмотрении', 'Доработка', 'Согласование', 'Утверждено'].map(s => (
                <label
                  key={s}
                  className={`filter-type-item ${filterStatus === s ? 'checked' : ''}`}
                  onClick={() => { setFilterStatus(s); setShowStatusFilter(false); }}
                >
                  <span className="filter-type-dot" style={{ background: getStatusColor(s) }}></span>
                  <span>{s}</span>
                </label>
              ))}
            </div>
          )}
        </div>
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
                  <span>Отделы: {doc.departments?.join(', ')}</span>
                  <span className={isOverdue(doc) ? 'overdue-text' : ''}>
                    Срок: {formatDate(doc.deadline)}
                  </span>
                </div>

                {/* Department statuses */}
                {doc.departmentStatuses && doc.departmentStatuses.length > 0 && (
                  <div className="mydoc-dept-statuses">
                    {doc.departmentStatuses.map((ds, i) => (
                      <div key={i} className="dept-status-mini">
                        <span className="dept-status-mini-name">{ds.department}</span>
                        <span className="status-badge-sm" style={{ background: getStatusColor(ds.status) }}>
                          {ds.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {doc.file && (
                  <div className="mydoc-file" onClick={() => window.open(`http://localhost:5000/api/files/${doc.file.fileId}/download`, '_blank')}>
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
                <div className="mydoc-actions">
                  {doc.status === 'Утверждено' ? (
                    <span className="doc-locked">🔒 Документ утверждён и заблокирован</span>
                  ) : (
                  <>
                    <button className="btn-edit" onClick={() => openEdit(doc)}>
                      Редактировать
                    </button>
                    <button className="btn-delete" onClick={() => setDeleteConfirm(doc._id)}>
                      Удалить
                    </button>
                  </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: 'center', padding: '30px' }}>
              <h3>Удалить документ?</h3>
              <p style={{ color: '#666', margin: '12px 0 20px' }}>Это действие нельзя отменить</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button className="btn-delete" onClick={() => handleDelete(deleteConfirm)}>Удалить</button>
                <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Отмена</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
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
                <div className="form-group">
                  <label>Тип документа</label>
                  <select name="documentType" value={editData.documentType} onChange={handleEditChange} required>
                    {docTypes.map(t => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Отделы-получатели</label>
                  <div className="departments-checklist">
                    {departments.map(dept => (
                      <label key={dept} className={`dept-checkbox ${editData.departments?.includes(dept) ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={editData.departments?.includes(dept) || false}
                          onChange={() => handleEditDeptToggle(dept)}
                        />
                        <span>{dept}</span>
                      </label>
                    ))}
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
