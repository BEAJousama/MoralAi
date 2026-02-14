import React, { useState, useEffect, useMemo } from 'react';
import { createAppointment, getCounselors, getSlots, getSlotDates, type AppointmentType, type Counselor, type ProviderType, type SlotOption } from '../../services/authService';
import { Button } from '../Button';
import { Calendar, X, Loader2, CheckCircle, User, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const APPOINTMENT_TYPES: { value: AppointmentType; label: string }[] = [
  { value: 'counseling', label: 'Counseling' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'follow_up', label: 'Follow-up' },
];

interface RequestAppointmentModalProps {
  authToken: string | null;
  studentId: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RequestAppointmentModal: React.FC<RequestAppointmentModalProps> = ({
  authToken,
  studentId,
  onClose,
  onSuccess,
}) => {
  const [type, setType] = useState<AppointmentType>('counseling');
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [selectedCounselorId, setSelectedCounselorId] = useState<number | ''>('');
  const [date, setDate] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [datesWithSlots, setDatesWithSlots] = useState<string[]>([]);
  const [datesLoading, setDatesLoading] = useState(false);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!authToken) return;
    getCounselors(authToken)
      .then(setCounselors)
      .catch(() => setCounselors([]));
  }, [authToken]);

  // Counseling → only counselors. Doctor → only doctors. Follow-up → both.
  const filteredCounselors = useMemo(() => {
    if (type === 'follow_up') return counselors;
    if (type === 'doctor') return counselors.filter((c) => c.provider_type === 'doctor');
    // counseling: only counselors (include when provider_type is missing/undefined as counselor)
    if (type === 'counseling') return counselors.filter((c) => c.provider_type !== 'doctor');
    return counselors;
  }, [counselors, type]);

  // Clear preferred provider if they're not in the filtered list (e.g. switched from Doctor to Counseling)
  useEffect(() => {
    if (selectedCounselorId === '') return;
    if (!filteredCounselors.some((c) => c.id === selectedCounselorId)) setSelectedCounselorId('');
  }, [type, filteredCounselors, selectedCounselorId]);

  // Fetch which dates in the calendar month have slots (to highlight them)
  useEffect(() => {
    if (!authToken) {
      setDatesWithSlots([]);
      return;
    }
    setDatesLoading(true);
    getSlotDates(authToken, calendarMonth, {
      counselorId: selectedCounselorId === '' ? undefined : selectedCounselorId,
      type,
    })
      .then(setDatesWithSlots)
      .catch(() => setDatesWithSlots([]))
      .finally(() => setDatesLoading(false));
  }, [authToken, calendarMonth, selectedCounselorId, type]);

  // Fetch available slots when date (and counselor/type) change
  useEffect(() => {
    if (!authToken || !date) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }
    setSlotsLoading(true);
    setSelectedSlot(null);
    getSlots(authToken, date, {
      counselorId: selectedCounselorId === '' ? undefined : selectedCounselorId,
      type,
    })
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [authToken, date, selectedCounselorId, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || !selectedSlot) return;
    setError(null);
    setSubmitting(true);
    try {
      await createAppointment(authToken, {
        studentId,
        scheduledAt: selectedSlot.start,
        type,
        providerOrNotes: note.trim() || undefined,
        assignedTo: selectedSlot.counselor_id,
      });
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = new Date().toISOString().slice(0, 10);
  const datesWithSlotsSet = useMemo(() => new Set(datesWithSlots), [datesWithSlots]);

  // Clear selected date if it no longer has slots (e.g. after changing type/counselor)
  useEffect(() => {
    if (date && !datesWithSlotsSet.has(date)) setDate('');
  }, [datesWithSlotsSet, date]);

  // Build calendar grid for current month
  const calendarGrid = useMemo(() => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    const startPad = first.getDay();
    const daysInMonth = last.getDate();
    const cells: { day: number | null; dateStr: string }[] = [];
    for (let i = 0; i < startPad; i++) cells.push({ day: null, dateStr: '' });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, dateStr });
    }
    return { year: y, month: m, cells };
  }, [calendarMonth]);

  const goPrevMonth = () => {
    const [y, m] = calendarMonth.split('-').map(Number);
    if (m === 1) setCalendarMonth(`${y - 1}-12`);
    else setCalendarMonth(`${y}-${String(m - 1).padStart(2, '0')}`);
  };
  const goNextMonth = () => {
    const [y, m] = calendarMonth.split('-').map(Number);
    if (m === 12) setCalendarMonth(`${y + 1}-01`);
    else setCalendarMonth(`${y}-${String(m + 1).padStart(2, '0')}`);
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-md p-8 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <CheckCircle size={48} className="mx-auto text-sage mb-4" />
          <h3 className="text-xl font-semibold text-charcoal mb-2">Request sent</h3>
          <p className="text-gentleBlue-text text-sm">
            Your appointment request has been submitted. A counselor will be in touch. Check your notifications for updates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-charcoal flex items-center gap-2">
            <Calendar size={22} className="text-sage" />
            Request an appointment
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-charcoal rounded-full" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-gentleBlue-text">
            Choose type and provider, then pick a date and an available slot. You’ll get a confirmation in notifications.
          </p>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AppointmentType)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-charcoal focus:border-sage focus:ring-2 focus:ring-sage/20 outline-none"
            >
              {APPOINTMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1 flex items-center gap-2">
              <User size={16} className="text-sage" />
              Preferred doctor / counselor
            </label>
            <select
              value={selectedCounselorId}
              onChange={(e) => setSelectedCounselorId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-charcoal focus:border-sage focus:ring-2 focus:ring-sage/20 outline-none"
            >
              <option value="">Any available</option>
              {filteredCounselors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.username} ({(c.provider_type ?? 'counselor') === 'doctor' ? 'Doctor' : 'Counselor'})
                </option>
              ))}
            </select>
            {filteredCounselors.length === 0 && (
              <p className="text-xs text-gentleBlue-text mt-1">
                {type === 'doctor' ? 'No doctors listed yet.' : type === 'counseling' ? 'No counselors listed yet.' : 'No providers listed yet.'} Add providers in admin and set their availability.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Date – choose a highlighted day</label>
            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={goPrevMonth} className="p-1.5 rounded-lg hover:bg-gray-200 text-charcoal" aria-label="Previous month">
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm font-semibold text-charcoal">
                  {new Date(calendarGrid.year, calendarGrid.month - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                </span>
                <button type="button" onClick={goNextMonth} className="p-1.5 rounded-lg hover:bg-gray-200 text-charcoal" aria-label="Next month">
                  <ChevronRight size={20} />
                </button>
              </div>
              {datesLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-gentleBlue-text text-sm">
                  <Loader2 size={18} className="animate-spin" />
                  Loading…
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {WEEKDAYS.map((wd) => (
                      <div key={wd} className="text-center text-xs text-gray-500 py-1">
                        {wd}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {calendarGrid.cells.map((cell, i) => {
                      if (cell.day === null) {
                        return <div key={`e-${i}`} className="aspect-square" />;
                      }
                      const hasSlots = datesWithSlotsSet.has(cell.dateStr);
                      const isPast = cell.dateStr < minDate;
                      const isSelected = date === cell.dateStr;
                      const clickable = hasSlots && !isPast;
                      return (
                        <button
                          key={cell.dateStr}
                          type="button"
                          disabled={!clickable}
                          onClick={() => clickable && setDate(cell.dateStr)}
                          className={`
                            aspect-square rounded-lg text-sm font-medium transition-colors
                            ${!clickable ? 'text-gray-300 cursor-default' : 'cursor-pointer'}
                            ${hasSlots && !isPast ? 'bg-sage/20 text-charcoal hover:bg-sage/30 border border-sage/50' : ''}
                            ${!hasSlots && !isPast ? 'text-gray-400 hover:bg-gray-100' : ''}
                            ${isPast ? 'text-gray-300' : ''}
                            ${isSelected ? 'ring-2 ring-sage ring-offset-2' : ''}
                          `}
                        >
                          {cell.day}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1 flex items-center gap-2">
              <Clock size={16} className="text-sage" />
              Available slots
            </label>
            {!date ? (
              <p className="text-sm text-gentleBlue-text">Pick a date to see available slots.</p>
            ) : slotsLoading ? (
              <div className="flex items-center gap-2 text-gentleBlue-text text-sm py-2">
                <Loader2 size={18} className="animate-spin" />
                Loading slots…
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-gentleBlue-text">No slots available for this date. Try another date or another provider.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                {slots.map((slot) => (
                  <button
                    key={`${slot.start}-${slot.counselor_id}`}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                      selectedSlot?.start === slot.start && selectedSlot?.counselor_id === slot.counselor_id
                        ? 'border-sage bg-sage/10 text-charcoal font-medium'
                        : 'border-gray-200 hover:border-sage/50 text-charcoal'
                    }`}
                  >
                    {new Date(slot.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    <span className="block text-xs text-gentleBlue-text truncate">{slot.counselor_username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Prefer morning, or brief reason"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-charcoal placeholder-gray-400 focus:border-sage focus:ring-2 focus:ring-sage/20 outline-none resize-none"
              rows={2}
            />
          </div>
          {error && (
            <p className="text-sm text-warmCoral-text">{error}</p>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !selectedSlot} className="flex-1">
              {submitting ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Request appointment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
