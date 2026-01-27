import { useState, Component, ErrorInfo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Filter, Search, Users, Calendar, Clock, MapPin, User, ChevronLeft, ChevronRight, Mail, Phone, Eye, Download } from "lucide-react";
import { exportToCSV } from "@/utils/exportUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string | null;
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

interface SessionRecord {
  id: string;
  coach_id: string;
  training_sessions: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    branch_id: string;
    package_type: string | null;
    branches: { name: string } | null;
    session_participants: { students: { name: string } }[];
  };
}

interface CoachSessionTime {
  id: string;
  coach_id: string;
  session_id: string;
  time_in: string | null;
  time_out: string | null;
}

interface CoachAttendanceRecord {
  id: string;
  coach_id: string;
  session_id: string;
  status: 'present' | 'absent' | 'pending';
  marked_at: string | null;
}

const formatTime12Hour = (timeString: string) => {
  const [hours, minutes] = timeString.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

// Error Boundary Component
class CoachesErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: string | null }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary in CoachesManager:", error, errorInfo);
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

export function CoachesManager() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("All");
  const [coachPackageTypeFilter, setCoachPackageTypeFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const queryClient = useQueryClient();

  const { data: coaches, isLoading: coachesLoading, error: coachesError } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      console.log("Fetching coaches...");
      const { data, error } = await supabase
        .from("coaches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("coaches query error:", error);
        toast.error(`Failed to fetch coaches: ${error.message}`);
        throw error;
      }
      console.log("Fetched coaches:", data);
      return data as Coach[];
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

  const filteredCoaches = coaches?.filter((coach) =>
    coach.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (branchFilter === "All" || true) && // Branch filter not applied to coaches directly
    (coachPackageTypeFilter === "All" || true) // Package type filter not applied to coaches directly
  ) || [];

  const totalPages = Math.ceil(filteredCoaches.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCoaches = filteredCoaches.slice(startIndex, endIndex);

  const { data: sessionRecords, isLoading: recordsLoading, error: recordsError } = useQuery({
    queryKey: ["session_records", paginatedCoaches?.map(c => c.id) || []],
    queryFn: async () => {
      if (!paginatedCoaches || paginatedCoaches.length === 0) return [];
      console.log("Fetching session records for coaches:", paginatedCoaches.map(c => c.id));
      const { data, error } = await supabase
        .from("session_coaches")
        .select(`
          id,
          coach_id,
          training_sessions (
            id,
            date,
            start_time,
            end_time,
            branch_id,
            package_type,
            branches (name),
            session_participants (students (name))
          )
        `)
        .in("coach_id", paginatedCoaches.map(c => c.id))
        .order("date", { ascending: false, referencedTable: "training_sessions" });
      if (error) {
        console.error("session_records query error:", error);
        toast.error(`Failed to fetch session records: ${error.message}`);
        throw error;
      }
      console.log("Fetched session records:", data);
      return data as SessionRecord[];
    },
    enabled: !!paginatedCoaches && paginatedCoaches.length > 0,
  });

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
    mutationFn: async (coach: typeof formData) => {
      const { data, error } = await supabase.functions.invoke('create-coach-account', {
        body: {
          name: coach.name,
          email: coach.email,
          phone: coach.phone || null
        }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data.coach;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["coaches"] });
      toast.success("Coach account created successfully! Default password: TOcoachAccount!1");
      resetForm();
    },
    onError: (error: any) => {
      console.error("Create coach error:", error);
      toast.error("Failed to create coach account: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...coach }: typeof formData & { id: string }) => {
      const { data, error } = await supabase
        .from("coaches")
        .update({ name: coach.name, email: coach.email, phone: coach.phone || null })
        .eq("id", id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("No coach found with that ID or you don't have permission to update");
      }
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coaches"] });
      toast.success("Coach updated successfully");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Failed to update coach: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coaches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coaches"] });
      toast.success("Coach deleted successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to delete coach: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({ name: "", email: "", phone: "" });
    setEditingCoach(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCoach) {
      updateMutation.mutate({ ...formData, id: editingCoach.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (coach: Coach) => {
    setEditingCoach(coach);
    setFormData({
      name: coach.name,
      email: coach.email,
      phone: coach.phone || "",
    });
    setIsDialogOpen(true);
  };

  const handleShowRecords = (coach: Coach) => {
    navigate(`/dashboard/coaches/${coach.id}/view`);
  };

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
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

  if (coachesLoading || branchesLoading || packagesLoading) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <Users className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">Loading coaches...</h3>
          <p className="text-xs sm:text-sm md:text-lg text-gray-600">Please wait while we fetch the coach data.</p>
        </div>
      </div>
    );
  }

  if (coachesError || branchesError || packagesError) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <Users className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">Error loading coaches</h3>
          <p className="text-sm sm:text-base md:text-lg text-gray-600">
            Failed to load data: {(coachesError || branchesError || packagesError)?.message || 'Unknown error'}. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CoachesErrorBoundary>
      <div className="min-h-screen bg-background pt-4 p-3 sm:p-4 md:p-6 pb-24 md:pb-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#242833] mb-2 tracking-tight">Coaches Manager</h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-700">Manage coach information and session history</p>
          </div>

          <Card className="border-2 border-[#242833] bg-white shadow-xl">
            <CardHeader className="border-b border-[#242833] bg-[#242833] p-3 sm:p-4 md:p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                <div>
                  <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                    <Users className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" style={{ color: '#79e58f' }} />
                    Coach Management
                  </CardTitle>
                  <CardDescription className="text-gray-400 text-xs sm:text-sm">
                    View and manage coach profiles
                  </CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => resetForm()}
                      className="bg-accent text-white hover:bg-accent/90 transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                      style={{ backgroundColor: '#79e58f' }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Coach
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
                    <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
                      <DialogTitle className="text-sm sm:text-base md:text-lg font-bold text-white flex items-center gap-2 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                        </div>
                        <span className="truncate">{editingCoach ? "Edit Coach" : "Create Coach Account"}</span>
                      </DialogTitle>
                      <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13 hidden sm:block">
                        {editingCoach ? "Update coach information" : "Create a new coach account with login credentials"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="p-3 sm:p-4 md:p-5 overflow-y-auto flex-1 custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="name" className="text-gray-700 font-medium text-xs sm:text-sm">Name</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                          required
                          className="mt-1 border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 bg-white text-xs sm:text-sm"
                          style={{ borderColor: '#79e58f' }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-gray-700 font-medium text-xs sm:text-sm">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                          required
                          className="mt-1 border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 bg-white text-xs sm:text-sm"
                          style={{ borderColor: '#79e58f' }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone" className="text-gray-700 font-medium text-xs sm:text-sm">Phone</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                          className="mt-1 border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 bg-white text-xs sm:text-sm"
                          style={{ borderColor: '#79e58f' }}
                        />
                      </div>
                      {!editingCoach && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-xs sm:text-sm text-blue-800">
                            <strong>Note:</strong> A login account will be created with default password: <code className="bg-blue-100 px-1 rounded">TOcoachAccount!1</code>
                          </p>
                          <p className="text-xs text-blue-600 mt-1">The coach can change this password after their first login.</p>
                        </div>
                      )}
                      <div className="flex flex-row justify-end gap-2 pt-4 border-t border-gray-200">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={resetForm}
                          className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 min-w-fit w-auto px-2 sm:px-3 text-xs sm:text-sm"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createMutation.isPending || updateMutation.isPending}
                          className="bg-accent text-white hover:bg-accent/90 min-w-fit w-auto px-2 sm:px-3 text-xs sm:text-sm"
                          style={{ backgroundColor: '#79e58f' }}
                        >
                          {createMutation.isPending || updateMutation.isPending ? "Processing..." : editingCoach ? "Update" : "Create Account"}
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
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Filter Coaches</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2 flex flex-col min-w-0">
                    <Label htmlFor="search-coaches" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                      <Search className="w-4 h-4 mr-2 text-accent" style={{ color: '#79e58f' }} />
                      Search
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="search-coaches"
                        type="text"
                        placeholder="Search coaches..."
                        className="pl-10 pr-4 py-2 w-full border-2 border-accent rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-accent/20 bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ borderColor: '#79e58f' }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs sm:text-sm text-gray-600">
                    Showing {filteredCoaches.length} coach{filteredCoaches.length === 1 ? '' : 'es'}
                  </p>
                  {filteredCoaches.length > 0 && (
                    <Button
                      onClick={() => {
                        const headers = ['Name', 'Email', 'Phone', 'Created At'];
                        exportToCSV(
                          filteredCoaches,
                          'coaches_report',
                          headers,
                          (coach) => [
                            coach.name || '',
                            coach.email || '',
                            coach.phone || '',
                            coach.created_at ? format(new Date(coach.created_at), 'yyyy-MM-dd') : ''
                          ]
                        );
                        toast.success('Coaches report exported to Excel successfully');
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm transition-all duration-300"
                    >
                      <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      Export Excel
                    </Button>
                  )}
                </div>
              </div>

              {filteredCoaches.length === 0 ? (
                <div className="text-center py-12 sm:py-16">
                  <Users className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2">
                    {searchTerm ? "No coaches found" : "No coaches"}
                  </h3>
                  <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-6">
                    {searchTerm ? "Try adjusting your search." : "Add a new coach to get started."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                  {paginatedCoaches.map((coach) => {
                    const sessionCount = sessionRecords?.filter(r => r.coach_id === coach.id).length || 0;
                    return (
                      <Card
                        key={coach.id}
                        className="border-2 transition-all duration-300 hover:shadow-lg rounded-xl border-accent"
                        style={{ borderColor: '#79e58f' }}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center space-x-2 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-sm" style={{ backgroundColor: '#79e58f' }}>
                              {coach.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                            </div>
                            <h3 className="font-bold text-base sm:text-lg text-gray-900 truncate">{coach.name}</h3>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center space-x-2 min-w-0">
                            <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <span className="text-xs sm:text-sm truncate"><span className="font-medium">Email:</span> {coach.email}</span>
                          </div>
                          <div className="flex items-center space-x-2 min-w-0">
                            <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <span className="text-xs sm:text-sm truncate"><span className="font-medium">Phone:</span> {coach.phone || "N/A"}</span>
                          </div>
                          <div className="flex items-center space-x-2 min-w-0">
                            <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <span className="text-xs sm:text-sm truncate"><span className="font-medium">Sessions:</span> {sessionCount} conducted</span>
                          </div>
                          <div className="flex items-center justify-end pt-2">
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteMutation.mutate(coach.id)}
                                className="bg-red-600 text-white hover:bg-red-700 w-10 h-10 p-0 flex items-center justify-center"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(coach)}
                                className="bg-yellow-600 text-white hover:bg-yellow-700 w-10 h-10 p-0 flex items-center justify-center"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleShowRecords(coach)}
                                className="text-white w-10 h-10 p-0 flex items-center justify-center"
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
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
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
            </CardContent>
          </Card>

        </div>
      </div>
    </CoachesErrorBoundary>
  );
}
