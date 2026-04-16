import { useState, useEffect } from 'react';
import API from '../api/axios';
import { DOCUMENT_COLORS } from '../components/DocumentModal';
import '../styles/Statistics.css';

const Statistics = () => {
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [period, dateFrom, dateTo]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = {};
      if (period === 'custom' && dateFrom && dateTo) {
        params.dateFrom = dateFrom;
        params.dateTo = dateTo;
      } else if (period !== 'custom') {
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
  const maxDeptCount = stats?.byDepartment?.length > 0 ? Math.max(...stats.byDepartment.map(d => d.count)) : 1;

  return (
    <div className="stats-container">
      <h1 className="page-title">Статистика</h1>

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

      {loading ? (
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

          {/* By department */}
          <div className="stats-card stats-wide">
            <h3>По отделам-получателям</h3>
            <div className="stats-bars">
              {stats.byDepartment.map(d => (
                <div key={d._id} className="stats-bar-row">
                  <span className="stats-bar-label">{d._id}</span>
                  <div className="stats-bar-track">
                    <div
                      className="stats-bar-fill"
                      style={{
                        width: `${(d.count / maxDeptCount) * 100}%`,
                        background: '#1a73e8'
                      }}
                    />
                  </div>
                  <span className="stats-bar-count">{d.count}</span>
                </div>
              ))}
              {stats.byDepartment.length === 0 && <p className="stats-empty">Нет данных</p>}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Statistics;
