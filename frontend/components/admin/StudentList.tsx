import React, { useState, useEffect, useMemo } from 'react';
import { Student } from '../../types';
import { getStudents, type ApiStudent } from '../../services/authService';
import { RiskBadge } from '../Badge';
import { UserPlus } from 'lucide-react';

interface StudentListProps {
  authToken: string | null;
  filterRisk?: 'High' | null;
  onClearFilter?: () => void;
  onSelectStudent: (student: Student) => void;
  onSelectApiStudent: (student: ApiStudent) => void;
}

export const StudentList: React.FC<StudentListProps> = ({
  authToken,
  filterRisk,
  onClearFilter,
  onSelectStudent,
  onSelectApiStudent,
}) => {
  const [registeredStudents, setRegisteredStudents] = useState<ApiStudent[]>([]);
  const [loading, setLoading] = useState(!!authToken);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authToken) {
      setRegisteredStudents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getStudents(authToken)
      .then(setRegisteredStudents)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [authToken]);

  const displayed = useMemo(() => {
    if (filterRisk === 'High') {
      return registeredStudents.filter((s) => s.risk_level === 'High');
    }
    return registeredStudents;
  }, [registeredStudents, filterRisk]);

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-charcoal flex items-center gap-2">
              <UserPlus size={20} className="text-sage shrink-0" />
              Registered Students
            </h2>
            <p className="text-sm text-gentleBlue-text mt-1">
              {loading ? 'Loading...' : filterRisk ? `${displayed.length} high-risk (of ${registeredStudents.length} total)` : `${registeredStudents.length} student(s) registered`}
            </p>
          </div>
          {filterRisk && onClearFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="text-sm font-medium text-sage hover:underline"
            >
              Clear filter · Show all
            </button>
          )}
        </div>
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-warmCoral-bg text-warmCoral-text text-sm">
            {error}
          </div>
        )}
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full text-left border-collapse min-w-[560px] text-sm">
            <thead>
              <tr className="bg-cream-light text-gentleBlue-text text-xs uppercase tracking-wider font-semibold">
                <th className="px-3 sm:px-6 py-3 sm:py-4">ID</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4">Username</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4">Risk</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4">Score</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">Last assessed</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">Registered</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {displayed.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 sm:px-6 py-6 sm:py-8 text-center text-gentleBlue-text">
                    {filterRisk ? 'No high-risk students in the list.' : 'No registered students yet. Students can sign up from the login screen.'}
                  </td>
                </tr>
              )}
              {displayed.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-sage-50 transition-colors cursor-pointer"
                  onClick={() => onSelectApiStudent(s)}
                >
                  <td className="px-3 sm:px-6 py-3 sm:py-4 font-medium text-charcoal">{s.id}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-charcoal max-w-[100px] sm:max-w-none truncate">{s.username}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    {s.risk_level != null ? <RiskBadge level={s.risk_level} /> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    {s.risk_score != null ? `${s.risk_score}/100` : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-gentleBlue-text hidden sm:table-cell">
                    {s.assessed_at ? new Date(s.assessed_at).toLocaleDateString(undefined, { dateStyle: 'short' }) : '—'}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-gentleBlue-text hidden md:table-cell">
                    {new Date(s.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
