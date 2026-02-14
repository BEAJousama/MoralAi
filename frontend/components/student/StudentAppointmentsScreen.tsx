import React, { useState, useEffect } from 'react';
import { getAppointments, updateAppointment, type Appointment } from '../../services/authService';
import { Card } from '../Card';
import { Button } from '../Button';
import { Calendar, ArrowLeft, Clock, User, Pencil, Trash2, Loader2 } from 'lucide-react';

interface StudentAppointmentsScreenProps {
  authToken: string | null;
  onBack: () => void;
}

export const StudentAppointmentsScreen: React.FC<StudentAppointmentsScreenProps> = ({ authToken, onBack }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(!!authToken);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const now = new Date().toISOString();
  const scheduled = appointments.filter((a) => a.status === 'scheduled' && a.scheduled_at >= now);
  const past = appointments.filter((a) => a.status !== 'scheduled' || a.scheduled_at < now);

  const openReschedule = (a: Appointment) => {
    setEditingId(a.id);
    setRescheduleAt(new Date(a.scheduled_at).toISOString().slice(0, 16));
    setError(null);
  };

  const handleReschedule = async () => {
    if (!authToken || editingId == null || !rescheduleAt.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateAppointment(authToken, editingId, {
        scheduled_at: new Date(rescheduleAt).toISOString(),
      });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reschedule');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (a: Appointment) => {
    if (!authToken || a.status !== 'scheduled') return;
    if (!window.confirm('Cancel this appointment? You can request a new one anytime.')) return;
    try {
      await updateAppointment(authToken, a.id, { status: 'cancelled' });
      load();
    } catch {
      // could show error
    }
  };

  return (
    <div className="min-h-screen bg-cream-bg">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-charcoal hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-charcoal flex items-center gap-2">
            <Calendar size={24} className="text-sage" />
            My appointments
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gentleBlue-text">
            <Loader2 size={24} className="animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            <p className="text-sm text-gentleBlue-text mb-6">
              View, reschedule, or cancel your appointments. You’ll get updates in notifications.
            </p>

            {scheduled.length === 0 && past.length === 0 && (
              <Card className="!p-8 text-center">
                <Calendar size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gentleBlue-text">No appointments yet.</p>
                <p className="text-sm text-gray-400 mt-1">Request one after your check-in from the results or support plan.</p>
              </Card>
            )}

            {scheduled.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gentleBlue-text uppercase tracking-wider mb-3">Upcoming</h2>
                <ul className="space-y-3">
                  {scheduled.map((a) => (
                    <li key={a.id}>
                      <Card className="!p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-charcoal flex items-center gap-2">
                              <Clock size={16} className="text-sage shrink-0" />
                              {new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
                            </p>
                            <p className="text-sm text-gentleBlue-text mt-1 capitalize">{a.type}</p>
                            {a.assigned_to_username && (
                              <p className="text-sm text-charcoal mt-1 flex items-center gap-1">
                                <User size={14} />
                                {a.assigned_to_username}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button size="sm" variant="secondary" onClick={() => openReschedule(a)} className="flex items-center gap-1">
                              <Pencil size={14} />
                              Reschedule
                            </Button>
                            <Button size="sm" variant="outline-danger" onClick={() => handleCancel(a)} className="flex items-center gap-1">
                              <Trash2 size={14} />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {editingId != null && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40" onClick={() => !saving && setEditingId(null)}>
                <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <h3 className="font-semibold text-lg text-charcoal mb-4">Reschedule</h3>
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
                  {error && <p className="text-sm text-warmCoral-text mb-2">{error}</p>}
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => !saving && setEditingId(null)} disabled={saving}>
                      Cancel
                    </Button>
                    <Button onClick={handleReschedule} disabled={saving || !rescheduleAt.trim()}>
                      {saving ? <Loader2 size={18} className="animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gentleBlue-text uppercase tracking-wider mb-3">Past</h2>
                <ul className="space-y-2">
                  {past.slice(0, 20).map((a) => (
                    <li key={a.id} className="flex items-center gap-3 py-2 text-sm text-gentleBlue-text border-b border-gray-100 last:border-0">
                      <Clock size={14} />
                      {new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                      <span className="capitalize text-charcoal">{a.type}</span>
                      <span className="capitalize text-gray-500">{a.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
