import React, { useState, useEffect } from 'react';
import { getAppointments, type Appointment } from '../../services/authService';
import { Card } from '../Card';
import { Calendar, Clock, User, Loader2 } from 'lucide-react';

interface AppointmentsOverviewProps {
  authToken: string | null;
  refreshKey?: number;
}

export const AppointmentsOverview: React.FC<AppointmentsOverviewProps> = ({ authToken, refreshKey }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(!!authToken);

  useEffect(() => {
    if (!authToken) {
      setAppointments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getAppointments(authToken, { status: 'scheduled' })
      .then((list) => {
        const now = new Date().toISOString();
        const upcoming = list.filter((a) => a.scheduled_at >= now).slice(0, 10);
        setAppointments(upcoming);
      })
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  }, [authToken, refreshKey]);

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
    <Card className="!p-4 sm:!p-6">
      <h3 className="font-semibold text-base sm:text-lg text-charcoal mb-3 sm:mb-4 flex items-center gap-2">
        <Calendar size={20} className="text-sage shrink-0" />
        Upcoming appointments
      </h3>
      {appointments.length === 0 ? (
        <p className="text-sm text-gentleBlue-text">No scheduled appointments.</p>
      ) : (
        <ul className="space-y-2 sm:space-y-3">
          {appointments.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-2 sm:gap-3 p-3 rounded-lg bg-cream-light hover:bg-gray-50 transition-colors"
            >
              <Clock size={16} className="text-sage mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-charcoal">
                  {new Date(a.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                <p className="text-sm text-gentleBlue-text flex items-center gap-1">
                  <User size={12} />
                  {a.student_username ?? `Student #${a.student_id}`}
                </p>
                <p className="text-xs text-gray-500 capitalize mt-0.5">{a.type}</p>
                {a.location && (
                  <p className="text-xs text-gentleBlue-text mt-0.5">{a.location}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
