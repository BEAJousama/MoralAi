import React, { useState, useEffect } from 'react';
import { getAppointments, updateAppointment, getAvailability, setAvailability, type Appointment, type AvailabilityWindow } from '../../services/authService';
import { Card } from '../Card';
import { Button } from '../Button';
import { Calendar, Clock, User, Loader2, LogOut, CheckCircle, XCircle, FileText, UserPlus, Pencil, Settings2 } from 'lucide-react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface CounselorDashboardProps {
  authToken: string | null;
  counselorId?: number;
  onLogout: () => void;
}

type OutcomeAction = 'completed' | 'no_show';

export const CounselorDashboard: React.FC<CounselorDashboardProps> = ({ authToken, counselorId, onLogout }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(!!authToken);
  const [outcomeModal, setOutcomeModal] = useState<{ appointment: Appointment; action: OutcomeAction } | null>(null);
  const [rescheduleModal, setRescheduleModal] = useState<Appointment | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [reportText, setReportText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [declinedIds, setDeclinedIds] = useState<Set<number>>(new Set());
  const [availability, setAvailabilityState] = useState<Record<number, { start: string; end: string }>>({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);

  const load = () => {
    if (!authToken) return;
    setLoading(true);
    getAppointments(authToken)
      .then(setAppointments)
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [authToken]);

  const loadAvailability = () => {
    if (!authToken) return;
    setAvailabilityLoading(true);
    getAvailability(authToken)
      .then((windows) => {
        const byDay: Record<number, { start: string; end: string }> = {};
        windows.forEach((w) => {
          byDay[w.day_of_week] = { start: w.start_time.slice(0, 5), end: w.end_time.slice(0, 5) };
        });
        setAvailabilityState(byDay);
      })
      .catch(() => setAvailabilityState({}))
      .finally(() => setAvailabilityLoading(false));
  };

  useEffect(() => {
    loadAvailability();
  }, [authToken]);

  const handleSaveAvailability = async () => {
    if (!authToken) return;
    const windows: AvailabilityWindow[] = [];
    (Object.entries(availability) as [string, { start: string; end: string }][]).forEach(([dayStr, range]) => {
      const day = Number(dayStr);
      if (range.start && range.end && day >= 0 && day <= 6) windows.push({ day_of_week: day, start_time: range.start, end_time: range.end });
    });
    setAvailabilitySaving(true);
    try {
      await setAvailability(authToken, windows);
      loadAvailability();
    } catch {
      // could show error
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const setDayAvailability = (day: number, field: 'start' | 'end', value: string) => {
    setAvailabilityState((prev) => ({
      ...prev,
      [day]: { start: prev[day]?.start ?? '09:00', end: prev[day]?.end ?? '17:00', ...prev[day], [field]: value },
    }));
  };

  const openOutcomeModal = (a: Appointment, action: OutcomeAction) => {
    if (a.status !== 'scheduled') return;
    setOutcomeModal({ appointment: a, action });
    setReportText('');
  };

  const handleSubmitOutcome = async () => {
    if (!authToken || !outcomeModal) return;
    setSubmitting(true);
    try {
      await updateAppointment(authToken, outcomeModal.appointment.id, {
        status: outcomeModal.action,
        counselor_report: reportText.trim() || undefined,
      });
      setOutcomeModal(null);
      setReportText('');
      load();
    } catch {
      // could show error toast
    } finally {
      setSubmitting(false);
    }
  };

  const now = new Date().toISOString();
  const pendingRequests = appointments.filter(
    (a) => a.status === 'scheduled' && a.assigned_to == null && a.scheduled_at >= now && !declinedIds.has(a.id)
  );
  const myUpcoming = appointments.filter((a) => a.status === 'scheduled' && a.assigned_to != null && a.scheduled_at >= now);
  const past = appointments.filter((a) => a.status !== 'scheduled' || a.scheduled_at < now);

  const handleAccept = async (a: Appointment) => {
    if (!authToken || counselorId == null) return;
    setAcceptingId(a.id);
    try {
      await updateAppointment(authToken, a.id, { assigned_to: counselorId });
      load();
    } catch {
      // could show error
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDecline = (a: Appointment) => {
    setDeclinedIds((prev) => new Set(prev).add(a.id));
  };

  const handleRescheduleSubmit = async () => {
    if (!authToken || !rescheduleModal || !rescheduleAt.trim()) return;
    setSubmitting(true);
    try {
      await updateAppointment(authToken, rescheduleModal.id, {
        scheduled_at: new Date(rescheduleAt).toISOString(),
      });
      setRescheduleModal(null);
      load();
    } catch {
      // could show error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar size={24} className="text-sage shrink-0" />
            <span className="text-base sm:text-xl font-bold text-charcoal truncate">Counselor dashboard</span>
          </div>
          <button
            onClick={onLogout}
            className="text-sm font-medium text-gentleBlue-text hover:text-warmCoral-text flex items-center gap-1.5 shrink-0 py-2 px-1"
          >
            <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8">
        <p className="text-gentleBlue-text">
          Accept requests, reschedule, or mark appointments done. Your report is sent to the student only.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-gentleBlue-text">
            <Loader2 size={24} className="animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            <Card className="!p-4 sm:!p-6">
              <h2 className="font-semibold text-base sm:text-lg text-charcoal mb-3 sm:mb-4 flex items-center gap-2">
                <Settings2 size={20} className="text-sage" />
                My weekly availability
              </h2>
              <p className="text-sm text-gentleBlue-text mb-3">Set when you’re available for 30‑min slots. Students will only see these times when booking.</p>
              {availabilityLoading ? (
                <div className="flex items-center gap-2 text-gentleBlue-text text-sm py-2">
                  <Loader2 size={18} className="animate-spin" />
                  Loading…
                </div>
              ) : (
                <div className="space-y-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <div key={day} className="flex flex-wrap items-center gap-2 py-1">
                      <span className="w-24 text-sm text-charcoal shrink-0">{DAY_NAMES[day]}</span>
                      <input
                        type="time"
                        value={availability[day]?.start ?? ''}
                        onChange={(e) => setDayAvailability(day, 'start', e.target.value)}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                      />
                      <span className="text-gray-400 text-sm">–</span>
                      <input
                        type="time"
                        value={availability[day]?.end ?? ''}
                        onChange={(e) => setDayAvailability(day, 'end', e.target.value)}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                      />
                      <span className="text-xs text-gray-400">(leave empty = unavailable)</span>
                    </div>
                  ))}
                  <Button size="sm" onClick={handleSaveAvailability} disabled={availabilitySaving} className="mt-2">
                    {availabilitySaving ? <Loader2 size={16} className="animate-spin" /> : 'Save availability'}
                  </Button>
                </div>
              )}
            </Card>

            {pendingRequests.length > 0 && (
              <Card className="!p-4 sm:!p-6">
                <h2 className="font-semibold text-base sm:text-lg text-charcoal mb-3 sm:mb-4 flex items-center gap-2">
                  <UserPlus size={20} className="text-sage" />
                  Pending requests
                </h2>
                <p className="text-sm text-gentleBlue-text mb-3">Students requested an appointment. Accept to assign yourself.</p>
                <ul className="space-y-3">
                  {pendingRequests.map((a) => (
                    <li key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="min-w-0">
                        <p className="font-medium text-charcoal text-sm">
                          {new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
                        </p>
                        <p className="text-sm text-gentleBlue-text">{a.student_username ?? `Student #${a.student_id}`}</p>
                        <p className="text-xs text-gray-500 capitalize">{a.type}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleAccept(a)}
                          disabled={acceptingId === a.id || counselorId == null}
                        >
                          {acceptingId === a.id ? <Loader2 size={16} className="animate-spin" /> : 'Accept'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDecline(a)}
                          disabled={acceptingId === a.id}
                        >
                          Decline
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="!p-4 sm:!p-6">
              <h2 className="font-semibold text-base sm:text-lg text-charcoal mb-3 sm:mb-4">My upcoming</h2>
              {myUpcoming.length === 0 ? (
                <p className="text-sm text-gentleBlue-text">No upcoming appointments assigned to you.</p>
              ) : (
                <ul className="space-y-3 sm:space-y-4">
                  {myUpcoming.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 sm:p-4 rounded-xl bg-cream-light border border-gray-100"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-charcoal text-sm sm:text-base">
                          {new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
                        </p>
                        <p className="text-sm text-gentleBlue-text flex items-center gap-1 mt-1">
                          <User size={14} className="shrink-0" />
                          <span className="truncate">{a.student_username ?? `Student #${a.student_id}`}</span>
                        </p>
                        <p className="text-xs text-gray-500 capitalize mt-0.5">{a.type}</p>
                        {a.location && (
                          <p className="text-xs text-gentleBlue-text mt-0.5">{a.location}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => { setRescheduleModal(a); setRescheduleAt(new Date(a.scheduled_at).toISOString().slice(0, 16)); }}
                          disabled={!!rescheduleModal}
                          className="flex items-center gap-1"
                        >
                          <Pencil size={14} />
                          Reschedule
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openOutcomeModal(a, 'completed')}
                          disabled={!!outcomeModal}
                          className="w-full sm:w-auto"
                        >
                          <CheckCircle size={16} className="mr-1" />
                          Done
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openOutcomeModal(a, 'no_show')}
                          disabled={!!outcomeModal}
                          className="w-full sm:w-auto border-amber-risk text-amber-text hover:bg-amber-bg"
                        >
                          <XCircle size={16} className="mr-1" />
                          Missed
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {past.length > 0 && (
              <Card className="!p-4 sm:!p-6">
                <h2 className="font-semibold text-base sm:text-lg text-charcoal mb-3 sm:mb-4">Past</h2>
                <ul className="space-y-3">
                  {past.slice(0, 20).map((a) => (
                    <li key={a.id} className="flex items-center gap-3 py-2 text-sm text-gentleBlue-text">
                      <Clock size={14} />
                      {new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                      <span className="text-charcoal">{a.student_username ?? `#${a.student_id}`}</span>
                      <span className="capitalize text-gray-500">{a.status}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}

        {rescheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40" onClick={() => !submitting && setRescheduleModal(null)}>
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold text-lg text-charcoal mb-4">Reschedule</h3>
              <p className="text-sm text-gentleBlue-text mb-2">{rescheduleModal.student_username ?? `Student #${rescheduleModal.student_id}`}</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-charcoal mb-1">New date & time</label>
                <input
                  type="datetime-local"
                  value={rescheduleAt}
                  onChange={(e) => setRescheduleAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-sage focus:ring-2 focus:ring-sage/20 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => !submitting && setRescheduleModal(null)} disabled={submitting}>Cancel</Button>
                <Button onClick={handleRescheduleSubmit} disabled={submitting || !rescheduleAt.trim()}>
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {outcomeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40" onClick={() => !submitting && setOutcomeModal(null)}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold text-lg text-charcoal mb-1">
                {outcomeModal.action === 'completed' ? 'Mark as done' : 'Mark as missed'}
              </h3>
              <p className="text-sm text-gentleBlue-text mb-4">
                {outcomeModal.appointment.student_username ?? `Student #${outcomeModal.appointment.student_id}`} · {new Date(outcomeModal.appointment.scheduled_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-charcoal mb-2 flex items-center gap-2">
                  <FileText size={16} className="text-sage" />
                  Report (optional) – sent to the student only
                </label>
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="e.g. Student attended, discussed coping strategies. Follow-up in 2 weeks."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm min-h-[100px] resize-y"
                  maxLength={2000}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => !submitting && setOutcomeModal(null)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={handleSubmitOutcome} disabled={submitting}>
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : outcomeModal.action === 'completed' ? 'Mark done' : 'Mark missed'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
