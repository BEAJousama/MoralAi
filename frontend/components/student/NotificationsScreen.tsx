import React, { useState, useEffect } from 'react';
import { getNotifications, markNotificationRead, markAllNotificationsRead, type Notification } from '../../services/authService';
import { Card } from '../Card';
import { Button } from '../Button';
import { ArrowLeft, Bell, Calendar, Loader2, CheckCircle, XCircle, CheckCheck } from 'lucide-react';

export type NotificationNavigateView = 'STUDENT_APPOINTMENTS' | 'STUDENT_REPORTS';

interface NotificationsScreenProps {
  authToken: string | null;
  onBack: () => void;
  /** When user taps a notification linked to an appointment/report, call with view and appointment id */
  onNotificationNavigate?: (view: NotificationNavigateView, appointmentId: number) => void;
}

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffM < 1) return 'Just now';
  if (diffM < 60) return `${diffM}m ago`;
  if (diffD < 1) return `${diffM}m ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ authToken, onBack, onNotificationNavigate }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(!!authToken);
  const [clearing, setClearing] = useState(false);

  const load = () => {
    if (!authToken) return;
    setLoading(true);
    getNotifications(authToken)
      .then(setNotifications)
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [authToken]);

  const handleMarkRead = async (n: Notification) => {
    if (n.read_at || !authToken) return;
    try {
      await markNotificationRead(authToken, n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = (n: Notification) => {
    handleMarkRead(n);
    if (onNotificationNavigate && n.related_type === 'appointment' && n.related_id != null) {
      const view: NotificationNavigateView = n.type === 'appointment_outcome' ? 'STUDENT_REPORTS' : 'STUDENT_APPOINTMENTS';
      onNotificationNavigate(view, n.related_id);
    }
  };

  const hasUnread = notifications.some((n) => !n.read_at);

  const handleClearAll = async () => {
    if (!authToken || !hasUnread) return;
    setClearing(true);
    try {
      await markAllNotificationsRead(authToken);
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    } catch {
      // could show error
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-bg flex flex-col">
      <header className="bg-white shadow-soft px-4 py-3 flex items-center gap-3 fixed top-0 left-0 right-0 z-10">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-slate-100 text-charcoal"
          aria-label="Back"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-charcoal flex items-center gap-2 flex-1 min-w-0">
          <Bell size={24} className="text-sage shrink-0" />
          Notifications
        </h1>
        {hasUnread && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClearAll}
            disabled={clearing}
            className="shrink-0 flex items-center gap-1.5"
          >
            {clearing ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
            Clear all
          </Button>
        )}
      </header>

      <main className="flex-1 p-4 pt-20 max-w-2xl mx-auto w-full transition-all duration-300">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-sage" />
          </div>
        ) : notifications.length === 0 ? (
          <Card className="!p-8 text-center">
            <Bell size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gentleBlue-text">No notifications yet.</p>
            <p className="text-sm text-gray-400 mt-1">When we schedule an appointment for you, it will appear here.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {notifications.map((n) => (
              <li key={n.id}>
                <Card
                  className={`!p-4 cursor-pointer transition-colors ${!n.read_at ? 'border-l-4 border-sage bg-sage-50/30' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      n.type === 'appointment_booked' ? 'bg-sage/20 text-sage' :
                      n.type === 'appointment_outcome' ? (n.body?.startsWith('Completed') ? 'bg-sage/20 text-sage' : 'bg-amber-risk/20 text-amber-text') :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {n.type === 'appointment_booked' && <Calendar size={20} />}
                      {n.type === 'appointment_outcome' && (n.body?.startsWith('Completed') ? <CheckCircle size={20} /> : <XCircle size={20} />)}
                      {!n.type || (n.type !== 'appointment_booked' && n.type !== 'appointment_outcome') ? <Calendar size={20} /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-charcoal">{n.title}</p>
                      <p className="text-sm text-gentleBlue-text whitespace-pre-line mt-1">{n.body}</p>
                      <p className="text-xs text-gray-400 mt-2">{formatTimeAgo(n.created_at)}</p>
                    </div>
                    {!n.read_at && (
                      <span className="w-2 h-2 rounded-full bg-sage shrink-0 mt-2" aria-hidden />
                    )}
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
