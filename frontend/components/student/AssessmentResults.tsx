import React from 'react';
import { Card } from '../Card';
import { Button } from '../Button';
import { ArrowLeft, Heart, Brain, CheckCircle2, ExternalLink, Phone, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AssessmentResult, RiskLevel } from '../../services/authService';

interface AssessmentResultsProps {
  assessment: AssessmentResult | null;
  onBack: () => void;
  onBackToHome?: () => void;
  onViewPlan: () => void;
  onRequestAppointment?: () => void;
}

const riskColors: Record<RiskLevel, { bg: string; text: string; label: string; stroke: string }> = {
  Low: { bg: 'bg-mint-risk', text: 'text-mint-risk', label: 'Low support needed', stroke: '#88C5A1' },
  Medium: { bg: 'bg-amber-risk', text: 'text-amber-text', label: 'Medium support level', stroke: '#F4B860' },
  High: { bg: 'bg-warmCoral-risk', text: 'text-warmCoral-text', label: 'Higher support recommended', stroke: '#E88476' },
};

export const AssessmentResults: React.FC<AssessmentResultsProps> = ({ assessment, onBack, onBackToHome, onViewPlan, onRequestAppointment }) => {
  if (!assessment) {
    return (
      <div className="min-h-screen bg-cream-bg p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gentleBlue-text mb-4">No assessment yet. Complete a check-in first.</p>
          <button onClick={onBack} className="text-sage font-semibold">Back to chat</button>
        </div>
      </div>
    );
  }

  const score = assessment.risk_score;
  const riskStyle = riskColors[assessment.risk_level];
  
  return (
    <div className="min-h-screen bg-cream-bg p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <button onClick={onBack} className="flex items-center text-gentleBlue-text hover:text-charcoal font-medium">
            <ArrowLeft size={20} className="mr-2" /> Back to chat
          </button>
          {onBackToHome && (
            <button onClick={onBackToHome} className="text-sm text-sage font-medium hover:underline">
              Back to home
            </button>
          )}
        </div>

        <h1 className="text-2xl font-bold text-charcoal mb-6">Your Mental Wellness Check-In</h1>

        <Card className="mb-6 text-center py-8">
            <div className="relative w-40 h-40 mx-auto mb-6 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#E8E5DE" strokeWidth="8" />
                    <motion.circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={riskStyle.stroke}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray="283"
                        initial={{ strokeDashoffset: 283 }}
                        animate={{ strokeDashoffset: 283 - (283 * score) / 100 }}
                        transition={{ duration: 1.5, ease: 'easeOut' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-charcoal">{score}</span>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">out of 100</span>
                </div>
            </div>

            <h2 className={`text-xl font-semibold mb-2 ${riskStyle.text}`}>{riskStyle.label}</h2>
            <p className="text-gentleBlue-text max-w-sm mx-auto leading-relaxed">
                {assessment.ai_recommendation}
            </p>
        </Card>

        <h3 className="text-lg font-semibold text-charcoal mb-4">Key areas we noticed</h3>
        <div className="grid gap-4 mb-8">
          {assessment.concerns.length > 0 ? (
            assessment.concerns.map((concern, i) => (
              <Card key={i} className="flex items-center !p-4">
                <div className="w-10 h-10 rounded-full bg-sage-50 flex items-center justify-center text-sage mr-4 shrink-0">
                  <Brain size={20} />
                </div>
                <h4 className="font-semibold text-charcoal">{concern}</h4>
              </Card>
            ))
          ) : (
            <Card className="flex items-center !p-4">
              <div className="w-10 h-10 rounded-full bg-mint-risk/20 flex items-center justify-center text-mint-risk mr-4 shrink-0">
                <Heart size={20} />
              </div>
              <p className="text-gentleBlue-text">No specific concerns flagged. Keep up your self-care.</p>
            </Card>
          )}
        </div>
        {assessment.keywords.length > 0 && (
          <p className="text-sm text-gray-500 mb-6">
            Themes: {assessment.keywords.join(', ')} · Trend: {assessment.trend}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {onRequestAppointment && (
            <Button fullWidth size="lg" onClick={onRequestAppointment} className="flex items-center justify-center gap-2">
              <Calendar size={20} />
              Request an appointment
            </Button>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button fullWidth size="lg" onClick={onViewPlan}>
              View Your Support Plan
            </Button>
            {onBackToHome && (
              <Button variant="secondary" fullWidth size="lg" onClick={onBackToHome}>
                Back to home
              </Button>
            )}
          </div>
        </div>

        {/* Suggested solutions (Low/Medium) or Follow-up (High) */}
        <Card className="mt-8 !p-6 border-l-4 border-sage">
          <h3 className="text-lg font-semibold text-charcoal mb-2 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-sage" />
            {(assessment.risk_level === 'Low' || assessment.risk_level === 'Medium') ? 'Suggested solutions' : 'Follow-up for you'}
          </h3>
          {(assessment.risk_level === 'Low' || assessment.risk_level === 'Medium') && (
            <p className="text-gentleBlue-text text-sm mb-4 leading-relaxed">
              Based on your check-in, our AI suggests: {assessment.ai_recommendation}
            </p>
          )}
          {assessment.risk_level === 'High' && (
            <>
              <p className="text-gentleBlue-text text-sm mb-4">
                It’s okay to ask for help. Reaching out is a sign of strength. Here are some next steps we suggest:
              </p>
              <ul className="space-y-2 text-sm text-charcoal mb-4">
                <li className="flex items-start gap-2">
                  <span className="text-sage mt-0.5">•</span>
                  <span>Share how you feel with someone you trust (friend, family, or campus counselor).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-sage mt-0.5">•</span>
                  <span>Contact your university wellness or counseling service to book a check-in.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-sage mt-0.5">•</span>
                  <span>Keep a small routine (sleep, meals, a short walk) to steady your week.</span>
                </li>
              </ul>
            </>
          )}
          {assessment.risk_level === 'Medium' && (
            <>
              <p className="text-gentleBlue-text text-sm mb-4">
                You’re not alone. Here are a few things that often help:
              </p>
              <ul className="space-y-2 text-sm text-charcoal mb-4">
                <li className="flex items-start gap-2">
                  <span className="text-sage mt-0.5">•</span>
                  <span>Schedule a 10–15 minute break today for something you enjoy.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-sage mt-0.5">•</span>
                  <span>Reply to one message or meet one person for a short chat.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-sage mt-0.5">•</span>
                  <span>Come back for another check-in in a few days if things feel heavier.</span>
                </li>
              </ul>
            </>
          )}
          {assessment.risk_level === 'Low' && (
            <>
              <p className="text-gentleBlue-text text-sm mb-4">
                Nice work checking in. A few ideas to keep the momentum:
              </p>
              <ul className="space-y-2 text-sm text-charcoal mb-4">
                <li className="flex items-start gap-2">
                  <span className="text-sage mt-0.5">•</span>
                  <span>Keep a short daily habit (e.g. one thing you’re grateful for or one small win).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-sage mt-0.5">•</span>
                  <span>Reach out to a friend or classmate who might need a check-in too.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-sage mt-0.5">•</span>
                  <span>Return anytime you want to talk or track how you’re doing.</span>
                </li>
              </ul>
            </>
          )}
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-charcoal mb-2">If you need immediate support</p>
            <p className="text-sm text-gentleBlue-text mb-2">
              Contact your campus counseling or use a 24/7 helpline in your country (e.g. local mental health hotline).
            </p>
            <a
              href="https://findahelpline.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sage font-medium text-sm hover:underline"
            >
              <Phone size={16} />
              Find a helpline
              <ExternalLink size={14} />
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
};
