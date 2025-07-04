 import { useState } from "react";
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

type Student = Database["public"]["Tables"]["students"]["Row"];
type Branch = Database["public"]["Tables"]["branches"]["Row"];
type AttendanceRecord = Database["public"]["Tables"]["attendance_records"]["Row"] & {
  training_sessions: Database["public"]["Tables"]["training_sessions"]["Row"] & {
    branches: { name: string };
    coaches: { name: string };
  };
};

const PACKAGE_TYPES = [
  "Camp Training",
  "Personal Training"
];

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

  const { data: students, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("students query error:", error);
        throw error;
      }
      console.log("Fetched students:", data);
      return data as Student[];
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .order("name");
      if (error) {
        console.error("branches query error:", error);
        throw error;
      }
      return data as Branch[];
    },
  });

  const { data: attendanceRecords, isLoading: recordsLoading, error: recordsError } = useQuery({
    queryKey: ["attendance_records", selectedStudent?.id],
    queryFn: async () => {
      if (!selectedStudent) return [];
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
            coach_id,
            package_type,
            branches (name),
            coaches (name)
          )
        `)
        .eq("student_id", selectedStudent.id)
        .order("date", { ascending: false, referencedTable: "training_sessions" });
      if (error) {
        console.error("attendance_records query error:", error);
        throw error;
      }
      return data as AttendanceRecord[];
    },
    enabled: !!selectedStudent,
  });

  const filteredStudents = students?.filter((student) =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (branchFilter === "All" || student.branch_id === branchFilter) &&
    (packageTypeFilter === "All" || student.package_type === packageTypeFilter)
  ) || [];

  // Pagination logic for students
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  const filteredAttendanceRecords = attendanceRecords?.filter((record) =>
    (recordsBranchFilter === "All" || record.training_sessions.branch_id === recordsBranchFilter) &&
    (recordsPackageTypeFilter === "All" || record.training_sessions.package_type === recordsPackageTypeFilter)
  ) || [];

  // Pagination logic for attendance records
  const recordsTotalPages = Math.ceil(filteredAttendanceRecords.length / itemsPerPage);
  const recordsStartIndex = (recordsCurrentPage - 1) * itemsPerPage;
  const recordsEndIndex = recordsStartIndex + itemsPerPage;
  const paginatedRecords = filteredAttendanceRecords.slice(recordsStartIndex, recordsEndIndex);

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
      remaining_sessions: student.remaining_sessions,
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
    switch (packageType) {
      case 'Camp Training': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Personal Training': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-7xl mx-auto text-center py-16">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-black mb-3">Loading players...</h3>
          <p className="text-lg text-gray-600">Please wait while we fetch the player data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-4 p-6">
      <div className="max-w-7xl mx-auto space-y-8 -mt-5">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#181818] mb-2 tracking-tight">Players Manager</h1>
          <p className="text-lg text-gray-700">Manage player information and session quotas</p>
        </div>
        <Card className="border-2 border-black bg-white shadow-xl">
          <CardHeader className="border-b border-[#181A18] bg-[#181A18]">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div>
                <CardTitle className="text-2xl font-bold text-[#efeff1] flex items-center">
                  <Users className="h-6 w-6 mr-3 text-accent" style={{ color: '#BEA877' }} />
                  Player Profiles
                </CardTitle>
                <CardDescription className="text-gray-400 text-base">
                  View and manage player profiles
                </CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => resetForm()}
                    className="bg-accent hover:bg-[#8e7a3f] text-white transition-all duration-300 hover:scale-105"
                    style={{ backgroundColor: '#BEA877' }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Player
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-2 border-gray-200 bg-white shadow-lg max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-gray-900">
                      {editingStudent ? "Edit Player" : "Add New Player"}
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 text-base">
                      {editingStudent ? "Update player information" : "Add a new player to the system"}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name" className="text-gray-700 font-medium">Name</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                          required
                          className="mt-1 border-2 border-gray-200 rounded-xl focus:border-accent focus:ring-accent/20"
                          style={{ borderColor: '#BEA877' }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-gray-700 font-medium">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                          required
                          className="mt-1 border-2 border-gray-200 rounded-xl focus:border-accent focus:ring-accent/20"
                          style={{ borderColor: '#BEA877' }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone" className="text-gray-700 font-medium">Phone</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                          className="mt-1 border-2 border-gray-200 rounded-xl focus:border-accent focus:ring-accent/20"
                          style={{ borderColor: '#BEA877' }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="branch_id" className="text-gray-700 font-medium">Branch</Label>
                        <Select
                          value={formData.branch_id ?? undefined}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, branch_id: value }))}
                        >
                          <SelectTrigger className="mt-1 border-2 border-gray-200 rounded-xl focus:border-accent focus:ring-accent/20" style={{ borderColor: '#BEA877' }}>
                            <SelectValue placeholder="Select Branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches?.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {branch.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="package_type" className="text-gray-700 font-medium">Package Type</Label>
                      <Select
                        value={formData.package_type ?? undefined}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, package_type: value }))}
                      >
                        <SelectTrigger className="mt-1 border-2 border-gray-200 rounded-xl focus:border-accent focus:ring-accent/20" style={{ borderColor: '#BEA877' }}>
                          <SelectValue placeholder="Select Package Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {PACKAGE_TYPES.map((packageType) => (
                            <SelectItem key={packageType} value={packageType}>
                              {packageType}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sessions" className="text-gray-700 font-medium">Total Sessions</Label>
                        <Input
                          id="sessions"
                          type="number"
                          min="0"
                          value={formData.sessions}
                          onChange={(e) => setFormData((prev) => ({ ...prev, sessions: parseInt(e.target.value) || 0 }))}
                          className="mt-1 border-2 border-gray-200 rounded-xl focus:border-accent focus:ring-accent/20"
                          style={{ borderColor: '#BEA877' }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="remaining_sessions" className="text-gray-700 font-medium">Remaining Sessions</Label>
                        <Input
                          id="remaining_sessions"
                          type="number"
                          min="0"
                          value={formData.remaining_sessions}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, remaining_sessions: parseInt(e.target.value) || 0 }))
                          }
                          className="mt-1 border-2 border-gray-200 rounded-xl focus:border-accent focus:ring-accent/20"
                          style={{ borderColor: '#BEA877' }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetForm}
                        className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-all duration-300 hover:scale-105"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white transition-all duration-300 hover:scale-105"
                      >
                        {editingStudent ? "Update" : "Create"}
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
                <h3 className="text-lg font-semibold text-gray-900">Filter Players</h3>
              </div>
              <div className="flex flex-col space-y-4 lg:flex-row lg:items-end lg:gap-4 lg:space-y-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search players..."
                    className="pl-10 pr-4 py-3 w-full border-2 border-accent rounded-xl text-sm focus:border-accent focus:ring-accent/20 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ borderColor: '#BEA877' }}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="filter-branch" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                    Branch
                  </Label>
                  <Select
                    value={branchFilter}
                    onValueChange={(value) => setBranchFilter(value)}
                  >
                    <SelectTrigger className="border-2 focus:border-accent rounded-xl" style={{ borderColor: '#BEA877' }}>
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
                <div className="flex-1">
                  <Label htmlFor="filter-package-type" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <Users className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                    Package Type
                  </Label>
                  <Select
                    value={packageTypeFilter}
                    onValueChange={(value) => setPackageTypeFilter(value)}
                  >
                    <SelectTrigger className="border-2 focus:border-accent rounded-xl" style={{ borderColor: '#BEA877' }}>
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
                Showing {filteredStudents.length} player{filteredStudents.length === 1 ? '' : 's'}
              </p>
            </div>
            {filteredStudents.length === 0 ? (
              <div className="text-center py-16">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchTerm || branchFilter !== "All" || packageTypeFilter !== "All" ? "No players found" : "No players"}
                </h3>
                <p className="text-gray-600">
                  {searchTerm || branchFilter !== "All" || packageTypeFilter !== "All" ? "Try adjusting your search or filters." : "Add a new player to get started."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedStudents.map((student) => {
                    const attended = (student.sessions || 0) - student.remaining_sessions;
                    const total = student.sessions || 0;
                    const progressPercentage = total > 0 ? (attended / total) * 100 : 0;
                    const branch = branches?.find(b => b.id === student.branch_id);
                    return (
                      <Card 
                        key={student.id} 
                        className="border-2 transition-all duration-300 hover:shadow-lg rounded-xl border-accent"
                        style={{ borderColor: '#BEA877' }}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center space-x-2">
                              <Users className="w-5 h-5 text-accent" style={{ color: '#BEA877' }} />
                              <h3 className="font-bold text-lg text-gray-900">
                                {student.name}
                              </h3>
                            </div>
                            <Badge className={`font-medium ${getPackageBadgeColor(student.package_type)}`}>
                              {student.package_type || 'N/A'}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2 text-gray-600">
                            <User className="w-4 h-4" />
                            <span className="text-sm font-medium">{student.email}</span>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="text-sm"><span className="font-medium">Branch:</span> {branch?.name || 'N/A'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-gray-500" />
                            <span className="text-sm"><span className="font-medium">Sessions:</span> {attended} of {total} attended</span>
                          </div>
                          <div>
                            <Progress value={progressPercentage} className="h-2 mt-1" />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Users className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium">{total} Total Sessions</span>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleShowRecords(student)}
                                className="bg-blue-600 text-white"
                              >
                                <Eye className="w-4 h-4" /> View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(student)}
                                className="bg-yellow-600 text-white"
                              >
                                <Edit className="w-4 h-4" /> Edit
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
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
              </>
            )}
          </CardContent>
        </Card>
        <Dialog open={isRecordsDialogOpen} onOpenChange={setIsRecordsDialogOpen}>
          <DialogContent className="max-w-4xl border-2 border-gray-200 bg-white shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gray-900">
                History Records for {selectedStudent?.name}
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-base">
                View session attendance and details for this player
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Player Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Name:</span> {selectedStudent?.name}</p>
                    <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Email:</span> {selectedStudent?.email}</p>
                    <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Phone:</span> {selectedStudent?.phone || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Branch:</span> {branches?.find(b => b.id === selectedStudent?.branch_id)?.name || "N/A"}</p>
                    <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Package Type:</span> {selectedStudent?.package_type || "N/A"}</p>
                    <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Total Sessions:</span> {selectedStudent?.sessions || 0}</p>
                    <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Remaining Sessions:</span> {selectedStudent?.remaining_sessions}</p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Session Records</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Showing {attendanceRecords?.length || 0} record{attendanceRecords?.length === 1 ? '' : 's'}
                </p>
                {recordsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
                    <p className="text-gray-600 mt-2">Loading attendance records...</p>
                  </div>
                ) : recordsError ? (
                  <p className="text-red-600 text-sm">Error loading records: {(recordsError as Error).message}</p>
                ) : !attendanceRecords || attendanceRecords.length === 0 ? (
                  <p className="text-gray-600 text-sm">No attendance records found for this player.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full rounded-xl">
                      <thead className="bg-[#181A18] text-[#efeff1]">
                        <tr>
                          <th className="py-3 px-4 text-left font-semibold"><Calendar className="w-4 h-4 inline mr-2" />Date</th>
                          <th className="py-3 px-4 text-left font-semibold"><Clock className="w-4 h-4 inline mr-2" />Time</th>
                          <th className="py-3 px-4 text-left font-semibold"><MapPin className="w-4 h-4 inline mr-2" />Branch</th>
                          <th className="py-3 px-4 text-left font-semibold"><User className="w-4 h-4 inline mr-2" />Coach</th>
                          <th className="py-3 px-4 text-left font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(attendanceRecords || []).slice(recordsStartIndex, recordsEndIndex).map((record, index) => (
                          <tr
                            key={record.session_id}
                            className={`transition-all duration-300 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                          >
                            <td className="py-3 px-4 text-gray-600">
                              {format(new Date(record.training_sessions.date), "MMM dd, yyyy")}
                            </td>
                            <td className="py-3 px-4 text-gray-600">
                              {format(new Date(`1970-01-01T${record.training_sessions.start_time}`), "hh:mm a")} - 
                              {format(new Date(`1970-01-01T${record.training_sessions.end_time}`), "hh:mm a")}
                            </td>
                            <td className="py-3 px-4 text-gray-600">{record.training_sessions.branches.name}</td>
                            <td className="py-3 px-4 text-gray-600">{record.training_sessions.coaches.name}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
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
                      <div className="flex justify-center items-center mt-6 space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => handleRecordsPageChange(recordsCurrentPage - 1)}
                          disabled={recordsCurrentPage === 1}
                          className="border-2 border-accent text-accent hover:bg-accent hover:text-white"
                          style={{ borderColor: '#BEA877', color: '#BEA877' }}
                        >
                          <ChevronLeft className="w-4 h-4" />
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
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-all duration-300 hover:scale-105"
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
