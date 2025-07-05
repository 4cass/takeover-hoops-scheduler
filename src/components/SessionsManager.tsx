import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Users, UserCheck, Trash2, Edit, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface TrainingSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  package_type?: string;
  branch_id: string;
  branches: {
    name: string;
    city: string;
  };
  coaches: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  participants: Array<{
    student_id: string;
    students: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

interface Branch {
  id: string;
  name: string;
  city: string;
}

interface Coach {
  id: string;
  name: string;
  email: string;
}

interface Student {
  id: string;
  name: string;
  email: string;
  remaining_sessions: number;
}

const SessionsManager = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [newSession, setNewSession] = useState({
    date: '',
    start_time: '',
    end_time: '',
    branch_id: '',
    coach_ids: [] as string[],
    student_ids: [] as string[],
    package_type: '',
    notes: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch sessions with coaches and participants
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['training-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          *,
          branches (
            name,
            city
          ),
          session_coaches (
            coaches (
              id,
              name,
              email
            )
          ),
          session_participants (
            student_id,
            students (
              id,
              name,
              email
            )
          )
        `)
        .order('date', { ascending: true });

      if (error) throw error;

      return data.map(session => ({
        ...session,
        coaches: session.session_coaches?.map(sc => sc.coaches).filter(Boolean) || [],
        participants: session.session_participants || []
      }));
    }
  });

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch coaches
  const { data: coaches = [] } = useQuery({
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

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: typeof newSession) => {
      // Check for conflicts first
      const { data: conflicts } = await supabase.rpc('check_scheduling_conflicts', {
        p_date: sessionData.date,
        p_start_time: sessionData.start_time,
        p_end_time: sessionData.end_time,
        p_coach_ids: sessionData.coach_ids,
        p_student_ids: sessionData.student_ids
      });

      if (conflicts && conflicts.length > 0) {
        throw new Error(conflicts.map(c => c.conflict_details).join(', '));
      }

      // Create the session
      const { data: session, error: sessionError } = await supabase
        .from('training_sessions')
        .insert([{
          date: sessionData.date,
          start_time: sessionData.start_time,
          end_time: sessionData.end_time,
          branch_id: sessionData.branch_id,
          package_type: sessionData.package_type,
          notes: sessionData.notes
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Insert coach associations
      if (sessionData.coach_ids.length > 0) {
        const { error: coachError } = await supabase
          .from('session_coaches')
          .insert(
            sessionData.coach_ids.map(coach_id => ({
              session_id: session.id,
              coach_id
            }))
          );

        if (coachError) throw coachError;
      }

      // Insert student participants
      if (sessionData.student_ids.length > 0) {
        const { error: participantError } = await supabase
          .from('session_participants')
          .insert(
            sessionData.student_ids.map(student_id => ({
              session_id: session.id,
              student_id
            }))
          );

        if (participantError) throw participantError;
      }

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      setIsCreateDialogOpen(false);
      setNewSession({
        date: '',
        start_time: '',
        end_time: '',
        branch_id: '',
        coach_ids: [],
        student_ids: [],
        package_type: '',
        notes: ''
      });
      toast({
        title: "Success",
        description: "Training session created successfully",
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

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      toast({
        title: "Success",
        description: "Training session deleted successfully",
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

  const handleCreateSession = () => {
    createSessionMutation.mutate(newSession);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (confirm('Are you sure you want to delete this session?')) {
      deleteSessionMutation.mutate(sessionId);
    }
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
    return <div className="flex justify-center p-8">Loading sessions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Training Sessions</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Training Session</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newSession.date}
                    onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="branch">Branch</Label>
                  <Select value={newSession.branch_id} onValueChange={(value) => setNewSession({ ...newSession, branch_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name} - {branch.city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={newSession.start_time}
                    onChange={(e) => setNewSession({ ...newSession, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={newSession.end_time}
                    onChange={(e) => setNewSession({ ...newSession, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Coaches</Label>
                <Select 
                  value=""
                  onValueChange={(value) => {
                    if (!newSession.coach_ids.includes(value)) {
                      setNewSession({ 
                        ...newSession, 
                        coach_ids: [...newSession.coach_ids, value] 
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add coaches" />
                  </SelectTrigger>
                  <SelectContent>
                    {coaches.filter(coach => !newSession.coach_ids.includes(coach.id)).map((coach) => (
                      <SelectItem key={coach.id} value={coach.id}>
                        {coach.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {newSession.coach_ids.map(coachId => {
                    const coach = coaches.find(c => c.id === coachId);
                    return (
                      <Badge key={coachId} variant="secondary" className="flex items-center gap-1">
                        {coach?.name}
                        <button
                          onClick={() => setNewSession({
                            ...newSession,
                            coach_ids: newSession.coach_ids.filter(id => id !== coachId)
                          })}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Students</Label>
                <Select 
                  value=""
                  onValueChange={(value) => {
                    if (!newSession.student_ids.includes(value)) {
                      setNewSession({ 
                        ...newSession, 
                        student_ids: [...newSession.student_ids, value] 
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add students" />
                  </SelectTrigger>
                  <SelectContent>
                    {students
                      .filter(student => !newSession.student_ids.includes(student.id) && student.remaining_sessions > 0)
                      .map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name} ({student.remaining_sessions} sessions left)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {newSession.student_ids.map(studentId => {
                    const student = students.find(s => s.id === studentId);
                    return (
                      <Badge key={studentId} variant="secondary" className="flex items-center gap-1">
                        {student?.name}
                        <button
                          onClick={() => setNewSession({
                            ...newSession,
                            student_ids: newSession.student_ids.filter(id => id !== studentId)
                          })}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label htmlFor="package_type">Package Type</Label>
                <Input
                  id="package_type"
                  value={newSession.package_type}
                  onChange={(e) => setNewSession({ ...newSession, package_type: e.target.value })}
                  placeholder="e.g., Beginner, Intermediate, Advanced"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newSession.notes}
                  onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })}
                  placeholder="Session notes..."
                />
              </div>

              <Button 
                onClick={handleCreateSession} 
                className="w-full"
                disabled={createSessionMutation.isPending}
              >
                {createSessionMutation.isPending ? 'Creating...' : 'Create Session'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {sessions.map((session) => (
          <Card key={session.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {format(new Date(session.date), 'EEEE, MMMM d, yyyy')}
                  <Badge className={`${getStatusColor(session.status)} text-white`}>
                    {session.status}
                  </Badge>
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteSession(session.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{session.start_time} - {session.end_time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{session.branches.name}, {session.branches.city}</span>
                </div>
              </div>

              {session.coaches.length > 0 && (
                <div className="flex items-start gap-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <span className="text-sm text-muted-foreground">Coaches: </span>
                    <div className="flex flex-wrap gap-1">
                      {session.coaches.map((coach, index) => (
                        <span key={coach.id} className="text-sm">
                          {coach.name}
                          {index < session.coaches.length - 1 && ', '}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {session.participants.length > 0 && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <span className="text-sm text-muted-foreground">Students: </span>
                    <div className="flex flex-wrap gap-1">
                      {session.participants.map((participant, index) => (
                        <span key={participant.student_id} className="text-sm">
                          {participant.students.name}
                          {index < session.participants.length - 1 && ', '}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {session.package_type && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Package: </span>
                  <Badge variant="outline">{session.package_type}</Badge>
                </div>
              )}

              {session.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Notes: </span>
                  <span>{session.notes}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {sessions.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No training sessions found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SessionsManager;
