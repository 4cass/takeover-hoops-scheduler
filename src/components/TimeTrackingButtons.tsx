
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Clock, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";

interface TimeTrackingButtonsProps {
  sessionId: string;
  isAdmin?: boolean;
}

const formatDateTime = (date: Date | string) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'MM/dd/yyyy hh:mm a');
};

export function TimeTrackingButtons({ sessionId, isAdmin = false }: TimeTrackingButtonsProps) {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const { data: coachId } = useQuery({
    queryKey: ["coach-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: coach, error } = await supabase
        .from("coaches")
        .select("id")
        .eq("auth_id", user.id)
        .single();
      
      if (error) {
        console.error("Error fetching coach ID:", error);
        return null;
      }
      return coach?.id;
    },
    enabled: !!user?.id,
  });

  const { data: timeRecord } = useQuery({
    queryKey: ["coach-time-record", sessionId, coachId],
    queryFn: async () => {
      if (!coachId) return null;
      const { data, error } = await supabase
        .from("coach_session_times")
        .select("*")
        .eq("session_id", sessionId)
        .eq("coach_id", coachId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching time record:", error);
        return null;
      }
      return data;
    },
    enabled: !!coachId && !!sessionId,
  });

  const timeInMutation = useMutation({
    mutationFn: async () => {
      if (!coachId) throw new Error("Coach ID not found");
      
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("coach_session_times")
        .upsert({
          session_id: sessionId,
          coach_id: coachId,
          time_in: now,
          updated_at: now
        });
      
      if (error) throw error;

      // Create activity log
      await supabase.from("activity_logs").insert({
        user_id: coachId,
        user_type: role || 'coach',
        session_id: sessionId,
        activity_type: 'time_in',
        activity_description: 'Coach timed in for session'
      });
    },
    onSuccess: () => {
      toast.success("Time In recorded successfully");
      queryClient.invalidateQueries({ queryKey: ["coach-time-record"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
    },
    onError: (error) => {
      console.error("Time In failed:", error);
      toast.error("Failed to record Time In");
    },
  });

  const timeOutMutation = useMutation({
    mutationFn: async () => {
      if (!coachId) throw new Error("Coach ID not found");
      
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("coach_session_times")
        .update({
          time_out: now,
          updated_at: now
        })
        .eq("session_id", sessionId)
        .eq("coach_id", coachId);
      
      if (error) throw error;

      // Create activity log
      await supabase.from("activity_logs").insert({
        user_id: coachId,
        user_type: role || 'coach',
        session_id: sessionId,
        activity_type: 'time_out',
        activity_description: 'Coach timed out for session'
      });
    },
    onSuccess: () => {
      toast.success("Time Out recorded successfully");
      queryClient.invalidateQueries({ queryKey: ["coach-time-record"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
    },
    onError: (error) => {
      console.error("Time Out failed:", error);
      toast.error("Failed to record Time Out");
    },
  });

  const handleTimeIn = () => {
    timeInMutation.mutate();
  };

  const handleTimeOut = () => {
    timeOutMutation.mutate();
  };

  const hasTimedIn = !!timeRecord?.time_in;
  const canTimeOut = hasTimedIn;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          onClick={handleTimeIn}
          disabled={hasTimedIn || timeInMutation.isPending}
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Clock className="w-4 h-4 mr-2" />
          {timeInMutation.isPending ? "Recording..." : "Time In"}
        </Button>
        
        <Button
          onClick={handleTimeOut}
          disabled={!canTimeOut || timeOutMutation.isPending}
          size="sm"
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <Timer className="w-4 h-4 mr-2" />
          {timeOutMutation.isPending ? "Recording..." : "Time Out"}
        </Button>
      </div>

      {timeRecord && (
        <div className="text-sm space-y-1 bg-gray-50 p-3 rounded-lg">
          {timeRecord.time_in && (
            <div className="flex items-center text-green-700">
              <Clock className="w-4 h-4 mr-2" />
              <span className="font-medium">Time In:</span>
              <span className="ml-2">{formatDateTime(timeRecord.time_in)}</span>
            </div>
          )}
          {timeRecord.time_out && (
            <div className="flex items-center text-red-700">
              <Timer className="w-4 h-4 mr-2" />
              <span className="font-medium">Time Out:</span>
              <span className="ml-2">{formatDateTime(timeRecord.time_out)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
