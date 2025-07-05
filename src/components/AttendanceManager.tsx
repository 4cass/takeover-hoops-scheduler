
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, MapPin, Users, UserCheck, Check, X, Clock3 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface AttendanceRecord {
  id: string;
  student_id: string;
  session_id: string;
  status: 'present' | 'absent' | 'pending';
  marked_at: string | null;
  students: {
    name: string;
    email: string;
  };
}

interface TrainingSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  package_type?: string;
  branches: {
    name: string;
    city: string;
  };
  coaches: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  attendance_records: AttendanceRecord[];
  session_participants: Array<{
    student_id: string;
    students: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

const AttendanceManager = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch sessions for the selected date with attendance records
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['attendance-sessions', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          *,
          branches!training_sessions_branch_id_fkey (
            name,
            city
          ),
          session_coaches (
            coaches!session_coaches_coach_id_fkey (
              id,
              name,
              email
            )
          ),
          session_participants (
            student_id,
            students!session_participants_student_id_fkey (
              id,
              name,
              email
            )
          ),
          attendance_records (
            id,
            student_id,
            status,
            marked_at,
            students!attendance_records_student_id_fkey (
              name,
              email
            )
          )
        `)
        .eq('date', selectedDate)
        .order('start_time');

      if (error) throw error;

      return data.map(session => ({
        ...session,
        coaches: session.session_coaches?.map(sc => sc.coaches).filter(Boolean) || []
      }));
    }
  });

  // Mark attendance mutation
  const markAttendanceMutation = useMutation({
    mutationFn: async ({ sessionId, studentId, status }: { sessionId: string; studentId: string; status: 'present' | 'absent' }) => {
      const { error } = await supabase
        .from('attendance_records')
        .upsert({
          session_id: sessionId,
          student_id: studentId,
          status,
          marked_at: new Date().toISOString()
        }, {
          onConflict: 'session_id,student_id'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions', selectedDate] });
      toast({
        title: "Success",
        description: "Attendance marked successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleMarkAttendance = (sessionId: string, studentId: string, status: 'present' | 'absent') => {
    markAttendanceMutation.mutate({ sessionId, studentId, status });
  };

  const getAttendanceStatus = (session: TrainingSession, studentId: string) => {
    const record = session.attendance_records.find(r => r.student_id === studentId);
    return record?.status || 'pending';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <Check className="h-4 w-4 text-green-600" />;
      case 'absent': return <X className="h-4 w-4 text-red-600" />;
      default: return <Clock3 className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-500';
      case 'absent': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading attendance...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Attendance Management</h2>
        <div className="flex items-center gap-4">
          <label htmlFor="date-select" className="text-sm font-medium">Select Date:</label>
          <input
            id="date-select"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid gap-6">
        {sessions.map((session) => (
          <Card key={session.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {format(new Date(session.date), 'EEEE, MMMM d, yyyy')}
                <Badge className={`${session.status === 'completed' ? 'bg-green-500' : session.status === 'cancelled' ? 'bg-red-500' : 'bg-blue-500'} text-white`}>
                  {session.status}
                </Badge>
              </CardTitle>
              <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{session.start_time} - {session.end_time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{session.branches?.name}, {session.branches?.city}</span>
                </div>
              </div>

              {session.coaches.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <UserCheck className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <span className="text-muted-foreground">Coaches: </span>
                    <span>
                      {session.coaches.map(coach => coach.name).join(', ')}
                    </span>
                  </div>
                </div>
              )}

              {session.package_type && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Package: </span>
                  <Badge variant="outline">{session.package_type}</Badge>
                </div>
              )}
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Student Attendance</span>
                </div>

                {session.session_participants.length > 0 ? (
                  <div className="space-y-3">
                    {session.session_participants.map((participant) => {
                      const status = getAttendanceStatus(session, participant.student_id);
                      return (
                        <div key={participant.student_id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(status)}
                            <div>
                              <p className="font-medium">{participant.students.name}</p>
                              <p className="text-sm text-muted-foreground">{participant.students.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`${getStatusColor(status)} text-white`}>
                              {status}
                            </Badge>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant={status === 'present' ? 'default' : 'outline'}
                                onClick={() => handleMarkAttendance(session.id, participant.student_id, 'present')}
                                disabled={markAttendanceMutation.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant={status === 'absent' ? 'destructive' : 'outline'}
                                onClick={() => handleMarkAttendance(session.id, participant.student_id, 'absent')}
                                disabled={markAttendanceMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No students enrolled in this session.</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {sessions.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No training sessions found for {format(new Date(selectedDate), 'MMMM d, yyyy')}.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttendanceManager;
