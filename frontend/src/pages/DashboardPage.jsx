import { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck,
  Coffee,
  DoorOpen,
  Activity,
  FlaskConical,
  Clock,
  TrendingUp
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { dashboardAPI } from '../services/api';

const StatCard = ({ icon: Icon, label, value, color, glowColor, loading, subtitle }) => (
  <div className="rounded-xl p-5 transition-all duration-200 hover:scale-[1.02]" style={{
    background: '#161b22',
    border: `1px solid ${glowColor ? glowColor.replace('1)', '0.2)') : 'rgba(0,212,232,0.12)'}`,
    boxShadow: glowColor ? `0 0 20px ${glowColor.replace('1)', '0.05)')}` : 'none',
  }}>
    <div className="flex items-start gap-4">
      <div className="p-3 rounded-xl flex-shrink-0" style={{ background: color, border: `1px solid ${color.replace('0.15', '0.3')}` }}>
        <Icon className="w-5 h-5" style={{ color: glowColor || '#00d4e8' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>{label}</p>
        {loading ? (
          <div className="h-8 w-16 rounded animate-pulse" style={{ background: 'rgba(0,212,232,0.1)' }}></div>
        ) : (
          <p className="text-3xl font-bold" style={{ color: glowColor || '#00d4e8', fontFamily: "'Rajdhani', sans-serif" }}>{value}</p>
        )}
        {subtitle && <p className="text-xs mt-1" style={{ color: '#475569' }}>{subtitle}</p>}
      </div>
    </div>
  </div>
);

const getSessionLabel = () => {
  const hour = new Date().getHours();
  const min = new Date().getMinutes();
  const timeNum = hour * 100 + min;

  if (timeNum >= 800 && timeNum <= 930) return { label: 'Morning Lab', session: 'MORNING', color: '#00d4e8' };
  if (timeNum >= 1200 && timeNum <= 1300) return { label: 'Lunch Break', session: 'LUNCH', color: '#fbbf24' };
  if (timeNum > 1300 && timeNum <= 1700) return { label: 'After Lunch', session: 'AFTER_LUNCH', color: '#34d399' };
  if (timeNum > 1700) return { label: 'Leaving Lab', session: 'EXIT', color: '#f87171' };
  return { label: 'No Active Session', session: null, color: '#64748b' };
};

export const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await dashboardAPI.getStats();
        setStats(statsRes.data);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const session = getSessionLabel();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
            Lab Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            CXR Lab Entry &amp; Exit Monitoring System
          </p>
        </div>

        {/* Current Time & Session */}
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums" style={{ color: '#00d4e8', fontFamily: "'Rajdhani', sans-serif" }}>
            {currentTime.toLocaleTimeString()}
          </p>
          <div className="flex items-center justify-end gap-2 mt-1">
            <div className="w-2 h-2 rounded-full pulse-live" style={{
              background: session.session ? session.color : '#64748b',
              boxShadow: session.session ? `0 0 6px ${session.color}` : 'none'
            }} />
            <span className="text-xs font-medium" style={{ color: session.color }}>{session.label}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Total Members"
          value={stats?.total_students ?? 0}
          color="rgba(0,212,232,0.12)"
          glowColor="rgba(0,212,232,1)"
          loading={loading}
          subtitle="Registered in system"
        />
        <StatCard
          icon={UserCheck}
          label="Currently in Lab"
          value={stats?.live_student_count ?? 0}
          color="rgba(52,211,153,0.12)"
          glowColor="rgba(52,211,153,1)"
          loading={loading}
          subtitle="Active right now"
        />
        <StatCard
          icon={Coffee}
          label="Out for Lunch"
          value={stats?.out_for_lunch ?? 0}
          color="rgba(251,191,36,0.12)"
          glowColor="rgba(251,191,36,1)"
          loading={loading}
          subtitle="Left for lunch break"
        />
        <StatCard
          icon={DoorOpen}
          label="Left Lab"
          value={stats?.left_lab ?? 0}
          color="rgba(239,68,68,0.12)"
          glowColor="rgba(239,68,68,1)"
          loading={loading}
          subtitle="Exited for the day"
        />
        <StatCard
          icon={Activity}
          label="Current Session"
          value={session.label}
          color="rgba(100,116,139,0.12)"
          glowColor={session.color}
          loading={false}
          subtitle={session.session ? `Mode: ${session.session}` : 'Outside session hours'}
        />
        <StatCard
          icon={TrendingUp}
          label="Attendance %"
          value={`${stats?.attendance_percentage ?? 0}%`}
          color="rgba(139,92,246,0.12)"
          glowColor="rgba(139,92,246,1)"
          loading={loading}
          subtitle="Of registered members"
        />
      </div>

      {/* Quick Access */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4" style={{ color: '#00d4e8' }} />
            <span>Lab Sessions</span>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Morning Lab', time: '8:00 – 9:30 AM', color: '#00d4e8', bg: 'rgba(0,212,232,0.08)', path: '/lab/morning' },
              { label: 'Lunch Break', time: '12:00 – 1:00 PM', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', path: '/lab/lunch' },
              { label: 'After Lunch', time: 'After 1:00 PM', color: '#34d399', bg: 'rgba(52,211,153,0.08)', path: '/lab/after-lunch' },
              { label: 'Leaving Lab', time: 'End of Day', color: '#f87171', bg: 'rgba(239,68,68,0.08)', path: '/lab/leaving' },
            ].map((s) => (
              <a
                key={s.label}
                href={s.path}
                className="block rounded-xl p-4 transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: s.bg,
                  border: `1px solid ${s.color}30`,
                  textDecoration: 'none'
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" style={{ color: '#64748b' }} />
                  <span className="text-xs" style={{ color: '#64748b' }}>{s.time}</span>
                </div>
              </a>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
