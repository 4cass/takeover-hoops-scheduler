import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

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

export const CalendarManager = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Fetch training sessions
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['training-sessions-calendar'],
    queryFn: async () => {
      console.log('Fetching training sessions for calendar...');
      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          *,
          branches (name),
          session_coaches (
            coaches (id, name)
          ),
          session_participants (
            students (id, name)
          )
        `)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching training sessions:', error);
        throw error;
      }
      
      console.log('Training sessions fetched for calendar:', data);
      return data as TrainingSession[];
    },
  });

  const filteredSessions = sessions.filter(session => {
    if (!selectedDate) return false;
    const sessionDate = new Date(session.date);
    return (
      sessionDate.getFullYear() === selectedDate.getFullYear() &&
      sessionDate.getMonth() === selectedDate.getMonth() &&
      sessionDate.getDate() === selectedDate.getDate()
    );
  });

  return (
    <div className="flex flex-col space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Select Date</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Sessions for {selectedDate ? format(selectedDate, 'PPP') : 'Select a date'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading sessions...</div>
          ) : filteredSessions.length === 0 ? (
            <div>No sessions scheduled for this day.</div>
          ) : (
            <div className="grid gap-4">
              {filteredSessions.map((session) => (
                <div key={session.id} className="border rounded-md p-4">
                  <h3 className="text-lg font-semibold">{session.branches.name}</h3>
                  <p className="text-sm">
                    {session.start_time} - {session.end_time}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    {session.session_coaches.map((sc) => (
                      <Badge key={sc.coaches.id} variant="secondary">
                        {sc.coaches.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
