import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Users, UserCheck } from 'lucide-react';
import { format } from 'date-fns';

interface SessionRecord {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  branch_id: string;
  package_type: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  branches: {
    name: string;
  };
  session_participants: Array<{
    student_id: string;
    students: {
      name: string;
    };
  }>;
  session_coaches: Array<{
    coach_id: string;
  }>;
  coaches: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

const CoachesManager = () => {
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);

  // Fetch coaches
  const { data: coaches = [], isLoading: isLoadingCoaches } = useQuery({
    queryKey: ['coaches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coaches')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch sessions for selected coach with proper joins
  const { data: coachSessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ['coach-sessions', selectedCoachId],
    queryFn: async () => {
      if (!selectedCoachId) return [];
      
      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          *,
          branches!training_sessions_branch_id_fkey (
            name
          ),
          session_coaches!inner (
            coach_id
          ),
          session_participants (
            student_id,
            students!session_participants_student_id_fkey (
              name
            )
          )
        `)
        .eq('session_coaches.coach_id', selectedCoachId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCoachId
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold">Coaches</h2>
        <Select
          value={selectedCoachId || ''}
          onValueChange={(value) => setSelectedCoachId(value || null)}
          className="w-full sm:w-64"
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a coach" />
          </SelectTrigger>
          <SelectContent>
            {coaches.map(coach => (
              <SelectItem key={coach.id} value={coach.id}>
                {coach.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoadingSessions ? (
        <div className="flex justify-center p-8">Loading sessions...</div>
      ) : (
        <div className="grid gap-4">
          {coachSessions.length > 0 ? (
            coachSessions.map((session) => (
              <Card key={session.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {format(new Date(session.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
                    <Badge className={`${getStatusColor(session.status)} text-white`}>
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
                      <span>{session.branches.name}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {session.session_participants.length > 0 ? (
                    <div className="flex items-start gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <span className="text-muted-foreground">Students: </span>
                        <span>
                          {session.session_participants.map(p => p.students.name).join(', ')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No students enrolled in this session.</p>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-muted-foreground text-center">No sessions found for the selected coach.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CoachesManager;
