// Status badge with CXR lab-specific statuses
const statusStyles = {
  // New lab statuses
  ENTERED:             { bg: 'rgba(0,212,232,0.15)', text: '#00d4e8', border: 'rgba(0,212,232,0.3)',  label: '⬆ Entered' },
  LEFT_FOR_LUNCH:      { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.3)', label: '☕ Left for Lunch' },
  ENTERED_AFTER_LUNCH: { bg: 'rgba(52,211,153,0.12)', text: '#34d399', border: 'rgba(52,211,153,0.3)', label: '↩ Returned' },
  LEFT_LAB:            { bg: 'rgba(239,68,68,0.12)',  text: '#f87171', border: 'rgba(239,68,68,0.3)',  label: '⬇ Left Lab' },

  // Legacy fallbacks
  present:    { bg: 'rgba(0,212,232,0.15)', text: '#00d4e8', border: 'rgba(0,212,232,0.3)', label: 'Entered' },
  absent:     { bg: 'rgba(239,68,68,0.12)', text: '#f87171', border: 'rgba(239,68,68,0.3)', label: 'Left' },
  not_marked: { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', border: 'rgba(100,116,139,0.2)', label: 'Not Marked' },
};

export const Badge = ({ status, children }) => {
  const key = status?.toUpperCase?.() || status;
  const style = statusStyles[key] || statusStyles[status] || {
    bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', border: 'rgba(100,116,139,0.2)', label: status
  };

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{ background: style.bg, color: style.text, borderColor: style.border }}
    >
      {children || style.label || status?.replace(/_/g, ' ')}
    </span>
  );
};
