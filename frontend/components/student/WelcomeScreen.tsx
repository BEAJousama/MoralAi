import React, { useState, useEffect } from 'react';
import { Button } from '../Button';
import { getUnreadNotificationCount } from '../../services/authService';
import { Bell, Lock, LogOut, Calendar } from 'lucide-react';

interface WelcomeScreenProps {
  authToken: string | null;
  onStart: () => void;
  onLogout: () => void;
  onOpenNotifications: () => void;
  onOpenAppointments?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ authToken, onStart, onLogout, onOpenNotifications, onOpenAppointments }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!authToken) {
      setUnreadCount(0);
      return;
    }
    getUnreadNotificationCount(authToken).then(setUnreadCount).catch(() => setUnreadCount(0));
  }, [authToken]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-cream px-6 text-center relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={onOpenNotifications}
          className="relative p-2 text-gentleBlue-text hover:text-charcoal rounded-full hover:bg-white/60 transition-colors"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-warmCoral-risk text-white text-xs font-bold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={onLogout}
          className="p-2 text-gentleBlue-text hover:text-charcoal flex items-center text-sm font-medium transition-colors"
        >
          <LogOut size={16} className="mr-1.5" />
          Logout
        </button>
      </div>

      <div className="max-w-md w-full flex flex-col items-center">
        <div className="mb-8 relative w-64 h-64 bg-sage-light rounded-full flex items-center justify-center overflow-hidden shadow-soft">
          <img 
            src="https://picsum.photos/400/400?grayscale" 
            alt="Calming Illustration" 
            className="opacity-80 mix-blend-multiply object-cover w-full h-full"
          />
          <div className="absolute inset-0 bg-sage-50 opacity-20"></div>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-charcoal mb-4">
          Welcome to MoraLai
        </h1>
        
        <p className="text-gentleBlue-text text-lg mb-8 leading-relaxed">
          A safe space to check in with yourself.
          <br />
          <span className="text-sm mt-2 block opacity-80">
            • Completely anonymous • Your pace • Support when needed
          </span>
        </p>

        <div className="w-full space-y-3">
          <Button onClick={onStart} fullWidth size="lg">
            Start conversation
          </Button>
          {onOpenAppointments && (
            <Button variant="secondary" onClick={onOpenAppointments} fullWidth size="lg" className="flex items-center justify-center gap-2">
              <Calendar size={20} />
              My appointments
            </Button>
          )}
        </div>

        <div className="mt-8 flex items-center text-gentleBlue-light text-xs font-medium">
          <Lock size={12} className="mr-1.5" />
          Private & Secure • No data shared without consent
        </div>
      </div>
    </div>
  );
};
