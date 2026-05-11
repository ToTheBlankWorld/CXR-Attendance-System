export const Input = ({
  label,
  error,
  className = '',
  ...props
}) => (
  <div className={className}>
    {label && (
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#64748b' }}>
        {label}
      </label>
    )}
    <input
      className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200"
      style={{
        background: 'rgba(0,0,0,0.3)',
        border: error ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(0,212,232,0.15)',
        color: '#e2e8f0',
        '--tw-ring-color': '#00d4e8',
      }}
      onFocus={(e) => {
        e.target.style.borderColor = 'rgba(0,212,232,0.5)';
        e.target.style.boxShadow = '0 0 0 2px rgba(0,212,232,0.1)';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(0,212,232,0.15)';
        e.target.style.boxShadow = 'none';
      }}
      {...props}
    />
    {error && <p className="mt-1 text-xs" style={{ color: '#f87171' }}>{error}</p>}
  </div>
);
