import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'available' | 'occupied' | 'unavailable' | 'neutral' | 'outline';
}

export function Badge({ className = '', variant = 'neutral', children, ...props }: BadgeProps) {
  const variants = {
    available: 'bg-emerald-50 text-corporate-green border-emerald-200',
    occupied: 'bg-rose-50 text-corporate-red border-rose-200',
    unavailable: 'bg-slate-100 text-corporate-grey border-slate-300',
    neutral: 'bg-corporate-offwhite text-corporate-charcoal border-corporate-hairline',
    outline: 'bg-transparent text-corporate-charcoal border-corporate-hairline',
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
