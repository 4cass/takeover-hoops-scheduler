import { useState, Component, ErrorInfo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Filter, Search, Users, Calendar, Clock, MapPin, User, ChevronLeft, ChevronRight, Mail, Phone, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

type Coach = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
};

type Branch = {
  id: string;
  name: string;
};

type Package = {
  id: string;
  name: string;
  is_active: boolean;
};

type SessionRecord = {
  training_sessions: any;
  coach_id: string;
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  branch_id: string;
  package_type: string | null;
  branches: { name: string } | null;
  session_participants: { students: { name: string } }[];
  session_coaches: { coach_id: string; coaches: { name: string } | null }[];
};

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRecordsDialogOpen, setIsRecordsDialogOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("All");
  const [coachPackageTypeFilter, setCoachPackageTypeFilter] = useState<string>("All");
  const [recordsBranchFilter, setRecordsBranchFilter] = useState<string>("All");
  const [recordsPackageTypeFilter, setRecordsPackageTypeFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsCurrentPage, setRecordsCurrentPage] = useState(1);
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

  const { data: packages, isLoading: packagesLoading, error: packagesError } = useQuery({
    queryKey: ["packages"],
    queryFn: async () => {
      console.log("Fetching packages...");
      const { data, error } = await supabase
        .from("packages")
        .select("name")
        .eq("is_active", true)
        .order("name");
      if (error) {
        console.error("packages query error:", error);
        toast.error(`Failed to fetch packages: ${error.message}`);
        throw error;
      }
      console.log("Fetched packages:", data);
      return data as Package[];
    },
  });

  const { data: coachPackageTypes, isLoading: coachPackageTypesLoading } = useQuery({
    queryKey: ["coach_package_types", coaches?.map(c => c.id) || []],
    queryFn: async () => {
      if (!coaches || coaches.length === 0) return [];
      console.log("Fetching coach package types...");
      const { data, error } = await supabase
        .from("session_coaches")
        .select(`
          coach_id,
          training_sessions (package_type)
        `)
        .in("coach_id", coaches.map(c => c.id));
      if (error) {
        console.error("coach_package_types query error:", error);
        toast.error(`Failed to fetch coach package types: ${error.message}`);
        throw error;
      }
      console.log("Fetched coach package types:", data);
      return data as { coach_id: string; training_sessions: { package_type: string | null } }[];
    },
    enabled: !!coaches && coaches.length > 0,
  });

  const filteredCoaches = coaches?.filter((coach) => {
    const matchesSearch = coach.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPackageType = coachPackageTypeFilter === "All" ||
      coachPackageTypes?.some(
        (cpt) => cpt.coach_id === coach.id && cpt.training_sessions?.package_type === coachPackageTypeFilter
      );
    return matchesSearch && matchesPackageType;
  }) || [];

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
          training_sessions (
            id,
            date,
            start_time,
            end_time,
            branch_id,
            package_type,
            branches (name),
            session_participants (students (name))
          ),
          coach_id,
          coaches (name)
        `)
        .in("coach_id", paginatedCoaches.map(c => c.id))
        .order("date", { ascending: false, referencedTable: "training_sessions" });
      if (error) {
        console.error("session_records query error:", error);
        toast.error(`Failed to fetch session records: ${error.message}`);
        throw error;
      }
      console.log("Fetched session records:", data);
      return data as unknown as SessionRecord[];
    },
    enabled: !!paginatedCoaches && paginatedCoaches.length > 0,
  });

  const filteredSessionRecords = sessionRecords?.filter((record) =>
    (recordsBranchFilter === "All" || record.training_sessions?.branch_id === recordsBranchFilter) &&
    (recordsPackageTypeFilter === "All" || record.training_sessions?.package_type === recordsPackageTypeFilter) &&
    (selectedCoach ? record.coach_id === selectedCoach.id : true)
  ) || [];

  const recordsTotalPages = Math.ceil(filteredSessionRecords.length / itemsPerPage);
  const recordsStartIndex = (recordsCurrentPage - 1) * itemsPerPage;
  const recordsEndIndex = recordsStartIndex + itemsPerPage;
  const paginatedSessionRecords = filteredSessionRecords.slice(recordsStartIndex, recordsEndIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRecordsPageChange = (page: number) => {
    setRecordsCurrentPage(page);
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
        .select()
        .single();
      if (error) throw error;
      return data;
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
    setSelectedCoach(coach);
    setRecordsBranchFilter("All");
    setRecordsPackageTypeFilter("All");
    setRecordsCurrentPage(1);
    setIsRecordsDialogOpen(true);
  };

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

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
      <div className="min-h-screen bg-background pt-4 p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#181818] mb-2 tracking-tight">Coaches Manager</h1>
            <p className="text-xs sm:text-sm md:text-base text-gray-700">Manage coach information and session history</p>
          </div>

          <Card className="border-2 border-[#181A18] bg-white shadow-xl">
            <CardHeader className="border-b border-[#181A18] bg-[#181A18] p-3 sm:p-4 md:p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                <div>
                  <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                    <Users className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" style={{ color: '#BEA877' }} />
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
                      style={{ backgroundColor: '#BEA877' }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Coach
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md bg-white border-2 border-[#181A18] p-3 sm:p-4 md:p-5">
                    <DialogHeader>
                      <DialogTitle className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                        {editingCoach ? "Edit Coach" : "Create Coach Account"}
                      </DialogTitle>
                      <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                        {editingCoach ? "Update coach information" : "Create a new coach account with login credentials"}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="name" className="text-gray-700 font-medium text-xs sm:text-sm">Name</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                          required
                          className="mt-1 border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 bg-white text-xs sm:text-sm"
                          style={{ borderColor: '#BEA877' }}
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
                          style={{ borderColor: '#BEA877' }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone" className="text-gray-700 font-medium text-xs sm:text-sm">Phone</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                          className="mt-1 border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 bg-white text-xs sm:text-sm"
                          style={{ borderColor: '#BEA877' }}
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
                          style={{ backgroundColor: '#BEA877' }}
                        >
                          {createMutation.isPending || updateMutation.isPending ? "Processing..." : editingCoach ? "Update" : "Create Account"}
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
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Filter Coaches</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2 flex flex-col min-w-0">
                    <Label htmlFor="search-coaches" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                      <Search className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
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
                        style={{ borderColor: '#BEA877' }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 flex flex-col min-w-0">
                    <Label htmlFor="filter-coach-package-type" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                      <Users className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                      Package Type
                    </Label>
                    <Select
                      value={coachPackageTypeFilter}
                      onValueChange={(value) => setCoachPackageTypeFilter(value)}
                    >
                      <SelectTrigger className="border-2 focus:border-accent rounded-lg py-2 text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
                        <SelectValue placeholder="Select Package Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All" className="text-xs sm:text-sm">All Package Types</SelectItem>
                        {packages?.map((pkg) => (
                          <SelectItem key={pkg.name} value={pkg.name} className="text-xs sm:text-sm">
                            {pkg.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 mt-3">
                  Showing {filteredCoaches.length} coach{filteredCoaches.length === 1 ? '' : 'es'}
                </p>
              </div>

              {filteredCoaches.length === 0 ? (
                <div className="text-center py-12 sm:py-16">
                  <Users className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2">
                    {searchTerm || coachPackageTypeFilter !== "All" ? "No coaches found" : "No coaches"}
                  </h3>
                  <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-6">
                    {(searchTerm || coachPackageTypeFilter !== "All") ? "Try adjusting your search or filters." : "Add a new coach to get started."}
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
                        style={{ borderColor: '#BEA877' }}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center space-x-2 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-sm" style={{ backgroundColor: '#BEA877' }}>
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
                                className="bg-blue-600 text-white hover:bg-blue-700 w-10 h-10 p-0 flex items-center justify-center"
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
                    style={{ borderColor: '#BEA877', color: '#BEA877' }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
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
            </CardContent>
          </Card>

          <Dialog open={isRecordsDialogOpen} onOpenChange={setIsRecordsDialogOpen}>
            <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl bg-white border-2 border-[#181A18] p-3 sm:p-4 md:p-5">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg md:text-xl font-bold text-gray-900 truncate">
                  Session History for {selectedCoach?.name}
                </DialogTitle>
                <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                  View session details for this coach
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="p-3 sm:p-4 rounded-lg border border-gray-200 bg-gray-50">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Coach Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-700 truncate"><span className="font-medium">Name:</span> {selectedCoach?.name}</p>
                      <p className="text-xs sm:text-sm text-gray-700 truncate"><span className="font-medium">Email:</span> {selectedCoach?.email}</p>
                      <p className="text-xs sm:text-sm text-gray-700 truncate"><span className="font-medium">Phone:</span> {selectedCoach?.phone || "N/A"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center mb-4">
                    <Filter className="h-4 sm:h-5 w-4 sm:w-5 text-accent mr-2" style={{ color: '#BEA877' }} />
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Session Records</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2 flex flex-col min-w-0">
                      <Label htmlFor="filter-records-branch" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                        <MapPin className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                        Branch
                      </Label>
                      <Select
                        value={recordsBranchFilter}
                        onValueChange={(value) => setRecordsBranchFilter(value)}
                      >
                        <SelectTrigger className="border-2 focus:border-accent rounded-lg py-2 text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
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
                    <div className="space-y-2 flex flex-col min-w-0">
                      <Label htmlFor="filter-records-package-type" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                        <Users className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                        Package Type
                      </Label>
                      <Select
                        value={recordsPackageTypeFilter}
                        onValueChange={(value) => setRecordsPackageTypeFilter(value)}
                      >
                        <SelectTrigger className="border-2 focus:border-accent rounded-lg py-2 text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
                          <SelectValue placeholder="Select Package Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All" className="text-xs sm:text-sm">All Package Types</SelectItem>
                          {packages?.map((pkg) => (
                            <SelectItem key={pkg.name} value={pkg.name} className="text-xs sm:text-sm">
                              {pkg.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-4">
                    Showing {filteredSessionRecords.length} session{filteredSessionRecords.length === 1 ? '' : 's'}
                  </p>
                  {recordsLoading ? (
                    <div className="text-center py-12 sm:py-16">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto" style={{ borderColor: '#BEA877' }}></div>
                      <p className="text-gray-600 mt-2 text-xs sm:text-sm">Loading session records...</p>
                    </div>
                  ) : recordsError ? (
                    <p className="text-red-600 text-xs sm:text-sm">Error loading records: {(recordsError as Error).message}</p>
                  ) : filteredSessionRecords.length === 0 ? (
                    <div className="text-center py-12 sm:py-16">
                      <Calendar className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-base sm:text-lg text-gray-600 mb-2">
                        {recordsBranchFilter !== "All" || recordsPackageTypeFilter !== "All" ? 
                          "No sessions found with the selected filters." : 
                          "No session records found for this coach."}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-2 border-[#181A18] rounded-xl min-w-[600px]">
                        <thead className="bg-[#181A18] text-[#efeff1]">
                          <tr>
                            <th className="py-3 px-4 text-left font-semibold text-xs sm:text-sm"><Calendar className="w-4 h-4 inline mr-2" />Date</th>
                            <th className="py-3 px-4 text-left font-semibold text-xs sm:text-sm"><Clock className="w-4 h-4 inline mr-2" />Time</th>
                            <th className="py-3 px-4 text-left font-semibold text-xs sm:text-sm"><MapPin className="w-4 h-4 inline mr-2" />Branch</th>
                            <th className="py-3 px-4 text-left font-semibold text-xs sm:text-sm"><Users className="w-4 h-4 inline mr-2" />Package Type</th>
                            <th className="py-3 px-4 text-left font-semibold text-xs sm:text-sm"><User className="w-4 h-4 inline mr-2" />Students</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedSessionRecords.map((record, index) => (
                            <tr
                              key={record.training_sessions?.id}
                              className={`transition-all duration-300 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                            >
                              <td className="py-3 px-4 text-gray-600 text-xs sm:text-sm min-w-0 truncate">
                                {record.training_sessions ? format(new Date(record.training_sessions.date), 'MMM dd, yyyy') : 'N/A'}
                              </td>
                              <td className="py-3 px-4 text-gray-600 text-xs sm:text-sm min-w-0 truncate">
                                {record.training_sessions ? `${formatTime12Hour(record.training_sessions.start_time)} - ${formatTime12Hour(record.training_sessions.end_time)}` : 'N/A'}
                              </td>
                              <td className="py-3 px-4 text-gray-600 text-xs sm:text-sm min-w-0 truncate">
                                {record.training_sessions?.branches?.name || 'N/A'}
                              </td>
                              <td className="py-3 px-4 text-gray-600 text-xs sm:text-sm min-w-0 truncate">
                                {record.training_sessions?.package_type || 'N/A'}
                              </td>
                              <td className="py-3 px-4 text-gray-600 text-xs sm:text-sm min-w-0 truncate">
                                {record.training_sessions?.session_participants?.map(participant => participant.students.name).join(", ") || "No students"}
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
                          {Array.from({ length: recordsTotalPages }, (_, index) => index + 1).map((page) => (
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
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </CoachesErrorBoundary>
  );
}