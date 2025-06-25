
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { LocalStorage, STORAGE_KEYS } from '@/lib/storage';
import { Student, Coach, Branch, TrainingSession } from '@/types';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalCoaches: 0,
    totalBranches: 0,
    todaySessions: 0
  });

  useEffect(() => {
    const students = LocalStorage.get<Student>(STORAGE_KEYS.STUDENTS);
    const coaches = LocalStorage.get<Coach>(STORAGE_KEYS.COACHES);
    const branches = LocalStorage.get<Branch>(STORAGE_KEYS.BRANCHES);
    const sessions = LocalStorage.get<TrainingSession>(STORAGE_KEYS.SESSIONS);
    
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = sessions.filter(session => session.date === today);

    setStats({
      totalStudents: students.length,
      totalCoaches: coaches.length,
      totalBranches: branches.length,
      todaySessions: todaySessions.length
    });
  }, []);

  const statCards = [
    {
      title: 'Total Students',
      value: stats.totalStudents,
      className: 'bg-blue-50 border-blue-200'
    },
    {
      title: 'Total Coaches',
      value: stats.totalCoaches,
      className: 'bg-green-50 border-green-200'
    },
    {
      title: 'Total Branches',
      value: stats.totalBranches,
      className: 'bg-purple-50 border-purple-200'
    },
    {
      title: "Today's Sessions",
      value: stats.todaySessions,
      className: 'bg-orange-50 border-orange-200'
    }
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to Takeover Basketball Management System</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <Card key={index} className={`p-6 ${stat.className}`}>
            <h3 className="text-sm font-medium text-gray-600 mb-2">{stat.title}</h3>
            <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
              Schedule New Session
            </button>
            <button className="w-full text-left p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
              Add New Student
            </button>
            <button className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
              View Today's Schedule
            </button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <p>No recent activity to display</p>
            <p className="text-xs">Activity will appear here as you use the system</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
