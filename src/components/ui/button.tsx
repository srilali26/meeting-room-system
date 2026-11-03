import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'teal';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-corporate-teal focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-sm';
    
    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-9 px-4 text-sm',
      lg: 'h-11 px-6 text-base',
    };

    const variants = {
      primary: 'bg-corporate-navy text-white hover:bg-[#071528] active:bg-[#050e1b] shadow-sm',
      secondary: 'bg-corporate-offwhite text-corporate-charcoal hover:bg-slate-200 border border-corporate-hairline',
      danger: 'bg-corporate-red text-white hover:bg-red-800 active:bg-red-900 shadow-sm',
      ghost: 'bg-transparent text-corporate-charcoal hover:bg-black/5 active:bg-black/10',
      outline: 'bg-white border border-corporate-hairline text-corporate-charcoal hover:bg-corporate-offwhite shadow-sm',
      teal: 'bg-corporate-teal text-white hover:bg-[#0b3844] shadow-sm',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
