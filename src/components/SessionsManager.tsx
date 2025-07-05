import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, User, Users, Trash2, Edit, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TrainingSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
  coach_id: string;
  branch_id: string;
  package_type: string | null;
  created_at: string;
  updated_at: string;
  branches: {
    id: string;
    name: string;
    city: string;
    address: string;
  };
  coaches: {
    id: string;
    name: string;
    email: string;
  };
  session_participants: Array<{
    id: string;
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
  address: string;
}

interface Coach {
  id: string;
  name: string;
  email: string;
  package_type: string | null;
}

interface Student {
  id: string;
  name: string;
  email: string;
  remaining_sessions: number;
  package_type: string | null;
}

const SessionsManager = () => {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    date: '',
    start_time: '',
    end_time: '',
    coach_ids: [] as string[],
    branch_id: '',
    package_type: '',
    notes: '',
    student_ids: [] as string[]
  });

  const packageTypes = ['Personal Training', 'Camp Training', 'Group Training'];

  useEffect(() => {
    fetchSessions();
    fetchBranches();
    fetchCoaches();
    fetchStudents();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          *,
          branches (id, name, city, address),
          coaches (id, name, email),
          session_participants (
            id,
            student_id,
            students (id, name, email)
          )
        `)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to fetch sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchCoaches = async () => {
    try {
      const { data, error } = await supabase
        .from('coaches')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCoaches(data || []);
    } catch (error) {
      console.error('Error fetching coaches:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate required fields
      if (!formData.date || !formData.start_time || !formData.end_time || 
          formData.coach_ids.length === 0 || !formData.branch_id || !formData.package_type) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Check for scheduling conflicts for each coach
      for (const coachId of formData.coach_ids) {
        const { data: conflicts } = await supabase.rpc('check_scheduling_conflicts', {
          p_date: formData.date,
          p_start_time: formData.start_time,
          p_end_time: formData.end_time,
          p_coach_id: coachId,
          p_student_ids: formData.student_ids,
          p_session_id: editingSession?.id
        });

        if (conflicts && conflicts.length > 0) {
          const coach = coaches.find(c => c.id === coachId);
          toast.error(`Scheduling conflict detected for coach ${coach?.name || 'Unknown'}: ${conflicts[0].conflict_details}`);
          return;
        }
      }

      if (editingSession) {
        // Update existing session
        const { error } = await supabase
          .from('training_sessions')
          .update({
            date: formData.date,
            start_time: formData.start_time,
            end_time: formData.end_time,
            coach_id: formData.coach_ids[0], // Use first coach for single session updates
            branch_id: formData.branch_id,
            package_type: formData.package_type,
            notes: formData.notes || null,
          })
          .eq('id', editingSession.id);

        if (error) throw error;

        // Update participants
        await supabase
          .from('session_participants')
          .delete()
          .eq('session_id', editingSession.id);

        if (formData.student_ids.length > 0) {
          const participants = formData.student_ids.map(studentId => ({
            session_id: editingSession.id,
            student_id: studentId
          }));

          const { error: participantError } = await supabase
            .from('session_participants')
            .insert(participants);

          if (participantError) throw participantError;
        }

        toast.success('Session updated successfully');
      } else {
        // Create new sessions - one for each coach or group session for Camp Training
        if (formData.package_type === 'Camp Training' && formData.coach_ids.length > 1) {
          // For Camp Training with multiple coaches, create one session with a reference coach
          console.log('Creating camp training session with multiple coaches:', formData.coach_ids);
          
          const { data: sessionData, error: sessionError } = await supabase
            .from('training_sessions')
            .insert({
              date: formData.date,
              start_time: formData.start_time,
              end_time: formData.end_time,
              coach_id: formData.coach_ids[0], // Primary coach
              branch_id: formData.branch_id,
              package_type: formData.package_type,
              notes: formData.notes ? `${formData.notes} (Coaches: ${formData.coach_ids.map(id => coaches.find(c => c.id === id)?.name).join(', ')})` : `Coaches: ${formData.coach_ids.map(id => coaches.find(c => c.id === id)?.name).join(', ')}`,
              status: 'scheduled'
            })
            .select()
            .single();

          if (sessionError) throw sessionError;

          // Add participants
          if (formData.student_ids.length > 0) {
            const participants = formData.student_ids.map(studentId => ({
              session_id: sessionData.id,
              student_id: studentId
            }));

            const { error: participantError } = await supabase
              .from('session_participants')
              .insert(participants);

            if (participantError) throw participantError;
          }
        } else {
          // Create separate sessions for each coach
          for (const coachId of formData.coach_ids) {
            console.log('Creating session for coach:', coachId);
            
            const { data: sessionData, error: sessionError } = await supabase
              .from('training_sessions')
              .insert({
                date: formData.date,
                start_time: formData.start_time,
                end_time: formData.end_time,
                coach_id: coachId,
                branch_id: formData.branch_id,
                package_type: formData.package_type,
                notes: formData.notes || null,
                status: 'scheduled'
              })
              .select()
              .single();

            if (sessionError) throw sessionError;

            // Add participants to each session
            if (formData.student_ids.length > 0) {
              const participants = formData.student_ids.map(studentId => ({
                session_id: sessionData.id,
                student_id: studentId
              }));

              const { error: participantError } = await supabase
                .from('session_participants')
                .insert(participants);

              if (participantError) throw participantError;
            }
          }
        }

        toast.success('Session(s) created successfully');
      }

      // Reset form and close dialog
      setFormData({
        date: '',
        start_time: '',
        end_time: '',
        coach_ids: [],
        branch_id: '',
        package_type: '',
        notes: '',
        student_ids: []
      });
      setIsDialogOpen(false);
      setEditingSession(null);
      fetchSessions();

    } catch (error) {
      console.error('Error saving session:', error);
      toast.error('Failed to save session');
    }
  };

  const handleEdit = (session: TrainingSession) => {
    setEditingSession(session);
    setFormData({
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      coach_ids: [session.coach_id],
      branch_id: session.branch_id,
      package_type: session.package_type || '',
      notes: session.notes || '',
      student_ids: session.session_participants.map(p => p.student_id)
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      // Delete participants first
      await supabase
        .from('session_participants')
        .delete()
        .eq('session_id', sessionId);

      // Delete session
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      toast.success('Session deleted successfully');
      fetchSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    }
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredStudents = students.filter(student => 
    !formData.package_type || student.package_type === formData.package_type
  );

  const filteredCoaches = coaches.filter(coach => 
    !formData.package_type || coach.package_type === formData.package_type
  );

  const resetForm = () => {
    setFormData({
      date: '',
      start_time: '',
      end_time: '',
      coach_ids: [],
      branch_id: '',
      package_type: '',
      notes: '',
      student_ids: []
    });
    setEditingSession(null);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-48">Loading sessions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Training Sessions</h2>
          <p className="text-muted-foreground">Manage and schedule training sessions</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingSession ? 'Edit Session' : 'Create New Session'}</DialogTitle>
              <DialogDescription>
                {editingSession ? 'Update the session details' : 'Fill in the details to create a new training session'}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh] pr-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="package_type">Package Type *</Label>
                    <Select
                      value={formData.package_type}
                      onValueChange={(value) => setFormData({ ...formData, package_type: value, coach_ids: [], student_ids: [] })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select package type" />
                      </SelectTrigger>
                      <SelectContent>
                        {packageTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_time">Start Time *</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="end_time">End Time *</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Coaches * {formData.package_type === 'Camp Training' && '(Multiple selection allowed for Camp Training)'}</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {filteredCoaches.map((coach) => (
                      <div key={coach.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`coach-${coach.id}`}
                          checked={formData.coach_ids.includes(coach.id)}
                          onCheckedChange={(checked) => {
                            if (formData.package_type === 'Camp Training') {
                              // Allow multiple coaches for Camp Training
                              if (checked) {
                                setFormData({ ...formData, coach_ids: [...formData.coach_ids, coach.id] });
                              } else {
                                setFormData({ ...formData, coach_ids: formData.coach_ids.filter(id => id !== coach.id) });
                              }
                            } else {
                              // Single coach for other package types
                              setFormData({ ...formData, coach_ids: checked ? [coach.id] : [] });
                            }
                          }}
                        />
                        <Label htmlFor={`coach-${coach.id}`} className="text-sm">
                          {coach.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Students (Optional)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {filteredStudents.map((student) => (
                      <div key={student.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`student-${student.id}`}
                          checked={formData.student_ids.includes(student.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({ ...formData, student_ids: [...formData.student_ids, student.id] });
                            } else {
                              setFormData({ ...formData, student_ids: formData.student_ids.filter(id => id !== student.id) });
                            }
                          }}
                        />
                        <Label htmlFor={`student-${student.id}`} className="text-sm">
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
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingSession ? 'Update Session' : 'Create Session'}
                  </Button>
                </div>
              </form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No sessions scheduled</p>
              <p className="text-muted-foreground">Create your first training session to get started</p>
            </CardContent>
          </Card>
        ) : (
          sessions.map((session) => (
            <Card key={session.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {new Date(session.date).toLocaleDateString()}
                    </span>
                    <Badge variant={
                      session.status === 'completed' ? 'default' : 
                      session.status === 'cancelled' ? 'destructive' : 'secondary'
                    }>
                      {session.status}
                    </Badge>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(session)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(session.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{formatTime(session.start_time)} - {formatTime(session.end_time)}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{session.coaches.name}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{session.branches.name}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{session.session_participants.length} students</span>
                  </div>
                </div>

                {session.package_type && (
                  <Badge variant="outline">{session.package_type}</Badge>
                )}

                {session.session_participants.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Participants:</p>
                    <div className="flex flex-wrap gap-1">
                      {session.session_participants.map((participant) => (
                        <Badge key={participant.id} variant="secondary" className="text-xs">
                          {participant.students.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {session.notes && (
                  <div>
                    <p className="text-sm font-medium">Notes:</p>
                    <p className="text-sm text-muted-foreground">{session.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default SessionsManager;
