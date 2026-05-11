import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authAPI.login(username, password);
      login(response.data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0d1117' }}>
      {/* Left panel - Banner */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-12 relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0d1117 50%, #0a1628 100%)',
        borderRight: '1px solid rgba(0,212,232,0.1)'
      }}>
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'linear-gradient(rgba(0,212,232,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,232,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />

        <img src="/cxr-banner.png" alt="CXR Lab" className="w-full max-w-md object-contain relative z-10 rounded-2xl" />
        <div className="mt-8 text-center relative z-10">
          <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
            CXR Lab Entry &amp; Exit Monitor
          </h2>
          <p className="text-slate-400 text-sm">Real-time face recognition lab monitoring system</p>
        </div>

        {/* Glowing orb */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-32 rounded-full opacity-10"
          style={{ background: 'radial-gradient(ellipse, #00d4e8, transparent)', filter: 'blur(40px)' }} />
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:max-w-md w-full">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <img src="/cxr-logo.png" alt="CXR" className="w-20 h-20 object-contain mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              CXR Lab Monitor
            </h1>
            <p className="text-slate-500 text-sm mt-1">Sign in to access the system</p>
          </div>

          <div className="rounded-2xl p-7" style={{
            background: '#161b22',
            border: '1px solid rgba(0,212,232,0.15)',
          }}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
              />

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-8 transition-colors"
                  style={{ color: '#64748b' }}
                  onMouseEnter={(e) => e.target.style.color = '#00d4e8'}
                  onMouseLeave={(e) => e.target.style.color = '#64748b'}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-lg text-sm" style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#f87171'
                }}>
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full py-3" loading={loading}>
                <ShieldCheck className="w-4 h-4" />
                Sign In
              </Button>
            </form>

            <div className="mt-5 text-center text-xs" style={{ color: '#475569' }}>
              Demo: <span style={{ color: '#00d4e8' }}>admin</span> / <span style={{ color: '#00d4e8' }}>admin123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
