
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Users, CheckCircle, Clock, TrendingUp, Target } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function CoachDashboardStats() {
  const { user } = useAuth();

  // Get coach ID from user
  const { data: coachId } = useQuery({
    queryKey: ['coach-id', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('coaches')
        .select('id')
        .eq('auth_id', user.id)
        .single();
      
      if (error) return null;
      return data?.id;
    },
    enabled: !!user?.id,
  });

  // Fetch sessions for this coach
  const { data: sessions = [] } = useQuery({
    queryKey: ['coach-sessions', coachId],
    queryFn: async () => {
      if (!coachId) return [];
      
      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          *,
          branches!training_sessions_branch_id_fkey (
            name,
            city
          ),
          session_coaches!inner (
            coach_id
          )
        `)
        .eq('session_coaches.coach_id', coachId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching coach sessions:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!coachId,
  });

  // Fetch attendance records for coach's sessions
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['coach-attendance', coachId],
    queryFn: async () => {
      if (!coachId) return [];
      
      const sessionIds = sessions.map(s => s.id);
      if (sessionIds.length === 0) return [];

      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .in('session_id', sessionIds);

      if (error) {
        console.error('Error fetching attendance records:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!coachId && sessions.length > 0,
  });

  // Calculate stats
  const totalSessions = sessions.length;
  const upcomingSessions = sessions.filter(s => 
    new Date(s.date) > new Date() && s.status === 'scheduled'
  ).length;
  const completedSessions = sessions.filter(s => s.status === 'completed').length;
  const totalAttendance = attendanceRecords.filter(r => r.status === 'present').length;
  const attendanceRate = attendanceRecords.length > 0 
    ? Math.round((totalAttendance / attendanceRecords.length) * 100) 
    : 0;

  // Recent sessions for activity feed
  const recentSessions = sessions
    .filter(s => new Date(s.date) <= new Date())
    .slice(0, 5);

  if (!coachId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading coach information...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSessions}</div>
            <p className="text-xs text-muted-foreground">All time sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Sessions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingSessions}</div>
            <p className="text-xs text-muted-foreground">Scheduled sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedSessions}</div>
            <p className="text-xs text-muted-foreground">Sessions completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceRate}%</div>
            <p className="text-xs text-muted-foreground">Student attendance</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSessions.length > 0 ? (
                recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium">{new Date(session.date).toLocaleDateString()}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.start_time} - {session.end_time}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.branches?.name || 'Unknown Branch'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        session.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : session.status === 'scheduled'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {session.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">No recent sessions</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">This Week's Sessions</span>
                <span className="font-medium">
                  {sessions.filter(s => {
                    const sessionDate = new Date(s.date);
                    const now = new Date();
                    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    return sessionDate >= weekStart && sessionDate <= weekEnd;
                  }).length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">This Month's Sessions</span>
                <span className="font-medium">
                  {sessions.filter(s => {
                    const sessionDate = new Date(s.date);
                    const now = new Date();
                    return sessionDate.getMonth() === now.getMonth() && 
                           sessionDate.getFullYear() === now.getFullYear();
                  }).length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Average Attendance</span>
                <span className="font-medium">{attendanceRate}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
