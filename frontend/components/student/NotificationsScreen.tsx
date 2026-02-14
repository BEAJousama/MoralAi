import React, { useState, useEffect } from 'react';
import { getNotifications, markNotificationRead, type Notification } from '../../services/authService';
import { Card } from '../Card';
import { ArrowLeft, Bell, Calendar, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface NotificationsScreenProps {
  authToken: string | null;
  onBack: () => void;
}

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffM < 1) return 'Just now';
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ authToken, onBack }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(!!authToken);

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

  return (
    <div className="min-h-screen bg-cream-bg flex flex-col">
      <header className="bg-white shadow-soft px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-slate-100 text-charcoal"
          aria-label="Back"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-charcoal flex items-center gap-2">
          <Bell size={24} className="text-sage" />
          Notifications
        </h1>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
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
                  onClick={() => handleMarkRead(n)}
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
