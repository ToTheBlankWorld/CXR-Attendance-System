import { X, AlertTriangle, Trash2, CheckCircle, Info } from 'lucide-react';
import { Button } from './Button';

const iconMap = {
  warning: { icon: AlertTriangle, color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  danger:  { icon: Trash2,        color: '#f87171', bg: 'rgba(239,68,68,0.12)' },
  success: { icon: CheckCircle,   color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  info:    { icon: Info,          color: '#00d4e8', bg: 'rgba(0,212,232,0.12)' },
};

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const { icon: Icon, color, bg } = iconMap[type] || iconMap.warning;

  const confirmVariant = type === 'danger' ? 'danger' : type === 'success' ? 'success' : 'primary';

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-xl p-6 max-w-md w-full mx-4" style={{
        background: '#1c2330',
        border: '1px solid rgba(0,212,232,0.15)',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full" style={{ background: bg }}>
              <Icon className="w-6 h-6" style={{ color }} />
            </div>
            <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-6 ml-12">
          {message}
        </p>

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={isLoading}>
            {isLoading ? 'Processing...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
