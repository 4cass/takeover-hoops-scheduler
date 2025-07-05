
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, Clock, TrendingUp } from 'lucide-react';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';

interface CoachDashboardStatsProps {
  coachId: string;
}

export const CoachDashboardStats = ({ coachId }: CoachDashboardStatsProps) => {
  // Fetch coach's sessions
  const { data: sessions } = useQuery({
    queryKey: ['coach-sessions', coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          *,
          branches (name),
          session_participants (
            students (name)
          )
        `)
        .eq('coach_id', coachId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Fetch attendance records for coach's sessions
  const { data: attendanceRecords } = useQuery({
    queryKey: ['coach-attendance', coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          training_sessions!inner (
            coach_id,
            date
          ),
          students (name)
        `)
        .eq('training_sessions.coach_id', coachId);

      if (error) throw error;
      return data;
    }
  });

  // Calculate stats
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  const totalSessions = sessions?.length || 0;
  const completedSessions = sessions?.filter(s => s.status === 'completed').length || 0;
  const upcomingSessions = sessions?.filter(s => 
    s.status === 'scheduled' && new Date(s.date) >= now
  ).length || 0;

  const thisWeekSessions = sessions?.filter(s => 
    isWithinInterval(new Date(s.date), { start: weekStart, end: weekEnd })
  ) || [];

  const totalStudents = new Set(
    sessions?.flatMap(s => 
      s.session_participants?.map(p => p.students?.name) || []
    ).filter(Boolean)
  ).size;

  // Calculate attendance rate
  const totalAttendanceRecords = attendanceRecords?.length || 0;
  const presentRecords = attendanceRecords?.filter(r => r.status === 'present').length || 0;
  const attendanceRate = totalAttendanceRecords > 0 ? (presentRecords / totalAttendanceRecords) * 100 : 0;

  // Get recent sessions
  const recentSessions = sessions?.slice(0, 5) || [];

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
            <p className="text-xs text-muted-foreground">
              {completedSessions} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Sessions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingSessions}</div>
            <p className="text-xs text-muted-foreground">
              {thisWeekSessions.length} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">
              Total unique students
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {presentRecords}/{totalAttendanceRecords} sessions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions found.</p>
            ) : (
              recentSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {format(new Date(session.date), 'EEEE, MMM d')}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span>{session.start_time} - {session.end_time}</span>
                      <span>{session.branches?.name}</span>
                      <span>{session.session_participants?.length || 0} students</span>
                    </div>
                  </div>
                  <Badge variant={
                    session.status === 'completed' ? 'default' :
                    session.status === 'cancelled' ? 'destructive' : 'secondary'
                  }>
                    {session.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* This Week's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>This Week's Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {thisWeekSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions scheduled this week.</p>
            ) : (
              thisWeekSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {format(new Date(session.date), 'EEEE, MMM d')}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span>{session.start_time} - {session.end_time}</span>
                      <span>{session.branches?.name}</span>
                    </div>
                    {session.session_participants && session.session_participants.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {session.session_participants.map((participant, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {participant.students?.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge variant={
                    session.status === 'completed' ? 'default' :
                    session.status === 'cancelled' ? 'destructive' : 'secondary'
                  }>
                    {session.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
