import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Edit, Trash2, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  package_type: string | null;
  auth_id: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionRecord {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  branch_id: string;
  package_type: string | null;
  branches: {
    name: string;
  };
  session_participants: {
    students: {
      name: string;
    };
  }[];
}

export const CoachesManager = () => {
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'coach',
    package_type: '',
    password: ''
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  // Fetch coaches
  const { data: coaches = [], isLoading: coachesLoading } = useQuery({
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

  // Create coach mutation
  const createCoachMutation = useMutation({
    mutationFn: async (coachData: typeof formData & { password?: string }) => {
      console.log('Creating coach with data:', coachData);

      // Create user in auth.users
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: coachData.email,
        password: coachData.password || 'defaultpassword', // Provide a default password
        options: {
          data: {
            name: coachData.name,
            role: coachData.role,
          }
        }
      });

      if (authError) {
        console.error('Error creating user in auth:', authError);
        throw authError;
      }

      // Create coach record in public.coaches
      const { data, error } = await supabase
        .from('coaches')
        .insert({
          name: coachData.name,
          email: coachData.email,
          phone: coachData.phone,
          role: coachData.role,
          package_type: coachData.package_type,
          auth_id: authData.user?.id,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating coach:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaches'] });
      resetForm();
      toast.success('Coach created successfully');
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      console.error('Failed to create coach:', error);
      toast.error(`Failed to create coach: ${error.message}`);
    },
  });

  // Update coach mutation
  const updateCoachMutation = useMutation({
    mutationFn: async (coachData: typeof formData & { id: string }) => {
      console.log('Updating coach with data:', coachData);
      
      const { data, error } = await supabase
        .from('coaches')
        .update({
          name: coachData.name,
          email: coachData.email,
          phone: coachData.phone,
          role: coachData.role,
          package_type: coachData.package_type,
        })
        .eq('id', coachData.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating coach:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaches'] });
      resetForm();
      toast.success('Coach updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update coach:', error);
      toast.error(`Failed to update coach: ${error.message}`);
    },
  });

  // Delete coach mutation
  const deleteCoachMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('Deleting coach with id:', id);
      
      const { error } = await supabase
        .from('coaches')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting coach:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaches'] });
      toast.success('Coach deleted successfully');
    },
    onError: (error) => {
      console.error('Failed to delete coach:', error);
      toast.error(`Failed to delete coach: ${error.message}`);
    },
  });

  // Fetch coach sessions with proper joins
  const { data: coachSessions = [] } = useQuery({
    queryKey: ['coach-sessions', selectedCoachId],
    queryFn: async () => {
      if (!selectedCoachId) return [];
      
      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          id,
          date,
          start_time,
          end_time,
          branch_id,
          package_type,
          branches (
            name
          ),
          session_participants (
            students (
              name
            )
          )
        `)
        .eq('session_coaches.coach_id', selectedCoachId)
        .order('date', { ascending: false });
      
      if (error) {
        console.error('Error fetching coach sessions:', error);
        return [];
      }
      
      return data as SessionRecord[];
    },
    enabled: !!selectedCoachId,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'coach',
      package_type: '',
      password: ''
    });
    setEditingCoach(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingCoach) {
      updateCoachMutation.mutate({ ...formData, id: editingCoach.id });
    } else {
      createCoachMutation.mutate(formData);
    }
  };

  if (coachesLoading) {
    return <div>Loading coaches...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Coaches</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add Coach</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Coach</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
              {!editingCoach && (
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={createCoachMutation.isPending || updateCoachMutation.isPending}>
                  {(createCoachMutation.isPending || updateCoachMutation.isPending) ? 'Saving...' : editingCoach ? 'Update Coach' : 'Create Coach'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { resetForm(); setIsCreateDialogOpen(false); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Coaches List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {coaches.map((coach) => (
          <Card key={coach.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                {coach.name}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setEditingCoach(coach);
                      setFormData({
                        name: coach.name,
                        email: coach.email,
                        phone: coach.phone || '',
                        role: coach.role,
                        package_type: coach.package_type || '',
                        password: ''
                      });
                      setIsCreateDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this coach?')) {
                        deleteCoachMutation.mutate(coach.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSelectedCoachId(coach.id)}
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-sm font-medium">Email: {coach.email}</p>
                {coach.phone && <p className="text-sm font-medium">Phone: {coach.phone}</p>}
                <p className="text-sm font-medium">Role: {coach.role}</p>
                {coach.package_type && <p className="text-sm font-medium">Package Type: {coach.package_type}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coach Sessions List */}
      {selectedCoachId && (
        <Card>
          <CardHeader>
            <CardTitle>Sessions for {coaches.find(coach => coach.id === selectedCoachId)?.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {coachSessions.length === 0 ? (
              <p className="text-muted-foreground">No sessions found for this coach.</p>
            ) : (
              <div className="space-y-4">
                {coachSessions.map((session) => (
                  <Card key={session.id}>
                    <CardContent>
                      <h4 className="font-semibold">{session.date} - {session.branches.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Students: {session.session_participants.map(sp => sp.students.name).join(', ')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={() => setSelectedCoachId(null)}>Close Sessions</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
