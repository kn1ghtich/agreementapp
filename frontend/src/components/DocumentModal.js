import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import UserProfileModal from './UserProfileModal';
import '../styles/DocumentModal.css';

const DOCUMENT_COLORS = {
  'Приказы': '#E53935',
  'Договора': '#1E88E5',
  'Соглашения': '#43A047',
  'Меморандумы': '#FB8C00',
  'Методика': '#8E24AA',
  'Инструкция': '#00ACC1',
  'Планы': '#FFB300',
  'Политика': '#3949AB',
  'Правила': '#D81B60',
  'Программа': '#00897B',
  'Иные внутренние нормативные документы': '#6D4C41'
};

const STATUSES = ['Входящие', 'На рассмотрении', 'Доработка', 'Согласование', 'Утверждено'];

const DocumentModal = ({ document, onClose, onUpdate, isSender }) => {
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewProfileId, setViewProfileId] = useState(null);

  const userDeptStatus = document.departmentStatuses?.find(
    ds => ds.department === user.department
  );
  const currentStatus = userDeptStatus?.status || document.status || 'Входящие';
  const isRecipient = !isSender && document.departments?.includes(user.department);
  const isOverdue = new Date(document.deadline) < new Date() && document.status !== 'Утверждено';
  const isPresident = user.department === 'Президент';

  const canSetStatus = (s) => {
    if (!isRecipient || loading) return false;
    if (s === 'Утверждено') {
      if (!isPresident) return false;
      const allAgreed = document.departmentStatuses?.every(ds => ds.status === 'Согласование');
      return allAgreed;
    }
    return true;
  };

  const handleStatusChange = async (newStatus) => {
    if (!canSetStatus(newStatus)) return;
    setLoading(true);
    try {
      const { data } = await API.put(`/documents/${document._id}/status`, { status: newStatus });
      if (onUpdate) onUpdate(data);
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setLoading(true);
    try {
      const { data } = await API.post(`/documents/${document._id}/comments`, { text: comment });
      if (onUpdate) onUpdate(data);
      setComment('');
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (document.file?.fileId) {
      window.open(`http://localhost:5000/api/files/${document.file.fileId}/download`, '_blank');
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  const senderName = document.sender?.fullName || 'Неизвестно';

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts.map(p => p[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>

        {/* Status bar */}
        <div className="modal-status-bar">
          {STATUSES.map(s => (
            <button
              key={s}
              className={`status-btn ${currentStatus === s ? 'active' : ''} ${s === 'Утверждено' ? 'done' : ''}`}
              onClick={() => canSetStatus(s) && handleStatusChange(s)}
              disabled={!canSetStatus(s)}
              style={currentStatus === s ? { background: getStatusColor(s) } : {}}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="modal-body">
          <h2 className="modal-title">{document.title}</h2>

          <div className="modal-meta">
            <span
              className="doc-type-badge"
              style={{ background: DOCUMENT_COLORS[document.documentType] || '#666' }}
            >
              {document.documentType}
            </span>
            <span className={`deadline-text ${isOverdue ? 'overdue' : ''}`}>
              Срок: {formatDate(document.deadline)}
            </span>
          </div>

          {document.description && (
            <div className="modal-section">
              <h4>Описание</h4>
              <p>{document.description}</p>
            </div>
          )}

          <div className="modal-section">
            <h4>Отправитель</h4>
            <div
              className="sender-info clickable-user"
              onClick={() => setViewProfileId(document.sender?._id)}
            >
              {document.sender?.avatar ? (
                <img src={`http://localhost:5000/api/files/${document.sender.avatar}`} alt="" className="sender-avatar" />
              ) : (
                <div className="sender-avatar-placeholder">
                  {getInitials(document.sender?.fullName)}
                </div>
              )}
              <span className="clickable-name">{senderName}</span>
            </div>
          </div>

          {/* Department statuses */}
          {document.departmentStatuses && document.departmentStatuses.length > 0 && (
            <div className="modal-section">
              <h4>Статусы по отделам</h4>
              <div className="dept-statuses-list">
                {document.departmentStatuses.map((ds, i) => (
                  <div key={i} className="dept-status-row">
                    <span className="dept-status-name">{ds.department}</span>
                    <span className="status-badge" style={{ background: getStatusColor(ds.status) }}>
                      {ds.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {document.file && (
            <div className="modal-section">
              <h4>Документ</h4>
              <div className="file-download" onClick={handleDownload}>
                <div className="file-icon">DOCX</div>
                <span>{document.file.originalName}</span>
              </div>
            </div>
          )}

          {document.lastModifiedBy && (
            <div className="modal-section last-change">
              <p>
                Последнее изменение:{' '}
                <span
                  className="clickable-name"
                  onClick={() => setViewProfileId(document.lastModifiedBy._id)}
                >
                  {document.lastModifiedBy.fullName}
                </span>
              </p>
            </div>
          )}

          {/* Comments */}
          <div className="modal-section">
            <h4>Комментарии ({document.comments?.length || 0})</h4>
            <div className="comments-list">
              {document.comments?.map((c, i) => (
                <div key={i} className="comment-item">
                  <div className="comment-header">
                    <strong
                      className="clickable-name"
                      onClick={() => setViewProfileId(c.author?._id)}
                    >
                      {c.author?.fullName}
                    </strong>
                    <span className="comment-date">{formatDate(c.createdAt)}</span>
                  </div>
                  <p>{c.text}</p>
                </div>
              ))}
              {(!document.comments || document.comments.length === 0) && (
                <p className="no-comments">Комментариев пока нет</p>
              )}
            </div>

            <form onSubmit={handleComment} className="comment-form">
              <input
                type="text"
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Написать комментарий..."
                disabled={loading}
              />
              <button type="submit" disabled={!comment.trim() || loading}>
                Отправить
              </button>
            </form>
          </div>
        </div>
      </div>

      {viewProfileId && (
        <UserProfileModal
          userId={viewProfileId}
          onClose={() => setViewProfileId(null)}
        />
      )}
    </div>
  );
};

function getStatusColor(status) {
  const colors = {
    'Входящие': '#1a73e8',
    'На рассмотрении': '#FB8C00',
    'Доработка': '#E53935',
    'Согласование': '#8E24AA',
    'Утверждено': '#43A047'
  };
  return colors[status] || '#666';
}

export { DOCUMENT_COLORS, STATUSES };
export default DocumentModal;
