import { useState, useEffect, useRef } from 'react';
import API from '../api/axios';
import DocumentModal from '../components/DocumentModal';
import { DOCUMENT_COLORS } from '../components/DocumentModal';
import '../styles/Archive.css';

const PAGE_SIZE = 15;

const Archive = () => {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [filterType, setFilterType] = useState([]);
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [docTypes, setDocTypes] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const didMount = useRef(false);

  useEffect(() => {
    API.get('/documents/types').then(res => setDocTypes(res.data)).catch(() => {});
  }, []);

  const fetchDocuments = async (pageToFetch = page) => {
    setLoading(true);
    try {
      const params = { page: pageToFetch, limit: PAGE_SIZE };
      if (submittedSearch) params.search = submittedSearch;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (filterType.length > 0) params.types = filterType.join(',');
      const { data } = await API.get('/documents/archive', { params });
      setDocuments(data.items || []);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
      setPage(data.page || pageToFetch);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDocuments(1);
    didMount.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset to page 1 and refetch when filters change
  useEffect(() => {
    if (!didMount.current) return;
    fetchDocuments(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, filterType, submittedSearch]);

  const handleFilterTypeToggle = (type) => {
    setFilterType(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSubmittedSearch(search);
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

  const goToPage = (p) => {
    const target = Math.min(Math.max(1, p), pages);
    if (target === page) return;
    fetchDocuments(target);
  };

  // Build compact page list: 1 … p-1 p p+1 … N
  const buildPageList = () => {
    const result = [];
    const push = (v) => { if (result[result.length - 1] !== v) result.push(v); };
    push(1);
    if (page > 3) push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) push(i);
    if (page < pages - 2) push('…');
    if (pages > 1) push(pages);
    return result;
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
        <>
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

          {total > 0 && (
            <div className="archive-pagination">
              <span className="pagination-info">
                Страница {page} из {pages} · всего {total}
              </span>
              <div className="pagination-controls">
                <button
                  className="page-btn"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                >
                  ← Назад
                </button>
                {buildPageList().map((p, idx) =>
                  p === '…' ? (
                    <span key={`e${idx}`} className="page-ellipsis">…</span>
                  ) : (
                    <button
                      key={p}
                      className={`page-btn ${p === page ? 'active' : ''}`}
                      onClick={() => goToPage(p)}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  className="page-btn"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= pages}
                >
                  Вперёд →
                </button>
              </div>
            </div>
          )}
        </>
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
