import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-corporate-charcoal">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`flex h-10 w-full rounded-sm border bg-white px-3 py-2 text-sm text-corporate-charcoal placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-corporate-teal focus-visible:border-corporate-teal disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${
            error ? 'border-corporate-red ring-1 ring-corporate-red' : 'border-corporate-hairline'
          } ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-xs text-corporate-red font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
