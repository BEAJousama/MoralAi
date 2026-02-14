import React from 'react';
import { Student } from '../../types';
import { RiskBadge } from '../Badge';
import { Button } from '../Button';
import { X, TrendingUp, Clock, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MOCK_CHART_DATA } from '../../constants';

interface StudentModalProps {
  student: Student | null;
  onClose: () => void;
}

export const StudentModal: React.FC<StudentModalProps> = ({ student, onClose }) => {
  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
            <div>
                <h2 className="text-xl font-bold text-charcoal">Student Profile: {student.id}</h2>
                <span className="text-sm text-gentleBlue-text">{student.department} Department</span>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-charcoal transition-colors">
                <X size={24} />
            </button>
        </div>

        <div className="p-6 md:p-8 space-y-8">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-6 rounded-2xl flex items-center justify-between ${
                    student.riskLevel === 'High' ? 'bg-warmCoral-bg border border-warmCoral-risk/20' : 
                    student.riskLevel === 'Medium' ? 'bg-amber-bg border border-amber-risk/20' : 
                    'bg-mint-bg border border-mint-risk/20'
                }`}>
                    <div>
                        <p className="text-sm font-semibold opacity-70 mb-1">Current Risk Level</p>
                        <div className="flex items-center gap-3">
                             <RiskBadge level={student.riskLevel} className="scale-110 origin-left" />
                             <span className="text-3xl font-bold text-charcoal">{student.riskScore}/100</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                    <p className="text-sm font-semibold text-gray-500 mb-4">Engagement Stats</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center text-xs text-gray-400 mb-1">
                                <Clock size={12} className="mr-1" /> Last Active
                            </div>
                            <span className="font-semibold text-charcoal">{student.lastActive}</span>
                        </div>
                         <div>
                            <div className="flex items-center text-xs text-gray-400 mb-1">
                                <TrendingUp size={12} className="mr-1" /> Trend
                            </div>
                            <span className="font-semibold text-charcoal capitalize">{student.trend}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Analysis */}
            <div className="bg-cream rounded-2xl p-6 md:p-8">
                <h3 className="text-lg font-bold text-charcoal mb-4 flex items-center">
                    🤖 AI Analysis & Recommendations
                </h3>
                <div className="space-y-6">
                    <div>
                        <h4 className="font-semibold text-charcoal mb-2">Primary Concerns:</h4>
                        <ul className="list-disc list-inside space-y-1 text-gentleBlue-text">
                            {student.concerns.map((concern, idx) => (
                                <li key={idx}>{concern}</li>
                            ))}
                            {student.keywords.length > 0 && (
                                <li className="italic text-sm mt-2 text-gray-500">
                                    Keywords detected: {student.keywords.join(", ")}
                                </li>
                            )}
                        </ul>
                    </div>
                    
                    <div>
                        <h4 className="font-semibold text-charcoal mb-2">Recommended Intervention:</h4>
                        <div className="bg-white border-l-4 border-sage p-4 rounded-r-xl shadow-sm">
                            <p className="font-bold text-charcoal mb-1">{student.aiRecommendation}</p>
                            <p className="text-sm text-gray-500">Based on severity score and recent keywords.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div>
                <h3 className="text-lg font-bold text-charcoal mb-4">Mood History (Last 7 Days)</h3>
                <div className="h-48 w-full bg-white border border-gray-100 rounded-xl p-4">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={MOCK_CHART_DATA}>
                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                            <Tooltip contentStyle={{borderRadius: '8px'}} />
                            <Area type="monotone" dataKey="score" stroke="#E89F8D" fill="#FFF4F2" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 flex flex-col sm:flex-row justify-end gap-3 bg-gray-50 rounded-b-2xl">
            <Button variant="text" onClick={onClose}>Close</Button>
            <Button variant="secondary">Schedule Later</Button>
            <Button variant={student.riskLevel === 'High' ? 'filled-danger' : 'primary'}>
                {student.riskLevel === 'High' ? 'Book Psychiatrist (Urgent)' : 'Book Appointment'}
            </Button>
        </div>
      </div>
    </div>
  );
};
