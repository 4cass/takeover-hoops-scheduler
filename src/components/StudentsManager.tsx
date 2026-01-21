import { Component, ErrorInfo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Plus, Edit, Trash2, Filter, Search, Users, Calendar, Clock, MapPin, User, ChevronLeft, ChevronRight, Eye, CalendarIcon, DollarSign, CreditCard, Download } from "lucide-react";
import { exportToCSV } from "@/utils/exportUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  sessions: number | null;
  remaining_sessions: number | null;
  branch_id: string | null;
  package_type: string | null;
  created_at: string;
  enrollment_date: string | null;
  expiration_date: string | null;
  total_training_fee: number | null;
  downpayment: number | null;
  remaining_balance: number | null;
}


interface Branch {
  id: string;
  name: string;
}

interface Package {
  id: string;
  name: string;
  is_active: boolean;
}

const getPackageStatus = (totalSessions: number, remainingSessions: number, expirationDate: Date | null) => {
  const usedSessions = totalSessions - remainingSessions;
  const currentDate = new Date();

  if (remainingSessions <= 0 || usedSessions >= totalSessions) {
    return { status: 'completed' as const, statusColor: 'bg-blue-50 text-blue-700 border-blue-200', statusText: 'Completed' };
  } else if (expirationDate && currentDate > expirationDate) {
    return { status: 'expired' as const, statusColor: 'bg-red-50 text-red-700 border-red-200', statusText: 'Inactive' };
  } else {
    return { status: 'ongoing' as const, statusColor: 'bg-green-50 text-green-700 border-green-200', statusText: 'Ongoing' };
  }
};


class StudentsErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: string | null }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary in StudentsManager:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
          <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
            <Users className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">Something went wrong</h3>
            <p className="text-sm sm:text-base md:text-lg text-gray-600">
              Error: {this.state.error || "Unknown error"}. Please try refreshing the page or contact support.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function StudentsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("All");
  const [packageTypeFilter, setPackageTypeFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const { role } = useAuth();
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const { data: students, isLoading: studentsLoading, error: studentsError } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      console.log("Fetching students...");
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("students query error:", error);
        toast.error(`Failed to fetch students: ${error.message}`);
        throw error;
      }
      console.log("Fetched students:", data);
      // Log remaining_sessions values to debug decimal support
      if (data && data.length > 0) {
        const sample = data.slice(0, 5).map(s => ({
          name: s.name,
          remaining_sessions: s.remaining_sessions,
          sessions: s.sessions,
          type: typeof s.remaining_sessions,
          raw_value: s.remaining_sessions,
          is_decimal: s.remaining_sessions % 1 !== 0
        }));
        console.log("Sample remaining_sessions values:", sample);
        // Also log any students with decimal values
        const withDecimals = data.filter(s => s.remaining_sessions != null && s.remaining_sessions % 1 !== 0);
        if (withDecimals.length > 0) {
          console.log("Students with decimal remaining_sessions:", withDecimals.map(s => ({
            name: s.name,
            remaining: s.remaining_sessions,
            total: s.sessions,
            used: (s.sessions || 0) - (s.remaining_sessions || 0)
          })));
        } else {
          console.log("⚠️ No students found with decimal remaining_sessions values. Database column may still be INTEGER.");
        }
      }
      return data as Student[];
    },
  });

  const { data: branches, isLoading: branchesLoading, error: branchesError } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      console.log("Fetching branches...");
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .order("name");
      if (error) {
        console.error("branches query error:", error);
        toast.error(`Failed to fetch branches: ${error.message}`);
        throw error;
      }
      console.log("Fetched branches:", data);
      return data as Branch[];
    },
  });

  const { data: packages, isLoading: packagesLoading, error: packagesError } = useQuery<Package[], Error>({
    queryKey: ["packages-select"],
    queryFn: async () => {
      console.log("Fetching packages...");
      const { data, error } = await (supabase as any)
        .from("packages")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) {
        console.error("packages query error:", error);
        toast.error(`Failed to fetch packages: ${error.message}`);
        throw error;
      }
      console.log("Fetched packages:", data);
      return (data || []) as Package[];
    },
  });

  // Fetch attendance records for all students to calculate accurate session usage
  const { data: allAttendanceRecords } = useQuery({
    queryKey: ["all-attendance-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select(`
          student_id,
          session_duration,
          status,
          package_cycle,
          training_sessions (date)
        `)
        .eq("status", "present");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch package history for all students to determine current package cycle
  const { data: allPackageHistory } = useQuery({
    queryKey: ["all-package-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_package_history")
        .select("student_id, captured_at, enrollment_date, expiration_date")
        .order("captured_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Helper function to calculate accurate session usage for a student
  const getAccurateSessionData = (student: Student) => {
    const total = Number(student.sessions) || 0;
    
    // Get package history for this student
    const studentHistory = allPackageHistory?.filter(h => h.student_id === student.id) || [];
    const currentCycle = studentHistory.length + 1;
    
    // Determine current package window
    const latestHistoryCapture = studentHistory.length > 0 
      ? new Date(studentHistory[0].captured_at) 
      : null;
    const packageStart = latestHistoryCapture 
      ? latestHistoryCapture 
      : student.enrollment_date 
        ? new Date(student.enrollment_date) 
        : null;
    const packageEnd = student.expiration_date ? new Date(student.expiration_date) : null;
    
    // Get attendance records for this student in current package
    const studentAttendance = allAttendanceRecords?.filter(record => {
      if (record.student_id !== student.id) return false;
      
      // First try to match by package_cycle
      if (record.package_cycle != null) {
        return record.package_cycle === currentCycle;
      }
      
      // Fallback to date-based matching
      const sessionDate = record.training_sessions?.date ? new Date(record.training_sessions.date) : null;
      if (!sessionDate) return false;
      if (packageStart && sessionDate < packageStart) return false;
      if (packageEnd && sessionDate > packageEnd) return false;
      return true;
    }) || [];
    
    // Calculate used sessions from attendance
    const usedSessions = studentAttendance.reduce((sum, record) => sum + (record.session_duration ?? 1), 0);
    const remaining = Math.max(0, total - usedSessions);
    const progressPercentage = total > 0 ? (usedSessions / total) * 100 : 0;
    
    return { total, usedSessions, remaining, progressPercentage };
  };

  const filteredStudents = students?.filter((student) => {
    // Use accurate session data for filtering (same as card display)
    const sessionData = getAccurateSessionData(student);
    const expirationDate = student.expiration_date ? new Date(student.expiration_date) : null;
    const packageStatus = getPackageStatus(sessionData.total, sessionData.remaining, expirationDate);

    return (
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (branchFilter === "All" || student.branch_id === branchFilter) &&
      (packageTypeFilter === "All" || student.package_type === packageTypeFilter) &&
      (statusFilter === "All" || packageStatus.statusText === statusFilter)
    );
  }) || [];

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  const getPaginationRange = (current: number, total: number) => {
    const maxPagesToShow = 3;
    let start = Math.max(1, current - 1);
    let end = Math.min(total, start + maxPagesToShow - 1);
    if (end - start + 1 < maxPagesToShow) {
      start = Math.max(1, end - maxPagesToShow + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };


  const createMutation = useMutation({
    mutationFn: async (student: typeof formData) => {
      const defaultSessions = 8;
      const totalSessions = role === 'admin' ? student.sessions : defaultSessions;
      const { data, error } = await supabase
        .from("students")
        .insert([{
          name: student.name,
          email: student.email,
          phone: student.phone || null,
          sessions: totalSessions,
          remaining_sessions: totalSessions, // For new players, remaining = total
          branch_id: student.branch_id,
          package_type: student.package_type,
          enrollment_date: student.enrollment_date ? format(student.enrollment_date, 'yyyy-MM-dd') : null,
          expiration_date: student.expiration_date ? format(student.expiration_date, 'yyyy-MM-dd') : null,
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Player created successfully");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to create player: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...student }: typeof formData & { id: string }) => {
      const { data, error } = await supabase
        .from("students")
        .update({
          name: student.name,
          email: student.email,
          phone: student.phone || null,
          branch_id: student.branch_id,
          package_type: student.package_type,
          enrollment_date: student.enrollment_date ? format(student.enrollment_date, 'yyyy-MM-dd') : null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Player updated successfully");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to update player: " + error.message);
    },
  });


const deleteMutation = useMutation({
  mutationFn: async (id: string) => {
    try {
      // Temporarily comment out permission check
      // if (userRole !== "admin" && userRole !== "coach") {
      //   throw new Error("You do not have permission to delete players.");
      // }

      // Perform deletions in the correct order to avoid foreign key constraints
      const { error: attendanceError } = await supabase
        .from("attendance_records")
        .delete()
        .eq("student_id", id);
      if (attendanceError) throw attendanceError;

      const { error: participantsError } = await supabase
        .from("session_participants")
        .delete()
        .eq("student_id", id);
      if (participantsError) throw participantsError;

      const { error: studentError } = await supabase
        .from("students")
        .delete()
        .eq("id", id);
      if (studentError) throw studentError;

      // If all deletions succeed, return success
      return { success: true };
    } catch (error: any) {
      throw new Error(`Failed to delete player: ${error.message}`);
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["students"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    toast.success("Player deleted successfully");
  },
  onError: (error: any) => {
    toast.error(`Failed to delete player: ${error.message}`);
  },
});

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      sessions: 8,
      remaining_sessions: 8,
      branch_id: null,
      package_type: null,
      enrollment_date: null,
      expiration_date: addMonths(new Date(), 1), // Default to 1 month from now
    });
    setEditingStudent(null);
    setIsDialogOpen(false);
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStudent) {
      updateMutation.mutate({ ...formData, id: editingStudent.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      email: student.email,
      phone: student.phone || "",
      sessions: 8,
      remaining_sessions: 8,
      branch_id: student.branch_id || null,
      package_type: student.package_type || null,
      enrollment_date: student.enrollment_date ? new Date(student.enrollment_date) : null,
      expiration_date: addMonths(new Date(), 1),
    });
    setIsDialogOpen(true);
  };

  const handleAddPayment = (student: Student) => {
    navigate(`/dashboard/students/${student.id}/payments`);
  };

  const handleShowRecords = (student: Student) => {
    navigate(`/dashboard/students/${student.id}/view`);
  };

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    sessions: 8,
    remaining_sessions: 8,
    branch_id: null as string | null,
    package_type: null as string | null,
    enrollment_date: null as Date | null,
    expiration_date: addMonths(new Date(), 1), // Default to 1 month from now
  });

  const getPackageBadgeColor = (packageType: string | null) => {
    if (!packageType) return 'bg-gray-50 text-gray-700 border-gray-200';
    const colors = [
      'bg-blue-50 text-blue-700 border-blue-200',
      'bg-green-50 text-green-700 border-green-200',
      'bg-purple-50 text-purple-700 border-purple-200',
      'bg-indigo-50 text-indigo-700 border-indigo-200',
      'bg-teal-50 text-teal-700 border-teal-200',
    ];
    const hash = packageType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (studentsLoading || branchesLoading || packagesLoading) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <Users className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">Loading players...</h3>
          <p className="text-sm sm:text-base md:text-lg text-gray-600">Please wait while we fetch the player data.</p>
        </div>
      </div>
    );
  }

  if (studentsError || branchesError || packagesError) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <Users className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">Error loading players</h3>
          <p className="text-sm sm:text-base md:text-lg text-gray-600">
            Failed to load data: {(studentsError || branchesError || packagesError)?.message || 'Unknown error'}. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <StudentsErrorBoundary>
      <div className="min-h-screen bg-background pt-4 p-3 sm:p-4 md:p-6 pb-24 md:pb-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#242833] mb-2 tracking-tight">Players Manager</h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-700">Manage player information and session quotas</p>
          </div>
          <Card className="border-2 border-[#242833] bg-white shadow-xl overflow-hidden">
            <CardHeader className="border-b border-[#242833] bg-[#242833] p-3 sm:p-4 md:p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
                <div>
                  <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                    <Users className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" style={{ color: '#79e58f' }} />
                    Player Profiles
                  </CardTitle>
                  <CardDescription className="text-gray-400 text-xs sm:text-sm">
                    View and manage player profiles
                  </CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => resetForm()}
                      className="bg-green-600 hover:bg-green-700 text-white transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Player
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl md:max-w-3xl border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
                    <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
                      <DialogTitle className="text-sm sm:text-base md:text-lg font-bold text-white flex items-center gap-2 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                        </div>
                        <span className="truncate">{editingStudent ? "Edit Player" : "Add New Player"}</span>
                      </DialogTitle>
                      <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13 hidden sm:block">
                        {editingStudent ? "Update player information" : "Add a new player to the system"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="p-3 sm:p-4 md:p-5 overflow-y-auto flex-1 custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col space-y-2 min-w-0">
                          <Label htmlFor="name" className="text-gray-700 font-medium text-xs sm:text-sm truncate">Name</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                            required
                            className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                            style={{ borderColor: '#79e58f' }}
                          />
                        </div>
                        <div className="flex flex-col space-y-2 min-w-0">
                          <Label htmlFor="email" className="text-gray-700 font-medium text-xs sm:text-sm truncate">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                            required
                            className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                            style={{ borderColor: '#79e58f' }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col space-y-2 min-w-0">
                          <Label htmlFor="phone" className="text-gray-700 font-medium text-xs sm:text-sm truncate">Phone</Label>
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                            className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                            style={{ borderColor: '#79e58f' }}
                          />
                        </div>
                        <div className="flex flex-col space-y-2 min-w-0">
                          <Label htmlFor="branch_id" className="text-gray-700 font-medium text-xs sm:text-sm truncate">Branch</Label>
                          <Select
                            value={formData.branch_id ?? undefined}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, branch_id: value }))}
                          >
                            <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#79e58f' }}>
                              <SelectValue placeholder="Select Branch" />
                            </SelectTrigger>
                            <SelectContent>
                              {branches?.map((branch) => (
                                <SelectItem key={branch.id} value={branch.id} className="text-xs sm:text-sm">
                                  {branch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col space-y-2 min-w-0">
                          <Label htmlFor="package_type" className="text-gray-700 font-medium text-xs sm:text-sm truncate">Package Type</Label>
                          <Select
                            value={formData.package_type ?? undefined}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, package_type: value }))}
                          >
                            <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#79e58f' }}>
                              <SelectValue placeholder="Select Package Type" />
                            </SelectTrigger>
                            <SelectContent>
                              {packages?.map((pkg) => (
                                <SelectItem key={pkg.id} value={pkg.name} className="text-xs sm:text-sm">
                                  {pkg.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col space-y-2 min-w-0">
                          <Label className="text-gray-700 font-medium text-xs sm:text-sm truncate">Player Enrollment Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal border-2 rounded-lg text-xs sm:text-sm",
                                  !formData.enrollment_date && "text-muted-foreground"
                                )}
                                style={{ borderColor: '#79e58f' }}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {formData.enrollment_date ? format(formData.enrollment_date, "MM/dd/yyyy") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={formData.enrollment_date || undefined}
                                onSelect={(date) => setFormData((prev) => ({ ...prev, enrollment_date: date || null }))}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        {!editingStudent && (
                          <div className="flex flex-col space-y-2 min-w-0">
                            <Label className="text-gray-700 font-medium text-xs sm:text-sm truncate">Session Expiry Date</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal border-2 rounded-lg text-xs sm:text-sm",
                                    !formData.expiration_date && "text-muted-foreground"
                                  )}
                                  style={{ borderColor: '#79e58f' }}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {formData.expiration_date ? format(formData.expiration_date, "MM/dd/yyyy") : <span>Pick a date</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={formData.expiration_date || undefined}
                                  onSelect={(date) => setFormData((prev) => ({ ...prev, expiration_date: date || null }))}
                                  initialFocus
                                  className={cn("p-3 pointer-events-auto")}
                                />
                              </PopoverContent>
                            </Popover>
                            <p className="text-xs text-gray-500 mt-1">Expiry date for the initial package session</p>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end space-x-3 pt-4 flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={resetForm}
                          className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createMutation.isPending || updateMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                        >
                          {editingStudent ? "Update" : "Create"}
                        </Button>
                      </div>
                    </form>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-5">
              <div className="mb-6">
                <div className="flex items-center mb-4">
                  <Filter className="h-4 sm:h-5 w-4 sm:w-5 text-accent mr-2" style={{ color: '#79e58f' }} />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Filter Players</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex flex-col space-y-2 min-w-0">
                    <Label htmlFor="search-players" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                      <Search className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                      Search
                    </Label>
                    <div className="relative w-full">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="search-players"
                        type="text"
                        placeholder="Search players..."
                        className="pl-10 pr-4 py-2 w-full border-2 border-accent rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-accent/20"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ borderColor: '#79e58f' }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2 min-w-0">
                    <Label htmlFor="filter-branch" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                      <MapPin className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                      Branch
                    </Label>
                    <Select
                      value={branchFilter}
                      onValueChange={(value) => setBranchFilter(value)}
                    >
                      <SelectTrigger className="border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#79e58f' }}>
                        <SelectValue placeholder="Select Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All" className="text-xs sm:text-sm">All Branches</SelectItem>
                        {branches?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id} className="text-xs sm:text-sm">
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col space-y-2 min-w-0">
                    <Label htmlFor="filter-package-type" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                      <Users className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                      Package Type
                    </Label>
                    <Select
                      value={packageTypeFilter}
                      onValueChange={(value) => setPackageTypeFilter(value)}
                    >
                      <SelectTrigger className="border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#79e58f' }}>
                        <SelectValue placeholder="Select Package Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All" className="text-xs sm:text-sm">All Packages</SelectItem>
                        {packages?.map((pkg) => (
                          <SelectItem key={pkg.id} value={pkg.name} className="text-xs sm:text-sm">
                            {pkg.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col space-y-2 min-w-0">
                    <Label htmlFor="filter-status" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                      <Clock className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                      Package Status
                    </Label>
                    <Select
                      value={statusFilter}
                      onValueChange={(value) => setStatusFilter(value)}
                    >
                      <SelectTrigger className="border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#79e58f' }}>
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All" className="text-xs sm:text-sm">All Statuses</SelectItem>
                        <SelectItem value="Ongoing" className="text-xs sm:text-sm">Ongoing</SelectItem>
                        <SelectItem value="Completed" className="text-xs sm:text-sm">Completed</SelectItem>
                        <SelectItem value="Inactive" className="text-xs sm:text-sm">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs sm:text-sm text-gray-600">
                    Showing {filteredStudents.length} player{filteredStudents.length === 1 ? '' : 's'}
                  </p>
                  {filteredStudents.length > 0 && (
                    <Button
                      onClick={() => {
                        const headers = ['Name', 'Remaining Sessions', 'Total Sessions', 'Email', 'Phone', 'Branch', 'Package Type', 'Enrollment Date'];
                        exportToCSV(
                          filteredStudents,
                          'players_report',
                          headers,
                          (student) => [
                            student.name || '',
                            String(student.remaining_sessions || 0),
                            String(student.sessions || 0),
                            student.email || '',
                            student.phone || '',
                            branches?.find(b => b.id === student.branch_id)?.name || '',
                            student.package_type || '',
                            student.enrollment_date ? format(new Date(student.enrollment_date), 'yyyy-MM-dd') : ''
                          ]
                        );
                        toast.success('Players report exported to Excel successfully');
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm transition-all duration-300"
                    >
                      <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      Export Excel
                    </Button>
                  )}
                </div>
              </div>
              {filteredStudents.length === 0 ? (
                <div className="text-center py-12 sm:py-16">
                  <Users className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2">
                    {searchTerm || branchFilter !== "All" || packageTypeFilter !== "All" || statusFilter !== "All" ? "No players found" : "No players"}
                  </h3>
                  <p className="text-xs sm:text-sm md:text-base text-gray-600">
                    {searchTerm || branchFilter !== "All" || packageTypeFilter !== "All" || statusFilter !== "All" ? "Try adjusting your search or filters." : "Add a new player to get started."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedStudents.map((student) => {
                      // Use accurate session data calculated from attendance records
                      const sessionData = getAccurateSessionData(student);
                      const { total, usedSessions, remaining, progressPercentage } = sessionData;
                      const branch = branches?.find(b => b.id === student.branch_id);
                      const expirationDate = student.expiration_date ? new Date(student.expiration_date) : null;
                      const packageStatus = getPackageStatus(total, remaining, expirationDate);
                      
                      return (
                        <Card 
                          key={student.id} 
                          className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                        >
                          {/* Header with Name & Status - Dark Background */}
                          <div className="bg-[#242833] p-4">
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 bg-[#79e58f] rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-sm font-bold text-white">{student.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-semibold text-white text-sm leading-tight line-clamp-1" title={student.name}>
                                    {student.name}
                                  </h3>
                                  <p className="text-xs text-gray-400 truncate">{student.email}</p>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
                                packageStatus.status === 'ongoing' 
                                  ? 'bg-emerald-500 text-white' 
                                  : packageStatus.status === 'expired' 
                                    ? 'bg-red-500 text-white' 
                                    : 'bg-blue-500 text-white'
                              }`}>
                                {packageStatus.statusText}
                              </span>
                            </div>
                            
                            {/* Package & Branch */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 bg-[#79e58f]/20 text-[#79e58f] rounded text-xs font-medium">
                                {student.package_type || 'No Package'}
                              </span>
                              {branch && (
                                <span className="inline-flex items-center text-xs text-gray-400">
                                  <MapPin className="w-3 h-3 mr-1" />
                                  {branch.name}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Stats Section */}
                          <div className="p-4">
                            {/* Session Stats Grid */}
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              <div className="text-center p-2 bg-gray-50 rounded-lg">
                                <p className="text-[10px] text-gray-400 uppercase">Total</p>
                                <p className="text-sm font-bold text-gray-900">{total}</p>
                              </div>
                              <div className="text-center p-2 bg-emerald-50 rounded-lg">
                                <p className="text-[10px] text-emerald-600 uppercase">Used</p>
                                <p className="text-sm font-bold text-emerald-700">{usedSessions % 1 === 0 ? usedSessions : usedSessions.toFixed(1)}</p>
                              </div>
                              <div className="text-center p-2 bg-gray-50 rounded-lg">
                                <p className="text-[10px] text-gray-400 uppercase">Left</p>
                                <p className="text-sm font-bold text-gray-900">{remaining % 1 === 0 ? remaining : remaining.toFixed(1)}</p>
                              </div>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="mb-3">
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all ${
                                    packageStatus.status === 'ongoing' ? 'bg-[#79e58f]' : packageStatus.status === 'expired' ? 'bg-red-400' : 'bg-blue-400'
                                  }`}
                                  style={{ width: `${progressPercentage}%` }}
                                />
                              </div>
                              <p className="text-[10px] text-gray-400 mt-1 text-center">{Math.round(progressPercentage)}% completed</p>
                            </div>
                            
                            {/* Date Info */}
                            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                              <div className="bg-gray-50 rounded-lg p-2">
                                <p className="text-gray-400 text-[10px] uppercase">Enrolled</p>
                                <p className="font-medium text-gray-900">{student.enrollment_date ? format(new Date(student.enrollment_date), 'MMM dd, yy') : '—'}</p>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-2">
                                <p className="text-gray-400 text-[10px] uppercase">Expires</p>
                                <p className="font-medium text-gray-900">{student.expiration_date ? format(new Date(student.expiration_date), 'MMM dd, yy') : '—'}</p>
                              </div>
                            </div>
                            
                            {/* Balance */}
                            <div className="flex items-center justify-between py-2 border-t border-gray-100">
                              <span className="text-xs text-gray-500">Balance</span>
                              <span className={`text-sm font-semibold ${(student.remaining_balance || 0) > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                                ₱{(student.remaining_balance || 0).toLocaleString()}
                              </span>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleShowRecords(student)}
                                className="text-xs h-8 px-3 text-white"
                                style={{ backgroundColor: '#1e3a8a', borderColor: '#1e3a8a' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#1e40af';
                                  e.currentTarget.style.borderColor = '#1e40af';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#1e3a8a';
                                  e.currentTarget.style.borderColor = '#1e3a8a';
                                }}
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                View
                              </Button>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAddPayment(student)}
                                  className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50"
                                  title="Add Payment"
                                >
                                  <DollarSign className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(student)}
                                  className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteMutation.mutate(student.id)}
                                  className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center mt-6 space-x-2 flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="border-2 border-accent text-accent hover:bg-accent hover:text-white w-10 h-10 p-0 flex items-center justify-center"
                        style={{ borderColor: '#79e58f', color: '#79e58f' }}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      {getPaginationRange(currentPage, totalPages).map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          onClick={() => handlePageChange(page)}
                          className={`border-2 w-10 h-10 p-0 flex items-center justify-center text-xs sm:text-sm ${
                            currentPage === page
                              ? 'bg-accent text-white'
                              : 'border-accent text-accent hover:bg-accent hover:text-white'
                          }`}
                          style={{ 
                            backgroundColor: currentPage === page ? '#79e58f' : 'transparent',
                            borderColor: '#79e58f',
                            color: currentPage === page ? 'white' : '#79e58f'
                          }}
                        >
                          {page}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="border-2 border-accent text-accent hover:bg-accent hover:text-white w-10 h-10 p-0 flex items-center justify-center"
                        style={{ borderColor: '#79e58f', color: '#79e58f' }}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </StudentsErrorBoundary>
  );
}
