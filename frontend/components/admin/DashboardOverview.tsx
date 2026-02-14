import React, { useState, useEffect } from 'react';
import { Card } from '../Card';
import { getDashboardStats, type DashboardStats } from '../../services/authService';
import { AlertTriangle, Users, TrendingUp, Activity, Loader2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface DashboardOverviewProps {
  authToken: string | null;
  onViewUrgent?: () => void;
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
  return `${diffD}d ago`;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ authToken, onViewUrgent }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(!!authToken);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authToken) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getDashboardStats(authToken)
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [authToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={32} className="animate-spin text-sage" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm">
        {error}
      </div>
    );
  }
  if (!stats) {
    return null;
  }

  const total = stats.totalActive || 1;
  const lowPct = Math.round((stats.lowRisk / total) * 100);
  const medPct = Math.round((stats.mediumRisk / total) * 100);
  const highPct = Math.round((stats.highRisk / total) * 100);
  const weekChange = stats.thisWeekCount - stats.lastWeekCount;
  const chartData = stats.trend.map((t) => ({ day: t.day, score: t.avgScore, count: t.count }));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <Card className="!p-4 sm:!p-6">
          <div className="flex justify-between items-start">
            <div className="min-w-0">
              <p className="text-gentleBlue-text text-xs sm:text-sm font-medium">Low Risk</p>
              <h3 className="text-2xl sm:text-3xl font-bold text-charcoal mt-1 sm:mt-2">{stats.lowRisk}</h3>
              <p className="text-sage text-sm font-semibold mt-1">{total > 0 ? `${lowPct}%` : '—'}</p>
            </div>
            <div className="w-4 h-4 rounded-full bg-mint-risk"></div>
          </div>
        </Card>

        <Card className="!p-4 sm:!p-6">
          <div className="flex justify-between items-start">
            <div className="min-w-0">
              <p className="text-gentleBlue-text text-xs sm:text-sm font-medium">Medium Risk</p>
              <h3 className="text-2xl sm:text-3xl font-bold text-charcoal mt-1 sm:mt-2">{stats.mediumRisk}</h3>
              <p className="text-amber-text text-sm font-semibold mt-1">{total > 0 ? `${medPct}%` : '—'}</p>
            </div>
            <div className="w-4 h-4 rounded-full bg-amber-risk"></div>
          </div>
        </Card>

        <Card className="!p-4 sm:!p-6">
          <div className="flex justify-between items-start">
            <div className="min-w-0">
              <p className="text-gentleBlue-text text-xs sm:text-sm font-medium">High Risk</p>
              <h3 className="text-2xl sm:text-3xl font-bold text-charcoal mt-1 sm:mt-2">{stats.highRisk}</h3>
              <p className="text-warmCoral-text text-sm font-semibold mt-1">{total > 0 ? `${highPct}%` : '—'}</p>
            </div>
            <div className="w-4 h-4 rounded-full bg-warmCoral-risk"></div>
          </div>
        </Card>

        <Card className="!p-4 sm:!p-6">
          <div className="flex justify-between items-start">
            <div className="min-w-0">
              <p className="text-gentleBlue-text text-xs sm:text-sm font-medium">Total Active</p>
              <h3 className="text-2xl sm:text-3xl font-bold text-charcoal mt-1 sm:mt-2">{stats.totalActive}</h3>
              <div className="flex items-center mt-1 text-sage text-sm font-semibold">
                <TrendingUp size={14} className="mr-1" />
                <span>{weekChange >= 0 ? '+' : ''}{weekChange} this week</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-charcoal">
              <Users size={16} />
            </div>
          </div>
        </Card>
      </div>

      {/* {stats.urgentCount > 0 && (
        <div className="bg-warmCoral-bg border border-warmCoral-risk/20 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-warmCoral-text">
          <div className="flex items-start sm:items-center gap-2 min-w-0">
            <AlertTriangle className="shrink-0 mt-0.5 sm:mt-0" size={20} />
            <span className="font-semibold text-sm sm:text-base">
              Urgent: {stats.urgentCount} student{stats.urgentCount !== 1 ? 's' : ''} with high risk in the last 48 hours.
            </span>
          </div>
          {onViewUrgent && (
            <button
              type="button"
              onClick={onViewUrgent}
              className="text-sm font-bold underline hover:text-red-700 shrink-0 self-start sm:self-center"
            >
              View Students
            </button>
          )}
        </div>
      )} */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2 !p-4 sm:!p-6">
          <h3 className="font-semibold text-base sm:text-lg text-charcoal mb-4 sm:mb-6">Average risk score (7 days)</h3>
          <div className="h-[220px] sm:h-[280px] lg:h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A8B89F" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#A8B89F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E0DDD6" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8A9BA8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8A9BA8', fontSize: 12 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [`Avg score: ${value}`, '']}
                />
                <Area type="monotone" dataKey="score" stroke="#A8B89F" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="!p-4 sm:!p-6">
          <h3 className="font-semibold text-base sm:text-lg text-charcoal mb-3 sm:mb-4">Risk distribution</h3>
          <div className="space-y-4">
            {[
              { name: 'Low', count: stats.lowRisk, pct: lowPct, color: 'bg-mint-risk' },
              { name: 'Medium', count: stats.mediumRisk, pct: medPct, color: 'bg-amber-risk' },
              { name: 'High', count: stats.highRisk, pct: highPct, color: 'bg-warmCoral-risk' },
            ].map((row) => (
              <div key={row.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-charcoal">{row.name}</span>
                  <span className="text-gentleBlue-text">{row.count} students</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`${row.color} h-2 rounded-full`} style={{ width: `${row.pct}%` }}></div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-100">
            <h4 className="font-semibold text-sm sm:text-base text-charcoal mb-3 flex items-center">
              <Activity size={18} className="mr-2 text-sage" /> Recent activity
            </h4>
            <div className="space-y-4 text-sm">
              {stats.recentActivity.length === 0 ? (
                <p className="text-gentleBlue-text">No check-ins yet.</p>
              ) : (
                stats.recentActivity.map((a, i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <div className="flex items-start min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 mr-2 shrink-0 ${
                          a.risk_level === 'High' ? 'bg-warmCoral-risk' : a.risk_level === 'Medium' ? 'bg-amber-risk' : 'bg-mint-risk'
                        }`}
                      />
                      <p className="text-gentleBlue-text">
                        <span className="font-medium text-charcoal">{a.username}</span> — {a.risk_level} risk
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{formatTimeAgo(a.assessed_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
