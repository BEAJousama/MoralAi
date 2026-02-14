import React, { useState, useEffect } from 'react';
import type { ApiStudent, Appointment, AppointmentType, Counselor } from '../../services/authService';
import { createAppointment, getAppointments, getCounselors } from '../../services/authService';
import { RiskBadge } from '../Badge';
import { Button } from '../Button';
import { X, Calendar, AlertCircle, CalendarPlus, Clock, MapPin } from 'lucide-react';

interface RegisteredStudentModalProps {
  student: ApiStudent;
  authToken: string | null;
  onClose: () => void;
  onAppointmentBooked?: () => void;
}

const APPOINTMENT_TYPES: { value: AppointmentType; label: string }[] = [
  { value: 'counseling', label: 'Counseling' },
  { value: 'doctor', label: 'Doctor / Clinical' },
  { value: 'follow_up', label: 'Follow-up' },
];

export const RegisteredStudentModal: React.FC<RegisteredStudentModalProps> = ({
  student,
  authToken,
  onClose,
  onAppointmentBooked,
}) => {
  const hasAssessment = student.risk_level != null && student.assessed_at != null;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [showBookForm, setShowBookForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [bookSuccess, setBookSuccess] = useState(false);
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('10:00');
  const [formType, setFormType] = useState<AppointmentType>('counseling');
  const [formLocation, setFormLocation] = useState('');
  const [formProviderNotes, setFormProviderNotes] = useState('');
  const [formAssignedTo, setFormAssignedTo] = useState<number | null>(null);
  const [counselors, setCounselors] = useState<Counselor[]>([]);

  const loadAppointments = () => {
    if (!authToken) return;
    setLoadingAppointments(true);
    getAppointments(authToken, { studentId: student.id })
      .then(setAppointments)
      .catch(() => setAppointments([]))
      .finally(() => setLoadingAppointments(false));
  };

  useEffect(() => {
    loadAppointments();
  }, [authToken, student.id]);

  useEffect(() => {
    if (!authToken) return;
    getCounselors(authToken).then(setCounselors).catch(() => setCounselors([]));
  }, [authToken]);

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || !formDate.trim()) return;
    setBookError(null);
    setSubmitting(true);
    const scheduledAt = new Date(`${formDate}T${formTime}:00`).toISOString();
    try {
      await createAppointment(authToken, {
        studentId: student.id,
        scheduledAt,
        type: formType,
        location: formLocation.trim() || undefined,
        providerOrNotes: formProviderNotes.trim() || undefined,
        assignedTo: formAssignedTo,
      });
      setBookSuccess(true);
      setShowBookForm(false);
      setFormDate('');
      setFormTime('10:00');
      setFormLocation('');
      setFormProviderNotes('');
      loadAppointments();
      onAppointmentBooked?.();
      setTimeout(() => setBookSuccess(false), 4000);
    } catch (err) {
      setBookError(err instanceof Error ? err.message : 'Failed to book');
    } finally {
      setSubmitting(false);
    }
  };

  const scheduledAppointments = appointments.filter((a) => a.status === 'scheduled');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-charcoal">Registered student</h2>
            <p className="text-sm text-gentleBlue-text">@{student.username} · ID {student.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-charcoal transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar size={16} />
            Registered {new Date(student.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
          </div>

          {hasAssessment ? (
            <>
              <div
                className={`p-4 rounded-xl border ${
                  student.risk_level === 'High'
                    ? 'bg-warmCoral-bg border-warmCoral-risk/20'
                    : student.risk_level === 'Medium'
                      ? 'bg-amber-bg border-amber-risk/20'
                      : 'bg-mint-bg border-mint-risk/20'
                }`}
              >
                <p className="text-sm font-semibold text-gray-600 mb-2">Latest assessment</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <RiskBadge level={student.risk_level!} />
                  <span className="text-2xl font-bold text-charcoal">{student.risk_score}/100</span>
                  <span className="text-sm text-gray-500">
                    {student.assessed_at ? new Date(student.assessed_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''}
                  </span>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-charcoal mb-2">AI recommendation</h3>
                <p className="text-gentleBlue-text leading-relaxed">{student.ai_recommendation}</p>
              </div>
              {student.concerns.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-charcoal mb-2">Concerns</h3>
                  <ul className="list-disc list-inside text-gentleBlue-text space-y-1">
                    {student.concerns.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {student.keywords.length > 0 && (
                <p className="text-sm text-gray-500">
                  Themes: {student.keywords.join(', ')} · Trend: {student.trend ?? '—'}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 text-gentleBlue-text">
              <AlertCircle size={24} className="shrink-0" />
              <p>This student has not completed a check-in yet. Assessment will appear here after they finish a chat session.</p>
            </div>
          )}

          {/* Appointments for this student */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-charcoal flex items-center gap-2">
                <CalendarPlus size={18} className="text-sage" />
                Appointments
              </h3>
              {authToken && (
                <Button
                  size="sm"
                  onClick={() => { setShowBookForm(!showBookForm); setBookError(null); }}
                >
                  {showBookForm ? 'Cancel' : 'Book appointment'}
                </Button>
              )}
            </div>
            {bookSuccess && (
              <div className="mb-3 p-3 rounded-lg bg-mint-risk/15 text-mint-risk text-sm font-medium">
                Appointment booked. The student will be notified in the app.
              </div>
            )}
            {showBookForm && authToken && (
              <form onSubmit={handleBookSubmit} className="mb-4 p-4 rounded-xl bg-cream-light space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-charcoal mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-charcoal mb-1">Time</label>
                    <input
                      type="time"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as AppointmentType)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    {APPOINTMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Assigned to (counselor/doctor)</label>
                  <select
                    value={formAssignedTo ?? ''}
                    onChange={(e) => setFormAssignedTo(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">— Optional —</option>
                    {counselors.map((c) => (
                      <option key={c.id} value={c.id}>{c.username}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Location (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Campus Wellness, Room 12"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Provider / notes for student (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Smith, or instructions"
                    value={formProviderNotes}
                    onChange={(e) => setFormProviderNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                {bookError && <p className="text-sm text-warmCoral-text">{bookError}</p>}
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Booking…' : 'Book and notify student'}
                </Button>
              </form>
            )}
            {loadingAppointments ? (
              <p className="text-sm text-gentleBlue-text">Loading appointments…</p>
            ) : scheduledAppointments.length === 0 ? (
              <p className="text-sm text-gentleBlue-text">No upcoming appointments.</p>
            ) : (
              <ul className="space-y-2">
                {scheduledAppointments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 text-sm"
                  >
                    <Clock size={16} className="text-sage mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-charcoal">
                        {new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      <p className="text-gentleBlue-text capitalize">{a.type}</p>
                      {a.location && (
                        <p className="text-gentleBlue-text flex items-center gap-1 mt-1">
                          <MapPin size={12} /> {a.location}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
