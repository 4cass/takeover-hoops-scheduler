import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Users, CheckCircle, Clock, TrendingUp, Activity, UserCheck, MapPin, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { Component, ErrorInfo } from "react";
import { toast } from "sonner";

type RecentActivity = {
  id: string;
  type: string;
  description: string;
  created_at: string;
};

type TrainingSession = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  branches: { name: string } | null;
  session_coaches: Array<{
    id: string;
    coach_id: string;
    coaches: { name: string } | null;
  }>;
  session_participants: { count: number }[];
};

// Error Boundary Component
class DashboardErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: string | null }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary in AdminDashboardStats:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
          <div className="max-w-7xl mx-auto text-center py-8 sm:py-12">
            <Activity className="w-10 sm:w-12 h-10 sm:h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-bold text-black mb-3">Something went wrong</h3>
            <p className="text-sm sm:text-base text-gray-600">
              Error: {this.state.error || "Unknown error"}. Please try refreshing the page or contact support.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AdminDashboardStats() {
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      console.log("Fetching dashboard stats...");
      const [studentsRes, coachesRes, branchesRes, sessionsRes] = await Promise.all([
        supabase.from('students').select('id'),
        supabase.from('coaches').select('id'),
        supabase.from('branches').select('id'),
        supabase.from('training_sessions').select('id').eq('status', 'scheduled')
      ]);

      if (studentsRes.error || coachesRes.error || branchesRes.error || sessionsRes.error) {
        const error = studentsRes.error || coachesRes.error || branchesRes.error || sessionsRes.error;
        console.error("Error fetching stats:", error);
        toast.error(`Failed to fetch stats: ${error?.message || 'Unknown error'}`);
        throw error;
      }

      const result = {
        students: studentsRes.data?.length || 0,
        coaches: coachesRes.data?.length || 0,
        branches: branchesRes.data?.length || 0,
        sessions: sessionsRes.data?.length || 0
      };
      console.log("Fetched stats:", result);
      return result;
    }
  });

  const { data: upcomingSessions, isLoading: sessionsLoading, error: sessionsError } = useQuery({
    queryKey: ['admin-upcoming-sessions'],
    queryFn: async () => {
      console.log("Fetching upcoming sessions...");
      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          id,
          date,
          start_time,
          end_time,
          branches!inner (name),
          session_coaches (
            id,
            coach_id,
            coaches (name)
          ),
          session_participants (count)
        `)
        .eq('status', 'scheduled')
        .gte('date', new Date().toISOString().slice(0, 10))
        .order('date', { ascending: true })
        .limit(5);

      if (error) {
        console.error("Error fetching upcoming sessions:", error);
        toast.error(`Failed to fetch upcoming sessions: ${error.message}`);
        throw error;
      }
      
      console.log("Fetched upcoming sessions:", data);
      return (data || []) as TrainingSession[];
    }
  });

  const { data: recentActivity, isLoading: activityLoading, error: activityError } = useQuery({
    queryKey: ['admin-recent-activity'],
    queryFn: async () => {
      console.log("Fetching recent activity...");
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
          .select(`
            id,
            created_at,
            session_coaches (
              id,
              coach_id,
              coaches (name)
            )
          `)
          .eq('status', 'scheduled')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('students')
          .select('id, created_at, name')
          .order('created_at', { ascending: false })
          .limit(2)
      ]);

      if (attendanceRes.error || sessionsRes.error || studentsRes.error) {
        const error = attendanceRes.error || sessionsRes.error || studentsRes.error;
        console.error("Error fetching recent activity:", error);
        toast.error(`Failed to fetch recent activity: ${error?.message || 'Unknown error'}`);
        throw error;
      }

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
          description: `New session scheduled with ${item.session_coaches.length > 0 ? item.session_coaches.map(sc => sc.coaches?.name || 'Unknown').join(', ') : 'No coaches assigned'}`,
          created_at: item.created_at
        })) || []),
        ...(studentsRes.data?.map(item => ({
          id: item.id,
          type: 'student',
          description: `New student ${item.name} registered`,
          created_at: item.created_at
        })) || [])
      ];

      const sortedActivities = activities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
      console.log("Fetched recent activity:", sortedActivities);
      return sortedActivities;
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
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch (error) {
      console.error("Error formatting time:", error);
      return timeString;
    }
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

  if (statsLoading || sessionsLoading || activityLoading) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-8 sm:py-12">
          <Activity className="w-10 sm:w-12 h-10 sm:h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl font-bold text-black mb-3">Loading dashboard...</h3>
          <p className="text-sm sm:text-base text-gray-600">Please wait while we fetch the dashboard data.</p>
        </div>
      </div>
    );
  }

  if (statsError || sessionsError || activityError) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-8 sm:py-12">
          <Activity className="w-10 sm:w-12 h-10 sm:h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl font-bold text-black mb-3">Error loading dashboard</h3>
          <p className="text-sm sm:text-base text-gray-600">
            Failed to load data: {(statsError || sessionsError || activityError)?.message || 'Unknown error'}. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardErrorBoundary>
      <div className="min-h-screen bg-background pt-2 sm:pt-4 p-3 sm:p-4 md:p-6 pb-24 md:pb-6">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 md:space-y-8">
          
          {/* Header */}
          <div className="mb-4 sm:mb-6 md:mb-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#242833] mb-2 tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
              Welcome back! Here's your complete overview of the training management system.
            </p>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6 lg:grid-cols-4">
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
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6">
                    <CardTitle className="text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider">
                      {stat.title}
                    </CardTitle>
                    <div className="p-1.5 sm:p-2 rounded-lg bg-accent/10 shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <IconComponent className={`h-4 sm:h-5 w-4 sm:w-5 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                    <div className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1">{stat.value}</div>
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
          <Card className="border-2 border-[#242833] bg-white shadow-xl">
            <CardHeader className="border-b border-foreground bg-[#242833] p-3 sm:p-4 md:p-6">
              <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold text-primary-foreground flex items-center">
                <Calendar className="h-5 sm:h-6 w-5 sm:w-6 mr-2 sm:mr-3 text-accent" style={{ color: '#79e58f' }} />
                Quick Actions
              </CardTitle>
              <CardDescription className="text-muted text-sm sm:text-base">
                Manage your training system efficiently
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 lg:p-8">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
                        h-auto p-3 sm:p-4 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold
                        transition-all duration-300 hover:scale-105 hover:shadow-lg
                        flex flex-col items-center gap-1.5 sm:gap-2 border-none
                      "
                      style={{ backgroundColor: '#79e58f' }}
                    >
                      <IconComponent className="h-4 sm:h-5 w-4 sm:w-5" />
                      <span className="text-xs sm:text-sm text-center">{action.label}</span>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:gap-6 md:gap-8 lg:grid-cols-2">
            
            {/* Upcoming Sessions */}
            <Card className="border-2 border-[#242833] bg-white shadow-xl">
              <CardHeader className="border-b border-[#242833] bg-[#242833] p-3 sm:p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-primary-foreground flex items-center">
                      <Clock className="h-4 sm:h-5 w-4 sm:w-5 mr-2 sm:mr-3 text-accent" style={{ color: '#79e58f' }} />
                      Upcoming Sessions
                    </CardTitle>
                    <CardDescription className="text-muted mt-1 text-xs sm:text-sm">
                      Scheduled training sessions
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/dashboard/sessions')}
                    className="border-accent text-accent hover:bg-accent hover:text-accent-foreground transition-colors text-xs sm:text-sm w-full sm:w-auto"
                    style={{ borderColor: '#79e58f', color: '#79e58f' }}
                  >
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {upcomingSessions && upcomingSessions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-accent/5 border-b border-accent/10">
                          <TableHead className="font-semibold text-foreground text-xs sm:text-sm p-2 sm:p-4">Date & Time</TableHead>
                          <TableHead className="font-semibold text-foreground text-xs sm:text-sm p-2 sm:p-4 hidden sm:table-cell">Coaches</TableHead>
                          <TableHead className="font-semibold text-foreground text-xs sm:text-sm p-2 sm:p-4">Branch</TableHead>
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
                            <TableCell className="py-2 sm:py-4 px-2 sm:px-4">
                              <div className="font-semibold text-foreground text-xs sm:text-sm">
                                {format(new Date(session.date), 'MMM dd, yyyy')}
                              </div>
                              <div className="text-xs sm:text-sm text-accent font-medium">
                                {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground font-medium text-xs sm:text-sm px-2 sm:px-4 hidden sm:table-cell">
                              {session.session_coaches.length > 0 
                                ? session.session_coaches.map(sc => sc.coaches?.name || 'Unknown').join(', ') 
                                : 'No coaches assigned'}
                            </TableCell>
                            <TableCell className="text-muted-foreground font-medium text-xs sm:text-sm px-2 sm:px-4">{session.branches?.name || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-4 sm:p-6 md:p-8 text-center">
                    <Clock className="h-8 sm:h-10 md:h-12 w-8 sm:w-10 md:w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm sm:text-base md:text-lg">No upcoming sessions scheduled</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="border-2 border-[#242833] bg-white shadow-xl">
              <CardHeader className="border-b border-[#242833] bg-[#242833] p-3 sm:p-4 md:p-6">
                <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-primary-foreground flex items-center">
                  <Activity className="h-4 sm:h-5 w-4 sm:w-5 mr-2 sm:mr-3 text-accent" style={{ color: '#79e58f' }} />
                  Recent Activity
                </CardTitle>
                <CardDescription className="text-muted mt-1 text-xs sm:text-sm">
                  Latest system activities
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 md:pt-6">
                {recentActivity && recentActivity.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4 max-h-60 sm:max-h-80 overflow-y-auto">
                    {recentActivity.map((activity, index) => (
                      <div 
                        key={activity.id} 
                        className={`
                          flex items-start space-x-3 sm:space-x-4 p-2 sm:p-3 rounded-lg transition-colors
                          ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}
                          hover:bg-accent/5
                        `}
                      >
                        <div className="flex-shrink-0 mt-1">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-foreground leading-5">{activity.description}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 sm:py-6 md:py-8">
                    <Activity className="h-8 sm:h-10 md:h-12 w-8 sm:w-10 md:w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm sm:text-base md:text-lg">No recent activity</p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

        </div>
      </div>
    </DashboardErrorBoundary>
  );
}