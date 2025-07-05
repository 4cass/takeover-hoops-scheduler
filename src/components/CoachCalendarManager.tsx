import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

interface TrainingSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  branch_id: string;
  notes: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  package_type: string | null;
  branches: {
    name: string;
  };
  session_coaches: {
    coaches: {
      id: string;
      name: string;
    };
  }[];
  session_participants: {
    students: {
      id: string;
      name: string;
    };
  }[];
}

export const CoachCalendarManager = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { user } = useAuth();

  // Fetch training sessions for the current coach
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['coach-training-sessions-calendar', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      console.log('Fetching coach training sessions for calendar...');
      
      // First get the coach record
      const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id')
        .eq('auth_id', user.id)
        .single();

      if (coachError || !coach) {
        console.error('Error fetching coach:', coachError);
        return [];
      }

      // Then get sessions where this coach is assigned
      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          *,
          branches (name),
          session_coaches!inner (
            coaches (id, name)
          ),
          session_participants (
            students (id, name)
          )
        `)
        .eq('session_coaches.coach_id', coach.id)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching coach training sessions:', error);
        throw error;
      }
      
      console.log('Coach training sessions fetched for calendar:', data);
      return data as TrainingSession[];
    },
    enabled: !!user?.id,
  });

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
  };

  // Filter sessions for the selected date
  const sessionsForSelectedDate = sessions.filter(session => {
    if (!selectedDate) return false;
    return format(new Date(session.date), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
          />
        </CardContent>
      </Card>

      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle>Sessions for {format(selectedDate, 'PPP')}</CardTitle>
          </CardHeader>
          <CardContent>
            {sessionsForSelectedDate.length === 0 ? (
              <p>No sessions scheduled for this date.</p>
            ) : (
              <div className="flex flex-col space-y-2">
                {sessionsForSelectedDate.map(session => (
                  <div key={session.id} className="border rounded-md p-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-semibold">
                        {session.start_time} - {session.end_time}
                      </h4>
                      <Badge variant="secondary">{session.branches.name}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {session.session_coaches.map(sc => sc.coaches.name).join(', ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.session_participants.map(sp => sp.students.name).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
