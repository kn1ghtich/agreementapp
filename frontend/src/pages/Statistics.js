import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { DOCUMENT_COLORS } from '../components/DocumentModal';
import '../styles/Statistics.css';

const Statistics = () => {
  const { user } = useAuth();
  const hasDepartment = user?.department && user.department !== 'Нет отдела';
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, dateFrom, dateTo]);

  // Тихий поллинг — обновляем статистику каждые 20 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
    }, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, dateFrom, dateTo]);

  const customIncomplete = period === 'custom' && (!dateFrom || !dateTo);

  const fetchStats = async () => {
    // Для периода с пользовательскими датами ждём пока выбраны обе
    if (customIncomplete) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = {};
      if (period === 'custom') {
        params.dateFrom = dateFrom;
        params.dateTo = dateTo;
      } else {
        params.period = period;
      }
      const { data } = await API.get('/documents/stats', { params });
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Входящие': '#1a73e8', 'На рассмотрении': '#FB8C00',
      'Доработка': '#E53935', 'Согласование': '#8E24AA', 'Утверждено': '#43A047'
    };
    return colors[status] || '#666';
  };

  const maxTypeCount = stats?.byType?.length > 0 ? Math.max(...stats.byType.map(t => t.count)) : 1;

  return (
    <div className="stats-container">
      <h1 className="page-title">
        Статистика
        {hasDepartment && <span className="stats-dept-label"> — {user.department}</span>}
      </h1>

      {!hasDepartment && (
        <div className="stats-empty-state">
          У вас не назначен отдел. Статистика недоступна — обратитесь к администратору.
        </div>
      )}

      <div className="stats-filters">
        <div className="stats-period-btns">
          <button className={period === 'week' ? 'active' : ''} onClick={() => { setPeriod('week'); setDateFrom(''); setDateTo(''); }}>
            Неделя
          </button>
          <button className={period === 'month' ? 'active' : ''} onClick={() => { setPeriod('month'); setDateFrom(''); setDateTo(''); }}>
            Месяц
          </button>
          <button className={period === 'custom' ? 'active' : ''} onClick={() => setPeriod('custom')}>
            Период
          </button>
        </div>
        {period === 'custom' && (
          <div className="stats-date-range">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span>—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        )}
      </div>

      {customIncomplete ? (
        <div className="stats-empty-state">
          Выберите обе даты, чтобы увидеть статистику за период.
        </div>
      ) : loading ? (
        <div className="loading-screen">Загрузка...</div>
      ) : stats ? (
        <div className="stats-grid">
          {/* Total */}
          <div className="stats-card stats-total">
            <h3>Всего документов</h3>
            <span className="stats-big-number">{stats.total}</span>
          </div>

          {/* By status */}
          <div className="stats-card">
            <h3>По статусам</h3>
            <div className="stats-bars">
              {stats.byStatus.map(s => (
                <div key={s._id} className="stats-bar-row">
                  <span className="stats-bar-label">{s._id}</span>
                  <div className="stats-bar-track">
                    <div
                      className="stats-bar-fill"
                      style={{
                        width: `${(s.count / stats.total) * 100}%`,
                        background: getStatusColor(s._id)
                      }}
                    />
                  </div>
                  <span className="stats-bar-count">{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By type */}
          <div className="stats-card stats-wide">
            <h3>По типам документов</h3>
            <div className="stats-bars">
              {stats.byType.map(t => (
                <div key={t._id} className="stats-bar-row">
                  <span className="stats-bar-label">{t._id}</span>
                  <div className="stats-bar-track">
                    <div
                      className="stats-bar-fill"
                      style={{
                        width: `${(t.count / maxTypeCount) * 100}%`,
                        background: DOCUMENT_COLORS[t._id] || '#666'
                      }}
                    />
                  </div>
                  <span className="stats-bar-count">{t.count}</span>
                </div>
              ))}
              {stats.byType.length === 0 && <p className="stats-empty">Нет данных</p>}
            </div>
          </div>

        </div>
      ) : null}
    </div>
  );
};

export default Statistics;
