
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { RecentActivities } from "./RecentActivities";
import { format, startOfWeek, endOfWeek } from "date-fns";

export function CoachDashboardStats() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["coach-dashboard-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get coach ID
      const { data: coach } = await supabase
        .from("coaches")
        .select("id")
        .eq("auth_id", user.id)
        .single();

      if (!coach) return null;

      // Get this week's date range
      const now = new Date();
      const weekStart = format(startOfWeek(now), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(now), 'yyyy-MM-dd');

      // Fetch session IDs from session_coaches
      const { data: sessionCoaches } = await supabase
        .from('session_coaches')
        .select('session_id')
        .eq('coach_id', coach.id);

      const sessionIds = sessionCoaches?.map(sc => sc.session_id) || [];

      if (sessionIds.length === 0) {
        return {
          totalSessions: 0,
          weekSessions: 0,
          completedSessions: 0,
        };
      }

      const [totalRes, weekRes, completedRes] = await Promise.all([
        supabase
          .from("training_sessions")
          .select("id", { count: "exact" })
          .in("id", sessionIds),
        supabase
          .from("training_sessions")
          .select("id", { count: "exact" })
          .in("id", sessionIds)
          .gte("date", weekStart)
          .lte("date", weekEnd),
        supabase
          .from("training_sessions")
          .select("id", { count: "exact" })
          .in("id", sessionIds)
          .eq("status", "completed"),
      ]);

      return {
        totalSessions: totalRes.count || 0,
        weekSessions: weekRes.count || 0,
        completedSessions: completedRes.count || 0,
      };
    },
    enabled: !!user?.id,
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSessions || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.weekSessions || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completedSessions || 0}</div>
          </CardContent>
        </Card>
      </div>

      <RecentActivities />
    </div>
  );
}
