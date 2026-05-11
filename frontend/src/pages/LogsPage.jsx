import { useState, useEffect } from 'react';
import { ClipboardList, Calendar, User, Trash2, Download, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { attendanceAPI } from '../services/api';

const SESSION_LABELS = {
  LAB_MORNING:    'Morning Lab',
  LAB_LUNCH:      'Lunch Break',
  LAB_AFTER_LUNCH:'After Lunch',
  LAB_EXIT:       'Leaving Lab',
};

export const LogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [filters, setFilters] = useState({
    session: '',
    date: new Date().toISOString().split('T')[0],
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const logsResponse = await attendanceAPI.getLogs(
        filters.session || undefined,
        filters.date || undefined
      );
      setLogs(logsResponse.data);
      setExpandedRows({});
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [filters]);

  const formatTime = (isoString) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString();
  };

  const toggleExpand = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleReset = async () => {
    setResetting(true);
    setShowConfirmModal(false);
    try {
      await attendanceAPI.resetAllLogs();
      setLogs([]);
    } catch (err) {
      console.error('Failed to reset:', err);
    } finally {
      setResetting(false);
    }
  };

  const exportCSV = () => {
    if (!logs.length) return;
    const headers = ['Name', 'Reg No', 'Date', 'Activities Count', 'First Entry', 'Last Exit'];
    const rows = logs.map(l => [
      `"${l.student_name}"`,
      l.reg_no,
      l.date,
      l.activity_count,
      formatTime(l.first_entry),
      formatTime(l.last_exit),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cxr_lab_logs_${filters.date || 'all'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(0,212,232,0.15)',
    color: '#e2e8f0',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    outline: 'none',
  };

  // Calculate stats from consolidated logs
  const totalActivities = logs.reduce((sum, log) => sum + log.activity_count, 0);
  const totalStudents = logs.length;

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleReset}
        title="Reset All Logs"
        message="This will permanently delete ALL activity logs. This action cannot be undone."
        confirmText="Delete All"
        type="danger"
        isLoading={resetting}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
            Activity Logs
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            Lab entry &amp; exit records for all sessions
          </p>
        </div>
        <div className="flex gap-3">
          {logs.length > 0 && (
            <Button variant="outline" onClick={exportCSV} size="sm">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          )}
          {logs.length > 0 && (
            <Button variant="danger" size="sm" onClick={() => setShowConfirmModal(true)} disabled={resetting}>
              <Trash2 className="w-4 h-4" />
              {resetting ? 'Resetting...' : 'Reset All'}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#64748b' }}>
                Session
              </label>
              <select
                value={filters.session}
                onChange={(e) => setFilters({ ...filters, session: e.target.value })}
                style={inputStyle}
              >
                <option value="">All Sessions</option>
                {Object.entries(SESSION_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#64748b' }}>
                <Calendar className="w-3 h-3 inline mr-1" />
                Date
              </label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                style={inputStyle}
              />
            </div>

            <Button variant="secondary" size="sm" onClick={() => setFilters({ session: '', date: '' })}>
              Clear Filters
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Summary badges */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Students', value: totalStudents, color: '#00d4e8' },
          { label: 'Total Activities', value: totalActivities, color: '#34d399' },
          { label: 'Avg Activities/Student', value: (totalActivities / (totalStudents || 1)).toFixed(1), color: '#fbbf24' },
        ].map(s => (
          <div key={s.label} className="rounded-xl px-4 py-3" style={{
            background: '#161b22', border: '1px solid rgba(0,212,232,0.1)'
          }}>
            <p className="text-xs text-slate-500 mb-0.5">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "'Rajdhani', sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <span className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" style={{ color: '#00d4e8' }} />
            Activity Records ({totalStudents} students, {totalActivities} activities)
          </span>
        </CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#00d4e8' }}></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-500">No activity logs found</p>
              <p className="text-slate-600 text-xs mt-1">Start a lab session to see entries here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                    {['', 'Name', 'Reg No', 'Date', 'Activities', 'First Entry', 'Last Exit'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#475569' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tbody key={log.id}>
                      {/* Main row - clickable to expand */}
                      <tr 
                        onClick={() => toggleExpand(log.id)}
                        className="border-t transition-colors hover:bg-[rgba(0,212,232,0.05)] cursor-pointer" 
                        style={{ borderColor: 'rgba(0,212,232,0.06)' }}
                      >
                        <td className="px-4 py-3 text-center">
                          {expandedRows[log.id] ? 
                            <ChevronUp className="w-4 h-4 inline" style={{ color: '#00d4e8' }} /> :
                            <ChevronDown className="w-4 h-4 inline" style={{ color: '#00d4e8' }} />
                          }
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-200">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{
                              background: 'rgba(0,212,232,0.1)', border: '1px solid rgba(0,212,232,0.2)'
                            }}>
                              <User className="w-3.5 h-3.5" style={{ color: '#00d4e8' }} />
                            </div>
                            {log.student_name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-500">{log.reg_no}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{log.date}</td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{
                            background: 'rgba(0,212,232,0.1)',
                            color: '#00d4e8',
                            border: '1px solid rgba(0,212,232,0.2)'
                          }}>
                            {log.activity_count} entries
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(log.first_entry)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatTime(log.last_exit)}</td>
                      </tr>
                      
                      {/* Expanded details - all activities */}
                      {expandedRows[log.id] && (
                        <tr style={{ background: 'rgba(0,212,232,0.02)' }}>
                          <td colSpan="7" className="px-4 py-4">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-slate-400 mb-3">📋 All Activities for {log.student_name}</p>
                              {log.activities.map((activity, idx) => (
                                <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg" style={{
                                  background: 'rgba(0,0,0,0.3)',
                                  border: '1px solid rgba(0,212,232,0.1)'
                                }}>
                                  <div className="flex items-center gap-3 flex-1">
                                    <span className="text-xs font-semibold text-slate-500 min-w-[20px]">{idx + 1}.</span>
                                    <Badge status={activity.status} />
                                    <span className="text-xs text-slate-500">{SESSION_LABELS[activity.lecture_id] || activity.lecture_id}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-slate-500">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      Entry: {formatTime(activity.entry_time)}
                                    </span>
                                    <span>Exit: {formatTime(activity.exit_time)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
