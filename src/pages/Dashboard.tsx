
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { LocalStorage, STORAGE_KEYS } from '@/lib/storage';
import { Student, Coach, Branch, TrainingSession } from '@/types';
import { Users, User, MapPin, Calendar, TrendingUp, Clock, Award } from 'lucide-react';

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
      icon: Users,
      className: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Total Coaches',
      value: stats.totalCoaches,
      icon: User,
      className: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200',
      iconColor: 'text-green-600'
    },
    {
      title: 'Total Branches',
      value: stats.totalBranches,
      icon: MapPin,
      className: 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200',
      iconColor: 'text-purple-600'
    },
    {
      title: "Today's Sessions",
      value: stats.todaySessions,
      icon: Calendar,
      className: 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200',
      iconColor: 'text-orange-600'
    }
  ];

  const quickActions = [
    {
      title: 'Schedule New Session',
      description: 'Create a new training session',
      icon: Clock,
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Add New Student',
      description: 'Register a new player',
      icon: Users,
      color: 'bg-green-50 hover:bg-green-100 border-green-200',
      iconColor: 'text-green-600'
    },
    {
      title: 'View Today\'s Schedule',
      description: 'Check today\'s training sessions',
      icon: Calendar,
      color: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
      iconColor: 'text-orange-600'
    },
    {
      title: 'Performance Reports',
      description: 'View attendance and progress',
      icon: TrendingUp,
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
      iconColor: 'text-purple-600'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center lg:text-left">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-lg text-gray-600">Welcome to Takeover Basketball Management System</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className={`p-6 border-2 shadow-lg hover:shadow-xl transition-all duration-200 ${stat.className}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full bg-white shadow-md ${stat.iconColor}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <Card className="p-8 basketball-card">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
              <Award className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">Quick Actions</h3>
          </div>
          <div className="space-y-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  className={`w-full text-left p-4 rounded-xl transition-all duration-200 border-2 ${action.color}`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg bg-white shadow-sm ${action.iconColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{action.title}</h4>
                      <p className="text-sm text-gray-600">{action.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="p-8 basketball-card">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">Recent Activity</h3>
          </div>
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 mb-2">No recent activity to display</p>
              <p className="text-sm text-gray-500">Activity will appear here as you use the system</p>
            </div>
          </div>
        </Card>
      </div>

      {/* System Status */}
      <Card className="p-8 basketball-card">
        <h3 className="text-xl font-bold text-gray-900 mb-4">System Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-green-50 rounded-lg border-2 border-green-200">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Award className="w-6 h-6 text-white" />
            </div>
            <p className="font-semibold text-green-800">System Active</p>
            <p className="text-sm text-green-600">All services running</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Users className="w-6 w-6 text-white" />
            </div>
            <p className="font-semibold text-blue-800">Data Synced</p>
            <p className="text-sm text-blue-600">All records updated</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <p className="font-semibold text-orange-800">Ready to Scale</p>
            <p className="text-sm text-orange-600">Supabase integration ready</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
