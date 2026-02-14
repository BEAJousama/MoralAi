import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { WelcomeScreen } from './components/student/WelcomeScreen';
import { ChatInterface } from './components/student/ChatInterface';
import { AssessmentResults } from './components/student/AssessmentResults';
import { SupportPlan } from './components/student/SupportPlan';
import { NotificationsScreen } from './components/student/NotificationsScreen';
import { DashboardOverview } from './components/admin/DashboardOverview';
import { CounselorsSection } from './components/admin/CounselorsSection';
import { CounselorDashboard } from './components/counselor/CounselorDashboard';
import { RequestAppointmentModal } from './components/student/RequestAppointmentModal';
import { StudentAppointmentsScreen } from './components/student/StudentAppointmentsScreen';
import type { AuthUser, AssessmentResult } from './services/authService';
import { LogOut, Bell } from 'lucide-react';
import { getUnreadNotificationCount } from './services/authService';

const AUTH_STORAGE_KEY = 'moralai_auth';

type Role = 'STUDENT' | 'ADMIN' | 'COUNSELOR' | null;
type View = 'LOGIN' | 'WELCOME' | 'CHAT' | 'RESULTS' | 'PLAN' | 'NOTIFICATIONS' | 'STUDENT_APPOINTMENTS' | 'ADMIN_DASHBOARD' | 'COUNSELOR_DASHBOARD';

function loadStoredAuth(): { token: string; user: AuthUser; role: Role } | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { token?: string; user?: AuthUser; role?: string };
    if (!data?.token || !data?.user?.id || !data?.user?.username || !data?.user?.role) return null;
    const role = data.role === 'ADMIN' ? 'ADMIN' : data.role === 'COUNSELOR' ? 'COUNSELOR' : data.role === 'STUDENT' ? 'STUDENT' : null;
    if (!role) return null;
    return { token: data.token, user: data.user, role };
  } catch {
    return null;
  }
}

function saveAuth(token: string, user: AuthUser, role: Role) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user, role }));
  } catch {
    // ignore
  }
}

