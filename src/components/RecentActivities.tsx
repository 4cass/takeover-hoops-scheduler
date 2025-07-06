
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Timer, CheckCircle, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";

const formatDateTime = (date: Date | string) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'MM/dd/yyyy hh:mm a');
};

const getActivityIcon = (activityType: string) => {
  switch (activityType) {
    case 'time_in':
      return <Clock className="w-4 h-4 text-green-600" />;
    case 'time_out':
      return <Timer className="w-4 h-4 text-red-600" />;
    case 'session_completed':
      return <CheckCircle className="w-4 h-4 text-blue-600" />;
    default:
      return <User className="w-4 h-4 text-gray-600" />;
  }
};

export function RecentActivities() {
  const { user, role } = useAuth();

  const { data: activities } = useQuery({
    queryKey: ["activity-logs", user?.id, role],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from("activity_logs")
        .select(`
          *,
          training_sessions!inner(date, start_time, branches(name))
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      // If not admin, only show user's own activities
      if (role !== 'admin') {
        const { data: coach } = await supabase
          .from("coaches")
          .select("id")
          .eq("auth_id", user.id)
          .single();
        
        if (coach) {
          query = query.eq("user_id", coach.id);
        }
      }

      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching activities:", error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!user?.id,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-[#181A18] flex items-center">
          <Clock className="h-5 w-5 mr-2 text-accent" style={{ color: '#BEA877' }} />
          Recent Activities
        </CardTitle>
        <CardDescription>
          Latest time tracking and session activities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities && activities.length > 0 ? (
            activities.map((activity: any) => (
              <div 
                key={activity.id} 
                className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="mt-0.5">
                  {getActivityIcon(activity.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.activity_description}
                  </p>
                  <div className="flex flex-col text-xs text-gray-500 mt-1 space-y-1">
                    <span>
                      Session: {format(new Date(activity.training_sessions.date + 'T00:00:00'), 'MM/dd/yyyy')} at {activity.training_sessions.branches?.name}
                    </span>
                    <span>
                      {formatDateTime(activity.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-sm font-medium text-gray-900 mb-2">No recent activities</h3>
              <p className="text-sm text-gray-500">Time tracking activities will appear here</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
