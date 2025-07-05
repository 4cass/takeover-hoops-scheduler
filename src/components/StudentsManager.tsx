import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';

interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
}

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  remaining_sessions: number;
  sessions: number | null;
  branch_id: string | null;
  package_type: string | null;
  created_at: string;
  updated_at: string;
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: 'present' | 'absent' | 'pending';
  marked_at: string | null;
  created_at: string;
  training_sessions: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    branches: {
      name: string;
    };
  };
}

export const StudentsManager = () => {
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    remaining_sessions: 0,
    sessions: 0,
    branch_id: '',
    package_type: ''
  });

  const queryClient = useQueryClient();

  // Fetch students
  const { data: students = [], isLoading: studentsLoading } = useQuery({
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

  // Fetch attendance records with proper joins
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['attendance-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          id,
          session_id,
          student_id,
          status,
          marked_at,
          created_at,
          training_sessions (
            id,
            date,
            start_time,
            end_time,
            branches (
              name
            )
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching attendance records:', error);
        throw error;
      }
      
      return data as AttendanceRecord[];
    },
  });

  // Create student mutation
  const createStudentMutation = useMutation({
    mutationFn: async (studentData: typeof formData) => {
      const { data, error } = await supabase
        .from('students')
        .insert(studentData)
        .select()
        .single();

      if (error) {
        console.error('Error creating student:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      resetForm();
      toast.success('Student created successfully');
    },
    onError: (error) => {
      console.error('Failed to create student:', error);
      toast.error(`Failed to create student: ${error.message}`);
    },
  });

  // Update student mutation
  const updateStudentMutation = useMutation({
    mutationFn: async (studentData: typeof formData & { id: string }) => {
      const { data, error } = await supabase
        .from('students')
        .update(studentData)
        .eq('id', studentData.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating student:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      resetForm();
      toast.success('Student updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update student:', error);
      toast.error(`Failed to update student: ${error.message}`);
    },
  });

  // Delete student mutation
  const deleteStudentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting student:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Student deleted successfully');
    },
    onError: (error) => {
      console.error('Failed to delete student:', error);
      toast.error(`Failed to delete student: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      remaining_sessions: 0,
      sessions: 0,
      branch_id: '',
      package_type: ''
    });
    setEditingStudent(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingStudent) {
      updateStudentMutation.mutate({ ...formData, id: editingStudent.id });
    } else {
      createStudentMutation.mutate(formData);
    }
  };

  if (studentsLoading) {
    return <div>Loading students...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Students</h2>
      </div>

      {/* Create Student Form */}
      <Card>
        <CardHeader>
          <CardTitle>{editingStudent ? 'Edit Student' : 'Create New Student'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  type="tel"
                  id="phone"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="remaining_sessions">Remaining Sessions</Label>
                <Input
                  type="number"
                  id="remaining_sessions"
                  value={formData.remaining_sessions}
                  onChange={(e) => setFormData({ ...formData, remaining_sessions: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <Label htmlFor="sessions">Total Sessions</Label>
                <Input
                  type="number"
                  id="sessions"
                  value={formData.sessions}
                  onChange={(e) => setFormData({ ...formData, sessions: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <Label htmlFor="branch">Branch</Label>
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

            <div className="flex gap-2">
              <Button type="submit" disabled={createStudentMutation.isPending || updateStudentMutation.isPending}>
                {(createStudentMutation.isPending || updateStudentMutation.isPending) ? 'Saving...' : editingStudent ? 'Update Student' : 'Create Student'}
              </Button>
              {editingStudent && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Students List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Registered Students</h3>
        {students.length === 0 ? (
          <p className="text-muted-foreground">No students registered.</p>
        ) : (
          students.map((student) => (
            <Card key={student.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {student.name}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Email: {student.email}
                    </p>
                    {student.phone && (
                      <p className="text-sm text-muted-foreground">
                        Phone: {student.phone}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Remaining Sessions: {student.remaining_sessions}
                    </p>
                    {student.branch_id && (
                      <p className="text-sm text-muted-foreground">
                        Branch ID: {student.branch_id}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingStudent(student);
                        setFormData({
                          name: student.name,
                          email: student.email,
                          phone: student.phone || '',
                          remaining_sessions: student.remaining_sessions,
                          sessions: student.sessions || 0,
                          branch_id: student.branch_id || '',
                          package_type: student.package_type || ''
                        });
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this student?')) {
                          deleteStudentMutation.mutate(student.id);
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

      {/* Attendance Records */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Attendance Records</h3>
        {attendanceRecords.length === 0 ? (
          <p className="text-muted-foreground">No attendance records found.</p>
        ) : (
          attendanceRecords.map((record) => (
            <Card key={record.id}>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <h4 className="font-semibold">
                    {record.training_sessions?.branches?.name} - {record.training_sessions?.date}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Status: {record.status}
                  </p>
                  {record.marked_at && (
                    <p className="text-sm text-muted-foreground">
                      Marked at: {record.marked_at}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
