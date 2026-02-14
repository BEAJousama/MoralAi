import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text' | 'outline-danger' | 'filled-danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-sage text-white shadow-soft hover:bg-sage-dark hover:shadow-medium active:translate-y-[1px]',
    secondary: 'bg-transparent text-sage border-2 border-sage hover:bg-sage-50 hover:border-sage-dark',
    text: 'bg-transparent text-gentleBlue-text hover:text-sage hover:underline',
    'outline-danger': 'bg-transparent text-warmCoral-text border-2 border-warmCoral-text hover:bg-warmCoral-bg',
    'filled-danger': 'bg-warmCoral-risk text-white hover:bg-warmCoral-text shadow-soft',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm rounded-lg',
    md: 'px-6 py-3 text-base rounded-xl',
    lg: 'px-8 py-4 text-lg rounded-2xl',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
