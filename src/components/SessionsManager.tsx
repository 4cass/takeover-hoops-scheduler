
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Plus, Users, Clock, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';

interface Session {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  package_type: string | null;
  notes: string | null;
  coach_id: string | null;
  branch_id: string;
  coaches?: { id: string; name: string } | null;
  branches?: { id: string; name: string } | null;
  session_participants?: Array<{
    students: { id: string; name: string } | null;
  }> | null;
}

interface Branch {
  id: string;
  name: string;
}

interface Coach {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  remaining_sessions: number;
}

export const SessionsManager = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    start_time: '',
    end_time: '',
    coach_id: '',
    branch_id: '',
    package_type: '',
    notes: '',
    student_ids: [] as string[]
  });

  const queryClient = useQueryClient();

  // Fetch sessions with related data
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          *,
          coaches (id, name),
          branches (id, name),
          session_participants (
            students (id, name)
          )
        `)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as Session[];
    }
  });

  // Fetch branches
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Branch[];
    }
  });

  // Fetch coaches
  const { data: coaches } = useQuery({
    queryKey: ['coaches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coaches')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Coach[];
    }
  });

  // Fetch students
  const { data: students } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Student[];
    }
  });

  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: typeof formData) => {
      // Check for conflicts first
      const { data: conflicts } = await supabase.rpc('check_scheduling_conflicts', {
        p_date: sessionData.date,
        p_start_time: sessionData.start_time,
        p_end_time: sessionData.end_time,
        p_coach_id: sessionData.coach_id,
        p_student_ids: sessionData.student_ids
      });

      if (conflicts && conflicts.length > 0) {
        throw new Error(conflicts.map(c => c.conflict_details).join(', '));
      }

      // Create session
      const { data: session, error } = await supabase
        .from('training_sessions')
        .insert({
          date: sessionData.date,
          start_time: sessionData.start_time,
          end_time: sessionData.end_time,
          coach_id: sessionData.coach_id || null,
          branch_id: sessionData.branch_id,
          package_type: sessionData.package_type || null,
          notes: sessionData.notes || null
        })
        .select()
        .single();

      if (error) throw error;

      // Add participants
      if (sessionData.student_ids.length > 0) {
        const participants = sessionData.student_ids.map(student_id => ({
          session_id: session.id,
          student_id
        }));

        const { error: participantError } = await supabase
          .from('session_participants')
          .insert(participants);

        if (participantError) throw participantError;
      }

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session created successfully');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to create session: ${error.message}`);
    }
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, sessionData }: { id: string; sessionData: typeof formData }) => {
      // Check for conflicts first (excluding current session)
      const { data: conflicts } = await supabase.rpc('check_scheduling_conflicts', {
        p_date: sessionData.date,
        p_start_time: sessionData.start_time,
        p_end_time: sessionData.end_time,
        p_coach_id: sessionData.coach_id,
        p_student_ids: sessionData.student_ids,
        p_session_id: id
      });

      if (conflicts && conflicts.length > 0) {
        throw new Error(conflicts.map(c => c.conflict_details).join(', '));
      }

      // Update session
      const { error } = await supabase
        .from('training_sessions')
        .update({
          date: sessionData.date,
          start_time: sessionData.start_time,
          end_time: sessionData.end_time,
          coach_id: sessionData.coach_id || null,
          branch_id: sessionData.branch_id,
          package_type: sessionData.package_type || null,
          notes: sessionData.notes || null
        })
        .eq('id', id);

      if (error) throw error;

      // Update participants
      await supabase.from('session_participants').delete().eq('session_id', id);
      
      if (sessionData.student_ids.length > 0) {
        const participants = sessionData.student_ids.map(student_id => ({
          session_id: id,
          student_id
        }));

        const { error: participantError } = await supabase
          .from('session_participants')
          .insert(participants);

        if (participantError) throw participantError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session updated successfully');
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed to update session: ${error.message}`);
    }
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete session: ${error.message}`);
    }
  });

  const resetForm = () => {
    setFormData({
      date: '',
      start_time: '',
      end_time: '',
      coach_id: '',
      branch_id: '',
      package_type: '',
      notes: '',
      student_ids: []
    });
    setEditingSession(null);
  };

  const handleEdit = (session: Session) => {
    setEditingSession(session);
    setFormData({
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      coach_id: session.coach_id || '',
      branch_id: session.branch_id,
      package_type: session.package_type || '',
      notes: session.notes || '',
      student_ids: session.session_participants?.map(p => p.students?.id).filter(Boolean) || []
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSession) {
      updateSessionMutation.mutate({ id: editingSession.id, sessionData: formData });
    } else {
      createSessionMutation.mutate(formData);
    }
  };

  const handleStudentSelection = (studentId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      student_ids: checked 
        ? [...prev.student_ids, studentId]
        : prev.student_ids.filter(id => id !== studentId)
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  if (isLoading) {
    return <div>Loading sessions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Training Sessions</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingSession ? 'Edit Session' : 'Create New Session'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="branch">Branch</Label>
                  <Select value={formData.branch_id} onValueChange={(value) => setFormData({ ...formData, branch_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches?.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
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
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="coach">Coach</Label>
                  <Select value={formData.coach_id} onValueChange={(value) => setFormData({ ...formData, coach_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select coach" />
                    </SelectTrigger>
                    <SelectContent>
                      {coaches?.map(coach => (
                        <SelectItem key={coach.id} value={coach.id}>
                          {coach.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="package_type">Package Type</Label>
                  <Select value={formData.package_type} onValueChange={(value) => setFormData({ ...formData, package_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select package type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Camp Training">Camp Training</SelectItem>
                      <SelectItem value="Personal Training">Personal Training</SelectItem>
                      <SelectItem value="Group Training">Group Training</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Students</Label>
                <div className="border rounded-md p-4 max-h-48 overflow-y-auto">
                  {students?.map(student => (
                    <div key={student.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`student-${student.id}`}
                        checked={formData.student_ids.includes(student.id)}
                        onCheckedChange={(checked) => handleStudentSelection(student.id, checked as boolean)}
                      />
                      <Label htmlFor={`student-${student.id}`} className="flex-1">
                        {student.name} ({student.remaining_sessions} sessions left)
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createSessionMutation.isPending || updateSessionMutation.isPending}>
                  {editingSession ? 'Update' : 'Create'} Session
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {sessions?.map((session) => (
          <Card key={session.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    {format(new Date(session.date), 'EEEE, MMMM d, yyyy')}
                  </CardTitle>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {session.start_time} - {session.end_time}
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      {session.branches?.name || 'No branch'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusColor(session.status)}>
                    {session.status}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(session)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => deleteSessionMutation.mutate(session.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Coach:</span>
                  <span className="text-sm">{session.coaches?.name || 'Unassigned'}</span>
                </div>
                {session.package_type && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Package:</span>
                    <Badge variant="outline">{session.package_type}</Badge>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Students:</span>
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    <span className="text-sm">
                      {session.session_participants?.length || 0}
                    </span>
                  </div>
                </div>
                {session.session_participants && session.session_participants.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {session.session_participants.map((participant, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {participant.students?.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {session.notes && (
                  <div className="mt-2">
                    <span className="text-sm font-medium">Notes:</span>
                    <p className="text-sm text-muted-foreground mt-1">{session.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
