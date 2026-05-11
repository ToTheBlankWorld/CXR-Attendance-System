import { useState, useEffect } from 'react';
import { Database, Search, Download, User, RefreshCw } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { recognitionAPI } from '../services/api';

export const EmbedListPage = () => {
  const [members, setMembers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await recognitionAPI.getEnrolledStudents();
      const list = response.data.students || [];
      setMembers(list);
      setFiltered(list);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFiltered(
      members.filter(m =>
        m.student_name?.toLowerCase().includes(term) ||
        m.reg_no?.toString().includes(term)
      )
    );
  }, [searchTerm, members]);

  const handleDownload = () => {
    const rows = [['Reg No', 'Name'], ...filtered.map(m => [m.reg_no, m.student_name])];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cxr_members_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(0,212,232,0.15)',
    color: '#e2e8f0',
    borderRadius: '8px',
    padding: '8px 12px 8px 36px',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
            Member List
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            All lab members enrolled with face embeddings
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={fetchMembers}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!filtered.length}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Enrolled', value: members.length, color: '#00d4e8' },
          { label: 'Showing', value: filtered.length, color: '#34d399' },
          { label: 'With Embeddings', value: members.length, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} className="rounded-xl px-5 py-4 text-center" style={{
            background: '#161b22', border: '1px solid rgba(0,212,232,0.1)'
          }}>
            <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">{s.label}</p>
            <p className="text-3xl font-bold" style={{ color: s.color, fontFamily: "'Rajdhani', sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Member Table */}
      <Card>
        <CardHeader>
          <span className="flex items-center gap-2">
            <Database className="w-4 h-4" style={{ color: '#00d4e8' }} />
            Enrolled Members ({filtered.length})
          </span>
        </CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#00d4e8' }}></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Database className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-500">No members found</p>
              <p className="text-slate-600 text-xs mt-1">Enroll members to see them here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                    {['#', 'ID / Reg No', 'Member Name', 'Status', 'Embedding'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#475569' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((member, idx) => (
                    <tr key={member.reg_no} className="border-t transition-colors hover:bg-[rgba(0,212,232,0.03)]" style={{ borderColor: 'rgba(0,212,232,0.06)' }}>
                      <td className="px-5 py-3.5 text-xs text-slate-600">{idx + 1}</td>
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-400">{member.reg_no}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{
                            background: 'rgba(0,212,232,0.1)', border: '1px solid rgba(0,212,232,0.2)'
                          }}>
                            <span className="text-xs font-bold" style={{ color: '#00d4e8' }}>
                              {member.student_name?.charAt(0)?.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-slate-200">{member.student_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{
                          background: 'rgba(52,211,153,0.12)',
                          color: '#34d399',
                          border: '1px solid rgba(52,211,153,0.25)'
                        }}>
                          Active
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{
                          background: 'rgba(0,212,232,0.1)',
                          color: '#00d4e8',
                          border: '1px solid rgba(0,212,232,0.2)'
                        }}>
                          ✓ Enrolled
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="text-xs text-slate-600 text-center">
        All members have their face embeddings stored — ready for recognition in all lab sessions.
      </div>
    </div>
  );
};
