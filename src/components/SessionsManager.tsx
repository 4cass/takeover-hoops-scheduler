
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Plus, Calendar, Clock, MapPin, User, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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
}

interface Student {
  id: string;
  name: string;
  email: string;
}

interface GroupedSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  package_type: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
  branch_id: string;
  branch_name: string;
  coaches: Array<{
    id: string;
    name: string;
  }>;
  participants: Array<{
    id: string;
    name: string;
  }>;
}

const SessionsManager = () => {
  const [sessions, setSessions] = useState<GroupedSession[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    date: '',
    start_time: '',
    end_time: '',
    package_type: '',
    status: 'scheduled' as const,
    notes: '',
    branch_id: '',
    coach_ids: [] as string[],
    student_ids: [] as string[]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch sessions with all related data
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('training_sessions')
        .select(`
          *,
          branches!inner(id, name, city, address),
          session_coaches!left(
            coaches!inner(id, name)
          ),
          session_participants!left(
            students!inner(id, name)
          )
        `)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (sessionsError) throw sessionsError;

      // Group sessions by core properties (date, time, branch, package_type)
      const groupedSessions = new Map<string, GroupedSession>();

      sessionsData?.forEach((session: any) => {
        const groupKey = `${session.date}-${session.start_time}-${session.end_time}-${session.branch_id}-${session.package_type || 'null'}`;
        
        if (!groupedSessions.has(groupKey)) {
          groupedSessions.set(groupKey, {
            id: session.id,
            date: session.date,
            start_time: session.start_time,
            end_time: session.end_time,
            package_type: session.package_type,
            status: session.status,
            notes: session.notes,
            branch_id: session.branch_id,
            branch_name: session.branches?.name || 'Unknown Branch',
            coaches: [],
            participants: []
          });
        }

        const groupedSession = groupedSessions.get(groupKey)!;

        // Add coaches (avoid duplicates)
        session.session_coaches?.forEach((sc: any) => {
          if (sc.coaches && !groupedSession.coaches.find(c => c.id === sc.coaches.id)) {
            groupedSession.coaches.push({
              id: sc.coaches.id,
              name: sc.coaches.name
            });
          }
        });

        // Add participants (avoid duplicates)
        session.session_participants?.forEach((sp: any) => {
          if (sp.students && !groupedSession.participants.find(p => p.id === sp.students.id)) {
            groupedSession.participants.push({
              id: sp.students.id,
              name: sp.students.name
            });
          }
        });
      });

      setSessions(Array.from(groupedSessions.values()));

      // Fetch other data
      const [branchesResult, coachesResult, studentsResult] = await Promise.all([
        supabase.from('branches').select('*'),
        supabase.from('coaches').select('*'),
        supabase.from('students').select('*')
      ]);

      if (branchesResult.error) throw branchesResult.error;
      if (coachesResult.error) throw coachesResult.error;
      if (studentsResult.error) throw studentsResult.error;

      setBranches(branchesResult.data || []);
      setCoaches(coachesResult.data || []);
      setStudents(studentsResult.data || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sessions data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Create the main session
      const { data: sessionData, error: sessionError } = await supabase
        .from('training_sessions')
        .insert({
          date: formData.date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          package_type: formData.package_type || null,
          status: formData.status,
          notes: formData.notes || null,
          branch_id: formData.branch_id
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Add coaches
      if (formData.coach_ids.length > 0) {
        const coachInserts = formData.coach_ids.map(coachId => ({
          session_id: sessionData.id,
          coach_id: coachId
        }));

        const { error: coachError } = await supabase
          .from('session_coaches')
          .insert(coachInserts);

        if (coachError) throw coachError;
      }

      // Add participants
      if (formData.student_ids.length > 0) {
        const participantInserts = formData.student_ids.map(studentId => ({
          session_id: sessionData.id,
          student_id: studentId
        }));

        const { error: participantError } = await supabase
          .from('session_participants')
          .insert(participantInserts);

        if (participantError) throw participantError;
      }

      toast({
        title: "Success",
        description: "Session created successfully"
      });

      setShowAddForm(false);
      resetForm();
      fetchData();

    } catch (error) {
      console.error('Error creating session:', error);
      toast({
        title: "Error",
        description: "Failed to create session",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      date: '',
      start_time: '',
      end_time: '',
      package_type: '',
      status: 'scheduled',
      notes: '',
      branch_id: '',
      coach_ids: [],
      student_ids: []
    });
    setEditingSession(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading sessions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Training Sessions</h2>
        <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Session
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Session</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="branch">Branch</Label>
                  <Select value={formData.branch_id} onValueChange={(value) => setFormData({...formData, branch_id: value})}>
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
                <div>
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="package_type">Package Type</Label>
                  <Input
                    id="package_type"
                    value={formData.package_type}
                    onChange={(e) => setFormData({...formData, package_type: e.target.value})}
                    placeholder="e.g., Basic, Premium"
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: any) => setFormData({...formData, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Coaches</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {coaches.map((coach) => (
                    <label key={coach.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.coach_ids.includes(coach.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({...formData, coach_ids: [...formData.coach_ids, coach.id]});
                          } else {
                            setFormData({...formData, coach_ids: formData.coach_ids.filter(id => id !== coach.id)});
                          }
                        }}
                      />
                      <span className="text-sm">{coach.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Students</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {students.map((student) => (
                    <label key={student.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.student_ids.includes(student.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({...formData, student_ids: [...formData.student_ids, student.id]});
                          } else {
                            setFormData({...formData, student_ids: formData.student_ids.filter(id => id !== student.id)});
                          }
                        }}
                      />
                      <span className="text-sm">{student.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Optional notes about the session"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit">Add Session</Button>
                <Button type="button" variant="outline" onClick={() => {setShowAddForm(false); resetForm();}}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {sessions.map((session) => (
          <Card key={session.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">{format(new Date(session.date), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>{session.start_time} - {session.end_time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span>{session.branch_name}</span>
                  </div>
                  <Badge className={getStatusColor(session.status)}>
                    {session.status}
                  </Badge>
                  {session.package_type && (
                    <Badge variant="outline">{session.package_type}</Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    <strong>Coach{session.coaches.length > 1 ? 'es' : ''}:</strong>{' '}
                    {session.coaches.map(coach => coach.name).join(', ') || 'No coaches assigned'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    <strong>Students:</strong>{' '}
                    {session.participants.map(participant => participant.name).join(', ') || 'No students enrolled'}
                  </span>
                </div>

                {session.notes && (
                  <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    <strong>Notes:</strong> {session.notes}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {sessions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No training sessions found. Click "Add Session" to create your first session.
        </div>
      )}
    </div>
  );
};

export default SessionsManager;
