
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Users, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

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

interface TrainingSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  package_type: string | null;
  notes: string | null;
  branch_id: string;
  branches: {
    name: string;
    city: string;
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

export function SessionsManager() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);

  // Form states
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [sessionDate, setSessionDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [packageType, setPackageType] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'scheduled' | 'completed' | 'cancelled'>('scheduled');

  const resetForm = () => {
    setSelectedBranch('');
    setSelectedCoaches([]);
    setSelectedStudents([]);
    setSessionDate('');
    setStartTime('');
    setEndTime('');
    setPackageType('');
    setNotes('');
    setStatus('scheduled');
  };

  const fetchSessions = async () => {
    try {
      console.log('Fetching sessions...');
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
              name
            )
          ),
          session_participants (
            students (
              id,
              name
            )
          )
        `)
        .order('date', { ascending: false })
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Error fetching sessions:', error);
        toast.error('Failed to fetch sessions');
        return;
      }

      console.log('Sessions fetched:', data);
      
      // Group sessions by unique combination of date, time, and branch to handle multiple coaches
      const groupedSessions = new Map();
      
      data?.forEach(session => {
        const key = `${session.date}-${session.start_time}-${session.end_time}-${session.branch_id}`;
        
        if (!groupedSessions.has(key)) {
          groupedSessions.set(key, {
            ...session,
            session_coaches: [],
            session_participants: []
          });
        }
        
        const groupedSession = groupedSessions.get(key);
        
        // Merge coaches
        if (session.session_coaches) {
          session.session_coaches.forEach(sc => {
            if (!groupedSession.session_coaches.find(gsc => gsc.coaches.id === sc.coaches.id)) {
              groupedSession.session_coaches.push(sc);
            }
          });
        }
        
        // Merge participants
        if (session.session_participants) {
          session.session_participants.forEach(sp => {
            if (!groupedSession.session_participants.find(gsp => gsp.students.id === sp.students.id)) {
              groupedSession.session_participants.push(sp);
            }
          });
        }
      });
      
      const uniqueSessions = Array.from(groupedSessions.values());
      setSessions(uniqueSessions);
    } catch (error) {
      console.error('Error in fetchSessions:', error);
      toast.error('Failed to fetch sessions');
    }
  };

  const fetchBranches = async () => {
    const { data, error } = await supabase.from('branches').select('*').order('name');
    if (error) {
      console.error('Error fetching branches:', error);
      toast.error('Failed to fetch branches');
    } else {
      setBranches(data || []);
    }
  };

  const fetchCoaches = async () => {
    const { data, error } = await supabase.from('coaches').select('id, name, email').order('name');
    if (error) {
      console.error('Error fetching coaches:', error);
      toast.error('Failed to fetch coaches');
    } else {
      setCoaches(data || []);
    }
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase.from('students').select('id, name, email').order('name');
    if (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to fetch students');
    } else {
      setStudents(data || []);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchSessions(),
        fetchBranches(),
        fetchCoaches(),
        fetchStudents()
      ]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleCreateSession = async () => {
    if (!selectedBranch || selectedCoaches.length === 0 || !sessionDate || !startTime || !endTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // Create the training session
      const { data: sessionData, error: sessionError } = await supabase
        .from('training_sessions')
        .insert({
          branch_id: selectedBranch,
          date: sessionDate,
          start_time: startTime,
          end_time: endTime,
          package_type: packageType || null,
          notes: notes || null,
          status: status
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error creating session:', sessionError);
        toast.error('Failed to create session');
        return;
      }

      // Add coaches to the session
      const coachInserts = selectedCoaches.map(coachId => ({
        session_id: sessionData.id,
        coach_id: coachId
      }));

      const { error: coachError } = await supabase
        .from('session_coaches')
        .insert(coachInserts);

      if (coachError) {
        console.error('Error adding coaches:', coachError);
        toast.error('Failed to add coaches to session');
        return;
      }

      // Add students to the session
      if (selectedStudents.length > 0) {
        const studentInserts = selectedStudents.map(studentId => ({
          session_id: sessionData.id,
          student_id: studentId
        }));

        const { error: studentError } = await supabase
          .from('session_participants')
          .insert(studentInserts);

        if (studentError) {
          console.error('Error adding students:', studentError);
          toast.error('Failed to add students to session');
          return;
        }
      }

      toast.success('Session created successfully');
      setShowCreateDialog(false);
      resetForm();
      fetchSessions();
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Failed to create session');
    }
  };

  const handleEditSession = async () => {
    if (!editingSession || !selectedBranch || selectedCoaches.length === 0 || !sessionDate || !startTime || !endTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // Update the training session
      const { error: sessionError } = await supabase
        .from('training_sessions')
        .update({
          branch_id: selectedBranch,
          date: sessionDate,
          start_time: startTime,
          end_time: endTime,
          package_type: packageType || null,
          notes: notes || null,
          status: status
        })
        .eq('id', editingSession.id);

      if (sessionError) {
        console.error('Error updating session:', sessionError);
        toast.error('Failed to update session');
        return;
      }

      // Remove existing coaches
      const { error: removeCoachError } = await supabase
        .from('session_coaches')
        .delete()
        .eq('session_id', editingSession.id);

      if (removeCoachError) {
        console.error('Error removing coaches:', removeCoachError);
        toast.error('Failed to update coaches');
        return;
      }

      // Add new coaches
      const coachInserts = selectedCoaches.map(coachId => ({
        session_id: editingSession.id,
        coach_id: coachId
      }));

      const { error: coachError } = await supabase
        .from('session_coaches')
        .insert(coachInserts);

      if (coachError) {
        console.error('Error adding coaches:', coachError);
        toast.error('Failed to add coaches to session');
        return;
      }

      // Remove existing students
      const { error: removeStudentError } = await supabase
        .from('session_participants')
        .delete()
        .eq('session_id', editingSession.id);

      if (removeStudentError) {
        console.error('Error removing students:', removeStudentError);
        toast.error('Failed to update students');
        return;
      }

      // Add new students
      if (selectedStudents.length > 0) {
        const studentInserts = selectedStudents.map(studentId => ({
          session_id: editingSession.id,
          student_id: studentId
        }));

        const { error: studentError } = await supabase
          .from('session_participants')
          .insert(studentInserts);

        if (studentError) {
          console.error('Error adding students:', studentError);
          toast.error('Failed to add students to session');
          return;
        }
      }

      toast.success('Session updated successfully');
      setShowEditDialog(false);
      setEditingSession(null);
      resetForm();
      fetchSessions();
    } catch (error) {
      console.error('Error updating session:', error);
      toast.error('Failed to update session');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        console.error('Error deleting session:', error);
        toast.error('Failed to delete session');
        return;
      }

      toast.success('Session deleted successfully');
      fetchSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    }
  };

  const openEditDialog = (session: TrainingSession) => {
    setEditingSession(session);
    setSelectedBranch(session.branch_id);
    setSelectedCoaches(session.session_coaches.map(sc => sc.coaches.id));
    setSelectedStudents(session.session_participants.map(sp => sp.students.id));
    setSessionDate(session.date);
    setStartTime(session.start_time);
    setEndTime(session.end_time);
    setPackageType(session.package_type || '');
    setNotes(session.notes || '');
    setStatus(session.status);
    setShowEditDialog(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-lg">Loading sessions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Training Sessions</h1>
          <p className="text-muted-foreground">Manage training sessions and schedules</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Create Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Training Session</DialogTitle>
              <DialogDescription>
                Set up a new training session with coaches and students.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch *</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
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
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start Time *</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">End Time *</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Coaches *</Label>
                <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                  {coaches.map((coach) => (
                    <label key={coach.id} className="flex items-center space-x-2 p-1">
                      <input
                        type="checkbox"
                        checked={selectedCoaches.includes(coach.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCoaches([...selectedCoaches, coach.id]);
                          } else {
                            setSelectedCoaches(selectedCoaches.filter(id => id !== coach.id));
                          }
                        }}
                      />
                      <span>{coach.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Students</Label>
                <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                  {students.map((student) => (
                    <label key={student.id} className="flex items-center space-x-2 p-1">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudents([...selectedStudents, student.id]);
                          } else {
                            setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                          }
                        }}
                      />
                      <span>{student.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="package-type">Package Type</Label>
                  <Input
                    id="package-type"
                    value={packageType}
                    onChange={(e) => setPackageType(e.target.value)}
                    placeholder="e.g., Camp, Individual, Group"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(value: 'scheduled' | 'completed' | 'cancelled') => setStatus(value)}>
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

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSession}>Create Session</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">No training sessions found</p>
            </CardContent>
          </Card>
        ) : (
          sessions.map((session) => (
            <Card key={session.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(session.date).toLocaleDateString()}
                      <Badge className={`${getStatusColor(session.status)} text-white`}>
                        {session.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {session.start_time} - {session.end_time}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {session.branches.name}, {session.branches.city}
                      </span>
                      {session.package_type && (
                        <Badge variant="outline">{session.package_type}</Badge>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(session)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteSession(session.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Coaches: {session.session_coaches.map(sc => sc.coaches.name).join(', ')}
                    </h4>
                  </div>
                  
                  {session.session_participants.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">
                        Students ({session.session_participants.length}):
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {session.session_participants.map((participant) => (
                          <Badge key={participant.students.id} variant="secondary">
                            {participant.students.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {session.notes && (
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Notes:</h4>
                      <p className="text-sm text-muted-foreground">{session.notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Training Session</DialogTitle>
            <DialogDescription>
              Update the training session details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-branch">Branch *</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
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
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date *</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start-time">Start Time *</Label>
                <Input
                  id="edit-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end-time">End Time *</Label>
                <Input
                  id="edit-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Coaches *</Label>
              <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                {coaches.map((coach) => (
                  <label key={coach.id} className="flex items-center space-x-2 p-1">
                    <input
                      type="checkbox"
                      checked={selectedCoaches.includes(coach.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCoaches([...selectedCoaches, coach.id]);
                        } else {
                          setSelectedCoaches(selectedCoaches.filter(id => id !== coach.id));
                        }
                      }}
                    />
                    <span>{coach.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Students</Label>
              <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                {students.map((student) => (
                  <label key={student.id} className="flex items-center space-x-2 p-1">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudents([...selectedStudents, student.id]);
                        } else {
                          setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                        }
                      }}
                    />
                    <span>{student.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-package-type">Package Type</Label>
                <Input
                  id="edit-package-type"
                  value={packageType}
                  onChange={(e) => setPackageType(e.target.value)}
                  placeholder="e.g., Camp, Individual, Group"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={status} onValueChange={(value: 'scheduled' | 'completed' | 'cancelled') => setStatus(value)}>
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

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSession}>Update Session</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
