import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, Calendar, MapPin, User, Users, Filter, Search, ChevronLeft, ChevronRight, Eye, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { CoachAttendanceManager } from "./CoachAttendanceManager";
import { format, addDays, subDays } from "date-fns";

type AttendanceStatus = "present" | "absent" | "pending";
type SessionStatus = "scheduled" | "completed" | "cancelled";

type UpdateAttendanceVariables = {
  recordId: string;
  status: AttendanceStatus;
};

const attendanceStatuses = ["present", "absent", "pending"] as const;

type AttendanceStatusLiteral = typeof attendanceStatuses[number];

const formatTime12Hour = (timeString: string) => {
  try {
    const [hours, minutes] = timeString.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  } catch (error) {
    console.error("Error formatting time:", error);
    return timeString;
  }
};

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
};

export function AttendanceManager() {
  const { role } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionIdFromUrl = searchParams.get('sessionId');

  if (role === 'coach') {
    return <CoachAttendanceManager />;
  }

  const [selectedSession, setSelectedSession] = useState<string | null>(sessionIdFromUrl);
  const [searchTerm, setSearchTerm] = useState("");
  const [sessionSearchTerm, setSessionSearchTerm] = useState("");
  const [filterPackageType, setFilterPackageType] = useState<"All" | "Camp Training" | "Personal Training">("All");
  const [filterSessionStatus, setFilterSessionStatus] = useState<"All" | SessionStatus>("All");
  const [branchFilter, setBranchFilter] = useState<string>("All");
  const [coachFilter, setCoachFilter] = useState<string>("All");
  const [sortOrder, setSortOrder] = useState<"Newest to Oldest" | "Oldest to Newest">("Newest to Oldest");
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (sessionIdFromUrl) {
      setSelectedSession(sessionIdFromUrl);
      setShowAttendanceModal(true);
    }
  }, [sessionIdFromUrl]);

  const { data: sessions } = useQuery<any[]>({
    queryKey: ["sessions"],
    queryFn: async () => {
      console.log("Fetching all sessions for admin");
      
      const today = new Date();
      const pastDate = subDays(today, 30);
      const futureDate = addDays(today, 30);
      
      const { data, error } = await supabase
        .from("training_sessions")
        .select(`
          id, 
          date, 
          start_time, 
          end_time, 
          status, 
          package_type, 
          branch_id, 
          coach_id, 
          branches (name), 
          coaches (name),
          session_participants (
            id,
            student_id,
            students (name)
          )
        `)
        .gte("date", format(pastDate, 'yyyy-MM-dd'))
        .lte("date", format(futureDate, 'yyyy-MM-dd'))
        .order("date", { ascending: false });
      
      if (error) {
        console.error("Error fetching sessions:", error);
        throw error;
      }
      
      console.log("Fetched sessions:", data);
      return data || [];
    },
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

  const { data: coaches } = useQuery({
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

  const { data: attendanceRecords } = useQuery<any[]>({
    queryKey: ["attendance", selectedSession],
    queryFn: async () => {
      if (!selectedSession) return [];
      console.log("Fetching attendance for session:", selectedSession);
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, session_id, student_id, status, marked_at, students (name)")
        .eq("session_id", selectedSession)
        .order("created_at", { ascending: true });
      
      if (error) {
        console.error("Error fetching attendance:", error);
        throw error;
      }
      
      console.log("Fetched attendance records:", data);
      return data || [];
    },
    enabled: !!selectedSession,
  });

  const selectedSessionDetails = sessions?.find((s) => s.id === selectedSession);

  const updateAttendance = useMutation<void, unknown, UpdateAttendanceVariables>({
    mutationFn: async ({ recordId, status }) => {
      console.log("Updating attendance:", recordId, status);
      const { error } = await supabase
        .from("attendance_records")
        .update({ status, marked_at: status !== "pending" ? new Date().toISOString() : null })
        .eq("id", recordId);
      if (error) {
        console.error("Error updating attendance:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Attendance updated");
      queryClient.invalidateQueries({ queryKey: ["attendance", selectedSession] });
    },
    onError: (error) => {
      console.error("Attendance update failed:", error);
      toast.error("Failed to update attendance");
    },
  });

  const filteredSessions = sessions
    ?.filter((session) =>
      (session.coaches.name.toLowerCase().includes(sessionSearchTerm.toLowerCase()) ||
       session.branches.name.toLowerCase().includes(sessionSearchTerm.toLowerCase())) &&
      (filterPackageType === "All" || session.package_type === filterPackageType) &&
      (filterSessionStatus === "All" || session.status === filterSessionStatus) &&
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

  const filteredAttendanceRecords = attendanceRecords?.filter((record) =>
    record.students.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const presentCount = filteredAttendanceRecords.filter((r) => r.status === "present").length;
  const absentCount = filteredAttendanceRecords.filter((r) => r.status === "absent").length;
  const pendingCount = filteredAttendanceRecords.filter((r) => r.status === "pending").length;

  const handleAttendanceChange = (recordId: string, status: AttendanceStatusLiteral) => {
    updateAttendance.mutate({ recordId, status });
  };

  const getAttendanceIcon = (status: AttendanceStatusLiteral) => {
    switch (status) {
      case "present": return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "absent": return <XCircle className="w-4 h-4 text-red-600" />;
      case "pending": return <Clock className="w-4 h-4 text-amber-600" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getAttendanceBadgeColor = (status: AttendanceStatusLiteral) => {
    switch (status) {
      case "present": return "bg-green-50 text-green-700 border-green-200";
      case "absent": return "bg-red-50 text-red-700 border-red-200";
      case "pending": return "bg-amber-50 text-amber-700 border-amber-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'completed': return 'bg-green-50 text-green-700 border-green-200';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const handleView = (session: any) => {
    setSelectedSession(session.id);
    setShowViewModal(true);
  };

  if (!sessions) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-7xl mx-auto text-center py-16">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-black mb-3">Loading attendance...</h3>
          <p className="text-lg text-gray-600">Please wait while we fetch the session data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-4 p-6">
      <div className="max-w-7xl mx-auto space-y-8 -mt-5">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#181818] mb-2 tracking-tight">Attendance Manager</h1>
          <p className="text-lg text-gray-700">Track and manage player attendance for training sessions</p>
        </div>

        <Card className="border-2 border-black bg-white shadow-xl">
          <CardHeader className="border-b border-[#181A18] bg-[#181A18]">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div>
                <CardTitle className="text-2xl font-bold text-[#efeff1] flex items-center">
                  <Calendar className="h-6 w-6 mr-3 text-accent" style={{ color: '#BEA877' }} />
                  Training Sessions
                </CardTitle>
                <CardDescription className="text-gray-400 text-base">
                  Select a training session to manage player attendance
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <Filter className="h-5 w-5 text-accent mr-2" style={{ color: '#BEA877' }} />
                <h3 className="text-lg font-semibold text-foreground">Filter Sessions</h3>
              </div>
              <div className="flex flex-col space-y-4 lg:flex-row lg:items-end lg:gap-4 lg:space-y-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by coach or branch..."
                    className="pl-10 pr-4 py-3 w-full border-2 border-accent rounded-xl text-sm focus:border-accent focus:ring-accent/20 bg-white"
                    value={sessionSearchTerm}
                    onChange={(e) => setSessionSearchTerm(e.target.value)}
                    style={{ borderColor: '#BEA877' }}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="filter-package" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <Users className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                    Package Type
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
                    <MapPin className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                    Branch
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
                    <User className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                    Coach
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
                  <Label htmlFor="filter-status" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                    Session Status
                  </Label>
                  <Select
                    value={filterSessionStatus}
                    onValueChange={(value: "All" | SessionStatus) => setFilterSessionStatus(value)}
                  >
                    <SelectTrigger className="border-2 focus:border-accent rounded-xl" style={{ borderColor: '#BEA877' }}>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Statuses</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="sort-order" className="flex items-center text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
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
                  {sessionSearchTerm || filterPackageType !== "All" || filterSessionStatus !== "All" || branchFilter !== "All" || coachFilter !== "All" 
                    ? `No sessions found` 
                    : "No Training Sessions"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {sessionSearchTerm || filterPackageType !== "All" || filterSessionStatus !== "All" || branchFilter !== "All" || coachFilter !== "All" 
                    ? "Try adjusting your search or filter." 
                    : "No sessions available to manage attendance."}
                </p>
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
                            <Calendar className="w-5 h-5 text-accent" style={{ color: '#BEA877' }} />
                            <h3 className="font-bold text-lg text-gray-900">
                              {formatDate(session.date)}
                            </h3>
                          </div>
                          <Badge className={`font-medium ${getStatusBadgeColor(session.status)}`}>
                            {session.status}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2 text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
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
                              onClick={() => {
                                setSelectedSession(session.id);
                                setShowAttendanceModal(true);
                              }}
                              className="bg-yellow-600 text-white"
                            >
                              <Pencil className="w-4 h-4" /> Edit
                            </Button>
                          </div>
                        </div>
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
                      <ChevronRight className="w-4 h-4 " />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
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
                      Date: {selectedSessionDetails ? formatDate(selectedSessionDetails.date) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Time: {selectedSessionDetails 
                        ? `${formatTime12Hour(selectedSessionDetails.start_time)} - ${formatTime12Hour(selectedSessionDetails.end_time)}` 
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Branch: {selectedSessionDetails?.branches.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Coach: {selectedSessionDetails?.coaches.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Package: {selectedSessionDetails?.package_type || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Players: {selectedSessionDetails?.session_participants?.length || 0}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Participants</Label>
                <div className="border-2 rounded-lg p-3 max-h-60 overflow-y-auto" style={{ borderColor: '#BEA877', backgroundColor: '#faf0e8' }}>
                  {selectedSessionDetails?.session_participants?.length === 0 ? (
                    <p className="text-sm text-gray-600">No participants assigned.</p>
                  ) : (
                    selectedSessionDetails?.session_participants?.map(participant => (
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
                  onClick={() => setShowViewModal(false)}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAttendanceModal} onOpenChange={setShowAttendanceModal}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gray-900">
                Manage Attendance
                {selectedSessionDetails && (
                  <span className="text-base font-normal ml-2">
                    - {formatDate(selectedSessionDetails.date)} at {formatTime12Hour(selectedSessionDetails.start_time)}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                Update attendance for players in this training session
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-700 mb-1">
                  <span className="font-medium">Coach:</span> {selectedSessionDetails?.coaches.name || 'N/A'}
                </p>
                <p className="text-sm text-gray-700 mb-1">
                  <span className="font-medium">Branch:</span> {selectedSessionDetails?.branches.name || 'N/A'}
                </p>
                <p className="text-sm text-gray-700 mb-1">
                  <span className="font-medium">Package Type:</span> {selectedSessionDetails?.package_type || 'N/A'}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Status:</span>{' '}
                  <Badge className={getStatusBadgeColor(selectedSessionDetails?.status || '')}>
                    {selectedSessionDetails?.status || 'N/A'}
                  </Badge>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="search" className="flex items-center text-sm font-medium text-gray-700">
                  <Search className="w-4 h-4 mr-2 text-accent" style={{ color: '#BEA877' }} />
                  Search Players
                </Label>
                <Input
                  id="search"
                  placeholder="Search by player name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-2 focus:border-accent rounded-lg"
                  style={{ borderColor: '#BEA877' }}
                />
              </div>
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Present: {presentCount}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-gray-700">Absent: {absentCount}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-gray-700">Pending: {pendingCount}</span>
                </div>
              </div>
              <div className="border-2 rounded-lg p-4 max-h-96 overflow-y-auto" style={{ borderColor: '#BEA877', backgroundColor: '#faf0e8' }}>
                {filteredAttendanceRecords.length === 0 ? (
                  <p className="text-center text-gray-600 py-4">
                    {searchTerm ? "No players found." : "No players registered for this session."}
                  </p>
                ) : (
                  filteredAttendanceRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-700">{record.students.name}</span>
                        <Badge className={`font-medium ${getAttendanceBadgeColor(record.status)}`}>
                          {getAttendanceIcon(record.status)}
                          <span className="ml-1 capitalize">{record.status}</span>
                        </Badge>
                      </div>
                      <Select
                        value={record.status}
                        onValueChange={(value: AttendanceStatusLiteral) => handleAttendanceChange(record.id, value)}
                      >
                        <SelectTrigger className="w-40 border-2 focus:border-accent rounded-lg" style={{ borderColor: '#BEA877' }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {attendanceStatuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              <div className="flex items-center space-x-2">
                                {getAttendanceIcon(status)}
                                <span className="capitalize">{status}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAttendanceModal(false);
                    setSearchTerm("");
                    if (sessionIdFromUrl) {
                      setSelectedSession(null);
                    }
                  }}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowAttendanceModal(false);
                    setSearchTerm("");
                    if (sessionIdFromUrl) {
                      setSelectedSession(null);
                    }
                  }}
                  className="font-semibold"
                  style={{ backgroundColor: '#BEA877', color: 'white' }}
                >
                  Save and Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}