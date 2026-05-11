import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ClipboardList, 
  UserPlus,
  LogOut,
  Database,
  ChevronDown,
  ChevronRight,
  Sun,
  Coffee,
  Sunrise,
  DoorOpen,
  FlaskConical
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const labSubItems = [
  { to: '/lab/morning', icon: Sun, label: 'Morning Lab', time: '8:00 – 9:30 AM' },
  { to: '/lab/lunch', icon: Coffee, label: 'Lunch Break', time: '12:00 – 1:00 PM' },
  { to: '/lab/after-lunch', icon: Sunrise, label: 'After Lunch', time: 'After 1:00 PM' },
  { to: '/lab/leaving', icon: DoorOpen, label: 'Leaving Lab', time: 'End of Day' },
];

const topNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
];

const bottomNavItems = [
  { to: '/logs', icon: ClipboardList, label: 'Activity Logs' },
  { to: '/embed-list', icon: Database, label: 'Member List' },
  { to: '/enroll', icon: UserPlus, label: 'Enroll Member' },
];

export const Sidebar = () => {
  const { logout } = useAuth();
  const [labExpanded, setLabExpanded] = useState(true);

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
      isActive
        ? 'bg-[rgba(0,212,232,0.15)] text-[#00d4e8] border border-[rgba(0,212,232,0.3)]'
        : 'text-slate-400 hover:bg-[rgba(0,212,232,0.08)] hover:text-[#00d4e8]'
    }`;

  return (
    <aside className="w-64 flex flex-col min-h-screen" style={{
      background: 'linear-gradient(180deg, #0d1117 0%, #161b22 100%)',
      borderRight: '1px solid rgba(0,212,232,0.12)'
    }}>
      {/* Logo */}
      <div className="p-5 border-b" style={{ borderColor: 'rgba(0,212,232,0.12)' }}>
        <div className="flex items-center gap-3">
          <img src="/cxr-logo.png" alt="CXR" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="font-bold text-base leading-tight" style={{
              fontFamily: "'Rajdhani', sans-serif",
              background: 'linear-gradient(135deg, #00d4e8, #00b8cc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>CXR Lab</h1>
            <p className="text-xs text-slate-500 leading-tight">Entry &amp; Exit Monitor</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* Dashboard */}
        {topNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={navLinkClass}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}

        {/* Lab Section */}
        <div className="pt-3">
          <button
            onClick={() => setLabExpanded(!labExpanded)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-semibold"
            style={{ color: '#00d4e8' }}
          >
            <FlaskConical className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Lab</span>
            {labExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          {labExpanded && (
            <div className="mt-1 ml-3 space-y-0.5 border-l pl-3" style={{ borderColor: 'rgba(0,212,232,0.15)' }}>
              {labSubItems.map(({ to, icon: Icon, label, time }) => (
                <NavLink key={to} to={to} className={({ isActive }) =>
                  `flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-[rgba(0,212,232,0.15)] border border-[rgba(0,212,232,0.3)]'
                      : 'hover:bg-[rgba(0,212,232,0.05)]'
                  }`
                }>
                  {({ isActive }) => (
                    <>
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isActive ? 'text-[#00d4e8]' : 'text-slate-500'}`} />
                      <div>
                        <p className={`text-xs font-medium leading-tight ${isActive ? 'text-[#00d4e8]' : 'text-slate-400'}`}>{label}</p>
                        <p className="text-[10px] text-slate-600 leading-tight mt-0.5">{time}</p>
                      </div>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="my-2 border-t" style={{ borderColor: 'rgba(0,212,232,0.08)' }} />

        {/* Bottom nav items */}
        {bottomNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={navLinkClass}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t" style={{ borderColor: 'rgba(0,212,232,0.12)' }}>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-900/10 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};
