import { useState, Component, ErrorInfo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Filter, Search, Users, Calendar, Clock, MapPin, User, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Database } from "@/integrations/supabase/types";

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

interface AttendanceRecord {
  session_id: string;
  student_id: string;
  status: "present" | "absent" | "pending";
  training_sessions: {
    date: string;
    start_time: string;
    end_time: string;
    branch_id: string;
    package_type: string | null;
    branches: { name: string } | null;
    session_coaches: Array<{
      id: string;
      coach_id: string;
      coaches: { name: string } | null;
    }>;
  };
}

// Error Boundary Component
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
  const [isRecordsDialogOpen, setIsRecordsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("All");
  const [packageTypeFilter, setPackageTypeFilter] = useState<string>("All");
  const [recordsBranchFilter, setRecordsBranchFilter] = useState<string>("All");
  const [recordsPackageTypeFilter, setRecordsPackageTypeFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsCurrentPage, setRecordsCurrentPage] = useState(1);
  const itemsPerPage = 6;

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

  const filteredStudents = students?.filter((student) =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (branchFilter === "All" || student.branch_id === branchFilter) &&
    (packageTypeFilter === "All" || student.package_type === packageTypeFilter)
  ) || [];

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  const { data: attendanceRecords, isLoading: recordsLoading, error: recordsError } = useQuery({
    queryKey: ["attendance_records", paginatedStudents?.map(s => s.id) || []],
    queryFn: async () => {
      if (!paginatedStudents || paginatedStudents.length === 0) return [];
      console.log("Fetching attendance records for students:", paginatedStudents.map(s => s.id));
      const { data, error } = await supabase
        .from("attendance_records")
        .select(`
          session_id,
          student_id,
          status,
          training_sessions (
            date,
            start_time,
            end_time,
            branch_id,
            package_type,
            branches (name),
            session_coaches (
              id,
              coach_id,
              coaches (name)
            )
          )
        `)
        .in("student_id", paginatedStudents.map(s => s.id))
        .order("date", { ascending: false, referencedTable: "training_sessions" });
      if (error) {
        console.error("attendance_records query error:", error);
        toast.error(`Failed to fetch attendance records: ${error.message}`);
        throw error;
      }
      console.log("Fetched attendance records:", data);
      return data as AttendanceRecord[];
    },
    enabled: !!paginatedStudents && paginatedStudents.length > 0,
  });

  const filteredAttendanceRecords = attendanceRecords?.filter((record) =>
    (recordsBranchFilter === "All" || record.training_sessions.branch_id === recordsBranchFilter) &&
    (recordsPackageTypeFilter === "All" || record.training_sessions.package_type === recordsPackageTypeFilter) &&
    (selectedStudent ? record.student_id === selectedStudent.id : true)
  ) || [];

  const recordsTotalPages = Math.ceil(filteredAttendanceRecords.length / itemsPerPage);
  const recordsStartIndex = (recordsCurrentPage - 1) * itemsPerPage;
  const recordsEndIndex = recordsStartIndex + itemsPerPage;
  const paginatedRecords = filteredAttendanceRecords.slice(recordsStartIndex, recordsEndIndex);

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

  const handleRecordsPageChange = (page: number) => {
    setRecordsCurrentPage(page);
  };

  const createMutation = useMutation({
    mutationFn: async (student: typeof formData) => {
      const { data, error } = await supabase
        .from("students")
        .insert([{
          name: student.name,
          email: student.email,
          phone: student.phone || null,
          sessions: student.sessions,
          remaining_sessions: student.remaining_sessions,
          branch_id: student.branch_id,
          package_type: student.package_type,
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
          sessions: student.sessions,
          remaining_sessions: student.remaining_sessions,
          branch_id: student.branch_id,
          package_type: student.package_type,
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
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Player deleted successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to delete player: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      sessions: 0,
      remaining_sessions: 0,
      branch_id: null,
      package_type: null,
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
      sessions: student.sessions || 0,
      remaining_sessions: student.remaining_sessions || 0,
      branch_id: student.branch_id || null,
      package_type: student.package_type || null,
    });
    setIsDialogOpen(true);
  };

  const handleShowRecords = (student: Student) => {
    setSelectedStudent(student);
    setIsRecordsDialogOpen(true);
    setRecordsCurrentPage(1);
    setRecordsBranchFilter("All");
    setRecordsPackageTypeFilter("All");
  };

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    sessions: 0,
    remaining_sessions: 0,
    branch_id: null as string | null,
    package_type: null as string | null,
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col space-y-2 min-w-0">
                          <Label htmlFor="sessions" className="text-gray-700 font-medium text-xs sm:text-sm truncate">Total Sessions</Label>
                          <Input
                            id="sessions"
                            type="number"
                            min="0"
                            value={formData.sessions}
                            onChange={(e) => setFormData((prev) => ({ ...prev, sessions: parseInt(e.target.value) || 0 }))}
                            className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                            style={{ borderColor: '#BEA877' }}
                          />
                        </div>
                        <div className="flex flex-col space-y-2 min-w-0">
                          <Label htmlFor="remaining_sessions" className="text-gray-700 font-medium text-xs sm:text-sm truncate">Remaining Sessions</Label>
                          <Input
                            id="remaining_sessions"
                            type="number"
                            min="0"
                            value={formData.remaining_sessions}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, remaining_sessions: parseInt(e.target.value) || 0 }))
                            }
                            className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                            style={{ borderColor: '#BEA877' }}
                          />
                        </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mt-3">
                  Showing {filteredStudents.length} player{filteredStudents.length === 1 ? '' : 's'}
                </p>
              </div>
              {filteredStudents.length === 0 ? (
                <div className="text-center py-12 sm:py-16">
                  <Users className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2">
                    {searchTerm || branchFilter !== "All" || packageTypeFilter !== "All" ? "No players found" : "No players"}
                  </h3>
                  <p className="text-xs sm:text-sm md:text-base text-gray-600">
                    {searchTerm || branchFilter !== "All" || packageTypeFilter !== "All" ? "Try adjusting your search or filters." : "Add a new player to get started."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                    {paginatedStudents.map((student) => {
                      const total = student.sessions || 0;
                      const usedSessions = total - (student.remaining_sessions || 0);
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
                              <Badge className={`font-medium ${getPackageBadgeColor(student.package_type)} text-xs sm:text-sm px-2 py-1 truncate max-w-full`}>
                                {student.package_type || 'N/A'}
                              </Badge>
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
                              <span className="text-xs sm:text-sm truncate"><span className="font-medium">Session Progress:</span> {usedSessions} of {total} attended</span>
                            </div>
                            <div>
                              <Progress value={progressPercentage} className="h-2 w-full max-w-full" />
                            </div>
                            <div className="flex items-center space-x-2 min-w-0">
                              <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <span className="text-xs sm:text-sm font-medium">{student.remaining_sessions || 0} Remaining Sessions</span>
                            </div>
                            <div className="flex items-center justify-end flex-wrap gap-2">
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleShowRecords(student)}
                                  className="bg-blue-600 text-white hover:bg-blue-700 w-10 h-10 p-0 flex items-center justify-center"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(student)}
                                  className="bg-yellow-600 text-white hover:bg-yellow-700 w-10 h-10 p-0 flex items-center justify-center"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteMutation.mutate(student.id)}
                                  className="bg-red-600 text-white hover:bg-red-700 w-10 h-10 p-0 flex items-center justify-center"
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
          <Dialog open={isRecordsDialogOpen} onOpenChange={setIsRecordsDialogOpen}>
            <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl border-2 border-gray-200 bg-white shadow-lg overflow-x-hidden p-3 sm:p-4 md:p-5">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg md:text-xl font-bold text-gray-900 truncate">
                  History Records for {selectedStudent?.name}
                </DialogTitle>
                <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                  View session attendance and progress for this player
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Player Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-gray-600 truncate"><span className="font-medium text-gray-900">Name:</span> {selectedStudent?.name}</p>
                      <p className="text-xs sm:text-sm text-gray-600 truncate"><span className="font-medium text-gray-900">Email:</span> {selectedStudent?.email}</p>
                      <p className="text-xs sm:text-sm text-gray-600 truncate"><span className="font-medium text-gray-900">Phone:</span> {selectedStudent?.phone || "N/A"}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-gray-600 truncate"><span className="font-medium text-gray-900">Branch:</span> {branches?.find(b => b.id === selectedStudent?.branch_id)?.name || "N/A"}</p>
                      <p className="text-xs sm:text-sm text-gray-600 truncate"><span className="font-medium text-gray-900">Package Type:</span> {selectedStudent?.package_type || "N/A"}</p>
                      <p className="text-xs sm:text-sm text-gray-600"><span className="font-medium text-gray-900">Session Progress:</span> {(selectedStudent?.sessions || 0) - (selectedStudent?.remaining_sessions || 0)} of {selectedStudent?.sessions || 0} attended</p>
                      <p className="text-xs sm:text-sm text-gray-600"><span className="font-medium text-gray-900">Remaining Sessions:</span> {selectedStudent?.remaining_sessions || 0}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Progress 
                      value={selectedStudent?.sessions ? (((selectedStudent.sessions - (selectedStudent.remaining_sessions || 0)) / selectedStudent.sessions) * 100) : 0} 
                      className="h-2 w-full max-w-full"
                    />
                  </div>
                </div>
                <div className="mb-6">
                  <div className="flex items-center mb-4">
                    <Filter className="h-4 sm:h-5 w-4 sm:w-5 text-accent mr-2" style={{ color: '#BEA877' }} />
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Filter Records</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col space-y-2 min-w-0">
                      <Label htmlFor="records-filter-branch" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                        <MapPin className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                        Branch
                      </Label>
                      <Select
                        value={recordsBranchFilter}
                        onValueChange={(value) => setRecordsBranchFilter(value)}
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
                      <Label htmlFor="records-filter-package-type" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                        <Users className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                        Package Type
                      </Label>
                      <Select
                        value={recordsPackageTypeFilter}
                        onValueChange={(value) => setRecordsPackageTypeFilter(value)}
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
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-3">
                    Showing {filteredAttendanceRecords.length} record{filteredAttendanceRecords.length === 1 ? '' : 's'}
                  </p>
                </div>
                {recordsLoading ? (
                  <div className="text-center py-8 sm:py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto" style={{ borderColor: '#BEA877' }}></div>
                    <p className="text-gray-600 mt-2 text-xs sm:text-sm">Loading attendance records...</p>
                  </div>
                ) : recordsError ? (
                  <p className="text-red-600 text-xs sm:text-sm">Error loading records: {(recordsError as Error).message}</p>
                ) : !filteredAttendanceRecords || filteredAttendanceRecords.length === 0 ? (
                  <p className="text-gray-600 text-xs sm:text-sm">No attendance records found for this player.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] rounded-lg border-2 border-[#181A18]">
                      <thead className="bg-[#181A18] text-[#efeff1]">
                        <tr>
                          <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm"><Calendar className="w-4 h-4 inline mr-2" />Date</th>
                          <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm"><Clock className="w-4 h-4 inline mr-2" />Time</th>
                          <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm"><MapPin className="w-4 h-4 inline mr-2" />Branch</th>
                          <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm"><User className="w-4 h-4 inline mr-2" />Coaches</th>
                          <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRecords.map((record, index) => (
                          <tr
                            key={record.session_id}
                            className={`transition-all duration-300 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                          >
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate">
                              {format(new Date(record.training_sessions.date), "MMM dd, yyyy")}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate">
                              {format(new Date(`1970-01-01T${record.training_sessions.start_time}`), "hh:mm a")} - 
                              {format(new Date(`1970-01-01T${record.training_sessions.end_time}`), "hh:mm a")}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate">{record.training_sessions.branches?.name || 'N/A'}</td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate">
                              {record.training_sessions.session_coaches.length > 0 
                                ? record.training_sessions.session_coaches.map(sc => sc.coaches?.name || 'Unknown').join(', ') 
                                : 'No coaches assigned'}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                              <span
                                className={`px-2 py-1 rounded-full text-xs sm:text-sm font-medium truncate max-w-full ${
                                  record.status === "present"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : record.status === "absent"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {record.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {recordsTotalPages > 1 && (
                      <div className="flex justify-center items-center mt-6 space-x-2 flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleRecordsPageChange(recordsCurrentPage - 1)}
                          disabled={recordsCurrentPage === 1}
                          className="border-2 border-accent text-accent hover:bg-accent hover:text-white w-10 h-10 p-0 flex items-center justify-center"
                          style={{ borderColor: '#BEA877', color: '#BEA877' }}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        {getPaginationRange(recordsCurrentPage, recordsTotalPages).map((page) => (
                          <Button
                            key={page}
                            variant={recordsCurrentPage === page ? "default" : "outline"}
                            onClick={() => handleRecordsPageChange(page)}
                            className={`border-2 w-10 h-10 p-0 flex items-center justify-center text-xs sm:text-sm ${
                              recordsCurrentPage === page
                                ? 'bg-accent text-white'
                                : 'border-accent text-accent hover:bg-accent hover:text-white'
                            }`}
                            style={{ 
                              backgroundColor: recordsCurrentPage === page ? '#BEA877' : 'transparent',
                              borderColor: '#BEA877',
                              color: recordsCurrentPage === page ? 'white' : '#BEA877'
                            }}
                          >
                            {page}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          onClick={() => handleRecordsPageChange(recordsCurrentPage + 1)}
                          disabled={recordsCurrentPage === recordsTotalPages}
                          className="border-2 border-accent text-accent hover:bg-accent hover:text-white w-10 h-10 p-0 flex items-center justify-center"
                          style={{ borderColor: '#BEA877', color: '#BEA877' }}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsRecordsDialogOpen(false)}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                >
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </StudentsErrorBoundary>
  );
}