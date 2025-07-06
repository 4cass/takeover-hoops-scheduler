
import { useQuery } from "@tanstack/react-query";
import { Clock, Timer, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface SessionTimeDetailsProps {
  sessionId: string;
}

const formatDateTime = (date: Date | string) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'MM/dd/yyyy hh:mm a');
};

export function SessionTimeDetails({ sessionId }: SessionTimeDetailsProps) {
  const { data: coachTimes } = useQuery({
    queryKey: ["session-coach-times", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_session_times")
        .select(`
          *,
          coaches(name)
        `)
        .eq("session_id", sessionId);
      
      if (error) {
        console.error("Error fetching coach times:", error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!sessionId,
  });

  if (!coachTimes || coachTimes.length === 0) {
    return (
      <div className="text-center py-4">
        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No time tracking data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-900 flex items-center">
        <Clock className="w-4 h-4 mr-2" />
        Coach Time Tracking
      </h4>
      
      <div className="space-y-3">
        {coachTimes.map((record: any) => (
          <div key={record.id} className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center mb-2">
              <User className="w-4 h-4 mr-2 text-gray-600" />
              <span className="font-medium text-sm text-gray-900">
                {record.coaches?.name || 'Unknown Coach'}
              </span>
            </div>
            
            <div className="space-y-2 text-xs">
              {record.time_in && (
                <div className="flex items-center text-green-700">
                  <Clock className="w-3 h-3 mr-2" />
                  <span className="font-medium">Time In:</span>
                  <span className="ml-2">{formatDateTime(record.time_in)}</span>
                </div>
              )}
              
              {record.time_out && (
                <div className="flex items-center text-red-700">
                  <Timer className="w-3 h-3 mr-2" />
                  <span className="font-medium">Time Out:</span>
                  <span className="ml-2">{formatDateTime(record.time_out)}</span>
                </div>
              )}
              
              {record.time_in && !record.time_out && (
                <div className="flex items-center text-amber-600">
                  <Clock className="w-3 h-3 mr-2" />
                  <span className="text-xs">Currently active</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