function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('LOGIN');
  const [userRole, setUserRole] = useState<Role>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authRestored, setAuthRestored] = useState(false);
  const [currentAssessment, setCurrentAssessment] = useState<AssessmentResult | null>(null);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const [showRequestAppointmentModal, setShowRequestAppointmentModal] = useState(false);
  const notificationsReturnViewRef = useRef<View>('WELCOME');

  const refreshAdminUnreadCount = useCallback(() => {
    if (authToken && userRole === 'ADMIN') {
      getUnreadNotificationCount(authToken).then(setAdminUnreadCount).catch(() => setAdminUnreadCount(0));
    }
  }, [authToken, userRole]);

  const openNotifications = useCallback((from: View) => {
    notificationsReturnViewRef.current = from;
    setCurrentView('NOTIFICATIONS');
  }, []);

  useEffect(() => {
    const stored = loadStoredAuth();
    if (stored) {
      setAuthToken(stored.token);
      setAuthUser(stored.user);
      setUserRole(stored.role);
      if (stored.role === 'STUDENT') setCurrentView('WELCOME');
      else if (stored.role === 'COUNSELOR') setCurrentView('COUNSELOR_DASHBOARD');
      else setCurrentView('ADMIN_DASHBOARD');
    }
    setAuthRestored(true);
  }, []);

  useEffect(() => {
    if (currentView === 'ADMIN_DASHBOARD' && authToken && userRole === 'ADMIN') {
      refreshAdminUnreadCount();
    }
  }, [currentView, authToken, userRole, refreshAdminUnreadCount]);

  const closeNotifications = useCallback(() => {
    setCurrentView(notificationsReturnViewRef.current);
  }, []);

  const handleLogin = (role: 'STUDENT' | 'ADMIN' | 'COUNSELOR', token: string, user: AuthUser) => {
    setUserRole(role);
    setAuthToken(token);
    setAuthUser(user);
    saveAuth(token, user, role);
    if (role === 'STUDENT') {
      setCurrentView('WELCOME');
    } else if (role === 'COUNSELOR') {
      setCurrentView('COUNSELOR_DASHBOARD');
    } else {
      setCurrentView('ADMIN_DASHBOARD');
    }
  };

  const handleLogout = () => {
    clearStoredAuth();
    setUserRole(null);
    setAuthToken(null);
    setAuthUser(null);
    setCurrentAssessment(null);
    setCurrentView('LOGIN');
  };

  // Render Logic
  const renderContent = () => {
    switch (currentView) {
      case 'LOGIN':
        return <LoginScreen onLogin={handleLogin} />;
        
      case 'WELCOME':
        return (
          <WelcomeScreen
            authToken={authToken}
            onStart={() => setCurrentView('CHAT')}
            onLogout={handleLogout}
            onOpenNotifications={() => openNotifications('WELCOME')}
            onOpenAppointments={() => setCurrentView('STUDENT_APPOINTMENTS')}
          />
        );

      case 'STUDENT_APPOINTMENTS':
        return (
          <StudentAppointmentsScreen
            authToken={authToken}
            onBack={() => setCurrentView('WELCOME')}
          />
        );

      case 'NOTIFICATIONS':
        return (
          <NotificationsScreen
            authToken={authToken}
            onBack={closeNotifications}
          />
        );
        
      case 'CHAT':
        return (
          <ChatInterface
            authToken={authToken}
            onBack={() => setCurrentView('WELCOME')}
            onOpenNotifications={() => openNotifications('CHAT')}
            onComplete={(assessment) => {
              setCurrentAssessment(assessment);
              setCurrentView('RESULTS');
            }}
          />
        );
      case 'RESULTS':
        return (
          <>
            <AssessmentResults
              assessment={currentAssessment}
              onBack={() => setCurrentView('CHAT')}
              onBackToHome={() => setCurrentView('WELCOME')}
              onViewPlan={() => setCurrentView('PLAN')}
              onRequestAppointment={() => setShowRequestAppointmentModal(true)}
            />
            {showRequestAppointmentModal && authToken && authUser?.id && (
              <RequestAppointmentModal
                authToken={authToken}
                studentId={authUser.id}
                onClose={() => setShowRequestAppointmentModal(false)}
                onSuccess={() => setShowRequestAppointmentModal(false)}
              />
            )}
          </>
        );

      case 'PLAN':
        return (
          <>
            <SupportPlan
              onBack={() => setCurrentView('RESULTS')}
              onBackToHome={() => setCurrentView('WELCOME')}
              onRequestAppointment={() => setShowRequestAppointmentModal(true)}
            />
            {showRequestAppointmentModal && authToken && authUser?.id && (
              <RequestAppointmentModal
                authToken={authToken}
                studentId={authUser.id}
                onClose={() => setShowRequestAppointmentModal(false)}
                onSuccess={() => setShowRequestAppointmentModal(false)}
              />
            )}
          </>
        );
        
      case 'ADMIN_DASHBOARD':
        return (
          <div className="min-h-screen bg-gray-50 pb-12 overflow-x-hidden">
            {/* Admin Header - responsive */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
              <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center min-w-0 flex-1">
                  <span className="text-base sm:text-xl font-bold text-charcoal truncate">MoraLai Admin</span>
                  <span className="hidden sm:inline mx-2 lg:mx-4 text-gray-300 shrink-0">|</span>
                  <span className="hidden md:inline text-sm text-gray-500 truncate">University of Morocco</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-4 shrink-0">
                    <button
                      type="button"
                      onClick={() => openNotifications('ADMIN_DASHBOARD')}
                      className="p-2 text-gentleBlue-text hover:text-sage relative rounded-lg transition-colors"
                      aria-label={adminUnreadCount > 0 ? `${adminUnreadCount} unread notifications` : 'Notifications'}
                    >
                      <Bell size={22} />
                      {adminUnreadCount > 0 && (
                        <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-warmCoral-risk text-white text-xs font-bold rounded-full border-2 border-white">
                          {adminUnreadCount > 99 ? '99+' : adminUnreadCount}
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-2 sm:gap-3 border-l border-gray-200 pl-2 sm:pl-6">
                         <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-sage flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0">
                            AD
                        </div>
                        <button 
                            onClick={handleLogout}
                            className="text-xs sm:text-sm font-medium text-gentleBlue-text hover:text-warmCoral-text flex items-center transition-colors py-1"
                        >
                            <LogOut size={16} className="mr-1 sm:mr-1.5 shrink-0" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
              </div>
            </header>

            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8 animate-fade-in">
              <DashboardOverview authToken={authToken} />
              <CounselorsSection authToken={authToken} />
            </main>
          </div>
        );
      
      case 'COUNSELOR_DASHBOARD':
        return (
          <CounselorDashboard authToken={authToken} counselorId={authUser?.id ?? undefined} onLogout={handleLogout} />
        );

      default:
        return <LoginScreen onLogin={handleLogin} />;
    }
  };

  if (!authRestored) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-bg">
        <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative font-sans text-charcoal antialiased">
      {renderContent()}
    </div>
  );
};

export default App;
