import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, hoverable = false }) => {
  const hoverStyles = hoverable ? 'hover:shadow-medium hover:-translate-y-0.5 cursor-pointer' : '';
  
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-soft p-5 transition-all duration-300 ${hoverStyles} ${className}`}
    >
      {children}
    </div>
  );
};
