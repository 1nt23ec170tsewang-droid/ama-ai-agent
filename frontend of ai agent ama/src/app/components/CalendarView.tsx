import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Video, MapPin, Users, Plus, Edit2, Trash2, X, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';

const getMonthDates = (offset = 0) => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0); // last day
  const daysInMonth = end.getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const isoDate = (d: Date) => {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};
const todayISO = isoDate(new Date());

const EMPTY_FORM = {
  title: '',
  time: '',
  duration: '',
  type: 'meeting',
  location: '',
  attendees: 0,
  date: todayISO,
};

export function CalendarView() {
  const { events, addEvent, updateEvent, deleteEvent } = useApp();

  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const monthDates = getMonthDates(monthOffset);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [didDrag, setDidDrag] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDown(true);
    setDidDrag(false);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };
  const handleMouseLeave = () => setIsDown(false);
  const handleMouseUp = () => setIsDown(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    if (Math.abs(walk) > 5) setDidDrag(true);
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };
  const scrollToToday = () => {
    setMonthOffset(0);
    const today = new Date();
    setSelectedDate(today);
    
    // Smoothly scroll today's date into the center of the strip
    setTimeout(() => {
      if (scrollRef.current) {
        const currentDates = getMonthDates(0);
        const todayIndex = currentDates.findIndex(d => isoDate(d) === todayISO);
        if (todayIndex !== -1) {
          const btnWidth = 80;
          const containerWidth = scrollRef.current.clientWidth;
          const targetScroll = (todayIndex * btnWidth) - (containerWidth / 2) + (btnWidth / 2);
          scrollRef.current.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
        }
      }
    }, 50);
  };

  // Scroll to today's date on initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const todayIndex = monthDates.findIndex(d => isoDate(d) === todayISO);
        if (todayIndex !== -1) {
          const btnWidth = 80;
          const containerWidth = scrollRef.current.clientWidth;
          const targetScroll = (todayIndex * btnWidth) - (containerWidth / 2) + (btnWidth / 2);
          scrollRef.current.scrollLeft = Math.max(0, targetScroll);
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const selectedISO = isoDate(selectedDate);

  const dayEvents = events.filter(e => {
    if (!e.date) return isoDate(new Date()) === selectedISO; // legacy events appear on today
    return e.date === selectedISO;
  });

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, date: selectedISO });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (event: any) => {
    setForm({
      title: event.title,
      time: event.time,
      duration: event.duration,
      type: event.type,
      location: event.location,
      attendees: event.attendees,
      date: event.date || selectedISO,
    });
    setEditingId(event.id);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) {
      // showToast('Title is required', 'error');
      return;
    }
    if (editingId) {
      updateEvent(editingId, { ...form });
      // showToast('Event updated!', 'success');
    } else {
      addEvent({ ...form });
      // showToast('Event added!', 'success');
    }
    setShowModal(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    deleteEvent(id);
    // showToast('Event deleted', 'info');
  };

  const displayDate = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // Count events per day for dots
  const eventCountForDate = (d: Date) =>
    events.filter(e => (e.date || todayISO) === isoDate(d)).length;

  return (
    <div className="p-4 md:p-8 h-full overflow-auto bg-slate-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">Calendar</h2>
              <p className="text-sm text-slate-600">{displayDate}</p>
            </div>
            <button
              id="add-event-btn"
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={scrollToToday}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium"
            >
              Today
            </button>
            <button
              onClick={() => { setMonthOffset(m => m - 1); setSelectedDate(getMonthDates(monthOffset - 1)[0]); }}
              className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setMonthOffset(m => m + 1); setSelectedDate(getMonthDates(monthOffset + 1)[0]); }}
              className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {monthOffset !== 0 && (
              <span className="text-xs text-slate-500">
                {monthOffset > 0 ? `${monthOffset} month${monthOffset > 1 ? 's' : ''} ahead` : `${Math.abs(monthOffset)} month${Math.abs(monthOffset) > 1 ? 's' : ''} ago`}
              </span>
            )}
          </div>
        </div>

        {/* Month Strip */}
        <div 
          ref={scrollRef}
          className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-x-auto select-none cursor-grab active:cursor-grabbing"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <style>{`
            .bg-white.rounded-xl.shadow-sm.border.border-slate-200.mb-6.overflow-x-auto::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          <div className="flex border-b border-slate-200" style={{ width: 'max-content' }}>
            {monthDates.map((date) => {
              const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const isSelected = isoDate(date) === selectedISO;
              const isToday = isoDate(date) === todayISO;
              const count = eventCountForDate(date);

              return (
                <button
                  key={isoDate(date)}
                  onClick={() => { if (!didDrag) setSelectedDate(date); }}
                  className={`p-2 md:p-4 text-center border-r border-slate-200 last:border-r-0 transition-colors w-20 flex-shrink-0 ${
                    isSelected ? 'bg-orange-50' : isWeekend ? 'bg-slate-50 hover:bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`text-xs mb-1 ${isWeekend ? 'text-slate-400' : 'text-slate-500'}`}>{dayStr}</div>
                  <div className={`text-lg font-semibold mx-auto flex items-center justify-center w-8 h-8 rounded-full ${
                    isSelected
                      ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white text-sm'
                      : isToday
                      ? 'border-2 border-orange-400 text-orange-600 text-sm'
                      : isWeekend ? 'text-slate-400' : 'text-slate-900'
                  }`}>
                    {date.getDate()}
                  </div>
                  {count > 0 && (
                    <div className="flex justify-center gap-0.5 mt-1">
                      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                        <div key={i} className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day Events */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Events for {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </h3>

          {dayEvents.length === 0 ? (
            <div className="text-center py-10">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No events scheduled for this day.</p>
              <button
                onClick={openAdd}
                className="mt-3 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg text-sm font-medium hover:from-amber-600 hover:to-orange-700 transition-all"
              >
                + Add Event
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {dayEvents.map(event => (
                <div
                  key={event.id}
                  className="flex flex-col md:flex-row md:items-center gap-3 p-4 border border-slate-200 rounded-lg hover:border-orange-300 hover:bg-orange-50/30 transition-all"
                >
                  <div className="md:w-24 flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-700">{event.time}</p>
                    <p className="text-xs text-slate-500">{event.duration}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-900 text-sm mb-1">{event.title}</h4>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="px-2 py-0.5 bg-slate-100 rounded capitalize">{event.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(event)}
                      className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-t-2xl sticky top-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {editingId ? 'Edit Event' : 'Add New Event'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/20 rounded-lg">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event Title *</label>
                <input
                  id="event-title-input"
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Product Review"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                  <input
                    type="text"
                    value={form.time}
                    onChange={e => setForm({ ...form, time: e.target.value })}
                    placeholder="e.g. 9:00 AM"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
                  <input
                    type="text"
                    value={form.duration}
                    onChange={e => setForm({ ...form, duration: e.target.value })}
                    placeholder="e.g. 1h"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  {['meeting', 'call', 'review', 'presentation', 'workshop', 'other'].map(t => (
                    <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  id="save-event-btn"
                  onClick={handleSave}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-medium transition-colors shadow-lg text-sm"
                >
                  {editingId ? 'Update Event' : 'Add Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
