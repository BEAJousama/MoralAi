import React, { useState, useEffect, useRef } from 'react';
import { getAppointments, type Appointment } from '../../services/authService';
import { Card } from '../Card';
import { ArrowLeft, FileText, Loader2, CheckCircle, XCircle, Calendar } from 'lucide-react';

interface StudentReportsScreenProps {
  authToken: string | null;
  onBack: () => void;
  focusAppointmentId?: number | null;
}

export const StudentReportsScreen: React.FC<StudentReportsScreenProps> = ({ authToken, onBack, focusAppointmentId }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(!!authToken);
  const focusRef = useRef<HTMLDivElement>(null);

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

  const reports = appointments.filter(
    (a) => (a.status === 'completed' || a.status === 'no_show') && a.counselor_report
  );

  useEffect(() => {
    if (focusAppointmentId != null && focusRef.current && reports.some((r) => r.id === focusAppointmentId)) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusAppointmentId, reports]);

  return (
    <div className="min-h-screen bg-cream-bg">
      <header className="bg-white border-b border-gray-100 fixed top-0 left-0 right-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-charcoal hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-charcoal flex items-center gap-2">
            <FileText size={24} className="text-sage" />
            My reports
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-6 transition-all duration-300">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gentleBlue-text">
            <Loader2 size={24} className="animate-spin" />
            Loading…
          </div>
        ) : reports.length === 0 ? (
          <Card className="!p-8 text-center">
            <FileText size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gentleBlue-text">No reports yet.</p>
            <p className="text-sm text-gray-400 mt-1">After your appointments, your counselor’s report will appear here.</p>
          </Card>
        ) : (
          <ul className="space-y-4">
            {reports.map((a) => (
              <li
                key={a.id}
                ref={focusAppointmentId === a.id ? focusRef : undefined}
                className={focusAppointmentId === a.id ? 'ring-2 ring-sage ring-offset-2 rounded-2xl' : ''}
              >
                <Card className="!p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        a.status === 'completed' ? 'bg-sage/20 text-sage' : 'bg-amber-risk/20 text-amber-text'
                      }`}
                    >
                      {a.status === 'completed' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-charcoal">
                        {new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
                      </p>
                      <p className="text-sm text-gentleBlue-text">
                        {a.assigned_to_username ? `With ${a.assigned_to_username}` : 'Appointment'} · {a.status === 'completed' ? 'Completed' : 'Missed'}
                      </p>
                      <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-sm font-medium text-charcoal mb-1">Counselor’s report</p>
                        <p className="text-sm text-gentleBlue-text whitespace-pre-wrap">{a.counselor_report}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};
