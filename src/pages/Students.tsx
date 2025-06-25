import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LocalStorage, STORAGE_KEYS } from '@/lib/storage';
import { Student, Branch } from '@/types';
import { useToast } from '@/hooks/use-toast';

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    remaining_sessions: 0,
    assigned_branch_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const studentsData = LocalStorage.get<Student>(STORAGE_KEYS.STUDENTS);
    const branchesData = LocalStorage.get<Branch>(STORAGE_KEYS.BRANCHES);
    setStudents(studentsData);
    setBranches(branchesData);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      remaining_sessions: 0,
      assigned_branch_id: ''
    });
    setEditingStudent(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.assigned_branch_id) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (editingStudent) {
      const updates: Partial<Student> = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        remaining_sessions: formData.remaining_sessions,
        assigned_branch_id: formData.assigned_branch_id
      };
      LocalStorage.update(STORAGE_KEYS.STUDENTS, editingStudent.id, updates);
      toast({
        title: "Success",
        description: "Student updated successfully"
      });
    } else {
      const newStudent: Student = {
        id: LocalStorage.generateId(),
        ...formData,
        created_at: new Date().toISOString()
      };
      LocalStorage.add(STORAGE_KEYS.STUDENTS, newStudent);
      toast({
        title: "Success",
        description: "Student created successfully"
      });
    }

    loadData();
    setIsDialogOpen(false);
    resetForm();
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      email: student.email,
      phone: student.phone,
      remaining_sessions: student.remaining_sessions,
      assigned_branch_id: student.assigned_branch_id
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    LocalStorage.delete(STORAGE_KEYS.STUDENTS, id);
    loadData();
    toast({
      title: "Success",
      description: "Student deleted successfully"
    });
  };

  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || 'Unknown Branch';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Students</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>Add Student</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingStudent ? 'Edit Student' : 'Add New Student'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="remaining_sessions">Remaining Sessions</Label>
                <Input
                  id="remaining_sessions"
                  type="number"
                  min="0"
                  value={formData.remaining_sessions}
                  onChange={(e) => setFormData({ ...formData, remaining_sessions: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="branch">Branch *</Label>
                <select
                  id="branch"
                  className="w-full p-2 border border-input rounded-md"
                  value={formData.assigned_branch_id}
                  onChange={(e) => setFormData({ ...formData, assigned_branch_id: e.target.value })}
                  required
                >
                  <option value="">Select a branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingStudent ? 'Update' : 'Create'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {students.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500">No students found. Add your first student to get started.</p>
          </Card>
        ) : (
          students.map((student) => (
            <Card key={student.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{student.name}</h3>
                  <p className="text-gray-600">{student.email}</p>
                  <p className="text-gray-600">{student.phone}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Branch: {getBranchName(student.assigned_branch_id)}
                  </p>
                  <p className="text-sm font-medium mt-1">
                    Remaining Sessions: 
                    <span className={`ml-1 ${student.remaining_sessions <= 5 ? 'text-red-600' : 'text-green-600'}`}>
                      {student.remaining_sessions}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(student)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(student.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
