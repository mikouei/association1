'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from './LoadingSpinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-[10px] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantClasses = {
      // Kotiz Design System
      primary: 'bg-[#F5A623] text-[#1F2937] hover:bg-[#D9861F] focus:ring-[#F5A623]',
      secondary: 'bg-[#1F4E79] text-white hover:bg-[#2A5F94] focus:ring-[#1F4E79]',
      danger: 'bg-[#B00020] text-white hover:bg-[#8B001A] focus:ring-[#B00020]',
      ghost: 'bg-transparent text-[#6B7280] hover:bg-gray-100 focus:ring-gray-500',
      outline: 'bg-transparent border-[1.5px] border-[#1F4E79] text-[#1F4E79] hover:bg-[#1F4E79]/5 focus:ring-[#1F4E79]',
    };
    
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-[14.5px]',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <LoadingSpinner size="sm" className="mr-2" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
