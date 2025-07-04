import { useState } from "react";
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

type SessionRecord = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  branch_id: string;
  package_type: string | null;
  branches: { name: string };
  session_participants: { students: { name: string } }[];
};

const PACKAGE_TYPES = [
  "Personal Training",
  "Camp Training"
];

const formatTime12Hour = (timeString: string) => {
  const [hours, minutes] = timeString.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

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

  const { data: coaches, isLoading } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coaches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Coach[];
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const { data: sessionRecords, isLoading: recordsLoading, error: recordsError } = useQuery({
    queryKey: ["training_sessions", selectedCoach?.id],
    queryFn: async () => {
      if (!selectedCoach) return [];
      const { data, error } = await supabase
        .from("training_sessions")
        .select(`
          id,
          date,
          start_time,
          end_time,
          branch_id,
          package_type,
          branches (name),
          session_participants (students (name))
        `)
        .eq("coach_id", selectedCoach.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as SessionRecord[];
    },
    enabled: !!selectedCoach,
  });

  const filteredCoaches = coaches?.filter((coach) =>
    coach.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredSessionRecords = sessionRecords?.filter((record) =>
    (recordsBranchFilter === "All" || record.branch_id === recordsBranchFilter) &&
    (recordsPackageTypeFilter === "All" || record.package_type === recordsPackageTypeFilter)
  ) || [];

  // Pagination logic for coaches
  const totalPages = Math.ceil(filteredCoaches.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCoaches = filteredCoaches.slice(startIndex, endIndex);

  // Pagination logic for session records
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-7xl mx-auto text-center py-16">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-black mb-3">Loading coaches...</h3>
          <p className="text-lg text-gray-600">Please wait while we fetch the coach data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-4 p-6">
      <div className="max-w-7xl mx-auto space-y-8 -mt-5">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#181818] mb-2 tracking-tight">Coaches Manager</h1>
          <p className="text-lg text-gray-700">Manage coach information and session history</p>
        </div>

        <Card className="border-2 border-black bg-white shadow-xl">
          <CardHeader className="border-b border-[#181A18] bg-[#181A18]">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div>
                <CardTitle className="text-2xl font-bold text-[#efeff1] flex items-center">
                  <Users className="h-6 w-6 mr-3 text-accent" style={{ color: '#BEA877' }} />
                  Coach Management
                </CardTitle>
                <CardDescription className="text-gray-400 text-base">
                  View and manage coach profiles
                </CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => resetForm()}
                    className="bg-accent text-white hover:bg-accent/90 transition-all duration-300"
                    style={{ backgroundColor: '#BEA877' }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Coach
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-md bg-white border-2 border-black">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-gray-900">
                      {editingCoach ? "Edit Coach" : "Create Coach Account"}
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 text-base">
                      {editingCoach ? "Update coach information" : "Create a new coach account with login credentials"}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name" className="text-gray-700 font-medium text-sm">Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        required
                        className="mt-1 border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 bg-white"
                        style={{ borderColor: '#BEA877' }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-gray-700 font-medium text-sm">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        required
                        className="mt-1 border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 bg-white"
                        style={{ borderColor: '#BEA877' }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-gray-700 font-medium text-sm">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                        className="mt-1 border-2 border-accent rounded-lg focus:border-accent focus:ring-accent/20 bg-white"
                        style={{ borderColor: '#BEA877' }}
                      />
                    </div>
                    {!editingCoach && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                          <strong>Note:</strong> A login account will be created with default password: <code className="bg-blue-100 px-1 rounded">TOcoachAccount!1</code>
                        </p>
                        <p className="text-xs text-blue-600 mt-1">The coach can change this password after their first login.</p>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetForm}
                        className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-all duration-300"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        className="bg-accent text-white hover:bg-accent/90 transition-all duration-300"
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
          <CardContent className="p-8">
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <Filter className="h-5 w-5 text-accent mr-2" style={{ color: '#BEA877' }} />
                <h3 className="text-lg font-semibold text-gray-900">Filter Coaches</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 flex flex-col">
                  <Label htmlFor="search-coaches" className="flex items-center text-sm font-medium text-gray-700">
                    <Search className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                    Search
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="search-coaches"
                      type="text"
                      placeholder="Search coaches..."
                      className="pl-10 pr-4 py-3 w-full max-w-md border-2 border-accent rounded-lg text-sm focus:border-accent focus:ring-accent/20 bg-white"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ borderColor: '#BEA877' }}
                    />
                  </div>
                </div>
                <div className="space-y-2 flex flex-col">
                  <Label htmlFor="filter-branch" className="flex items-center text-sm font-medium text-gray-700">
                    <MapPin className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                    Branch
                  </Label>
                  <Select
                    value={branchFilter}
                    onValueChange={(value) => setBranchFilter(value)}
                  >
                    <SelectTrigger className="border-2 focus:border-accent rounded-lg py-3 text-sm" style={{ borderColor: '#BEA877' }}>
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Branches</SelectItem>
                      {branches?.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex flex-col">
                  <Label htmlFor="filter-package-type" className="flex items-center text-sm font-medium text-gray-700">
                    <Users className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                    Package Type
                  </Label>
                  <Select
                    value={coachPackageTypeFilter}
                    onValueChange={(value) => setCoachPackageTypeFilter(value)}
                  >
                    <SelectTrigger className="border-2 focus:border-accent rounded-lg py-3 text-sm" style={{ borderColor: '#BEA877' }}>
                      <SelectValue placeholder="Select Package Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Package Types</SelectItem>
                      {PACKAGE_TYPES.map((packageType) => (
                        <SelectItem key={packageType} value={packageType}>
                          {packageType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                Showing {filteredCoaches.length} coach{filteredCoaches.length === 1 ? '' : 'es'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedCoaches.map((coach) => (
                <Card
                  key={coach.id}
                  className="border-2 transition-all duration-300 hover:shadow-lg rounded-xl border-accent"
                  style={{ borderColor: '#BEA877' }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-sm" style={{ backgroundColor: '#BEA877' }}>
                        {coach.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                      </div>
                      <h3 className="font-bold text-lg text-gray-900">{coach.name}</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span className="text-sm"><span className="font-medium">Email:</span> {coach.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span className="text-sm"><span className="font-medium">Phone:</span> {coach.phone || "N/A"}</span>
                    </div>
                    <div className="flex items-center justify-end pt-2">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(coach.id)}
                          className="bg-red-600 text-white hover:bg-accent"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(coach)}
                          className="bg-yellow-600 text-white hover:bg-accent"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleShowRecords(coach)}
                          className="bg-blue-600 text-white hover:bg-accent"
                        >
                          <Eye className="w-4 h-4 " />
                          <span className="hidden sm:inline">View</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {filteredCoaches.length === 0 ? (
              <div className="text-center py-16">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchTerm || branchFilter !== "All" || coachPackageTypeFilter !== "All" ? "No coaches found" : "No coaches"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || branchFilter !== "All" || coachPackageTypeFilter !== "All" ? "Try adjusting your search or filters." : "Add a new coach to get started."}
                </p>
              </div>
            ) : totalPages > 1 && (
              <div className="flex justify-center items-center mt-6 space-x-2">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="border-2 border-accent text-accent hover:bg-accent hover:text-white"
                  style={{ borderColor: '#BEA877', color: '#BEA877' }}
                >
                  <ChevronLeft className="w-4 h-4" />
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
          </CardContent>
        </Card>

        <Dialog open={isRecordsDialogOpen} onOpenChange={setIsRecordsDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl bg-white border-2 border-black">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gray-900">
                Session History for {selectedCoach?.name}
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-base">
                View session details for this coach
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Coach Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-700"><span className="font-medium">Name:</span> {selectedCoach?.name}</p>
                    <p className="text-sm text-gray-700"><span className="font-medium">Email:</span> {selectedCoach?.email}</p>
                    <p className="text-sm text-gray-700"><span className="font-medium">Phone:</span> {selectedCoach?.phone || "N/A"}</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center mb-4">
                  <Filter className="h-5 w-5 text-accent mr-2" style={{ color: '#BEA877' }} />
                  <h3 className="text-lg font-semibold text-gray-900">Session Records</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2 flex flex-col">
                    <Label htmlFor="filter-records-branch" className="flex items-center text-sm font-medium text-gray-700">
                      <MapPin className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                      Branch
                    </Label>
                    <Select
                      value={recordsBranchFilter}
                      onValueChange={(value) => setRecordsBranchFilter(value)}
                    >
                      <SelectTrigger className="border-2 focus:border-accent rounded-lg py-3 text-sm" style={{ borderColor: '#BEA877' }}>
                        <SelectValue placeholder="Select Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Branches</SelectItem>
                        {branches?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 flex flex-col">
                    <Label htmlFor="filter-records-package-type" className="flex items-center text-sm font-medium text-gray-700">
                      <Users className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                      Package Type
                    </Label>
                    <Select
                      value={recordsPackageTypeFilter}
                      onValueChange={(value) => setRecordsPackageTypeFilter(value)}
                    >
                      <SelectTrigger className="border-2 focus:border-accent rounded-lg py-3 text-sm" style={{ borderColor: '#BEA877' }}>
                        <SelectValue placeholder="Select Package Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Package Types</SelectItem>
                        {PACKAGE_TYPES.map((packageType) => (
                          <SelectItem key={packageType} value={packageType}>
                            {packageType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Showing {filteredSessionRecords.length} session{filteredSessionRecords.length === 1 ? '' : 's'}
                </p>
                {recordsLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto" style={{ borderColor: '#BEA877' }}></div>
                    <p className="text-gray-600 mt-2 text-base">Loading session records...</p>
                  </div>
                ) : recordsError ? (
                  <p className="text-red-600 text-base">Error loading records: {(recordsError as Error).message}</p>
                ) : filteredSessionRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg text-gray-600 mb-2">
                      {recordsBranchFilter !== "All" || recordsPackageTypeFilter !== "All" ? 
                        "No sessions found with the selected filters." : 
                        "No session records found for this coach."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-2 border-[#181A18] rounded-xl">
                      <thead className="bg-[#181A18] text-[#efeff1]">
                        <tr>
                          <th className="py-3 px-4 text-left font-semibold"><Calendar className="w-4 h-4 inline mr-2" />Date</th>
                          <th className="py-3 px-4 text-left font-semibold"><Clock className="w-4 h-4 inline mr-2" />Time</th>
                          <th className="py-3 px-4 text-left font-semibold"><MapPin className="w-4 h-4 inline mr-2" />Branch</th>
                          <th className="py-3 px-4 text-left font-semibold"><Users className="w-4 h-4 inline mr-2" />Package Type</th>
                          <th className="py-3 px-4 text-left font-semibold"><User className="w-4 h-4 inline mr-2" />Students</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedSessionRecords.map((record, index) => (
                          <tr
                            key={record.id}
                            className={`transition-all duration-300 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                          >
                            <td className="py-3 px-4 text-gray-600">
                              {format(new Date(record.date), 'MMM dd, yyyy')}
                            </td>
                            <td className="py-3 px-4 text-gray-600">
                              {formatTime12Hour(record.start_time)} - 
                              {formatTime12Hour(record.end_time)}
                            </td>
                            <td className="py-3 px-4 text-gray-600">{record.branches.name}</td>
                            <td className="py-3 px-4 text-gray-600">{record.package_type || "N/A"}</td>
                            <td className="py-3 px-4 text-gray-600">
                              {record.session_participants.map(participant => participant.students.name).join(", ") || "No students"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {recordsTotalPages > 1 && (
                      <div className="flex justify-center items-center mt-6 space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => handleRecordsPageChange(recordsCurrentPage - 1)}
                          disabled={recordsCurrentPage === 1}
                          className="border-2 border-accent text-accent hover:bg-accent hover:text-white"
                          style={{ borderColor: '#BEA877', color: '#BEA877' }}
                        >
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Previous
                        </Button>
                        {Array.from({ length: recordsTotalPages }, (_, index) => index + 1).map((page) => (
                          <Button
                            key={page}
                            variant={recordsCurrentPage === page ? "default" : "outline"}
                            onClick={() => handleRecordsPageChange(page)}
                            className={`border-2 ${
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
                          className="border-2 border-accent text-accent hover:bg-accent hover:text-white"
                          style={{ borderColor: '#BEA877', color: '#BEA877' }}
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-2" />
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
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-all duration-300"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}