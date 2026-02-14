import React, { useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { User, ShieldCheck, Eye, EyeOff, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { login, register } from '../services/authService';
import type { AuthUser } from '../services/authService';

interface LoginScreenProps {
  onLogin: (role: 'STUDENT' | 'ADMIN' | 'COUNSELOR', token: string, user: AuthUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<'STUDENT' | 'ADMIN'>('STUDENT');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isRegisterMode) {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }
    setIsLoading(true);
    try {
      if (isRegisterMode) {
        const { user, token } = await register(username, password);
        onLogin('STUDENT', token, user);
        return;
      }
      const { user, token } = await login(username, password);
      if (user.role === 'admin') {
        onLogin('ADMIN', token, user);
      } else if (user.role === 'counselor') {
        onLogin('COUNSELOR', token, user);
      } else {
        onLogin('STUDENT', token, user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchTab = (tab: 'STUDENT' | 'ADMIN') => {
    setActiveTab(tab);
    setIsRegisterMode(false);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <Card className="w-full max-w-md !p-0 overflow-hidden shadow-heavy">
        {/* Header with decorative background */}
        <div className="bg-sage-dark p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-white opacity-5">
             <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white opacity-20 blur-xl"></div>
             <div className="absolute top-20 right-10 w-20 h-20 rounded-full bg-white opacity-20 blur-lg"></div>
          </div>
          
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
               <Lock className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">MoraLai</h1>
            <p className="text-sage-light text-sm">Secure Access Portal</p>
          </div>
        </div>

        {/* Tabs: Student Login | Admin Portal */}
        <div className="flex border-b border-gray-200 bg-gray-50/50">
          <button
            type="button"
            onClick={() => switchTab('STUDENT')}
            aria-pressed={activeTab === 'STUDENT'}
            className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors shrink-0 ${
              activeTab === 'STUDENT'
                ? 'text-sage-dark border-b-2 border-sage-dark bg-white text-sage-dark shadow-sm'
                : 'text-gray-500 hover:text-charcoal hover:bg-gray-100'
            }`}
          >
            <User size={18} aria-hidden />
            Student Portal
          </button>
          <button
            type="button"
            onClick={() => switchTab('ADMIN')}
            aria-pressed={activeTab === 'ADMIN'}
            className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors shrink-0 ${
              activeTab === 'ADMIN'
                ? 'text-sage-dark border-b-2 border-sage-dark bg-white text-sage-dark shadow-sm'
                : 'text-gray-500 hover:text-charcoal hover:bg-gray-100'
            }`}
          >
            <ShieldCheck size={18} aria-hidden />
            Staff Portal
          </button>
        </div>

        {/* Form */}
        <div className="p-8">
          {/* {activeTab === 'ADMIN' && (
            <p className="text-sm text-gray-500 mb-4 -mt-1">View registered students and their assessments.</p>
          )} */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">
                {activeTab === 'STUDENT' ? 'Student ID' : 'Username'}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sage focus:ring-4 focus:ring-sage/10 outline-none transition-all"
                placeholder={activeTab === 'STUDENT' ? 'Enter Student ID' : 'Enter Admin Username'}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">
                Password {isRegisterMode && '(min 6 characters)'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sage focus:ring-4 focus:ring-sage/10 outline-none transition-all"
                  placeholder="••••••••"
                  required
                  minLength={isRegisterMode ? 6 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-charcoal"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {isRegisterMode && (
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Confirm password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sage focus:ring-4 focus:ring-sage/10 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-warmCoral-text text-sm bg-warmCoral-bg p-3 rounded-lg flex items-center"
              >
                <span className="w-1.5 h-1.5 bg-warmCoral-text rounded-full mr-2"></span>
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              disabled={isLoading}
              className={isLoading ? 'opacity-80 cursor-wait' : ''}
            >
              {isLoading ? (isRegisterMode ? 'Creating account...' : 'Signing in...') : isRegisterMode ? 'Register' : 'Login'}
            </Button>

            {activeTab === 'STUDENT' && (
              <p className="text-center text-sm text-gentleBlue-text">
                {isRegisterMode ? (
                  <>
                    Already have an account?{' '}
                    <button type="button" onClick={() => { setIsRegisterMode(false); setError(''); setConfirmPassword(''); }} className="font-semibold text-sage hover:underline">
                      Login
                    </button>
                  </>
                ) : (
                  <>
                    Don&apos;t have an account?{' '}
                    <button type="button" onClick={() => { setIsRegisterMode(true); setError(''); }} className="font-semibold text-sage hover:underline">
                      Register
                    </button>
                  </>
                )}
              </p>
            )}

            {/* {activeTab === 'ADMIN' && (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs text-center text-gray-500 font-medium mb-2 uppercase tracking-wide">Default admin</p>
                <p className="text-xs text-center text-charcoal">Username: admin · Password: password</p>
              </div>
            )} */}
          </form>
        </div>
      </Card>
    </div>
  );
};
