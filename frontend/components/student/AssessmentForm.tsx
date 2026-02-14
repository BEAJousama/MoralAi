import React, { useState } from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { Heart, Send } from 'lucide-react';
import { submitAssessmentForm, type AssessmentFormData, type AssessmentResult, type RiskLevel, type Trend } from '../../services/authService';

const CONCERN_OPTIONS = ['Stress', 'Sleep', 'Mood', 'Relationships', 'Academic', 'Loneliness', 'Health', 'Other'];

interface AssessmentFormProps {
  authToken: string | null;
  onSubmit: (assessment: AssessmentResult) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export const AssessmentForm: React.FC<AssessmentFormProps> = ({
  authToken,
  onSubmit,
  onCancel,
  submitLabel = 'Submit check-in',
}) => {
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('Low');
  const [concerns, setConcerns] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [trend, setTrend] = useState<Trend>('stable');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleConcern = (c: string) => {
    setConcerns((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) {
      setError('You must be logged in to submit.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const formData: AssessmentFormData = {
        risk_level: riskLevel,
        concerns,
        note: note.trim() || undefined,
        trend,
      };
      const assessment = await submitAssessmentForm(authToken, formData);
      onSubmit(assessment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-lg mx-auto !p-6">
      <div className="flex items-center gap-2 text-sage mb-6">
        <Heart size={24} />
        <h2 className="text-xl font-bold text-charcoal">Quick check-in form</h2>
      </div>
      <p className="text-gentleBlue-text text-sm mb-6">
        Use this form when the AI isn’t available. Your answers are saved the same way and admins can see your check-in.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">How are you feeling overall?</label>
          <div className="flex gap-3 flex-wrap">
            {(['Low', 'Medium', 'High'] as const).map((level) => (
              <label key={level} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="risk_level"
                  checked={riskLevel === level}
                  onChange={() => setRiskLevel(level)}
                  className="text-sage focus:ring-sage"
                />
                <span className="text-sm font-medium">{level}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">Low = doing okay · Medium = some strain · High = need more support</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">What’s on your mind? (optional)</label>
          <div className="flex flex-wrap gap-2">
            {CONCERN_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleConcern(c)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  concerns.includes(c) ? 'bg-sage text-white' : 'bg-gray-100 text-charcoal hover:bg-sage-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">Anything you’d like to add? (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A short note for yourself or your wellness team..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sage focus:ring-2 focus:ring-sage/20 outline-none resize-none"
            rows={3}
            maxLength={300}
          />
          <p className="text-xs text-gray-500 mt-1">{note.length}/300</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">Compared to last time?</label>
          <select
            value={trend}
            onChange={(e) => setTrend(e.target.value as Trend)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-sage outline-none"
          >
            <option value="stable">About the same</option>
            <option value="increasing">Things feel harder</option>
            <option value="decreasing">Things feel a bit better</option>
          </select>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-warmCoral-bg text-warmCoral-text text-sm">{error}</div>
        )}

        <div className="flex gap-3">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={loading} className={onCancel ? 'flex-1' : 'w-full'}>
            {loading ? 'Saving…' : submitLabel}
            <Send size={18} className="ml-2 inline" />
          </Button>
        </div>
      </form>
    </Card>
  );
};
