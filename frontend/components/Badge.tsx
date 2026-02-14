import React from 'react';
import { RiskLevel } from '../types';

interface BadgeProps {
  level?: RiskLevel;
  text?: string;
  className?: string;
}

export const RiskBadge: React.FC<BadgeProps> = ({ level = 'Low', text, className = '' }) => {
  const styles = {
    Low: 'bg-mint-bg text-mint-text',
    Medium: 'bg-amber-bg text-amber-text',
    High: 'bg-warmCoral-bg text-warmCoral-text',
  };

  return (
    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${styles[level]} ${className}`}>
      {level === 'Low' && <span className="mr-1.5 w-2 h-2 rounded-full bg-mint-text"></span>}
      {level === 'Medium' && <span className="mr-1.5 w-2 h-2 rounded-full bg-amber-text"></span>}
      {level === 'High' && <span className="mr-1.5 w-2 h-2 rounded-full bg-warmCoral-text"></span>}
      {text || `${level} Risk`}
    </span>
  );
};
