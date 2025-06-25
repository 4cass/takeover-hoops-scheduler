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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Students</h1>
          <p className="text-gray-600">Manage your basketball players and their training sessions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="basketball-button">
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-900">
                {editingStudent ? 'Edit Student' : 'Add New Student'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name" className="font-semibold text-gray-700">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="basketball-input mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email" className="font-semibold text-gray-700">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="basketball-input mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone" className="font-semibold text-gray-700">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="basketball-input mt-1"
                />
              </div>
              <div>
                <Label htmlFor="remaining_sessions" className="font-semibold text-gray-700">Remaining Sessions</Label>
                <Input
                  id="remaining_sessions"
                  type="number"
                  min="0"
                  value={formData.remaining_sessions}
                  onChange={(e) => setFormData({ ...formData, remaining_sessions: parseInt(e.target.value) || 0 })}
                  className="basketball-input mt-1"
                />
              </div>
              <div>
                <Label htmlFor="branch" className="font-semibold text-gray-700">Branch *</Label>
                <select
                  id="branch"
                  className="w-full basketball-input mt-1"
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
              <div className="flex gap-3 pt-4">
                <Button type="submit" className="basketball-button flex-1">
                  {editingStudent ? 'Update' : 'Create'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1 border-2 border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Students Grid */}
      <div className="grid gap-6">
        {students.length === 0 ? (
          <Card className="basketball-card p-12 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No students found</h3>
            <p className="text-gray-600">Add your first student to get started with training management.</p>
          </Card>
        ) : (
          students.map((student) => (
            <Card key={student.id} className="basketball-card p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{student.name}</h3>
                      <p className="text-gray-600">{student.email}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-500 font-medium">Phone</p>
                      <p className="text-gray-900">{student.phone || 'Not provided'}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-500 font-medium">Branch</p>
                      <p className="text-gray-900">{getBranchName(student.assigned_branch_id)}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-500 font-medium">Sessions Left</p>
                      <div className="flex items-center space-x-2">
                        <span className={`text-lg font-bold ${student.remaining_sessions <= 5 ? 'text-red-600' : 'text-green-600'}`}>
                          {student.remaining_sessions}
                        </span>
                        {student.remaining_sessions <= 5 && (
                          <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                            Low
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(student)}
                    className="border-orange-200 hover:bg-orange-50 hover:border-orange-300"
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
