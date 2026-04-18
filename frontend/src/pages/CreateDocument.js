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
  const [file, setFile] = useState(null);
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
    const selected = e.target.files[0];
    if (selected) {
      if (!selected.name.endsWith('.docx')) {
        setError('Допустимы только .docx файлы');
        return;
      }
      setFile(selected);
      setError('');
    }
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
      if (file) data.append('file', file);

      await API.post('/documents', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess('Документ успешно создан!');
      setFormData({ title: '', description: '', documentType: '', departments: [], deadline: '' });
      setFile(null);

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
                type="date"
                id="deadline"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Отделы-получатели * ({formData.departments.length} выбрано)</label>
            <div className="departments-checklist">
              {departments.map(dept => (
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
            <label>Документ (.docx)</label>
            <div className="file-upload-area">
              <input
                type="file"
                accept=".docx"
                onChange={handleFileChange}
                id="file-input"
                className="file-input-hidden"
              />
              <label htmlFor="file-input" className="file-upload-label">
                {file ? (
                  <div className="file-selected">
                    <span className="file-icon-sm">DOCX</span>
                    <span>{file.name}</span>
                    <button type="button" className="file-remove" onClick={(e) => { e.preventDefault(); setFile(null); }}>
                      &times;
                    </button>
                  </div>
                ) : (
                  <div className="file-placeholder">
                    <span className="upload-icon">+</span>
                    <span>Нажмите для загрузки .docx файла</span>
                  </div>
                )}
              </label>
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
