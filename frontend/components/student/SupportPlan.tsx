import React, { useState } from 'react';
import { Card } from '../Card';
import { INITIAL_TASKS } from '../../constants';
import { CheckCircle2, Circle, ArrowLeft, Calendar, CalendarCheck } from 'lucide-react';
import { motion } from 'framer-motion';

interface SupportPlanProps {
  onBack: () => void;
  onBackToHome?: () => void;
  onRequestAppointment?: () => void;
}

export const SupportPlan: React.FC<SupportPlanProps> = ({ onBack, onBackToHome, onRequestAppointment }) => {
  const [tasks, setTasks] = useState(INITIAL_TASKS);

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => 
        t.id === id ? { ...t, completed: !t.completed } : t
    ));
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progress = (completedCount / totalCount) * 100;

  return (
    <div className="min-h-screen bg-cream-bg p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="p-2 -ml-2 text-charcoal hover:bg-white rounded-full transition-colors" aria-label="Back to results">
                <ArrowLeft size={24} />
              </button>
              {onBackToHome && (
                <button onClick={onBackToHome} className="text-sm text-sage font-medium hover:underline">
                  Home
                </button>
              )}
            </div>
            <h1 className="text-xl font-bold text-charcoal">Your Support Plan</h1>
            <button className="p-2 text-sage hover:bg-white rounded-full transition-colors" aria-label="Calendar">
                <Calendar size={24} />
            </button>
        </header>

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Today</p>
              <h2 className="text-2xl font-bold text-charcoal">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h2>
            </div>
            {onRequestAppointment && (
              <button
                type="button"
                onClick={onRequestAppointment}
                className="flex items-center gap-2 text-sm font-medium text-sage hover:underline shrink-0"
              >
                <CalendarCheck size={18} />
                Request an appointment
              </button>
            )}
        </div>

        <div className="space-y-6">
            {['Morning', 'Afternoon', 'Evening'].map((time) => {
                const timeTasks = tasks.filter(t => t.timeOfDay === time);
                if (timeTasks.length === 0) return null;

                return (
                    <div key={time}>
                        <div className="flex items-center mb-3">
                            <h3 className="text-sm font-bold text-gentleBlue-text uppercase tracking-wider">{time}</h3>
                            <div className="h-px bg-gray-200 flex-1 ml-4"></div>
                        </div>
                        <div className="space-y-3">
                            {timeTasks.map(task => (
                                <motion.div key={task.id} layout transition={{ duration: 0.2 }}>
                                    <Card 
                                        onClick={() => toggleTask(task.id)}
                                        className={`flex items-start cursor-pointer border-2 transition-colors ${
                                            task.completed ? 'border-sage/50 bg-sage-50' : 'border-transparent'
                                        }`}
                                    >
                                        <div className="text-2xl mr-4 mt-1">{task.icon}</div>
                                        <div className="flex-1">
                                            <h4 className={`font-semibold text-lg ${task.completed ? 'text-sage-dark line-through' : 'text-charcoal'}`}>
                                                {task.title}
                                            </h4>
                                            <p className={`text-sm mt-1 ${task.completed ? 'text-sage' : 'text-gentleBlue-text'}`}>
                                                {task.description}
                                            </p>
                                        </div>
                                        <div className={`mt-1 text-2xl ${task.completed ? 'text-sage' : 'text-gray-200'}`}>
                                            {task.completed ? <CheckCircle2 size={28} className="fill-sage-light" /> : <Circle size={28} />}
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>

        {/* Floating progress bar at bottom */}
        <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[600px]">
            <div className="bg-charcoal text-white p-4 rounded-2xl shadow-heavy flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-300">Daily Progress</p>
                    <div className="flex items-center space-x-2">
                        <span className="font-bold">{completedCount}/{totalCount} completed</span>
                        {completedCount === totalCount && <span className="text-sage-light ml-2">🎉 Great job!</span>}
                    </div>
                </div>
                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-sage-light transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>
        </div>
        <div className="h-24"></div> {/* Spacer for fixed footer */}
      </div>
    </div>
  );
};
