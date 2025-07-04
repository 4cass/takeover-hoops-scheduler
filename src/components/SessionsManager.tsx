import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { Badge, Calendar, Clock, Eye, MapPin, Plus, Trash2, User, Users, Filter, Search, ChevronLeft, ChevronRight, Pencil } from "lucide-react";

type SessionStatus = Database['public']['Enums']['session_status'];

type Student = {
  id: string;
  name: string;
  remaining_sessions: number;
  branch_id: string | null;
  package_type: string | null;
};

type TrainingSession = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  branch_id: string;
  coach_id: string;
  notes: string | null;
  status: SessionStatus;
  package_type: "Camp Training" | "Personal Training" | null;
  branches: { name: string };
  coaches: { name: string };
  session_participants: Array<{
    id: string;
    student_id: string;
    students: { name: string };
  }>;
};

// Helper function to format date for display
const formatDisplayDate = (dateString: string) => {
  try {
    const date = parseISO(dateString);
    return format(date, 'MMM dd, yyyy');
  } catch (error) {
    console.error('Error formatting display date:', error);
    return 'Invalid Date';
  }
};

// Helper function to format time for display
const formatDisplayTime = (timeString: string) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dateTimeString = `${today}T${timeString}`;
    const date = parseISO(dateTimeString);
    return format(date, 'hh:mm a');
  } catch (error) {
    console.error('Error formatting display time:', error);
    return 'Invalid Time';
  }
};

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function SessionsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isParticipantsDialogOpen, setIsParticipantsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPackageType, setFilterPackageType] = useState<"All" | "Camp Training" | "Personal Training">("All");
  const [branchFilter, setBranchFilter] = useState<string>("All");
  const [coachFilter, setCoachFilter] = useState<string>("All");
  const [sortOrder, setSortOrder] = useState<"Newest to Oldest" | "Oldest to Newest">("Newest to Oldest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const [formData, setFormData] = useState({
    date: "",
    start_time: "",
    end_time: "",
    branch_id: "",
    coach_id: "",
    notes: "",
    status: "scheduled" as SessionStatus,
    package_type: "" as "Camp Training" | "Personal Training" | "",
  });

  const queryClient = useQueryClient();

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['training-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_sessions')
        .select(`
          *,
          branches (name),
          coaches (name),
          session_participants (
            id,
            student_id,
            students (name)
          )
        `)
        .order('date', { ascending: false });
      
      if (error) {
        console.error('Error fetching training sessions:', error);
        throw new Error(`Failed to fetch training sessions: ${error.message}`);
      }
      console.log('Fetched sessions:', data);
      return data as TrainingSession[];
    }
  });

  const { data: branches } = useQuery({
    queryKey: ['branches-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      console.log('Fetched branches:', data);
      return data;
    }
  });

  const { data: coaches, isLoading: coachesLoading, error: coachesError } = useQuery({
    queryKey: ['coaches-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coaches')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('coaches query error:', error);
        throw error;
      }
      console.log('Fetched coaches:', data);
      return data as { id: string; name: string; }[];
    },
  });

  const { data: students, isLoading: studentsLoading, error: studentsError } = useQuery({
    queryKey: ['students-select', formData.branch_id, formData.package_type],
    queryFn: async () => {
      if (!formData.branch_id || !formData.package_type) {
        console.log('Students query skipped: missing branch_id or package_type', { 
          branch_id: formData.branch_id, 
          package_type: formData.package_type 
        });
        return [];
      }
      const { data, error } = await supabase
        .from('students')
        .select('id, name, remaining_sessions, branch_id, package_type')
        .eq('branch_id', formData.branch_id)
        .eq('package_type', formData.package_type)
        .order('name');
      if (error) {
        console.error('Students query error:', error);
        throw error;
      }
      console.log(`Fetched students for branch_id=${formData.branch_id} and package_type=${formData.package_type}:`, data);
      return data as Student[];
    },
    enabled: !!formData.branch_id && !!formData.package_type,
  });

  const createMutation = useMutation({
    mutationFn: async (session: typeof formData) => {
      if (!session.package_type) {
        throw new Error('Package type is required');
      }

      const coachId = formData.package_type === "Personal Training" ? formData.coach_id : selectedCoaches[0];
      
      if (!coachId) {
        throw new Error('At least one coach must be selected');
      }

      const coachesToCheck = formData.package_type === "Camp Training" ? selectedCoaches : [formData.coach_id];
      
      for (const checkCoachId of coachesToCheck) {
        const { data: conflicts } = await supabase
          .from('training_sessions')
          .select('id')
          .eq('coach_id', checkCoachId)
          .eq('date', session.date)
          .lte('start_time', session.end_time)
          .gte('end_time', session.start_time);

        if (conflicts && conflicts.length > 0) {
          const coachName = coaches?.find(c => c.id === checkCoachId)?.name;
          throw new Error(`Coach ${coachName} is already scheduled for a session on this date/time.`);
        }
      }

      console.log('Creating session with data:', session);
      
      const { data, error } = await supabase
        .from('training_sessions')
        .insert([{ ...session, coach_id: coachId, package_type: session.package_type || null }])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating session:', error);
        throw error;
      }

      console.log('Session created successfully:', data);

      if (selectedStudents.length > 0) {
        const { error: participantsError } = await supabase
          .from('session_participants')
          .insert(
            selectedStudents.map(studentId => ({
              session_id: data.id,
              student_id: studentId
            }))
          );
        
        if (participantsError) throw participantsError;

        const { error: attendanceError } = await supabase
          .from('attendance_records')
          .insert(
            selectedStudents.map(studentId => ({
              session_id: data.id,
              student_id: studentId,
              status: 'pending' as const
            }))
          );
        
        if (attendanceError) throw attendanceError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Training session created successfully');
      resetForm();
    },
    onError: (error) => {
      console.error('Create mutation error:', error);
      toast.error('Failed to create session: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...session }: typeof formData & { id: string }) => {
      if (!session.package_type) {
        throw new Error('Package type is required');
      }

      const coachId = formData.package_type === "Personal Training" ? formData.coach_id : selectedCoaches[0];
      
      if (!coachId) {
        throw new Error('At least one coach must be selected');
      }

      console.log('Updating session with data:', session);

      const { data, error } = await supabase
        .from('training_sessions')
        .update({ ...session, coach_id: coachId, package_type: session.package_type || null })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating session:', error);
        throw error;
      }

      console.log('Session updated successfully:', data);

      await supabase
        .from('session_participants')
        .delete()
        .eq('session_id', id);

      if (selectedStudents.length > 0) {
        await supabase
          .from('session_participants')
          .insert(
            selectedStudents.map(studentId => ({
              session_id: id,
              student_id: studentId
            }))
          );

        await supabase
          .from('attendance_records')
          .delete()
          .eq('session_id', id);

        await supabase
          .from('attendance_records')
          .insert(
            selectedStudents.map(studentId => ({
              session_id: id,
              student_id: studentId,
              status: 'pending' as const
            }))
          );
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      toast.success('Training session updated successfully');
      resetForm();
    },
    onError: (error) => {
      console.error('Update mutation error:', error);
      toast.error('Failed to update session: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Training session deleted successfully');
      setCurrentPage(1); // Reset to first page on delete
    },
    onError: (error) => {
      toast.error('Failed to delete session: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      date: "",
      start_time: "",
      end_time: "",
      branch_id: "",
      coach_id: "",
      notes: "",
      status: "scheduled" as SessionStatus,
      package_type: "",
    });
    setSelectedStudents([]);
    setSelectedCoaches([]);
    setEditingSession(null);
    setIsDialogOpen(false);
    setIsParticipantsDialogOpen(false);
    setIsViewDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.branch_id) {
      toast.error('Please select a branch');
      return;
    }

    if (!formData.package_type) {
      toast.error('Please select a package type');
      return;
    }

    if (formData.package_type === "Personal Training") {
      if (!formData.coach_id) {
        toast.error('Please select a coach');
        return;
      }
    } else if (formData.package_type === "Camp Training") {
      if (selectedCoaches.length === 0) {
        toast.error('Please select at least one coach for camp training');
        return;
      }
    }

    if (!formData.date) {
      toast.error('Please select a date');
      return;
    }

    if (!formData.start_time || !formData.end_time) {
      toast.error('Please select start and end times');
      return;
    }

    console.log('Submitting form with data:', formData);

    const coachesToCheck = formData.package_type === "Personal Training" ? [formData.coach_id] : selectedCoaches;
    
    const hasConflict = sessions?.some(session =>
      coachesToCheck.includes(session.coach_id) &&
      session.date === formData.date &&
      (
        (formData.start_time < session.end_time) &&
        (formData.end_time > session.start_time)
      ) &&
      (!editingSession || editingSession.id !== session.id)
    );

    if (hasConflict) {
      toast.error('One or more selected coaches are already scheduled for a session on this date/time.');
      return;
    }

    if (editingSession) {
      updateMutation.mutate({ ...formData, id: editingSession.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (session: TrainingSession) => {
    console.log('Editing session:', session);
    setEditingSession(session);
    setFormData({
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      branch_id: session.branch_id,
      coach_id: session.coach_id,
      notes: session.notes || "",
      status: session.status,
      package_type: session.package_type || "",
    });
    setSelectedStudents(session.session_participants?.map(p => p.student_id) || []);
    if (session.package_type === "Personal Training") {
      setSelectedCoaches([]);
    } else {
      setSelectedCoaches([session.coach_id]);
    }
    setIsDialogOpen(true);
  };

  const handleView = (session: TrainingSession) => {
    setSelectedSession(session);
    setIsViewDialogOpen(true);
  };

  const handleManageParticipants = (session: TrainingSession) => {
    setSelectedSession(session);
    setFormData(prev => ({
      ...prev,
      branch_id: session.branch_id,
      package_type: session.package_type || "",
      coach_id: session.coach_id,
    }));
    setSelectedStudents(session.session_participants?.map(p => p.student_id) || []);
    setIsParticipantsDialogOpen(true);
  };

  const handleCoachToggle = (coachId: string) => {
    if (formData.package_type === "Personal Training") {
      setFormData(prev => ({ ...prev, coach_id: coachId }));
      setSelectedCoaches([]);
    } else if (formData.package_type === "Camp Training") {
      setSelectedCoaches(prev => {
        if (prev.includes(coachId)) {
          return prev.filter(id => id !== coachId);
        } else {
          return [...prev, coachId];
        }
      });
      setFormData(prev => ({ ...prev, coach_id: "" }));
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'completed': return 'bg-green-50 text-green-700 border border-green-200';
      case 'cancelled': return 'bg-red-50 text-red-700 border border-red-200';
      default: return 'bg-gray-50 text-gray-700 border border-gray-200';
    }
  };

  const filteredSessions = sessions
    ?.filter((session) =>
      (session.coaches.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       session.branches.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterPackageType === "All" || session.package_type === filterPackageType) &&
      (branchFilter === "All" || session.branch_id === branchFilter) &&
      (coachFilter === "All" || session.coach_id === coachFilter)
    )
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === "Newest to Oldest" ? dateB - dateA : dateA - dateB;
    }) || [];

  // Pagination logic
  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSessions = filteredSessions.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" style={{ backgroundColor: 'white' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#BEA877' }}></div>
        <span className="ml-3 text-gray-600">Loading sessions...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-4 p-6">
      <div className="max-w-7xl mx-auto space-y-8 -mt-5">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2 tracking-tight">Sessions Manager</h1>
          <p className="text-lg text-gray-700">Manage session information</p>
        </div>
        <Card className="shadow-xl border-2 border-foreground" style={{ backgroundColor: 'white' }}>
          <CardHeader className="border-b border-[#181A18] bg-[#181A18]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-bold text-[#efeff1] flex items-center">
                  <Calendar className="h-6 w-6 mr-3 text-accent" style={{ color: '#BEA877' }} />
                  Training Sessions
                </CardTitle>
                <CardDescription className="text-gray-400 text-base">
                  View and manage all basketball training sessions
                </CardDescription>
              </div>
              <div className="flex space-x-3">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => resetForm()}
                      className="px-6 py-3 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                      style={{ backgroundColor: '#BEA877', color: '#efeff1' }}
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Schedule New Session
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#fffefe' }}>
                    <DialogHeader className="pb-6">
                      <DialogTitle className="text-2xl font-bold text-gray-900">
                        {editingSession ? 'Edit Training Session' : 'Schedule New Training Session'}
                      </DialogTitle>
                      <DialogDescription className="text-gray-600">
                        {editingSession ? 'Update session details and participants' : 'Create a new training session for your players'}
                      </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="branch" className="flex items-center text-sm font-medium text-gray-700">
                            <MapPin className="w-4 h-4 mr-2" style={{ color: '#BEA877' }} />
                            Branch Location
                          </Label>
                          <Select 
                            value={formData.branch_id} 
                            onValueChange={(value) => {
                              setFormData(prev => ({ ...prev, branch_id: value, package_type: "", coach_id: "" }));
                              setSelectedStudents([]);
                              setSelectedCoaches([]);
                            }}
                          >
                            <SelectTrigger className="border-2 focus:border-accent rounded-lg">
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
                        <div className="space-y-2">
                          <Label htmlFor="package_type" className="flex items-center text-sm font-medium text-gray-700">
                            <Users className="w-4 h-4 mr-2" style={{ color: '#BEA877' }} />
                            Package Type
                          </Label>
                          <Select
                            value={formData.package_type}
                            onValueChange={(value: "Camp Training" | "Personal Training") => {
                              setFormData(prev => ({ ...prev, package_type: value, coach_id: "" }));
                              setSelectedStudents([]);
                              setSelectedCoaches([]);
                            }}
                            disabled={!formData.branch_id}
                          >
                            <SelectTrigger className="border-2 focus:border-accent rounded-lg">
                              <SelectValue placeholder={formData.branch_id ? "Select package type" : "Select branch first"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Camp Training">Camp Training</SelectItem>
                              <SelectItem value="Personal Training">Personal Training</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="coach" className="flex items-center text-sm font-medium text-gray-700">
                          <User className="w-4 h-4 mr-2" style={{ color: '#BEA877' }} />
                          {formData.package_type === "Camp Training" ? "Select Coaches (Multiple)" : "Assigned Coach"}
                        </Label>
                        
                        {formData.package_type === "Personal Training" ? (
                          <Select 
                            value={formData.coach_id} 
                            onValueChange={(value) => {
                              setFormData(prev => ({ ...prev, coach_id: value }));
                              setSelectedCoaches([]);
                            }}
                            disabled={!formData.package_type || coachesLoading}
                          >
                            <SelectTrigger className="border-2 focus:border-accent rounded-lg">
                              <SelectValue placeholder={
                                coachesLoading ? "Loading coaches..." : 
                                coachesError ? "Error loading coaches" : 
                                formData.package_type ? "Select coach" : "Select package type first"
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              {coaches?.map(coach => (
                                <SelectItem key={coach.id} value={coach.id}>
                                  {coach.name} 
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : formData.package_type === "Camp Training" ? (
                          <div className="border-2 rounded-lg p-4 max-h-48 overflow-y-auto" style={{ backgroundColor: '#faf0e8', borderColor: 'black' }}>
                            {coachesLoading ? (
                              <p className="text-sm text-gray-600">Loading coaches...</p>
                            ) : coachesError ? (
                              <p className="text-sm text-red-600">Error loading coaches: {(coachesError as Error).message}</p>
                            ) : coaches?.length === 0 ? (
                              <p className="text-sm text-gray-600">No coaches available.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {coaches?.map(coach => (
                                  <div key={coach.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-white transition-colors">
                                    <input
                                      type="checkbox"
                                      id={`coach-${coach.id}`}
                                      checked={selectedCoaches.includes(coach.id)}
                                      onChange={() => handleCoachToggle(coach.id)}
                                      className="w-4 h-4 rounded border-2 border-accent text-accent focus:ring-accent"
                                    />
                                    <Label htmlFor={`coach-${coach.id}`} className="flex-1 text-sm cursor-pointer">
                                      <span className="font-medium">{coach.name}</span>
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-gray-600 mt-2">
                              Selected: {selectedCoaches.length} coach{selectedCoaches.length === 1 ? '' : 'es'}
                            </p>
                          </div>
                        ) : (
                          <div className="border-2 rounded-lg p-4 text-center text-gray-500">
                            Please select a package type first
                          </div>
                        )}
                        
                        {coachesError && (
                          <p className="text-sm text-red-600 mt-1">Error loading coaches: {(coachesError as Error).message}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="date" className="flex items-center text-sm font-medium text-gray-700">
                            <Calendar className="w-4 h-4 mr-2" style={{ color: '#BEA877' }} />
                            Session Date
                          </Label>
                          <Input
                            id="date"
                            type="date"
                            value={formData.date}
                            onChange={(e) => {
                              console.log('Date input changed:', e.target.value);
                              setFormData(prev => ({ ...prev, date: e.target.value }));
                            }}
                            required
                            min={getTodayDate()}
                            className="border-2 focus:border-accent rounded-lg"
                            disabled={!formData.branch_id}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="status" className="text-sm font-medium text-gray-700">Session Status</Label>
                          <Select 
                            value={formData.status} 
                            onValueChange={(value: SessionStatus) => setFormData(prev => ({ ...prev, status: value }))}
                            disabled={!formData.branch_id}
                          >
                            <SelectTrigger className="border-2 focus:border-accent rounded-lg">
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="start_time" className="flex items-center text-sm font-medium text-gray-700">
                            <Clock className="w-4 h-4 mr-2" style={{ color: '#BEA877' }} />
                            Start Time
                          </Label>
                          <Input
                            id="start_time"
                            type="time"
                            value={formData.start_time}
                            onChange={(e) => {
                              console.log('Start time input changed:', e.target.value);
                              setFormData(prev => ({ ...prev, start_time: e.target.value }));
                            }}
                            required
                            className="border-2 focus:border-accent rounded-lg"
                            disabled={!formData.branch_id}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end_time" className="flex items-center text-sm font-medium text-gray-700">
                            <Clock className="w-4 h-4 mr-2" style={{ color: '#BEA877' }} />
                            End Time
                          </Label>
                          <Input
                            id="end_time"
                            type="time"
                            value={formData.end_time}
                            onChange={(e) => {
                              console.log('End time input changed:', e.target.value);
                              setFormData(prev => ({ ...prev, end_time: e.target.value }));
                            }}
                            required
                            className="border-2 focus:border-accent rounded-lg"
                            disabled={!formData.branch_id}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="flex items-center text-sm font-medium text-gray-700">
                          <Users className="w-4 h-4 mr-2" style={{ color: '#BEA877' }} />
                          Select Players ({selectedStudents.length} selected)
                        </Label>
                        <div className="border-2 rounded-lg p-4 max-h-48 overflow-y-auto" style={{ backgroundColor: '#faf0e8', borderColor: 'black' }}>
                          {formData.branch_id && formData.package_type ? (
                            studentsLoading ? (
                              <p className="text-sm text-gray-600">Loading students...</p>
                            ) : studentsError ? (
                              <p className="text-sm text-red-600">Error loading students: {(studentsError as Error).message}</p>
                            ) : students?.length === 0 ? (
                              <p className="text-sm text-gray-600">
                                No students available for this branch and package type combination.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {students?.map(student => (
                                  <div key={student.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-white transition-colors">
                                    <input
                                      type="checkbox"
                                      id={student.id}
                                      checked={selectedStudents.includes(student.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedStudents(prev => [...prev, student.id]);
                                        } else {
                                          setSelectedStudents(prev => prev.filter(id => id !== student.id));
                                        }
                                      }}
                                      className="w-4 h-4 rounded border-2 border-accent text-accent focus:ring-accent"
                                    />
                                    <Label htmlFor={student.id} className="flex-1 text-sm cursor-pointer">
                                      <span className="font-medium">{student.name}</span>
                                      <span className="text-gray-500 ml-2">({student.remaining_sessions} sessions left)</span>
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            )
                          ) : (
                            <p className="text-sm text-gray-600">Select a branch and package type to view available students.</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes" className="flex items-center text-sm font-medium text-gray-700">
                          <Eye className="w-4 h-4 mr-2" style={{ color: '#BEA877' }} />
                          Session Notes (Optional)
                        </Label>
                        <Input
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Add any special notes or instructions for this session..."
                          className="border-2 focus:border-accent rounded-lg"
                          disabled={!formData.branch_id}
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t">
                        {editingSession && (
                          <Button 
                            type="button" 
                            variant="destructive" 
                            onClick={() => {
                              if (editingSession) {
                                deleteMutation.mutate(editingSession.id);
                                resetForm();
                              }
                            }}
                            disabled={deleteMutation.isPending || !formData.branch_id}
                            className="w-full sm:w-auto"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Session
                          </Button>
                        )}
                        <div className="flex space-x-3 w-full sm:w-auto">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={resetForm} 
                            className="flex-1 sm:flex-none"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={
                              createMutation.isPending || 
                              updateMutation.isPending || 
                              !formData.branch_id || 
                              !formData.package_type || 
                              (formData.package_type === "Personal Training" && !formData.coach_id) ||
                              (formData.package_type === "Camp Training" && selectedCoaches.length === 0) ||
                              !formData.date
                            }
                            className="flex-1 sm:flex-none font-semibold"
                            style={{ backgroundColor: '#BEA877', color: 'white' }}
                          >
                            {editingSession ? 'Update Session' : 'Schedule Session'}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 border-b border-accent">
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <Filter className="h-5 w-5 text-[#BEA877] mr-2" />
                <h3 className="text-lg font-semibold text-black">Filter Sessions</h3>
              </div>
              <div className="flex flex-col space-y-4 lg:flex-row lg:items-end lg:gap-4 lg:space-y-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by coach or branch..."
                    className="pl-10 pr-4 py-3 w-full border-2 border-accent rounded-xl text-sm focus:border-accent focus:ring-accent bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ borderColor: '#BEA877' }}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="filter-package" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <Users className="w-4 h-4 mr-2" style={{ color: '#BEA877' }} />
                    Filter by Package Type
                  </Label>
                  <Select
                    value={filterPackageType}
                    onValueChange={(value: "All" | "Camp Training" | "Personal Training") => setFilterPackageType(value)}
                  >
                    <SelectTrigger className="border-2 focus:border-accent rounded-xl" style={{ borderColor: '#BEA877' }}>
                      <SelectValue placeholder="Select package type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Sessions</SelectItem>
                      <SelectItem value="Camp Training">Camp Training</SelectItem>
                      <SelectItem value="Personal Training">Personal Training</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="filter-branch" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 mr-2" style={{ color: '#BEA877' }} />
                    Filter by Branch
                  </Label>
                  <Select
                    value={branchFilter}
                    onValueChange={(value) => setBranchFilter(value)}
                  >
                    <SelectTrigger className="border-2 focus:border-accent rounded-xl" style={{ borderColor: '#BEA877' }}>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Branches</SelectItem>
                      {branches?.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="filter-coach" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <User className="w-4 h-4 mr-2" style={{ color: '#BEA877' }} />
                    Filter by Coach
                  </Label>
                  <Select
                    value={coachFilter}
                    onValueChange={(value) => setCoachFilter(value)}
                  >
                    <SelectTrigger className="border-2 focus:border-accent rounded-xl" style={{ borderColor: '#BEA877' }}>
                      <SelectValue placeholder="Select coach" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Coaches</SelectItem>
                      {coaches?.map(coach => (
                        <SelectItem key={coach.id} value={coach.id}>
                          {coach.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="sort-order" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 mr-2" style={{ color: '#BEA877' }} />
                    Sort Order
                  </Label>
                  <Select
                    value={sortOrder}
                    onValueChange={(value: "Newest to Oldest" | "Oldest to Newest") => setSortOrder(value)}
                  >
                    <SelectTrigger className="border-2 focus:border-accent rounded-xl" style={{ borderColor: '#BEA877' }}>
                      <SelectValue placeholder="Select sort order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Newest to Oldest">Newest to Oldest</SelectItem>
                      <SelectItem value="Oldest to Newest">Oldest to Newest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                Showing {filteredSessions.length} session{filteredSessions.length === 1 ? '' : 's'}
              </p>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="text-center py-16">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchTerm || filterPackageType !== "All" || branchFilter !== "All" || coachFilter !== "All" ? `No sessions found` : "No Training Sessions"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || filterPackageType !== "All" || branchFilter !== "All" || coachFilter !== "All" ? "Try adjusting your search or filter." : "Get started by scheduling your first training session"}
                </p>
                <Button 
                  onClick={() => setIsDialogOpen(true)}
                  className="font-semibold"
                  style={{ backgroundColor: '#BEA877', color: 'white' }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule First Session
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedSessions.map((session) => (
                    <Card 
                      key={session.id} 
                      className="border-2 transition-all duration-300 hover:shadow-lg rounded-xl border-accent"
                      style={{ borderColor: '#BEA877' }}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-5 h-5" style={{ color: '#BEA877' }} />
                            <h3 className="font-bold text-lg text-gray-900">
                              {formatDisplayDate(session.date)}
                            </h3>
                          </div>
                          <Badge className={`font-medium ${getStatusBadgeColor(session.status)}`}>
                            {session.status}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2 text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {formatDisplayTime(session.start_time)} - {formatDisplayTime(session.end_time)}
                          </span>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="text-sm"><span className="font-medium">Coach:</span> {session.coaches.name}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          <span className="text-sm"><span className="font-medium">Branch:</span> {session.branches.name}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-gray-500" />
                          <span className="text-sm"><span className="font-medium">Package:</span> {session.package_type || 'N/A'}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium">{session.session_participants?.length || 0} Players</span>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleView(session)}
                              className="bg-blue-600 text-white"
                            >
                              <Eye className="w-4 h-4" /> View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(session)}
                              className="bg-yellow-600 text-white"
                            >
                              <Pencil className="w-4 h-4" /> Edit
                            </Button>
                          </div>
                        </div>
                        
                        {session.notes && (
                          <div className="mt-3 p-2 bg-white rounded-md border border-accent" style={{ borderColor: '#BEA877' }}>
                            <p className="text-xs text-gray-600 italic">"{session.notes}"</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center items-center mt-6 space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="border-2 border-accent text-accent hover:bg-accent hover:text-white"
                      style={{ borderColor: '#BEA877', color: '#BEA877' }}
                    >
                      <ChevronLeft className="w-4 h-4 " />
                    </Button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        onClick={() => handlePageChange(page)}
                        className={`border-2 ${
                          currentPage === page
                            ? 'bg-accent text-white'
                            : 'border-accent text-accent hover:bg-accent hover:text-white'
                        }`}
                        style={{ 
                          backgroundColor: currentPage === page ? '#BEA877' : 'transparent',
                          borderColor: '#BEA877',
                          color: currentPage === page ? 'white' : '#BEA877'
                        }}
                      >
                        {page}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="border-2 border-accent text-accent hover:bg-accent hover:text-white"
                      style={{ borderColor: '#BEA877', color: '#BEA877' }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-lg" style={{ backgroundColor: '#fffefe' }}>
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold text-gray-900">Session Details</DialogTitle>
              <DialogDescription className="text-gray-600">
                View details of the selected training session
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-accent" style={{ color: '#BEA877' }} />
                    <span className="text-sm font-medium text-gray-700">
                      Date: {selectedSession ? formatDisplayDate(selectedSession.date) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Time: {selectedSession ? `${formatDisplayTime(selectedSession.start_time)} - ${formatDisplayTime(selectedSession.end_time)}` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Branch: {selectedSession?.branches.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Coach: {selectedSession?.coaches.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Package: {selectedSession?.package_type || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Players: {selectedSession?.session_participants?.length || 0}
                    </span>
                  </div>
                  {selectedSession?.notes && (
                    <div className="flex items-start space-x-2">
                      <Eye className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">
                        Notes: {selectedSession.notes}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Participants</Label>
                <div className="border-2 rounded-lg p-3 max-h-60 overflow-y-auto" style={{ borderColor: '#BEA877', backgroundColor: '#faf0e8' }}>
                  {selectedSession?.session_participants?.length === 0 ? (
                    <p className="text-sm text-gray-600">No participants assigned.</p>
                  ) : (
                    selectedSession?.session_participants?.map(participant => (
                      <div key={participant.id} className="flex items-center space-x-2 p-2">
                        <span className="text-sm text-gray-700">{participant.students.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsViewDialogOpen(false)}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isParticipantsDialogOpen} onOpenChange={setIsParticipantsDialogOpen}>
          <DialogContent className="max-w-lg" style={{ backgroundColor: '#fffefe' }}>
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold text-gray-900">Manage Session Participants</DialogTitle>
              <DialogDescription className="text-gray-600">
                Add or remove players from this training session
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-4 rounded-lg">
                <p className="text-sm text-gray-700 mb-1">
                  <span className="font-medium">Session Date:</span>{' '}
                  {selectedSession?.date ? formatDisplayDate(selectedSession.date) : 'Invalid Date'}
                </p>
                <p className="text-sm text-gray-700 mb-1">
                  <span className="font-medium">Package Type:</span> {selectedSession?.package_type || 'N/A'}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Coach:</span> {selectedSession?.coaches.name || 'N/A'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Currently selected: {selectedStudents.length} players
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Available Players</Label>
                <div className="border-2 rounded-lg p-3 max-h-60 overflow-y-auto space-y-2" style={{ borderColor: '#BEA877', backgroundColor: '#faf0e8' }}>
                  {studentsLoading ? (
                    <p className="text-sm text-gray-600">Loading students...</p>
                  ) : studentsError ? (
                    <p className="text-sm text-red-600">Error loading students: {(studentsError as Error).message}</p>
                  ) : students?.length === 0 ? (
                    <p className="text-sm text-gray-600">
                      No students available for this branch and package type combination.
                    </p>
                  ) : (
                    students?.map(student => (
                      <div key={student.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-white transition-colors">
                        <input
                          type="checkbox"
                          id={`participant-${student.id}`}
                          checked={selectedStudents.includes(student.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudents(prev => [...prev, student.id]);
                            } else {
                              setSelectedStudents(prev => prev.filter(id => id !== student.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-2 border-accent text-accent focus:ring-accent"
                          style={{ borderColor: '#BEA877', accentColor: '#BEA877' }}
                        />
                        <Label htmlFor={`participant-${student.id}`} className="flex-1 text-sm cursor-pointer">
                          <span className="font-medium">{student.name}</span>
                          <span className="text-gray-500 ml-2">({student.remaining_sessions} sessions left)</span>
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsParticipantsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!selectedSession) return;

                    await supabase
                      .from('session_participants')
                      .delete()
                      .eq('session_id', selectedSession.id);
                    
                    if (selectedStudents.length > 0) {
                      await supabase
                        .from('session_participants')
                        .insert(
                          selectedStudents.map(studentId => ({
                            session_id: selectedSession.id,
                            student_id: studentId
                          }))
                        );

                      await supabase
                        .from('attendance_records')
                        .delete()
                        .eq('session_id', selectedSession.id);

                      await supabase
                        .from('attendance_records')
                        .insert(
                          selectedStudents.map(studentId => ({
                            session_id: selectedSession.id,
                            student_id: studentId,
                            status: 'pending' as const
                          }))
                        );
                    }

                    queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
                    toast.success('Participants updated successfully');
                    setIsParticipantsDialogOpen(false);
                  }}
                  className="font-semibold"
                  style={{ backgroundColor: '#BEA877', color: 'white' }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}