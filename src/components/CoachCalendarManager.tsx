
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay, startOfMonth, endOfMonth } from "date-fns";
import { useState, useEffect } from "react";

type SessionStatus = "scheduled" | "completed" | "cancelled";

type TrainingSession = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  branch_id: string;
  coach_id: string;
  status: SessionStatus;
  package_type: "Camp Training" | "Personal Training" | null;
  branches: { name: string };
  coaches: { name: string };
  session_participants: Array<{ students: { name: string } }>;
};

export function CoachCalendarManager() {
  const { coachData } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [filterPackageType, setFilterPackageType] = useState<string>("all");
  const [coachId, setCoachId] = useState<string | null>(null);

  useEffect(() => {
    if (coachData?.id) {
      setCoachId(coachData.id);
    }
  }, [coachData]);

  const { data: sessions = [] } = useQuery({
    queryKey: ['coach-training-sessions', coachId, selectedBranch, filterPackageType, currentMonth],
    queryFn: async () => {
      if (!coachId) return [];
      
      let query = supabase
        .from('training_sessions')
        .select(`
          id, date, start_time, end_time, branch_id, coach_id, status, package_type,
          branches (name),
          coaches (name),
          session_participants (
            students (name)
          )
        `)
        .eq('coach_id', coachId)
        .gte('date', format(startOfMonth(currentMonth), 'yyyy-MM-dd'))
        .lte('date', format(endOfMonth(currentMonth), 'yyyy-MM-dd'));

      if (selectedBranch !== "all") {
        query = query.eq('branch_id', selectedBranch);
      }

      const { data, error } = await query.order('date', { ascending: true });
      if (error) throw error;
      return data as TrainingSession[];
    },
    enabled: !!coachId
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('*');
      if (error) throw error;
      return data;
    }
  });

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const formatTime12Hour = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const getStatusColor = (status: SessionStatus) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const selectedDateSessions = sessions.filter(session => 
    selectedDate && isSameDay(new Date(session.date), selectedDate)
  );

  const sessionDates = sessions.map(session => new Date(session.date));

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-1/2">
        <Card>
          <CardHeader>
            <CardTitle>My Training Schedule</CardTitle>
            <div className="flex gap-4">
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterPackageType} onValueChange={setFilterPackageType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Package type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Camp Training">Camp Training</SelectItem>
                  <SelectItem value="Personal Training">Personal Training</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              onMonthChange={setCurrentMonth}
              modifiers={{
                hasSession: sessionDates
              }}
              modifiersStyles={{
                hasSession: { backgroundColor: 'rgba(59, 130, 246, 0.2)' }
              }}
              className="rounded-md border"
            />
          </CardContent>
        </Card>
      </div>

      <div className="lg:w-1/2">
        <Card>
          <CardHeader>
            <CardTitle>
              Sessions for {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateSessions.length === 0 ? (
              <p className="text-muted-foreground">No sessions scheduled for this date.</p>
            ) : (
              <div className="space-y-4">
                {selectedDateSessions.map(session => (
                  <div key={session.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`${getStatusColor(session.status)} text-white`}>
                          {session.status}
                        </Badge>
                        {session.package_type && (
                          <Badge variant="outline">
                            {session.package_type}
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Branch:</span>
                        <p className="text-muted-foreground">{session.branches?.name}</p>
                      </div>
                      <div>
                        <span className="font-medium">Coach:</span>
                        <p className="text-muted-foreground">{session.coaches?.name || 'Not assigned'}</p>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <span className="font-medium">Participants:</span>
                      <p className="text-muted-foreground">
                        {session.session_participants?.length > 0 
                          ? session.session_participants.map(p => p.students.name).join(', ')
                          : 'No participants'
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
