import { useState, useEffect } from 'react';
import API from '../api/axios';
import DocumentModal from '../components/DocumentModal';
import { DOCUMENT_COLORS } from '../components/DocumentModal';
import '../styles/Home.css';

const STATUSES = ['Входящие', 'На рассмотрении', 'Доработка', 'Согласование', 'Выполнено'];

const Home = () => {
  const [documents, setDocuments] = useState([]);
  const [view, setView] = useState('kanban');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDeadline, setFilterDeadline] = useState('');
  const [docTypes, setDocTypes] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/documents/types').then(res => setDocTypes(res.data)).catch(() => {});
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data } = await API.get('/documents');
      setDocuments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDocUpdate = (updatedDoc) => {
    setDocuments(prev => prev.map(d => d._id === updatedDoc._id ? updatedDoc : d));
    setSelectedDoc(updatedDoc);
  };

  const isOverdue = (doc) => {
    return new Date(doc.deadline) < new Date() && doc.status !== 'Выполнено';
  };

  const filteredDocs = documents.filter(doc => {
    if (search && !doc.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && doc.documentType !== filterType) return false;
    if (filterDeadline) {
      const deadlineDate = new Date(doc.deadline);
      const today = new Date();
      if (filterDeadline === 'today') {
        if (deadlineDate.toDateString() !== today.toDateString()) return false;
      } else if (filterDeadline === 'week') {
        const weekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (deadlineDate > weekLater || deadlineDate < today) return false;
      } else if (filterDeadline === 'month') {
        const monthLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (deadlineDate > monthLater || deadlineDate < today) return false;
      } else if (filterDeadline === 'overdue') {
        if (!isOverdue(doc)) return false;
      }
    }
    return true;
  });

  const getKanbanDocs = (status) => {
    let docs = filteredDocs.filter(d => d.status === status);
    if (status === 'Выполнено') {
      docs = docs.filter(d => !isOverdue(d));
    }
    return docs.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  const getSenderShort = (sender) => {
    if (!sender?.fullName) return '';
    const parts = sender.fullName.split(' ');
    if (parts.length >= 2) return `${parts[0]} ${parts[1][0]}.`;
    return parts[0];
  };

  const renderDocCard = (doc) => (
    <div
      key={doc._id}
      className={`doc-card ${isOverdue(doc) ? 'overdue' : ''}`}
      onClick={() => setSelectedDoc(doc)}
    >
      <span
        className="doc-card-type"
        style={{ background: DOCUMENT_COLORS[doc.documentType] || '#666' }}
      >
        {doc.documentType}
      </span>
      <h4 className="doc-card-title">{doc.title}</h4>
      <div className="doc-card-footer">
        <span className="doc-card-deadline">{formatDate(doc.deadline)}</span>
        <span className="doc-card-sender">{getSenderShort(doc.sender)}</span>
      </div>
    </div>
  );

  if (loading) {
    return <div className="loading-screen">Загрузка...</div>;
  }

  return (
    <div className="home-container">
      <div className="home-toolbar">
        <div className="toolbar-left">
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
          <select value={filterDeadline} onChange={e => setFilterDeadline(e.target.value)} className="filter-select">
            <option value="">Все сроки</option>
            <option value="today">Сегодня</option>
            <option value="week">Эта неделя</option>
            <option value="month">Этот месяц</option>
            <option value="overdue">Просроченные</option>
          </select>
        </div>
        <div className="view-toggle">
          <button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}>
            Канбан
          </button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
            Список
          </button>
        </div>
      </div>

      {view === 'kanban' && (
        <div className="kanban-board">
          {STATUSES.map(status => (
            <div key={status} className="kanban-column">
              <div className="kanban-header" style={{ borderColor: getStatusColor(status) }}>
                <h3>{status}</h3>
                <span className="kanban-count">{getKanbanDocs(status).length}</span>
              </div>
              <div className="kanban-cards">
                {getKanbanDocs(status).map(renderDocCard)}
                {getKanbanDocs(status).length === 0 && (
                  <p className="kanban-empty">Нет документов</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'list' && (
        <div className="list-view">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Название</th>
                <th>Статус</th>
                <th>Срок</th>
                <th>Отправитель</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map(doc => (
                <tr
                  key={doc._id}
                  className={isOverdue(doc) ? 'overdue-row' : ''}
                  onClick={() => setSelectedDoc(doc)}
                >
                  <td>
                    <span
                      className="doc-type-badge-sm"
                      style={{ background: DOCUMENT_COLORS[doc.documentType] || '#666' }}
                    >
                      {doc.documentType}
                    </span>
                  </td>
                  <td className="td-title">{doc.title}</td>
                  <td>
                    <span className="status-badge" style={{ background: getStatusColor(doc.status) }}>
                      {doc.status}
                    </span>
                  </td>
                  <td className={isOverdue(doc) ? 'overdue-text' : ''}>{formatDate(doc.deadline)}</td>
                  <td>{getSenderShort(doc.sender)}</td>
                </tr>
              ))}
              {filteredDocs.length === 0 && (
                <tr><td colSpan="5" className="empty-row">Документы не найдены</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedDoc && (
        <DocumentModal
          document={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onUpdate={handleDocUpdate}
          isSender={false}
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
    'Выполнено': '#43A047'
  };
  return colors[status] || '#666';
}

export default Home;
