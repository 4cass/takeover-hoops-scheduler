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

  const filteredStudents = students?.filter((student) => {
    const totalSessions = Number(student.sessions) || 0;
    const remainingSessions = Number(student.remaining_sessions) || 0;
    const expirationDate = student.expiration_date ? new Date(student.expiration_date) : null;
    const packageStatus = getPackageStatus(totalSessions, remainingSessions, expirationDate);

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
      <div className="min-h-screen bg-background pt-4 p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#181818] mb-2 tracking-tight">Players Manager</h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-700">Manage player information and session quotas</p>
          </div>
          <Card className="border-2 border-[#181A18] bg-white shadow-xl overflow-hidden">
            <CardHeader className="border-b border-[#181A18] bg-[#181A18] p-3 sm:p-4 md:p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
                <div>
                  <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                    <Users className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" style={{ color: '#BEA877' }} />
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
                      className="bg-accent hover:bg-[#8e7a3f] text-white transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                      style={{ backgroundColor: '#BEA877' }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Player
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl md:max-w-3xl border-2 border-gray-200 bg-white shadow-lg overflow-x-hidden p-3 sm:p-4 md:p-5">
                    <DialogHeader>
                      <DialogTitle className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                        {editingStudent ? "Edit Player" : "Add New Player"}
                      </DialogTitle>
                      <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                        {editingStudent ? "Update player information" : "Add a new player to the system"}
                      </DialogDescription>
                    </DialogHeader>
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
                            style={{ borderColor: '#BEA877' }}
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
                            style={{ borderColor: '#BEA877' }}
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
                            style={{ borderColor: '#BEA877' }}
                          />
                        </div>
                        <div className="flex flex-col space-y-2 min-w-0">
                          <Label htmlFor="branch_id" className="text-gray-700 font-medium text-xs sm:text-sm truncate">Branch</Label>
                          <Select
                            value={formData.branch_id ?? undefined}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, branch_id: value }))}
                          >
                            <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
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
                            <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
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
                                style={{ borderColor: '#BEA877' }}
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
                                  style={{ borderColor: '#BEA877' }}
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
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-5">
              <div className="mb-6">
                <div className="flex items-center mb-4">
                  <Filter className="h-4 sm:h-5 w-4 sm:w-5 text-accent mr-2" style={{ color: '#BEA877' }} />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Filter Players</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex flex-col space-y-2 min-w-0">
                    <Label htmlFor="search-players" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                      <Search className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
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
                        style={{ borderColor: '#BEA877' }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2 min-w-0">
                    <Label htmlFor="filter-branch" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                      <MapPin className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                      Branch
                    </Label>
                    <Select
                      value={branchFilter}
                      onValueChange={(value) => setBranchFilter(value)}
                    >
                      <SelectTrigger className="border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
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
                      <Users className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                      Package Type
                    </Label>
                    <Select
                      value={packageTypeFilter}
                      onValueChange={(value) => setPackageTypeFilter(value)}
                    >
                      <SelectTrigger className="border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
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
                      <Clock className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                      Package Status
                    </Label>
                    <Select
                      value={statusFilter}
                      onValueChange={(value) => setStatusFilter(value)}
                    >
                      <SelectTrigger className="border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                    {paginatedStudents.map((student) => {
                      const total = Number(student.sessions) || 0;
                      const remaining = Number(student.remaining_sessions) || 0;
                      const usedSessions = total - remaining;
                      const progressPercentage = total > 0 ? (usedSessions / total) * 100 : 0;
                      const branch = branches?.find(b => b.id === student.branch_id);
                      return (
                        <Card 
                          key={student.id} 
                          className="border-2 transition-all duration-300 hover:shadow-lg rounded-lg border-accent overflow-hidden"
                          style={{ borderColor: '#BEA877' }}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                              <div className="flex items-center space-x-2 min-w-0">
                                <Users className="w-4 sm:w-5 h-4 sm:h-5 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                                <h3 className="font-bold text-base sm:text-lg text-gray-900 truncate">
                                  {student.name}
                                </h3>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                                <Badge className={`font-medium ${getPackageBadgeColor(student.package_type)} text-xs sm:text-sm px-2 py-1 truncate max-w-full`}>
                                  {student.package_type || 'N/A'}
                                </Badge>
                                {(() => {
                                  const totalSessions = Number(student.sessions) || 0;
                                  const remainingSessions = Number(student.remaining_sessions) || 0;
                                  const expirationDate = student.expiration_date ? new Date(student.expiration_date) : null;
                                  const packageStatus = getPackageStatus(totalSessions, remainingSessions, expirationDate);

                                  return (
                                    <Badge className={`font-medium ${packageStatus.statusColor} border text-xs sm:text-sm px-2 py-1`}>
                                      {packageStatus.statusText}
                                    </Badge>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 text-gray-600 min-w-0">
                              <User className="w-4 h-4 flex-shrink-0" />
                              <span className="text-xs sm:text-sm font-medium truncate">{student.email}</span>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex items-center space-x-2 min-w-0">
                              <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <span className="text-xs sm:text-sm truncate"><span className="font-medium">Branch:</span> {branch?.name || 'N/A'}</span>
                            </div>
                            <div className="flex items-center space-x-2 min-w-0">
                              <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <span className="text-xs sm:text-sm truncate"><span className="font-medium">Session Progress:</span> {
                                (() => {
                                  const used = Number(usedSessions);
                                  // Debug logging
                                  if (used % 1 !== 0) {
                                    console.log(`Student ${student.name}: usedSessions=${usedSessions}, used=${used}, remaining=${remaining}, total=${total}`);
                                  }
                                  // Always show one decimal place if it's not a whole number
                                  const remainder = used % 1;
                                  if (remainder === 0) {
                                    return used.toString();
                                  } else {
                                    return used.toFixed(1);
                                  }
                                })()
                              } of {total} attended</span>
                            </div>
                            <div>
                              <Progress value={progressPercentage} className="h-2 w-full max-w-full" />
                            </div>
                            <div className="flex items-center space-x-2 min-w-0">
                              <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <span className="text-xs sm:text-sm font-medium">{
                                (() => {
                                  const rem = Number(student.remaining_sessions) || 0;
                                  return rem % 1 === 0 ? rem.toString() : rem.toFixed(1);
                                })()
                              } Remaining Sessions</span>
                            </div>
                            <div className="flex items-center space-x-2 min-w-0">
                              <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <span className="text-xs sm:text-sm truncate"><span className="font-medium">Enrolled:</span> {student.enrollment_date ? format(new Date(student.enrollment_date), 'MM/dd/yyyy') : 'N/A'}</span>
                            </div>
                            <div className="border-t pt-3 space-y-2">
                              <div className="flex items-center space-x-2 min-w-0">
                                <DollarSign className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span className="text-xs sm:text-sm truncate"><span className="font-medium">Total Fee:</span> ₱{(student.total_training_fee || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex items-center space-x-2 min-w-0">
                                <CreditCard className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span className="text-xs sm:text-sm truncate"><span className="font-medium">Downpayment:</span> ₱{(student.downpayment || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex items-center space-x-2 min-w-0">
                                <DollarSign className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                <span className={`text-xs sm:text-sm truncate font-medium ${(student.remaining_balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  <span className="font-medium">Remaining:</span> ₱{(student.remaining_balance || 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-end flex-wrap gap-2">
                              <div className="flex space-x-2 flex-wrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleShowRecords(student)}
                                  className="bg-blue-600 text-white hover:bg-blue-700 w-10 h-10 p-0 flex items-center justify-center"
                                  title="View Records"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAddPayment(student)}
                                  className="bg-green-600 text-white hover:bg-green-700 w-10 h-10 p-0 flex items-center justify-center"
                                  title="Add Payment"
                                >
                                  <DollarSign className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(student)}
                                  className="bg-yellow-600 text-white hover:bg-yellow-700 w-10 h-10 p-0 flex items-center justify-center"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
      variant="outline"
      size="sm"
      onClick={() => deleteMutation.mutate(student.id)}
      // Temporarily remove disabled to test
      // disabled={userRole !== "admin" && userRole !== "coach"}
      className="bg-red-600 text-white hover:bg-red-700 w-10 h-10 p-0 flex items-center justify-center"
      title="Delete"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
                              </div>
                            </div>
                          </CardContent>
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
                        style={{ borderColor: '#BEA877', color: '#BEA877' }}
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
                        className="border-2 border-accent text-accent hover:bg-accent hover:text-white w-10 h-10 p-0 flex items-center justify-center"
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
        </div>
      </div>
    </StudentsErrorBoundary>
  );
}

function useEffect(arg0: () => void, arg1: undefined[]) {
  throw new Error("Function not implemented.");
}
