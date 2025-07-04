import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Users, CheckCircle, Clock, TrendingUp, Activity, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/context/AuthContext";

type RecentActivity = {
  id: string;
  type: string;
  description: string;
  created_at: string;
};

export function CoachDashboardStats() {
  const navigate = useNavigate();
  const { coachData, loading } = useAuth();

  console.log("CoachDashboardStats - Coach data:", coachData, "Loading:", loading);

  const { data: stats } = useQuery({
    queryKey: ['coach-dashboard-stats', coachData?.id],
    queryFn: async () => {
      console.log("Fetching coach stats for ID:", coachData?.id);
      if (!coachData?.id) return { sessions: 0 };

      const sessionsRes = await supabase
        .from('training_sessions')
        .select('id')
        .eq('coach_id', coachData.id)
        .eq('status', 'scheduled');

      console.log("Sessions result:", sessionsRes);

      return {
        sessions: sessionsRes.data?.length || 0
      };
    },
    enabled: !!coachData?.id && !loading
  });

  const { data: upcomingSessions } = useQuery({
    queryKey: ['coach-upcoming-sessions', coachData?.id],
    queryFn: async () => {
      if (!coachData?.id) return [];

      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          id,
          date,
          start_time,
          end_time,
          branches!inner (name),
          session_participants (count)
        `)
        .eq('coach_id', coachData.id)
        .eq('status', 'scheduled')
        .gte('date', new Date().toISOString().slice(0, 10))
        .order('date', { ascending: true })
        .limit(5);

      if (error) {
        console.error("Error fetching upcoming sessions:", error);
        throw error;
      }
      
      console.log("Upcoming sessions:", data);
      return data || [];
    },
    enabled: !!coachData?.id && !loading
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['coach-recent-activity', coachData?.id],
    queryFn: async () => {
      if (!coachData?.id) return [];

      const [attendanceRes, sessionsRes] = await Promise.all([
        supabase
          .from('attendance_records')
          .select(`
            id,
            created_at,
            students!inner (name),
            training_sessions!inner (
              date,
              coach_id
            )
          `)
          .eq('training_sessions.coach_id', coachData.id)
          .eq('status', 'present')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('training_sessions')
          .select('id, created_at')
          .eq('coach_id', coachData.id)
          .eq('status', 'scheduled')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      const activities: RecentActivity[] = [
        ...(attendanceRes.data?.map(item => ({
          id: item.id,
          type: 'attendance',
          description: `${item.students.name} attended your session on ${format(new Date(item.training_sessions.date), 'MMM dd, yyyy')}`,
          created_at: item.created_at
        })) || []),
        ...(sessionsRes.data?.map(item => ({
          id: item.id,
          type: 'session',
          description: `You scheduled a new session`,
          created_at: item.created_at
        })) || [])
      ];

      return activities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
    },
    enabled: !!coachData?.id && !loading
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-7xl mx-auto text-center py-16">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-black mb-3">Loading your dashboard...</h3>
          <p className="text-lg text-gray-600">Please wait while we fetch your data.</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "My Scheduled Sessions",
      value: stats?.sessions || 0,
      icon: Calendar,
      color: "text-accent",
      bgGradient: "from-accent/10 to-accent/5",
      borderColor: "border-foreground"
    }
  ];

  const formatTime12Hour = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'attendance':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'session':
        return <Calendar className="h-5 w-5 text-accent" style={{ color: '#BEA877' }} />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-white pt-4 p-6">
      <div className="max-w-7xl mx-auto space-y-8 -mt-5">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#181818] mb-2 tracking-tight">
            Coach Dashboard
          </h1>
          <p className="text-lg text-gray-700">
            Welcome back, {coachData?.name}! Here's your coaching overview.
          </p>
        </div>

    <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-stretch">
  {/* Stat Cards Column */}
  <div className="flex flex-col gap-4 h-full">
    {statCards.map((stat, index) => {
      const IconComponent = stat.icon;
      return (
        <Card
          key={index}
          className="flex-1 border-2 border-[#181A18] bg-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:scale-105 cursor-pointer group"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {stat.title}
            </CardTitle>
            <div className="p-2 rounded-lg bg-accent/10 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <IconComponent className="h-5 w-5" style={{ color: '#BEA877' }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground mb-1">{stat.value}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1" />
              Active
            </div>
          </CardContent>
        </Card>
      );
    })}
  </div>

  {/* Quick Actions */}
  <Card className="h-full border-2 border-[#181A18] bg-white shadow-xl flex flex-col">
    <CardHeader className="border-b border-[#181A18] bg-[#181A18]">
      <CardTitle className="text-2xl font-bold text-[#efeff1] flex items-center">
        <Calendar className="h-6 w-6 mr-3 text-accent" style={{ color: '#BEA877' }} />
        Quick Actions
      </CardTitle>
      <CardDescription className="text-gray-400 text-base">
        Manage your coaching activities
      </CardDescription>
    </CardHeader>
    <CardContent className="p-8 flex-1">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[
          { label: "View Calendar", icon: Calendar, route: "/dashboard/calendar" },
          { label: "Track Attendance", icon: UserCheck, route: "/dashboard/attendance" }
        ].map((action, index) => {
          const IconComponent = action.icon;
          return (
            <Button 
              key={index}
              onClick={() => navigate(action.route)}
              className="h-auto p-4 bg-accent hover:bg-accent/90 text-white font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg flex flex-col items-center gap-2 border-none"
              style={{ backgroundColor: '#BEA877' }}
            >
              <IconComponent className="h-5 w-5" />
              <span className="text-sm text-center">{action.label}</span>
            </Button>
          );
        })}
      </div>
    </CardContent>
  </Card>
</div>



        {/* Upcoming Sessions and Recent Activity Row */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* My Upcoming Sessions */}
          <Card className="border-2 border-[#181A18] bg-white shadow-xl">
            <CardHeader className="border-b border-[#181A18] bg-[#181A18]">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-[#efeff1] flex items-center">
                    <Clock className="h-5 w-5 mr-3 text-accent" style={{ color: '#BEA877' }} />
                    My Upcoming Sessions
                  </CardTitle>
                  <CardDescription className="text-gray-400 mt-1">
                    Your scheduled training sessions
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/dashboard/calendar')}
                  className="border-accent text-accent hover:bg-accent hover:text-white transition-colors"
                  style={{ borderColor: '#BEA877', color: '#BEA877' }}
                >
                  View Calendar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {upcomingSessions && upcomingSessions.length > 0 ? (
                <div className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-accent/5 border-b border-accent/10" style={{ backgroundColor: '#BEA8770D' }}>
                        <TableHead className="font-semibold text-foreground">Date & Time</TableHead>
                        <TableHead className="font-semibold text-foreground">Branch</TableHead>
                        <TableHead className="font-semibold text-foreground">Players</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingSessions.map((session, index) => (
                        <TableRow 
                          key={session.id} 
                          className={`
                            hover:bg-accent/5 transition-colors border-b border-muted/20
                            ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}
                          `}
                        >
                          <TableCell className="py-4">
                            <div className="font-semibold text-foreground">
                              {format(new Date(session.date), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-sm text-accent font-medium" style={{ color: '#BEA877' }}>
                              {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-medium">{session.branches?.name}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent" style={{ backgroundColor: '#BEA8771A', color: '#BEA877' }}>
                              {session.session_participants?.[0]?.count || 0} players
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg">No upcoming sessions scheduled</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-2 border-[#181A18] bg-white shadow-xl">
            <CardHeader className="border-b border-[#181A18] bg-[#181A18]">
              <CardTitle className="text-xl font-bold text-[#efeff1] flex items-center">
                <Activity className="h-5 w-5 mr-3 text-accent" style={{ color: '#BEA877' }} />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-gray-400 mt-1">
                Your latest coaching activities
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {recentActivity && recentActivity.length > 0 ? (
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {recentActivity.map((activity, index) => (
                    <div 
                      key={activity.id} 
                      className={`
                        flex items-start space-x-4 p-3 rounded-lg transition-colors
                        ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}
                        hover:bg-accent/5
                      `}
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-5">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}