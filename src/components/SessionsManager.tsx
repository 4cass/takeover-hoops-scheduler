import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Edit, Trash2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

interface Branch {
  id: string;
  name: string;
  address: string;
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

const SessionsManager = () => {
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [formData, setFormData] = useState({
    date: new Date(),
    start_time: '',
    end_time: '',
    branch_id: '',
    coach_ids: [] as string[],
    student_ids: [] as string[],
    notes: '',
    package_type: ''
  });
  const [dateOpen, setDateOpen] = useState(false);

  const queryClient = useQueryClient();

  // Fetch training sessions with related data
  const { data: sessions = [], isLoading: sessionsLoading, error: sessionsError } = useQuery({
    queryKey: ['training-sessions'],
    queryFn: async () => {
      console.log('Fetching training sessions...');
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
      
      console.log('Training sessions fetched:', data);
      return data as TrainingSession[];
    },
  });

  // Log any session loading errors
  if (sessionsError) {
    console.error('Error fetching training sessions:', sessionsError);
  }

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Branch[];
    },
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
      return data as Coach[];
    },
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
      return data as Student[];
    },
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: typeof formData) => {
      console.log('Creating session with data:', sessionData);
      
      // First create the training session
      const { data: session, error: sessionError } = await supabase
        .from('training_sessions')
        .insert({
          date: format(sessionData.date, 'yyyy-MM-dd'),
          start_time: sessionData.start_time,
          end_time: sessionData.end_time,
          branch_id: sessionData.branch_id,
          notes: sessionData.notes || null,
          package_type: sessionData.package_type || null,
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error creating session:', sessionError);
        throw sessionError;
      }

      console.log('Session created:', session);

      // Add coaches to the session
      if (sessionData.coach_ids.length > 0) {
        const coachInserts = sessionData.coach_ids.map(coach_id => ({
          session_id: session.id,
          coach_id
        }));

        const { error: coachError } = await supabase
          .from('session_coaches')
          .insert(coachInserts);

        if (coachError) {
          console.error('Error adding coaches to session:', coachError);
          throw coachError;
        }
      }

      // Add students to the session
      if (sessionData.student_ids.length > 0) {
        const studentInserts = sessionData.student_ids.map(student_id => ({
          session_id: session.id,
          student_id
        }));

        const { error: studentError } = await supabase
          .from('session_participants')
          .insert(studentInserts);

        if (studentError) {
          console.error('Error adding students to session:', studentError);
          throw studentError;
        }
      }

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      resetForm();
      toast.success('Session created successfully');
    },
    onError: (error) => {
      console.error('Failed to create session:', error);
      toast.error(`Failed to create session: ${error.message}`);
    },
  });

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: async (sessionData: typeof formData & { id: string }) => {
      console.log('Updating session with data:', sessionData);

      // First update the training session
      const { data: session, error: sessionError } = await supabase
        .from('training_sessions')
        .update({
          date: format(sessionData.date, 'yyyy-MM-dd'),
          start_time: sessionData.start_time,
          end_time: sessionData.end_time,
          branch_id: sessionData.branch_id,
          notes: sessionData.notes || null,
          package_type: sessionData.package_type || null,
        })
        .eq('id', sessionData.id)
        .select()
        .single();

      if (sessionError) {
        console.error('Error updating session:', sessionError);
        throw sessionError;
      }

      console.log('Session updated:', session);

      // Update coaches in the session
      // First, delete existing session coaches
      const { error: deleteCoachesError } = await supabase
        .from('session_coaches')
        .delete()
        .eq('session_id', session.id);

      if (deleteCoachesError) {
        console.error('Error deleting existing session coaches:', deleteCoachesError);
        throw deleteCoachesError;
      }

      // Then, add the new coaches to the session
      if (sessionData.coach_ids.length > 0) {
        const coachInserts = sessionData.coach_ids.map(coach_id => ({
          session_id: session.id,
          coach_id
        }));

        const { error: coachError } = await supabase
          .from('session_coaches')
          .insert(coachInserts);

        if (coachError) {
          console.error('Error adding coaches to session:', coachError);
          throw coachError;
        }
      }

      // Update students in the session
      // First, delete existing session participants
      const { error: deleteStudentsError } = await supabase
        .from('session_participants')
        .delete()
        .eq('session_id', session.id);

      if (deleteStudentsError) {
        console.error('Error deleting existing session participants:', deleteStudentsError);
        throw deleteStudentsError;
      }

      // Then, add the new students to the session
      if (sessionData.student_ids.length > 0) {
        const studentInserts = sessionData.student_ids.map(student_id => ({
          session_id: session.id,
          student_id
        }));

        const { error: studentError } = await supabase
          .from('session_participants')
          .insert(studentInserts);

        if (studentError) {
          console.error('Error adding students to session:', studentError);
          throw studentError;
        }
      }

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      resetForm();
      toast.success('Session updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update session:', error);
      toast.error(`Failed to update session: ${error.message}`);
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('Deleting session with id:', id);

      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting session:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      toast.success('Session deleted successfully');
    },
    onError: (error) => {
      console.error('Failed to delete session:', error);
      toast.error(`Failed to delete session: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      date: new Date(),
      start_time: '',
      end_time: '',
      branch_id: '',
      coach_ids: [],
      student_ids: [],
      notes: '',
      package_type: ''
    });
    setEditingSession(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.branch_id || !formData.start_time || !formData.end_time || formData.coach_ids.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (editingSession) {
      updateSessionMutation.mutate({ ...formData, id: editingSession.id });
    } else {
      createSessionMutation.mutate(formData);
    }
  };

  const handleCoachChange = (coachId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      coach_ids: checked 
        ? [...prev.coach_ids, coachId]
        : prev.coach_ids.filter(id => id !== coachId)
    }));
  };

  const handleStudentChange = (studentId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      student_ids: checked 
        ? [...prev.student_ids, studentId]
        : prev.student_ids.filter(id => id !== studentId)
    }));
  };

  if (sessionsLoading) {
    return <div>Loading sessions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Training Sessions</h2>
      </div>

      {/* Create Session Form */}
      <Card>
        <CardHeader>
          <CardTitle>{editingSession ? 'Edit Session' : 'Create New Session'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.date ? format(formData.date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.date}
                      onSelect={(date) => {
                        if (date) {
                          setFormData({ ...formData, date });
                          setDateOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="branch">Branch *</Label>
                <Select value={formData.branch_id} onValueChange={(value) => setFormData({ ...formData, branch_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="start_time">Start Time *</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="end_time">End Time *</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="package_type">Package Type</Label>
                <Select value={formData.package_type} onValueChange={(value) => setFormData({ ...formData, package_type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select package type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="camp">Camp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Coaches *</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {coaches.map((coach) => (
                  <div key={coach.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`coach-${coach.id}`}
                      checked={formData.coach_ids.includes(coach.id)}
                      onCheckedChange={(checked) => handleCoachChange(coach.id, checked as boolean)}
                    />
                    <Label htmlFor={`coach-${coach.id}`} className="text-sm font-normal">
                      {coach.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Students</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto">
                {students.map((student) => (
                  <div key={student.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`student-${student.id}`}
                      checked={formData.student_ids.includes(student.id)}
                      onCheckedChange={(checked) => handleStudentChange(student.id, checked as boolean)}
                    />
                    <Label htmlFor={`student-${student.id}`} className="text-sm font-normal">
                      {student.name} ({student.remaining_sessions} sessions left)
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Session notes..."
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={createSessionMutation.isPending || updateSessionMutation.isPending}>
                {(createSessionMutation.isPending || updateSessionMutation.isPending) ? 'Saving...' : editingSession ? 'Update Session' : 'Create Session'}
              </Button>
              {editingSession && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Sessions List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Upcoming Sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground">No sessions scheduled.</p>
        ) : (
          sessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">
                        {format(new Date(session.date), 'PPP')} - {session.start_time} to {session.end_time}
                      </h4>
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs",
                        session.status === 'scheduled' && "bg-blue-100 text-blue-800",
                        session.status === 'completed' && "bg-green-100 text-green-800",
                        session.status === 'cancelled' && "bg-red-100 text-red-800"
                      )}>
                        {session.status}
                      </span>
                      {session.package_type && (
                        <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                          {session.package_type}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Branch: {session.branches.name}
                    </p>
                    {session.session_coaches.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Coach(es): {session.session_coaches.map(sc => sc.coaches.name).join(', ')}
                      </p>
                    )}
                    {session.session_participants.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span className="text-sm text-muted-foreground">
                          {session.session_participants.length} student(s): {session.session_participants.map(sp => sp.students.name).join(', ')}
                        </span>
                      </div>
                    )}
                    {session.notes && (
                      <p className="text-sm text-muted-foreground">
                        Notes: {session.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingSession(session);
                        setFormData({
                          date: new Date(session.date),
                          start_time: session.start_time,
                          end_time: session.end_time,
                          branch_id: session.branch_id,
                          coach_ids: session.session_coaches.map(sc => sc.coaches.id),
                          student_ids: session.session_participants.map(sp => sp.students.id),
                          notes: session.notes || '',
                          package_type: session.package_type || ''
                        });
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this session?')) {
                          deleteSessionMutation.mutate(session.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default SessionsManager;
