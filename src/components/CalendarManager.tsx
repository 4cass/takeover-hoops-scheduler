import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, Users, UserCheck } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

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
  }>;
  participants: Array<{
    student_id: string;
    students: {
      name: string;
    };
  }>;
}

export function CalendarManager() {
  const [selectedEvent, setSelectedEvent] = useState<TrainingSession | null>(null);

  // Fetch training sessions with explicit foreign key references
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['calendar-sessions'],
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
              name
            )
          ),
          session_participants (
            student_id,
            students!session_participants_student_id_fkey (
              name
            )
          )
        `)
        .order('date', { ascending: false });

      if (error) throw error;

      return (data || []).map(session => ({
        ...session,
        coaches: session.session_coaches?.map(sc => sc.coaches).filter(Boolean) || [],
        participants: session.session_participants || []
      })) as TrainingSession[];
    }
  });

  const events = sessions.map(session => {
    const startDateTime = new Date(`${session.date}T${session.start_time}`);
    const endDateTime = new Date(`${session.date}T${session.end_time}`);

    return {
      id: session.id,
      title: `${session.package_type || 'Training'} - ${session.branches?.name || 'Unknown Branch'}`,
      start: startDateTime,
      end: endDateTime,
      resource: session,
    };
  });

  const handleSelectEvent = (event: any) => {
    setSelectedEvent(event.resource);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading calendar...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Training Calendar</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ height: '600px' }}>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              onSelectEvent={handleSelectEvent}
              views={['month', 'week', 'day']}
              defaultView="month"
              popup
              className="rbc-calendar"
            />
          </div>
        </CardContent>
      </Card>

      {/* Event Details Modal */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Session Details
            </DialogTitle>
            <DialogDescription>
              {selectedEvent && new Date(selectedEvent.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedEvent.start_time} - {selectedEvent.end_time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedEvent.branches?.name}, {selectedEvent.branches?.city}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge className={`${getStatusColor(selectedEvent.status)} text-white`}>
                  {selectedEvent.status}
                </Badge>
                {selectedEvent.package_type && (
                  <Badge variant="outline">{selectedEvent.package_type}</Badge>
                )}
              </div>

              {selectedEvent.coaches.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Coaches
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.coaches.map((coach) => (
                      <Badge key={coach.id} variant="secondary">
                        {coach.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedEvent.participants.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Students ({selectedEvent.participants.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.participants.map((participant) => (
                      <Badge key={participant.student_id} variant="outline">
                        {participant.students.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setSelectedEvent(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
