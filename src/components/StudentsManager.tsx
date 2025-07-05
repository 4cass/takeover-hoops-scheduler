import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Users, UserCheck, Trash2, Edit, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface StudentRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  branch_id: string | null;
  package_type: string | null;
  sessions: number | null;
  remaining_sessions: number;
  created_at: string;
  updated_at: string;
}

interface Branch {
  id: string;
  name: string;
  city: string;
}

interface AttendanceRecord {
  session_id: string;
  student_id: string;
  status: 'present' | 'absent' | 'pending';
  training_sessions: {
    date: string;
    start_time: string;
    end_time: string;
    branches: {
      name: string;
    };
  };
}

const StudentsManager = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [newStudent, setNewStudent] = useState({
    name: '',
    email: '',
    phone: '',
    branch_id: '',
    package_type: '',
    sessions: 0,
    remaining_sessions: 0
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch students
  const { data: students = [], isLoading } = useQuery({
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

  // Create student mutation
  const createStudentMutation = useMutation({
    mutationFn: async (studentData: typeof newStudent) => {
      const { data, error } = await supabase
        .from('students')
        .insert([studentData])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setIsCreateDialogOpen(false);
      setNewStudent({
        name: '',
        email: '',
        phone: '',
        branch_id: '',
        package_type: '',
        sessions: 0,
        remaining_sessions: 0
      });
      toast({
        title: "Success",
        description: "Student created successfully",
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

  // Update student mutation
  const updateStudentMutation = useMutation({
    mutationFn: async (studentData: StudentRecord) => {
      const { data, error } = await supabase
        .from('students')
        .update(studentData)
        .eq('id', studentData.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setEditingStudent(null);
      toast({
        title: "Success",
        description: "Student updated successfully",
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

  // Delete student mutation
  const deleteStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({
        title: "Success",
        description: "Student deleted successfully",
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

  const handleCreateStudent = () => {
    createStudentMutation.mutate(newStudent);
  };

  const handleUpdateStudent = () => {
    if (editingStudent) {
      updateStudentMutation.mutate(editingStudent);
    }
  };

  const handleDeleteStudent = (studentId: string) => {
    if (confirm('Are you sure you want to delete this student?')) {
      deleteStudentMutation.mutate(studentId);
    }
  };

  // Fetch attendance records with proper joins
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['student-attendance', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          training_sessions!attendance_records_session_id_fkey (
            date,
            start_time,
            end_time,
            branches!training_sessions_branch_id_fkey (
              name
            )
          )
        `)
        .eq('student_id', selectedStudentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedStudentId
  });

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading students...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Students Management</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Student
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newStudent.phone || ''}
                    onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="branch">Branch</Label>
                  <select
                    id="branch"
                    className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newStudent.branch_id}
                    onChange={(e) => setNewStudent({ ...newStudent, branch_id: e.target.value })}
                  >
                    <option value="">Select Branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="package_type">Package Type</Label>
                  <Input
                    id="package_type"
                    value={newStudent.package_type || ''}
                    onChange={(e) => setNewStudent({ ...newStudent, package_type: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="remaining_sessions">Remaining Sessions</Label>
                  <Input
                    id="remaining_sessions"
                    type="number"
                    value={newStudent.remaining_sessions?.toString() || ''}
                    onChange={(e) => setNewStudent({ ...newStudent, remaining_sessions: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <Button onClick={handleCreateStudent} className="w-full">
                {createStudentMutation.isPending ? 'Creating...' : 'Create Student'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {students.map((student) => (
          <Card key={student.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex justify-between items-center">
              <CardTitle>{student.name}</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setEditingStudent(student);
                }}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDeleteStudent(student.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>Email: {student.email}</p>
                {student.phone && <p>Phone: {student.phone}</p>}
                {student.branch_id && (
                  <p>
                    Branch:{' '}
                    {branches.find((branch) => branch.id === student.branch_id)?.name}
                  </p>
                )}
                {student.package_type && <p>Package: {student.package_type}</p>}
                <p>Remaining Sessions: {student.remaining_sessions}</p>
                <Button size="sm" onClick={() => setSelectedStudentId(student.id)}>
                  View Attendance
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingStudent && (
        <Dialog open={!!editingStudent} onOpenChange={() => setEditingStudent(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={editingStudent.name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editingStudent.email}
                    onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={editingStudent.phone || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="branch">Branch</Label>
                  <select
                    id="branch"
                    className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editingStudent.branch_id || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, branch_id: e.target.value })}
                  >
                    <option value="">Select Branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="package_type">Package Type</Label>
                  <Input
                    id="package_type"
                    value={editingStudent.package_type || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, package_type: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="remaining_sessions">Remaining Sessions</Label>
                  <Input
                    id="remaining_sessions"
                    type="number"
                    value={editingStudent.remaining_sessions?.toString() || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, remaining_sessions: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <Button onClick={handleUpdateStudent} className="w-full">
                {updateStudentMutation.isPending ? 'Updating...' : 'Update Student'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {attendanceRecords.length > 0 && selectedStudentId && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {attendanceRecords.map((record) => (
                <div key={record.session_id} className="p-4 border rounded-lg">
                  <p>
                    Date: {new Date(record.training_sessions.date).toLocaleDateString()}
                  </p>
                  <p>
                    Time: {record.training_sessions.start_time} - {record.training_sessions.end_time}
                  </p>
                  <p>Branch: {record.training_sessions.branches.name}</p>
                  <p>Status: {record.status}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {students.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No students found.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudentsManager;
