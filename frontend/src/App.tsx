import { useState, useEffect } from 'react';
import { AttentionChart } from './components/AttentionChart';
import { UserGrid } from './components/UserGrid';
import { SessionHeader } from './components/SessionHeader';

export default function App() {
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

  const [users, setUsers] = useState([
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

  const sessionData = {
    sessionId: '#9042',
    totalParticipants: 12,
    averageScore: 78,
    duration: '45m',
  };

  // Simulate real-time updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Update chart data
      setChartData((prev) => {
        const lastTime = prev[prev.length - 1].time;
        const [hours, minutes] = lastTime.split(':').map(Number);
        const newMinutes = minutes + 5;
        const newHours = hours + Math.floor(newMinutes / 60);
        const newTime = `${newHours}:${(newMinutes % 60).toString().padStart(2, '0')}`;
        const newScore = Math.floor(Math.random() * 40) + 60; // Random score between 60-100

        const newData = [...prev.slice(1), { time: newTime, score: newScore }];
        return newData;
      });

      // Update user scores randomly
      setUsers((prev) =>
        prev.map((user) => {
          const newScore = Math.floor(Math.random() * 60) + 40; // 40-100
          const newStatus = newScore >= 70 ? 'Active' : 'Idle';
          return { ...user, score: newScore, status: newStatus };
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-mono tracking-tight mb-2 text-[#00ff88]">
            CORPORATE ATTENTION MONITORING SYSTEM
          </h1>
          <div className="h-[2px] bg-gradient-to-r from-[#00ff88] to-transparent"></div>
        </div>

        <SessionHeader data={sessionData} />
        <AttentionChart data={chartData} />
        <UserGrid users={users} />
      </div>
    </div>
  );
}
