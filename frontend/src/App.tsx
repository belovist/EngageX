import { useState, useEffect } from 'react';
import { AttentionChart } from './components/AttentionChart';
import { UserGrid } from './components/UserGrid';
import { SessionHeader } from './components/SessionHeader';
import { Sidebar } from './components/Sidebar';
import { StatisticsCards } from './components/StatisticsCards';
import { SearchBar } from './components/SearchBar';
import { AlertPanel } from './components/AlertPanel';
import { UserDetailModal } from './components/UserDetailModal';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ThemeToggle } from './components/ThemeToggle';
import { Users, Target, TrendingUp, Clock } from 'lucide-react';

interface User {
  id: number;
  name: string;
  status: string;
  score: number;
}

interface Alert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  timestamp: string;
}

function AppContent() {
  const [chartData, setChartData] = useState([
    { time: '10:00', score: 82 },
    { time: '10:05', score: 85 },
    { time: '10:10', score: 78 },
    { time: '10:15', score: 72 },
    { time: '10:20', score: 68 },
    { time: '10:25', score: 75 },
    { time: '10:30', score: 81 },
    { time: '10:35', score: 79 },
    { time: '10:40', score: 76 },
    { time: '10:45', score: 78 },
  ]);

  const [users, setUsers] = useState<User[]>([
    { id: 1, name: 'User 01', status: 'Active', score: 85 },
    { id: 2, name: 'User 02', status: 'Active', score: 92 },
    { id: 3, name: 'User 03', status: 'Idle', score: 45 },
    { id: 4, name: 'User 04', status: 'Active', score: 78 },
    { id: 5, name: 'User 05', status: 'Active', score: 88 },
    { id: 6, name: 'User 06', status: 'Idle', score: 52 },
    { id: 7, name: 'User 07', status: 'Active', score: 91 },
    { id: 8, name: 'User 08', status: 'Active', score: 76 },
    { id: 9, name: 'User 09', status: 'Active', score: 82 },
    { id: 10, name: 'User 10', status: 'Idle', score: 38 },
    { id: 11, name: 'User 11', status: 'Active', score: 87 },
    { id: 12, name: 'User 12', status: 'Active', score: 79 },
  ]);

  const [alerts, setAlerts] = useState<Alert[]>([]);

  const [activeView, setActiveView] = useState('dashboard');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { theme } = useTheme();

  const sessionData = {
    sessionId: '#9042',
    totalParticipants: 12,
    averageScore: Math.round(users.reduce((sum, u) => sum + u.score, 0) / users.length),
    duration: '45m',
  };

  const stats = [
    {
      label: 'Total Users',
      value: users.length,
      trend: 5,
      icon: <Users size={20} className="text-blue-400" />,
      color: 'bg-blue-900/30',
    },
    {
      label: 'Active Users',
      value: users.filter((u) => u.status === 'Active').length,
      trend: 8,
      icon: <TrendingUp size={20} className="text-green-400" />,
      color: 'bg-green-900/30',
    },
    {
      label: 'Average Score',
      value: sessionData.averageScore + '%',
      trend: -2,
      icon: <Target size={20} className="text-yellow-400" />,
      color: 'bg-yellow-900/30',
    },
    {
      label: 'Session Duration',
      value: sessionData.duration,
      trend: 0,
      icon: <Clock size={20} className="text-purple-400" />,
      color: 'bg-purple-900/30',
    },
    {
      label: 'Peak Score',
      value: Math.max(...users.map((u) => u.score)) + '%',
      trend: 12,
      icon: <TrendingUp size={20} className="text-cyan-400" />,
      color: 'bg-cyan-900/30',
    },
  ];

  // Simulate real-time updates every 5 seconds
  useEffect(() => {
    let previousAverage = sessionData.averageScore;

    const interval = setInterval(() => {
      // Update chart data
      setChartData((prev) => {
        const lastTime = prev[prev.length - 1].time;
        const [hours, minutes] = lastTime.split(':').map(Number);
        const newMinutes = minutes + 5;
        const newHours = hours + Math.floor(newMinutes / 60);
        const newTime = `${newHours}:${(newMinutes % 60).toString().padStart(2, '0')}`;
        const newScore = Math.floor(Math.random() * 40) + 60;

        const newData = [...prev.slice(1), { time: newTime, score: newScore }];
        return newData;
      });

      // Update user scores randomly
      setUsers((prev) => {
        const updated = prev.map((user) => {
          const newScore = Math.floor(Math.random() * 60) + 40;
          const newStatus = newScore >= 70 ? 'Active' : 'Idle';
          return { ...user, score: newScore, status: newStatus };
        });

        // Calculate current average
        const currentAverage = Math.round(
          updated.reduce((sum, u) => sum + u.score, 0) / updated.length
        );

        // Only trigger alert if average is low (below 70%)
        if (currentAverage < 70 && previousAverage >= 70) {
          const newAlert: Alert = {
            id: Date.now().toString(),
            type: 'warning',
            title: 'Average Attention Score Declining',
            message: `Session average has dropped to ${currentAverage}%`,
            timestamp: 'Just now',
          };
          // Replace previous alerts with new one
          setAlerts([newAlert]);

          // Auto-dismiss after 8 seconds
          setTimeout(() => {
            setAlerts((prev) => prev.filter((a) => a.id !== newAlert.id));
          }, 8000);
        }

        // Alert if critical (below 60%)
        if (currentAverage < 60 && previousAverage >= 60) {
          const newAlert: Alert = {
            id: Date.now().toString(),
            type: 'critical',
            title: 'Critical: Low Attention Session',
            message: `Session average is critically low at ${currentAverage}%`,
            timestamp: 'Just now',
          };
          // Replace previous alerts with new one
          setAlerts([newAlert]);

          // Auto-dismiss after 10 seconds
          setTimeout(() => {
            setAlerts((prev) => prev.filter((a) => a.id !== newAlert.id));
          }, 10000);
        }

        previousAverage = currentAverage;
        return updated;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionData.averageScore]);

  const getThemeClasses = () => {
    switch (theme) {
      case 'light':
        return 'bg-white text-gray-900';
      case 'cyberpunk':
        return 'bg-black text-cyan-400';
      case 'ocean':
        return 'bg-blue-950 text-cyan-300';
      case 'purple':
        return 'bg-purple-950 text-purple-200';
      default:
        return 'bg-gray-900 text-white';
    }
  };

  return (
    <div className={`min-h-screen ${getThemeClasses()} transition-colors duration-300`}>
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      <div className="ml-0 lg:ml-64 p-6">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
              EngageX
            </h1>
            <p className="text-gray-400 text-sm">Real-time Attention Monitoring System</p>
          </div>
          <ThemeToggle />
        </header>

        {/* Alerts */}
        <AlertPanel alerts={alerts} onDismiss={(id) => setAlerts(alerts.filter((a) => a.id !== id))} />

        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar
            onSearch={setSearchQuery}
            placeholder="Search users, sessions, or data..."
          />
        </div>

        {/* Main Content */}
        {activeView === 'dashboard' && (
          <>
            {/* Statistics */}
            <StatisticsCards stats={stats} />

            {/* Session Header and Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2">
                <AttentionChart data={chartData} />
              </div>
              <div>
                <SessionHeader data={sessionData} />
              </div>
            </div>

            {/* User Grid */}
            <UserGrid users={users} onUserSelect={setSelectedUser} />
          </>
        )}

        {activeView === 'users' && (
          <>
            <h2 className="text-2xl font-bold mb-6">User Analytics</h2>
            <UserGrid users={users} onUserSelect={setSelectedUser} />
          </>
        )}

        {activeView === 'alerts' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-6">System Alerts</h2>
            {alerts.length === 0 ? (
              <p className="text-gray-400">No active alerts</p>
            ) : (
              <AlertPanel alerts={alerts} onDismiss={(id) => setAlerts(alerts.filter((a) => a.id !== id))} />
            )}
          </div>
        )}

        {activeView === 'export' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-6">Export Data</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { format: 'CSV', desc: 'Export as CSV file' },
                { format: 'PDF', desc: 'Generate PDF report' },
                { format: 'JSON', desc: 'Export as JSON data' },
              ].map((option) => (
                <button
                  key={option.format}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg transition-colors text-center"
                >
                  <p className="font-bold text-lg mb-2">{option.format}</p>
                  <p className="text-sm text-gray-200">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeView === 'settings' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-6">Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Enable email notifications</span>
                <input type="checkbox" className="w-5 h-5" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Real-time alerts</span>
                <input type="checkbox" className="w-5 h-5" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Auto-export data</span>
                <input type="checkbox" className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
