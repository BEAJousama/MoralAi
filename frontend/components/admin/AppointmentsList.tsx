import React, { useState, useEffect } from 'react';
import {
  getAppointments,
  updateAppointment,
  deleteAppointment,
  getCounselors,
  type Appointment,
  type AppointmentType,
  type Counselor,
} from '../../services/authService';
import { Card } from '../Card';
import { Button } from '../Button';
import { Calendar, Clock, User, Loader2, Pencil, Trash2, UserPlus } from 'lucide-react';

const APPOINTMENT_TYPES: { value: AppointmentType; label: string }[] = [
  { value: 'counseling', label: 'Counseling' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'follow_up', label: 'Follow-up' },
];

interface AppointmentsListProps {
  authToken: string | null;
  refreshKey?: number;
  onRefresh?: () => void;
}

export const AppointmentsList: React.FC<AppointmentsListProps> = ({ authToken, refreshKey, onRefresh }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [loading, setLoading] = useState(!!authToken);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState({ scheduled_at: '', type: 'counseling' as AppointmentType, location: '', provider_or_notes: '', admin_notes: '', assigned_to: null as number | null });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = () => {
    if (!authToken) return;
    setLoading(true);
    Promise.all([getAppointments(authToken), getCounselors(authToken)])
      .then(([list, couns]) => {
        setAppointments(list);
        setCounselors(couns);
      })
      .catch(() => { setAppointments([]); setCounselors([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [authToken, refreshKey]);

  const openEdit = (a: Appointment) => {
    setEditing(a);
    const d = new Date(a.scheduled_at);
    setEditForm({
      scheduled_at: d.toISOString().slice(0, 16),
      type: a.type,
      location: a.location ?? '',
      provider_or_notes: a.provider_or_notes ?? '',
      admin_notes: a.admin_notes ?? '',
      assigned_to: a.assigned_to,
    });
  };

  const handleSaveEdit = async () => {
    if (!authToken || !editing) return;
    setSaving(true);
    try {
      await updateAppointment(authToken, editing.id, {
        scheduled_at: new Date(editForm.scheduled_at).toISOString(),
        type: editForm.type,
        location: editForm.location || undefined,
        provider_or_notes: editForm.provider_or_notes || undefined,
        admin_notes: editForm.admin_notes || undefined,
        assigned_to: editForm.assigned_to,
      });
      setEditing(null);
      load();
      onRefresh?.();
    } catch {
      // could set error state
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!authToken || !window.confirm('Delete this appointment? The student will not be notified of the cancellation.')) return;
    setDeletingId(id);
    try {
      await deleteAppointment(authToken, id);
      load();
      onRefresh?.();
    } catch {
      // could set error state
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="!p-6">
        <div className="flex items-center gap-2 text-gentleBlue-text">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading appointments…</span>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="!p-4 sm:!p-6">
        <h3 className="font-semibold text-base sm:text-lg text-charcoal mb-3 sm:mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-sage shrink-0" />
          All appointments
        </h3>
        {appointments.length === 0 ? (
          <p className="text-sm text-gentleBlue-text">No appointments.</p>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-200 text-gentleBlue-text uppercase tracking-wider text-xs sm:text-sm">
                  <th className="py-2 px-2 sm:pr-4">Date & time</th>
                  <th className="py-2 px-2 sm:pr-4">Student</th>
                  <th className="py-2 px-2 sm:pr-4">Type</th>
                  <th className="py-2 px-2 sm:pr-4 hidden md:table-cell">Assigned to</th>
                  <th className="py-2 px-2 sm:pr-4">Status</th>
                  <th className="py-2 pl-2 pr-2 sm:pr-0 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="py-2 sm:py-3 px-2 sm:pr-4 text-charcoal whitespace-nowrap">
                      {new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:pr-4 max-w-[120px] truncate">{a.student_username ?? `#${a.student_id}`}</td>
                    <td className="py-2 sm:py-3 px-2 sm:pr-4 capitalize">{a.type}</td>
                    <td className="py-2 sm:py-3 px-2 sm:pr-4 text-gentleBlue-text max-w-[100px] truncate hidden md:table-cell">{a.assigned_to_username ?? '—'}</td>
                    <td className="py-2 sm:py-3 px-2 sm:pr-4">
                      <span className={`capitalize ${a.status === 'scheduled' ? 'text-sage' : a.status === 'cancelled' ? 'text-gray-500' : 'text-charcoal'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="py-2 sm:py-3 pl-2 pr-2 sm:pr-0 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(a)}
                        className="p-1.5 text-gentleBlue-text hover:text-sage rounded"
                        aria-label="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        disabled={deletingId === a.id}
                        className="p-1.5 text-gentleBlue-text hover:text-warmCoral-risk rounded ml-1"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-lg text-charcoal mb-4">Edit appointment</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Date & time</label>
                <input
                  type="datetime-local"
                  value={editForm.scheduled_at}
                  onChange={(e) => setEditForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Type</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as AppointmentType }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {APPOINTMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Assigned to (counselor/doctor)</label>
                <select
                  value={editForm.assigned_to ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, assigned_to: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">— Not assigned —</option>
                  {counselors.map((c) => (
                    <option key={c.id} value={c.id}>{c.username}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Location</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="e.g. Room 12"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Provider / notes (for student)</label>
                <input
                  type="text"
                  value={editForm.provider_or_notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, provider_or_notes: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Admin notes (internal)</label>
                <input
                  type="text"
                  value={editForm.admin_notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, admin_notes: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button onClick={handleSaveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
