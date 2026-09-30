import { useEffect, useState, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import api from '../api';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

/* ── constants ────────────────────────────────────────────────── */
// Predefined 1-hour slots staff can mark as available
const PREDEFINED_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
];

const SERVICE_TYPES = ['Websites', 'Cyber Essentials'];

const STAFF_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];
function staffColor(userId) {
  return STAFF_COLORS[(userId ?? 0) % STAFF_COLORS.length];
}

/* ── helpers ─────────────────────────────────────────────────── */
function toYMD(dateInput) {
  const d = new Date(dateInput);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addOneHour(t) {
  const [h, min] = t.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function fmtRange(start, end) {
  return `${start} – ${end || addOneHour(start)}`;
}

const emptyBookForm = {
  clientName: '', clientPhone: '', clientEmail: '',
  notes: '', serviceType: '',
};

/* ══════════════════════════════════════════════════════════════ */
export default function MeetingsPage() {
  const { user: me } = useAuth();
  const calRef = useRef(null);

  const [slots, setSlots]       = useState([]);   // AvailableSlot[] for the month
  const [meetings, setMeetings] = useState([]);   // Meeting[] for the month
  const [currentMonth, setCurrentMonth] = useState(() => monthKey(new Date()));

  // Day panel
  const [dayOpen, setDayOpen]     = useState(false);
  const [dayDate, setDayDate]     = useState('');       // "YYYY-MM-DD"
  const [daySlots, setDaySlots]   = useState([]);       // slots for selected day
  const [dayLoading, setDayLoading] = useState(false);

  // Booking (inside day panel for sales, or sales sub-step)
  const [bookingSlot, setBookingSlot] = useState(null); // the AvailableSlot to book
  const [bookForm, setBookForm]       = useState(emptyBookForm);
  const [bookSaving, setBookSaving]   = useState(false);

  // Meeting detail
  const [detailMeeting, setDetailMeeting]   = useState(null);
  const [detailOpen, setDetailOpen]         = useState(false);
  const [detailDeleting, setDetailDeleting] = useState(false);

  // Edit
  const [editOpen, setEditOpen]   = useState(false);
  const [editForm, setEditForm]   = useState(emptyBookForm);
  const [editSaving, setEditSaving] = useState(false);

  // Sales: filter by specific staff member
  const [salesStaffFilter, setSalesStaffFilter] = useState('');
  const [allStaff, setAllStaff]                 = useState([]);

  /* ── data loading ─────────────────────────────────────────── */
  const loadMonth = useCallback(async (month) => {
    try {
      const [sRes, mRes] = await Promise.all([
        api.get('/meetings/available-slots', { params: { month } }),
        api.get('/meetings',                 { params: { month } }),
      ]);
      setSlots(Array.isArray(sRes.data) ? sRes.data : []);
      setMeetings(Array.isArray(mRes.data) ? mRes.data : []);
    } catch {
      toast.error('Failed to load meeting data');
    }
  }, []);

  useEffect(() => { loadMonth(currentMonth); }, [currentMonth, loadMonth]);

  // Load staff/admin users for the sales assignee selector
  useEffect(() => {
    api.get('/users').then((r) => {
      setAllStaff((Array.isArray(r.data) ? r.data : []).filter((u) => u.role === 'staff' || u.role === 'admin'));
    }).catch(() => {});
  }, []);

  const loadDaySlots = useCallback(async (date) => {
    setDayLoading(true);
    try {
      const res = await api.get('/meetings/available-slots', { params: { date } });
      setDaySlots(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Failed to load day slots');
    } finally {
      setDayLoading(false);
    }
  }, []);

  /* ── derived helpers ──────────────────────────────────────── */
  // My slots on dayDate
  const myDaySlots = daySlots.filter((s) => s.userId === me?.id);
  const myDayStartTimes = new Set(myDaySlots.map((s) => s.startTime));

  // Staff with ≥1 free (unbooked) slot on dayDate grouped by user
  const staffWithFreeSlots = (() => {
    const map = new Map();
    daySlots
      .filter((s) => !s.meeting) // free only
      .forEach((s) => {
        if (!map.has(s.userId)) map.set(s.userId, { user: s.user, freeSlots: [] });
        map.get(s.userId).freeSlots.push(s);
      });
    return [...map.values()];
  })();

  /* ── calendar events ──────────────────────────────────────── */
  const events = [];

  // Background highlight: one event per day that has any slots
  const daySet = new Map(); // YYYY-MM-DD → { mine: bool }
  slots.forEach((s) => {
    const ymd = toYMD(s.date);
    const entry = daySet.get(ymd) || { mine: false };
    if (s.userId === me?.id) entry.mine = true;
    daySet.set(ymd, entry);
  });
  daySet.forEach(({ mine }, ymd) => {
    events.push({
      id: `bg-${ymd}`,
      start: ymd,
      allDay: true,
      display: 'background',
      backgroundColor: mine ? '#166534' : '#1e3a5f',
    });
  });

  // Meeting events
  meetings.forEach((m) => {
    const color = staffColor(m.staffUserId);
    const timeLabel = m.startTime ? `${m.startTime} · ` : '';
    events.push({
      id: `meet-${m.id}`,
      title: `${timeLabel}${m.clientName}`,
      start: toYMD(m.date),
      allDay: true,
      backgroundColor: color,
      borderColor: color,
      textColor: '#fff',
      extendedProps: { type: 'meeting', meeting: m },
    });
  });

  /* ── handlers ─────────────────────────────────────────────── */
  const handleDatesSet = useCallback((info) => {
    const mid = new Date((info.start.getTime() + info.end.getTime()) / 2);
    setCurrentMonth(monthKey(mid));
  }, []);

  const handleDateClick = useCallback(async (info) => {
    setDayDate(info.dateStr);
    setBookingSlot(null);
    setBookForm(emptyBookForm);
    setSalesStaffFilter('');
    setDayOpen(true);
    await loadDaySlots(info.dateStr);
  }, [loadDaySlots]);

  const handleEventClick = useCallback((info) => {
    const { type, meeting } = info.event.extendedProps;
    if (type !== 'meeting') return;
    setDetailMeeting(meeting);
    setDetailOpen(true);
  }, []);

  // Staff toggles a time slot on/off
  const toggleSlot = async (startTime) => {
    const existing = myDaySlots.find((s) => s.startTime === startTime);
    if (existing) {
      if (existing.meeting) {
        toast('This slot has a meeting booked — delete the meeting first', { icon: 'ℹ️' });
        return;
      }
      try {
        await api.delete(`/meetings/available-slots/${existing.id}`);
        toast.success(`${startTime} removed`);
        await Promise.all([loadDaySlots(dayDate), loadMonth(currentMonth)]);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to remove slot');
      }
    } else {
      try {
        await api.post('/meetings/available-slots', { date: dayDate, startTime });
        toast.success(`${startTime} added`);
        await Promise.all([loadDaySlots(dayDate), loadMonth(currentMonth)]);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to add slot');
      }
    }
  };

  // Sales selects a slot to book
  const selectSlotToBook = (slot) => {
    setBookingSlot(slot);
    setBookForm(emptyBookForm);
  };

  // Staff/admin books a meeting on their own free slot
  const openStaffBooking = (slot) => {
    setBookingSlot(slot);
    setBookForm(emptyBookForm);
  };

  const handleBookSubmit = async (e) => {
    e.preventDefault();
    if (!bookForm.clientName.trim()) return toast.error('Client name is required');
    if (!bookForm.serviceType)       return toast.error('Please select a service type');
    setBookSaving(true);
    try {
      await api.post('/meetings', {
        slotId:      bookingSlot.id,
        clientName:  bookForm.clientName.trim(),
        clientPhone: bookForm.clientPhone.trim() || null,
        clientEmail: bookForm.clientEmail.trim() || null,
        notes:       bookForm.notes.trim() || null,
        serviceType: bookForm.serviceType,
      });
      toast.success('Meeting booked!');
      setBookingSlot(null);
      setDayOpen(false);
      await Promise.all([loadDaySlots(dayDate), loadMonth(currentMonth)]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to book meeting');
    } finally {
      setBookSaving(false);
    }
  };

  const handleDeleteMeeting = async () => {
    setDetailDeleting(true);
    try {
      await api.delete(`/meetings/${detailMeeting.id}`);
      toast.success('Meeting deleted');
      setDetailOpen(false);
      setDetailMeeting(null);
      loadMonth(currentMonth);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    } finally {
      setDetailDeleting(false);
    }
  };

  const openEdit = () => {
    setEditForm({
      clientName:  detailMeeting.clientName,
      clientPhone: detailMeeting.clientPhone || '',
      clientEmail: detailMeeting.clientEmail || '',
      notes:       detailMeeting.notes || '',
      serviceType: detailMeeting.serviceType,
    });
    setDetailOpen(false);
    setEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.clientName.trim()) return toast.error('Client name is required');
    if (!editForm.serviceType)       return toast.error('Service type is required');
    setEditSaving(true);
    try {
      await api.put(`/meetings/${detailMeeting.id}`, {
        clientName:  editForm.clientName.trim(),
        clientPhone: editForm.clientPhone.trim() || null,
        clientEmail: editForm.clientEmail.trim() || null,
        notes:       editForm.notes.trim() || null,
        serviceType: editForm.serviceType,
      });
      toast.success('Meeting updated');
      setEditOpen(false);
      setDetailMeeting(null);
      loadMonth(currentMonth);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  };

  const canModify = (m) => me?.role === 'admin' || m?.createdBy === me?.id;
  const isSales   = me?.role === 'sales';
  const isStaff   = me?.role === 'staff' || me?.role === 'admin';

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meetings Calendar</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {isSales
              ? 'Click a highlighted day to book a meeting. Use the staff selector to assign to a specific team member.'
              : 'Click any day to manage your available time slots. Use the 🗓 icon on a slot to book a client meeting directly.'}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-400">
        {!isSales && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-green-900 opacity-80 inline-block" />
            Your available days
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-blue-900 opacity-80 inline-block" />
          {isSales ? 'Staff available' : 'Others available'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-indigo-500 inline-block" />
          Booked meetings
        </span>
      </div>

      {/* Calendar */}
      <div className="rounded-xl border border-gray-800 bg-surface p-4">
        <style>{`
          .fc .fc-daygrid-day-number { color: #94a3b8; font-size: 0.75rem; }
          .fc .fc-col-header-cell-cushion { color: #64748b; font-size: 0.75rem; text-transform: uppercase; }
          .fc-theme-standard td, .fc-theme-standard th { border-color: #1f2937; }
          .fc-theme-standard .fc-scrollgrid { border-color: #1f2937; }
          .fc .fc-daygrid-day.fc-day-today { background: rgba(99,102,241,0.08); }
          .fc .fc-button { background: #1f2937; border: 1px solid #374151; color: #e2e8f0; font-size: 0.75rem; padding: 0.35rem 0.75rem; border-radius: 0.5rem; }
          .fc .fc-button:hover { background: #374151; }
          .fc .fc-button-primary:not(:disabled).fc-button-active { background: #4f46e5; border-color: #4338ca; }
          .fc .fc-toolbar-title { color: #f1f5f9; font-size: 1rem; font-weight: 600; }
          .fc .fc-daygrid-event { font-size: 0.68rem; border-radius: 4px; padding: 1px 4px; cursor: pointer; }
          .fc .fc-bg-event { opacity: 0.25; }
          .fc .fc-daygrid-day-frame { cursor: pointer; }
        `}</style>
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          events={events}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          height="auto"
          dayMaxEvents={3}
        />
      </div>

      {/* ── Day Panel Modal ─────────────────────────────────────── */}
      <Modal
        open={dayOpen}
        onClose={() => { setDayOpen(false); setBookingSlot(null); setSalesStaffFilter(''); }}
        title={dayDate}
        wide
      >
        {dayLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* ── STAFF / ADMIN: slot manager ── */}
            {isStaff && !bookingSlot && (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  Click a time slot to toggle your availability. Booked slots cannot be removed.
                </p>

                {/* My slot grid */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Your time slots
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {PREDEFINED_SLOTS.map((start) => {
                      const mySlot = myDaySlots.find((s) => s.startTime === start);
                      const booked = !!mySlot?.meeting;
                      const active = myDayStartTimes.has(start);
                      return (
                        <div key={start} className="relative">
                        <button
                          onClick={() => toggleSlot(start)}
                          title={booked ? `Booked: ${mySlot.meeting.clientName}` : (active ? 'Click to remove slot' : 'Click to add slot')}
                          className={`relative w-full rounded-lg border px-3 py-2.5 text-center text-xs font-medium transition
                            ${active && !booked
                              ? 'border-green-600 bg-green-900/30 text-green-300'
                              : active && booked
                              ? 'border-green-700 bg-green-900/20 text-green-400 cursor-not-allowed'
                              : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                            }`}
                        >
                          {fmtRange(start, addOneHour(start))}
                          {booked && (
                            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[9px] text-black">
                              ✓
                            </span>
                          )}
                        </button>
                        {/* Calendar icon — lets staff book a meeting on their free slot */}
                        {active && !booked && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openStaffBooking(mySlot); }}
                            title="Book a meeting on this slot"
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white shadow-md hover:bg-brand-700 z-10"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                            </svg>
                          </button>
                        )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Other staff on this day (for context / admin) */}
                {daySlots.filter((s) => s.userId !== me?.id).length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Other staff available this day
                    </p>
                    <div className="space-y-1">
                      {(() => {
                        const others = new Map();
                        daySlots
                          .filter((s) => s.userId !== me?.id)
                          .forEach((s) => {
                            if (!others.has(s.userId)) others.set(s.userId, { user: s.user, slots: [] });
                            others.get(s.userId).slots.push(s);
                          });
                        return [...others.values()].map(({ user, slots: ss }) => (
                          <div key={user.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: staffColor(user.id) }}
                            />
                            <span className="text-sm font-medium text-gray-300 mr-2">{user.name}</span>
                            {ss.map((s) => (
                              <span
                                key={s.id}
                                className={`rounded px-2 py-0.5 text-xs ${
                                  s.meeting
                                    ? 'bg-gray-700 text-gray-500 line-through'
                                    : 'bg-gray-800 text-gray-300'
                                }`}
                              >
                                {fmtRange(s.startTime, s.endTime)}
                                {s.meeting && ' (booked)'}
                              </span>
                            ))}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SALES: slot picker ── */}
            {isSales && !bookingSlot && (
              <div className="space-y-4">
                {/* Staff member filter */}
                {allStaff.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-400">Assign to staff member</label>
                    <select
                      value={salesStaffFilter}
                      onChange={(e) => setSalesStaffFilter(e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-brand-500 focus:outline-none"
                    >
                      <option value="">All available staff</option>
                      {allStaff.map((s) => (
                        <option key={s.id} value={String(s.id)}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {(() => {
                  const filtered = salesStaffFilter
                    ? staffWithFreeSlots.filter((sw) => String(sw.user.id) === salesStaffFilter)
                    : staffWithFreeSlots;
                  return filtered.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-500">
                      {salesStaffFilter
                        ? 'This staff member has no available time slots on this day.'
                        : 'No staff members have available time slots on this day.'}
                    </p>
                  ) : (
                  <>
                    <p className="text-sm text-gray-400">
                      Select an available time slot to book a meeting.
                    </p>
                    {filtered.map(({ user, freeSlots }) => (
                      <div key={user.id}>
                        <div className="mb-2 flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: staffColor(user.id) }}
                          />
                          <span className="text-sm font-semibold text-gray-200">{user.name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {freeSlots.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => selectSlotToBook(s)}
                              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-center text-xs font-medium text-gray-300 transition hover:border-brand-500 hover:bg-brand-600/10 hover:text-brand-300"
                            >
                              {fmtRange(s.startTime, s.endTime)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                  );
                })()}
              </div>
            )}

            {/* ── Booking form (sales, after picking a slot) ── */}
            {bookingSlot && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-brand-700 bg-brand-900/20 px-4 py-3">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ background: staffColor(bookingSlot.userId) }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-brand-300">
                      {bookingSlot.userId === me?.id ? 'Your slot' : bookingSlot.user?.name} — {fmtRange(bookingSlot.startTime, bookingSlot.endTime)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {dayDate}
                      {bookingSlot.userId === me?.id && ' · You are booking a meeting on your own slot'}
                    </p>
                  </div>
                  <button
                    onClick={() => setBookingSlot(null)}
                    className="ml-auto text-xs text-gray-500 hover:text-gray-300"
                  >
                    ← Back
                  </button>
                </div>

                <form onSubmit={handleBookSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-400">Client Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="Full name"
                      value={bookForm.clientName}
                      onChange={(e) => setBookForm((f) => ({ ...f, clientName: e.target.value }))}
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-400">Phone</label>
                      <input
                        type="tel"
                        placeholder="+44 7700 000000"
                        value={bookForm.clientPhone}
                        onChange={(e) => setBookForm((f) => ({ ...f, clientPhone: e.target.value }))}
                        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-400">Email</label>
                      <input
                        type="email"
                        placeholder="client@example.com"
                        value={bookForm.clientEmail}
                        onChange={(e) => setBookForm((f) => ({ ...f, clientEmail: e.target.value }))}
                        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-400">Service Type *</label>
                    <div className="flex gap-3">
                      {SERVICE_TYPES.map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setBookForm((f) => ({ ...f, serviceType: st }))}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                            bookForm.serviceType === st
                              ? 'border-brand-500 bg-brand-600/20 text-brand-300'
                              : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-400">Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Any details about the meeting…"
                      value={bookForm.notes}
                      onChange={(e) => setBookForm((f) => ({ ...f, notes: e.target.value }))}
                      className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setBookingSlot(null)}
                      className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={bookSaving}
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {bookSaving ? 'Booking…' : 'Confirm Booking'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ── Meeting Detail Modal ─────────────────────────────── */}
      <Modal
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailMeeting(null); }}
        title="Meeting Details"
      >
        {detailMeeting && (
          <div className="space-y-3">
            <DetailRow label="Date"         value={toYMD(detailMeeting.date)} />
            <DetailRow
              label="Time"
              value={
                detailMeeting.startTime
                  ? fmtRange(detailMeeting.startTime, detailMeeting.endTime)
                  : '—'
              }
            />
            <DetailRow label="Staff Member" value={detailMeeting.staffUser?.name ?? '—'} />
            <DetailRow label="Client"       value={detailMeeting.clientName} />
            <DetailRow label="Phone"        value={detailMeeting.clientPhone || '—'} />
            <DetailRow label="Email"        value={detailMeeting.clientEmail || '—'} />
            <DetailRow label="Service"      value={detailMeeting.serviceType} />
            {detailMeeting.notes && (
              <div>
                <p className="mb-1 text-xs font-medium text-gray-400">Notes</p>
                <p className="rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm text-gray-200 whitespace-pre-wrap">
                  {detailMeeting.notes}
                </p>
              </div>
            )}
            <DetailRow label="Booked By"    value={detailMeeting.bookedBy?.name ?? 'Unknown'} />

            {canModify(detailMeeting) && (
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleDeleteMeeting}
                  disabled={detailDeleting}
                  className="rounded-lg border border-red-700 px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 disabled:opacity-50"
                >
                  {detailDeleting ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  onClick={openEdit}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Edit Meeting Modal ───────────────────────────────── */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Meeting"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Client Name *</label>
            <input
              required
              type="text"
              value={editForm.clientName}
              onChange={(e) => setEditForm((f) => ({ ...f, clientName: e.target.value }))}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Phone</label>
              <input
                type="tel"
                value={editForm.clientPhone}
                onChange={(e) => setEditForm((f) => ({ ...f, clientPhone: e.target.value }))}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Email</label>
              <input
                type="email"
                value={editForm.clientEmail}
                onChange={(e) => setEditForm((f) => ({ ...f, clientEmail: e.target.value }))}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Service Type *</label>
            <div className="flex gap-3">
              {SERVICE_TYPES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setEditForm((f) => ({ ...f, serviceType: st }))}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    editForm.serviceType === st
                      ? 'border-brand-500 bg-brand-600/20 text-brand-300'
                      : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Notes</label>
            <textarea
              rows={3}
              value={editForm.notes}
              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSaving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-28 shrink-0 text-xs font-medium text-gray-400">{label}</span>
      <span className="text-sm text-gray-200">{value}</span>
    </div>
  );
}

