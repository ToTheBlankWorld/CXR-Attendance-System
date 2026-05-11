const variants = {
  primary: '',
  secondary: '',
  success: '',
  danger: '',
  outline: '',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

const variantStyles = {
  primary: {
    background: 'linear-gradient(135deg, #00d4e8, #00b8cc)',
    color: '#0d1117',
    border: '1px solid transparent',
  },
  secondary: {
    background: 'rgba(100,116,139,0.15)',
    color: '#94a3b8',
    border: '1px solid rgba(100,116,139,0.25)',
  },
  success: {
    background: 'rgba(52,211,153,0.15)',
    color: '#34d399',
    border: '1px solid rgba(52,211,153,0.3)',
  },
  danger: {
    background: 'rgba(239,68,68,0.15)',
    color: '#f87171',
    border: '1px solid rgba(239,68,68,0.3)',
  },
  outline: {
    background: 'transparent',
    color: '#00d4e8',
    border: '1px solid rgba(0,212,232,0.4)',
  },
};

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  style: externalStyle = {},
  ...props
}) => (
  <button
    className={`
      ${sizes[size]}
      rounded-lg font-semibold transition-all duration-200
      disabled:opacity-40 disabled:cursor-not-allowed
      flex items-center justify-center gap-2
      hover:opacity-90 active:scale-95
      ${className}
    `}
    style={{ ...variantStyles[variant] || variantStyles.primary, ...externalStyle }}
    disabled={disabled || loading}
    {...props}
  >
    {loading && (
      <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></span>
    )}
    {children}
  </button>
);
