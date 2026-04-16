import { useState, useEffect } from 'react';
import API from '../api/axios';
import DocumentModal from '../components/DocumentModal';
import { DOCUMENT_COLORS } from '../components/DocumentModal';
import '../styles/Archive.css';

const Archive = () => {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
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
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterType) params.documentType = filterType;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const { data } = await API.get('/documents/archive', { params });
      setDocuments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) fetchDocuments();
  }, [filterType, dateFrom, dateTo]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDocuments();
  };

  const handleDocUpdate = (updatedDoc) => {
    setDocuments(prev => prev.map(d => d._id === updatedDoc._id ? updatedDoc : d));
    setSelectedDoc(updatedDoc);
  };

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

  return (
    <div className="archive-container">
      <h1 className="page-title">Архив документов</h1>

      <div className="archive-toolbar">
        <form onSubmit={handleSearch} className="archive-search-form">
          <input
            type="text"
            placeholder="Поиск по названию..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn-search">Найти</button>
        </form>

        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="filter-select">
          <option value="">Все типы</option>
          {docTypes.map(t => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>

        <div className="date-range">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="date-input" />
          <span className="date-separator">—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="date-input" />
          {(dateFrom || dateTo) && (
            <button className="date-clear" onClick={() => { setDateFrom(''); setDateTo(''); }}>
              &times;
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-screen">Загрузка...</div>
      ) : (
        <div className="archive-list">
          <table className="doc-table">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Название</th>
                <th>Статус</th>
                <th>Отделы</th>
                <th>Срок</th>
                <th>Создан</th>
                <th>Отправитель</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc._id} onClick={() => setSelectedDoc(doc)} className="clickable-row">
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
                  <td className="td-depts">{doc.departments?.join(', ')}</td>
                  <td>{formatDate(doc.deadline)}</td>
                  <td>{formatDate(doc.createdAt)}</td>
                  <td>{doc.sender?.fullName}</td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr><td colSpan="7" className="empty-row">Документы не найдены</td></tr>
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

export default Archive;
