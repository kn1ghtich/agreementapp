import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import DocumentModal from '../components/DocumentModal';
import { DOCUMENT_COLORS } from '../components/DocumentModal';
import '../styles/Home.css';

const STATUSES = ['Входящие', 'На рассмотрении', 'Доработка', 'Согласование', 'Утверждено'];

const Home = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [view, setView] = useState('kanban');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState([]);
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [docTypes, setDocTypes] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/documents/types').then(res => setDocTypes(res.data)).catch(() => {});
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const params = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const { data } = await API.get('/documents', { params });
      setDocuments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  // Тихий поллинг — подтягиваем новые документы каждые 15 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDocuments();
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const handleDocUpdate = (updatedDoc) => {
    setDocuments(prev => prev.map(d => d._id === updatedDoc._id ? updatedDoc : d));
    setSelectedDoc(updatedDoc);
  };

  const getUserDeptStatus = (doc) => {
    return doc.departmentStatuses?.find(ds => ds.department === user.department)?.status || 'Входящие';
  };

  const isOverdue = (doc) => {
    return new Date(doc.deadline) < new Date() && doc.status !== 'Утверждено';
  };

  const handleFilterTypeToggle = (type) => {
    setFilterType(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const filteredDocs = documents.filter(doc => {
    if (search && !doc.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType.length > 0 && !filterType.includes(doc.documentType)) return false;
    return true;
  });

  const getKanbanDocs = (status) => {
    return filteredDocs
      .filter(d => getUserDeptStatus(d) === status)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
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
          <div className="date-range">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="date-input"
              placeholder="С"
            />
            <span className="date-separator">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="date-input"
              placeholder="До"
            />
            {(dateFrom || dateTo) && (
              <button className="date-clear" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                &times;
              </button>
            )}
          </div>
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
                    <span className="status-badge" style={{ background: getStatusColor(getUserDeptStatus(doc)) }}>
                      {getUserDeptStatus(doc)}
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
    'Утверждено': '#43A047'
  };
  return colors[status] || '#666';
}

export default Home;
