import React, { useState, useEffect } from 'react';
import { getCounselors, createCounselor, type Counselor, type ProviderType } from '../../services/authService';
import { Card } from '../Card';
import { Button } from '../Button';
import { UserPlus, Users, Loader2 } from 'lucide-react';

interface CounselorsSectionProps {
  authToken: string | null;
}

export const CounselorsSection: React.FC<CounselorsSectionProps> = ({ authToken }) => {
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [loading, setLoading] = useState(!!authToken);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [providerType, setProviderType] = useState<ProviderType>('counselor');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!authToken) return;
    setLoading(true);
    getCounselors(authToken)
      .then(setCounselors)
      .catch(() => setCounselors([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [authToken]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken || !username.trim() || !password) return;
    setError(null);
    setSubmitting(true);
    try {
      await createCounselor(authToken, username.trim(), password, providerType);
      setUsername('');
      setPassword('');
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="!p-4 sm:!p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="font-semibold text-base sm:text-lg text-charcoal flex items-center gap-2">
          <Users size={20} className="text-sage shrink-0" />
          Doctors & counselors
        </h3>
        <Button size="sm" onClick={() => { setShowForm(!showForm); setError(null); }} className="w-full sm:w-auto">
          <UserPlus size={16} className="mr-1" />
          Add counselor
        </Button>
      </div>
      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 p-4 rounded-xl bg-cream-light space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select
              value={providerType}
              onChange={(e) => setProviderType(e.target.value as ProviderType)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="counselor">Counselor</option>
              <option value="doctor">Doctor</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            required
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            required
            minLength={6}
          />
          {error && <p className="text-sm text-warmCoral-text">{error}</p>}
          <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create'}</Button>
        </form>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-gentleBlue-text text-sm">
          <Loader2 size={18} className="animate-spin" />
          Loading…
        </div>
      ) : counselors.length === 0 ? (
        <p className="text-sm text-gentleBlue-text">No counselors yet. Add one so you can assign them to appointments.</p>
      ) : (
        <ul className="space-y-2">
          {counselors.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="font-medium text-charcoal">{c.username}</span>
              <span className="text-gray-500 capitalize">{c.provider_type ?? 'counselor'}</span>
              <span className="text-gray-400">ID {c.id}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
