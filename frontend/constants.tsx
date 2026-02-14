import { Student, DailyTask } from './types';
import React from 'react';

// Design Tokens (re-exported for use in JS logic if needed, though mostly handled by Tailwind)
export const COLORS = {
  sage: '#A8B89F',
  cream: '#F5F1E8',
  gentleBlue: '#7BA3C7',
  warmCoral: '#E89F8D',
  lowRisk: '#88C5A1',
  mediumRisk: '#F4B860',
  highRisk: '#E88476',
};

export const MOCK_STUDENTS: Student[] = [
  {
    id: 'A7B3',
    department: 'Engineering',
    riskLevel: 'High',
    riskScore: 87,
    lastActive: '2h ago',
    activeDays: 24,
    concerns: ['Severe anxiety', 'Sleep deprivation', 'Panic symptoms'],
    aiRecommendation: 'Immediate psychiatric evaluation within 24h',
    trend: 'increasing',
    keywords: ['overwhelmed', 'can\'t sleep', 'panic'],
  },
  {
    id: 'B2K9',
    department: 'Medicine',
    riskLevel: 'High',
    riskScore: 82,
    lastActive: '15m ago',
    activeDays: 28,
    concerns: ['Suicidal ideation (passive)', 'Burnout'],
    aiRecommendation: 'Crisis counseling appointment URGENT',
    trend: 'stable',
    keywords: ['hopeless', 'exhausted'],
  },
  {
    id: 'C5L2',
    department: 'Business',
    riskLevel: 'Medium',
    riskScore: 64,
    lastActive: '1 day ago',
    activeDays: 15,
    concerns: ['Academic stress', 'Social withdrawal'],
    aiRecommendation: 'Psychologist appointment this week',
    trend: 'decreasing',
    keywords: ['stress', 'grades'],
  },
  {
    id: 'D9M4',
    department: 'Arts',
    riskLevel: 'Low',
    riskScore: 32,
    lastActive: '3 days ago',
    activeDays: 8,
    concerns: ['Mild anxiety'],
    aiRecommendation: 'Wellness workshop recommendation',
    trend: 'stable',
    keywords: ['nervous'],
  },
  {
    id: 'E1N5',
    department: 'Engineering',
    riskLevel: 'Medium',
    riskScore: 58,
    lastActive: '5h ago',
    activeDays: 12,
    concerns: ['Sleep issues', 'Focus'],
    aiRecommendation: 'Sleep hygiene consultation',
    trend: 'increasing',
    keywords: ['tired', 'distracted'],
  },
  {
    id: 'F3P8',
    department: 'Medicine',
    riskLevel: 'Low',
    riskScore: 24,
    lastActive: 'Just now',
    activeDays: 30,
    concerns: [],
    aiRecommendation: 'Routine check-in',
    trend: 'stable',
    keywords: ['good', 'calm'],
  },
];

export const INITIAL_TASKS: DailyTask[] = [
  {
    id: '1',
    timeOfDay: 'Morning',
    title: 'Morning Check-In',
    description: 'Take 2 minutes to notice how you\'re feeling',
    icon: '☀️',
    completed: false,
  },
  {
    id: '2',
    timeOfDay: 'Afternoon',
    title: 'Breathing Exercise',
    description: '5-minute guided breathing to release tension',
    icon: '🌬️',
    completed: false,
  },
  {
    id: '3',
    timeOfDay: 'Evening',
    title: 'Gratitude Journaling',
    description: 'Write down 3 things that went well today',
    icon: '📝',
    completed: false,
  },
];

export const MOCK_CHART_DATA = [
  { day: 'Mon', score: 65 },
  { day: 'Tue', score: 68 },
  { day: 'Wed', score: 75 }, // Spike
  { day: 'Thu', score: 72 },
  { day: 'Fri', score: 80 },
  { day: 'Sat', score: 85 },
  { day: 'Sun', score: 87 },
];
