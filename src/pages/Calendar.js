import { useState, useEffect } from 'react';
import API from '../api/axios';
import DocumentModal from '../components/DocumentModal';
import { DOCUMENT_COLORS } from '../components/DocumentModal';
import '../styles/Calendar.css';

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [documents, setDocuments] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    fetchDocuments();
  }, [month, year]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/documents/calendar?month=${month + 1}&year=${year}`);
      setDocuments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const getDaysInMonth = () => new Date(year, month + 1, 0).getDate();

  const getFirstDayOfMonth = () => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const getDocsForDay = (day) => {
    return documents.filter(doc => {
      const d = new Date(doc.deadline);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  };

  const handleDocUpdate = (updatedDoc) => {
    setDocuments(prev => prev.map(d => d._id === updatedDoc._id ? updatedDoc : d));
    setSelectedDoc(updatedDoc);
  };

  const getStatusColor = (status) => {
    const colors = {
      'Входящие': '#1a73e8', 'На рассмотрении': '#FB8C00',
      'Доработка': '#E53935', 'Согласование': '#8E24AA', 'Выполнено': '#43A047'
    };
    return colors[status] || '#666';
  };

  const renderCalendarGrid = () => {
    const days = [];
    const totalDays = getDaysInMonth();
    const firstDay = getFirstDayOfMonth();

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-cell empty" />);
    }

    for (let day = 1; day <= totalDays; day++) {
      const docsForDay = getDocsForDay(day);
      const isToday = new Date().getDate() === day &&
                      new Date().getMonth() === month &&
                      new Date().getFullYear() === year;
      const isSelected = selectedDay === day;
      const dayOfWeek = new Date(year, month, day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      days.push(
        <div
          key={day}
          className={`calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${docsForDay.length > 0 ? 'has-docs' : ''} ${isWeekend ? 'weekend' : ''}`}
          onClick={() => setSelectedDay(day)}
        >
          <span className="cell-day">{day}</span>
          {docsForDay.length > 0 && (
            <div className="cell-dots">
              {docsForDay.slice(0, 4).map((doc, i) => (
                <span
                  key={i}
                  className="cell-dot"
                  style={{ background: DOCUMENT_COLORS[doc.documentType] || '#666' }}
                />
              ))}
              {docsForDay.length > 4 && <span className="cell-more">+{docsForDay.length - 4}</span>}
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  const selectedDayDocs = selectedDay ? getDocsForDay(selectedDay) : [];

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button className="cal-nav-btn" onClick={prevMonth}>&larr;</button>
        <h2>{MONTHS[month]} {year}</h2>
        <button className="cal-nav-btn" onClick={nextMonth}>&rarr;</button>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`calendar-weekday ${i >= 5 ? 'weekend' : ''}`}>{d}</div>
        ))}
        {renderCalendarGrid()}
      </div>

      {selectedDay && (
        <div className="day-details">
          <h3>{selectedDay} {MONTHS[month]} {year}</h3>
          {selectedDayDocs.length === 0 ? (
            <p className="no-docs-text">Нет документов на эту дату</p>
          ) : (
            <div className="day-docs-list">
              {selectedDayDocs.map(doc => (
                <div key={doc._id} className="day-doc-item" onClick={() => setSelectedDoc(doc)}>
                  <span
                    className="day-doc-type"
                    style={{ background: DOCUMENT_COLORS[doc.documentType] || '#666' }}
                  >
                    {doc.documentType}
                  </span>
                  <div className="day-doc-info">
                    <span className="day-doc-title">{doc.title}</span>
                    <span className="day-doc-sender">{doc.sender?.fullName}</span>
                  </div>
                  <span className="day-doc-status" style={{ background: getStatusColor(doc.status) }}>
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          )}
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

export default Calendar;
