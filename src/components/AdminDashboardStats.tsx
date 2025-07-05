
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Users, CheckCircle, Clock, TrendingUp, Activity, UserCheck, MapPin, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";

type RecentActivity = {
  id: string;
  type: string;
  description: string;
  created_at: string;
};

export function AdminDashboardStats() {
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      const [studentsRes, coachesRes, branchesRes, sessionsRes] = await Promise.all([
        supabase.from('students').select('id'),
        supabase.from('coaches').select('id'),
        supabase.from('branches').select('id'),
        supabase.from('training_sessions').select('id').eq('status', 'scheduled')
      ]);

      return {
        students: studentsRes.data?.length || 0,
        coaches: coachesRes.data?.length || 0,
        branches: branchesRes.data?.length || 0,
        sessions: sessionsRes.data?.length || 0
      };
    }
  });

  const { data: upcomingSessions } = useQuery({
    queryKey: ['admin-upcoming-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          id,
          date,
          start_time,
          end_time,
          branches!inner (name),
          coaches!inner (name),
          session_participants (count)
        `)
        .eq('status', 'scheduled')
        .gte('date', new Date().toISOString().slice(0, 10))
        .order('date', { ascending: true })
        .limit(5);

      if (error) {
        console.error("Error fetching upcoming sessions:", error);
        throw error;
      }
      
      return data || [];
    }
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['admin-recent-activity'],
    queryFn: async () => {
      const [attendanceRes, sessionsRes, studentsRes] = await Promise.all([
        supabase
          .from('attendance_records')
          .select(`
            id,
            created_at,
            students!inner (name)
          `)
          .eq('status', 'present')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('training_sessions')
          .select('id, created_at, coaches!inner (name)')
          .eq('status', 'scheduled')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('students')
          .select('id, created_at, name')
          .order('created_at', { ascending: false })
          .limit(2)
      ]);

      const activities: RecentActivity[] = [
        ...(attendanceRes.data?.map(item => ({
          id: item.id,
          type: 'attendance',
          description: `${item.students.name} attended a training session`,
          created_at: item.created_at
        })) || []),
        ...(sessionsRes.data?.map(item => ({
          id: item.id,
          type: 'session',
          description: `New session scheduled with ${item.coaches.name}`,
          created_at: item.created_at
        })) || []),
        ...(studentsRes.data?.map(item => ({
          id: item.id,
          type: 'student',
          description: `New student ${item.name} registered`,
          created_at: item.created_at
        })) || [])
      ];

      return activities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
    }
  });

  const statCards = [
    {
      title: "Total Students",
      value: stats?.students || 0,
      icon: Users,
      color: "text-accent",
      bgGradient: "from-accent/10 to-accent/5",
      borderColor: "border-foreground"
    },
    {
      title: "Active Coaches",
      value: stats?.coaches || 0,
      icon: UserCheck,
      color: "text-accent",
      bgGradient: "from-accent/10 to-accent/5",
      borderColor: "border-foreground"
    },
    {
      title: "Training Branches",
      value: stats?.branches || 0,
      icon: MapPin,
      color: "text-accent",
      bgGradient: "from-accent/10 to-accent/5",
      borderColor: "border-foreground"
    },
    {
      title: "Scheduled Sessions",
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
        return <Calendar className="h-5 w-5 text-accent" />;
      case 'student':
        return <GraduationCap className="h-5 w-5 text-blue-600" />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background pt-4 p-6">
      <div className="max-w-7xl mx-auto space-y-8 -mt-5">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#181A18] mb-2 tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-lg text-muted-foreground">
            Welcome back! Here's your complete overview of the training management system.
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <Card 
                key={index} 
                className={`
                  relative overflow-hidden border-2 ${stat.borderColor} bg-white
                  backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 
                  hover:-translate-y-1 hover:scale-105 cursor-pointer group
                `}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    {stat.title}
                  </CardTitle>
                  <div className={`
                    p-2 rounded-lg bg-accent/10 shadow-sm group-hover:scale-110 transition-transform duration-300
                  `}>
                    <IconComponent className={`h-5 w-5 ${stat.color}`} />
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
        <Card className="border-2 border-[#181A18] bg-white shadow-xl">
          <CardHeader className="border-b border-foreground bg-[#181A18]">
            <CardTitle className="text-2xl font-bold text-primary-foreground flex items-center">
              <Calendar className="h-6 w-6 mr-3 text-accent" />
              Quick Actions
            </CardTitle>
            <CardDescription className="text-muted text-base">
              Manage your training system efficiently
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Manage Sessions", icon: Calendar, route: "/dashboard/sessions" },
                { label: "Track Attendance", icon: UserCheck, route: "/dashboard/attendance" },
                { label: "View Students", icon: Users, route: "/dashboard/students" },
                { label: "Manage Coaches", icon: GraduationCap, route: "/dashboard/coaches" }
              ].map((action, index) => {
                const IconComponent = action.icon;
                return (
                  <Button 
                    key={index}
                    onClick={() => navigate(action.route)}
                    className="
                      h-auto p-4 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold
                      transition-all duration-300 hover:scale-105 hover:shadow-lg
                      flex flex-col items-center gap-2 border-none
                    "
                  >
                    <IconComponent className="h-5 w-5" />
                    <span className="text-sm text-center">{action.label}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-8 lg:grid-cols-2">
          
          {/* Upcoming Sessions */}
          <Card className="border-2 border-[#181A18] bg-white shadow-xl">
            <CardHeader className="border-b border-[#181A18] bg-[#181A18]">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-primary-foreground flex items-center">
                    <Clock className="h-5 w-5 mr-3 text-accent" />
                    Upcoming Sessions
                  </CardTitle>
                  <CardDescription className="text-muted mt-1">
                    Scheduled training sessions
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/dashboard/sessions')}
                  className="border-accent text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {upcomingSessions && upcomingSessions.length > 0 ? (
                <div className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-accent/5 border-b border-accent/10">
                        <TableHead className="font-semibold text-foreground">Date & Time</TableHead>
                        <TableHead className="font-semibold text-foreground">Coach</TableHead>
                        <TableHead className="font-semibold text-foreground">Branch</TableHead>
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
                            <div className="text-sm text-accent font-medium">
                              {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-medium">{session.coaches?.name}</TableCell>
                          <TableCell className="text-muted-foreground font-medium">{session.branches?.name}</TableCell>
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

          {/* Recent Activity */}
          <Card className="border-2 border-[#181A18] bg-white shadow-xl">
            <CardHeader className="border-b border-[#181A18] bg-[#181A18]">
              <CardTitle className="text-xl font-bold text-primary-foreground flex items-center">
                <Activity className="h-5 w-5 mr-3 text-accent" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-muted mt-1">
                Latest system activities
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
