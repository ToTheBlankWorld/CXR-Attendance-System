export const Card = ({ children, className = '', ...props }) => (
  <div
    className={`rounded-xl border transition-all duration-200 ${className}`}
    style={{
      background: '#161b22',
      borderColor: 'rgba(0,212,232,0.12)',
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className = '' }) => (
  <div
    className={`px-5 py-4 border-b text-slate-200 font-semibold text-sm ${className}`}
    style={{ borderColor: 'rgba(0,212,232,0.1)' }}
  >
    {children}
  </div>
);

export const CardBody = ({ children, className = '' }) => (
  <div className={`p-5 ${className}`}>{children}</div>
);
