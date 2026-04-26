import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { DOCUMENT_COLORS } from '../components/DocumentModal';
import '../styles/CreateDocument.css';

const CreateDocument = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    documentType: '',
    departments: [],
    deadline: ''
  });
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [linkInput, setLinkInput] = useState({ url: '', title: '' });
  const [docTypes, setDocTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      API.get('/documents/types'),
      API.get('/auth/departments')
    ]).then(([typesRes, deptsRes]) => {
      setDocTypes(typesRes.data);
      setDepartments(deptsRes.data);
    }).catch(() => {});
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDeptToggle = (dept) => {
    setFormData(prev => ({
      ...prev,
      departments: prev.departments.includes(dept)
        ? prev.departments.filter(d => d !== dept)
        : [...prev.departments, dept]
    }));
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    const invalid = selected.find(f => !f.name.toLowerCase().endsWith('.docx'));
    if (invalid) {
      setError('Допустимы только .docx файлы');
      return;
    }
    setFiles(prev => [...prev, ...selected]);
    setError('');
    e.target.value = '';
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const normalizeUrl = (raw) => {
    const u = String(raw || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return `https://${u}`;
  };

  const addLink = () => {
    const url = normalizeUrl(linkInput.url);
    if (!url) return;
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      setError('Некорректный URL ссылки');
      return;
    }
    setLinks(prev => [...prev, { url, title: linkInput.title.trim() }]);
    setLinkInput({ url: '', title: '' });
    setError('');
  };

  const removeLink = (idx) => {
    setLinks(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.departments.length === 0) {
      setError('Выберите хотя бы один отдел-получатель');
      return;
    }

    setIsLoading(true);

    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('description', formData.description);
      data.append('documentType', formData.documentType);
      data.append('departments', formData.departments.join(','));
      data.append('deadline', formData.deadline);
      data.append('links', JSON.stringify(links));
      files.forEach(f => data.append('files', f));

      await API.post('/documents', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess('Документ успешно создан!');
      setFormData({ title: '', description: '', documentType: '', departments: [], deadline: '' });
      setFiles([]);
      setLinks([]);
      setLinkInput({ url: '', title: '' });

      setTimeout(() => navigate('/my-documents'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка создания документа');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="create-container">
      <h1 className="page-title">Создание документа</h1>

      <div className="create-card">
        {error && <div className="create-message error">{error}</div>}
        {success && <div className="create-message success">{success}</div>}

        <form onSubmit={handleSubmit} className="create-form">
          <div className="form-group">
            <label htmlFor="title">Название документа *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Введите название документа"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Описание (опционально)</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Дополнительная информация о документе..."
              rows={4}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Тип документа *</label>
              <div className="create-type-wrapper">
                <button
                  type="button"
                  className={`create-type-btn ${!formData.documentType ? 'placeholder' : ''}`}
                  onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                >
                  {formData.documentType ? (
                    <>
                      <span className="filter-type-dot" style={{ background: DOCUMENT_COLORS[formData.documentType] }}></span>
                      <span>{formData.documentType}</span>
                    </>
                  ) : (
                    <span>Выберите тип</span>
                  )}
                  <span className="filter-arrow">{showTypeDropdown ? '▲' : '▼'}</span>
                </button>
                {showTypeDropdown && (
                  <div className="create-type-dropdown">
                    {docTypes.map(t => (
                      <label
                        key={t.name}
                        className={`filter-type-item ${formData.documentType === t.name ? 'checked' : ''}`}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, documentType: t.name }));
                          setShowTypeDropdown(false);
                        }}
                      >
                        <span className="filter-type-dot" style={{ background: t.color }}></span>
                        <span>{t.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="deadline">Срок рассмотрения *</label>
              <input
                type="datetime-local"
                id="deadline"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                required
                min={(() => {
                  const n = new Date();
                  n.setMinutes(n.getMinutes() - n.getTimezoneOffset());
                  return n.toISOString().slice(0, 16);
                })()}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Отделы-получатели * ({formData.departments.length} выбрано)</label>
            <div className="departments-checklist">
              {departments.filter(dept => dept !== 'Нет отдела').map(dept => (
                <label key={dept} className={`dept-checkbox ${formData.departments.includes(dept) ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={formData.departments.includes(dept)}
                    onChange={() => handleDeptToggle(dept)}
                  />
                  <span>{dept}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Документы (.docx) {files.length > 0 && `— выбрано: ${files.length}`}</label>
            <div className="file-upload-area">
              <input
                type="file"
                accept=".docx"
                multiple
                onChange={handleFileChange}
                id="file-input"
                className="file-input-hidden"
              />
              {files.length > 0 && (
                <div className="files-selected-list">
                  {files.map((f, idx) => (
                    <div key={idx} className="file-selected">
                      <span className="file-icon-sm">DOCX</span>
                      <span>{f.name}</span>
                      <button
                        type="button"
                        className="file-remove"
                        onClick={() => removeFile(idx)}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label htmlFor="file-input" className="file-upload-label">
                <div className="file-placeholder">
                  <span className="upload-icon">+</span>
                  <span>{files.length > 0 ? 'Добавить ещё .docx файл(ы)' : 'Нажмите для загрузки .docx файла(ов)'}</span>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Ссылки на документы (Google Docs, Office 365 и др.) {links.length > 0 && `— добавлено: ${links.length}`}</label>
            {links.length > 0 && (
              <div className="files-selected-list" style={{ marginBottom: 8 }}>
                {links.map((l, idx) => (
                  <div key={idx} className="file-selected">
                    <span className="file-icon-sm" style={{ background: '#1a73e8' }}>URL</span>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="file-link-name">
                      {l.title || l.url}
                    </a>
                    <button type="button" className="file-remove" onClick={() => removeLink(idx)}>&times;</button>
                  </div>
                ))}
              </div>
            )}
            <div className="link-add-row">
              <input
                type="url"
                placeholder="https://docs.google.com/..."
                value={linkInput.url}
                onChange={(e) => setLinkInput(prev => ({ ...prev, url: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
              />
              <input
                type="text"
                placeholder="Подпись (опционально)"
                value={linkInput.title}
                onChange={(e) => setLinkInput(prev => ({ ...prev, title: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
              />
              <button type="button" className="btn-secondary" onClick={addLink}>Добавить</button>
            </div>
          </div>

          <button type="submit" className="btn-primary btn-create" disabled={isLoading}>
            {isLoading ? 'Создание...' : 'Создать документ'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateDocument;
