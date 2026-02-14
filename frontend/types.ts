export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface Student {
  id: string;
  name?: string; // Optional for anonymity
  department: string;
  riskLevel: RiskLevel;
  riskScore: number;
  lastActive: string; // ISO string or relative time
  activeDays: number;
  concerns: string[];
  aiRecommendation: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  keywords: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface DailyTask {
  id: string;
  title: string;
  description: string;
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening';
  icon: string;
  completed: boolean;
}
