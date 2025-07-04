import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Clock, Calendar, MapPin, Users, Filter, Search, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { format, parseISO, addDays, subDays } from "date-fns";

type AttendanceStatus = "present" | "absent" | "pending";
type SessionStatus = "scheduled" | "completed" | "cancelled" | "all";

const attendanceStatuses = ["present", "absent", "pending"] as const;
type AttendanceStatusLiteral = typeof attendanceStatuses[number];

const formatTime12Hour = (timeString: string) => {
  const [hours, minutes] = timeString.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

const formatDate = (dateString: string) => {
  try {
    console.log("Formatting date:", dateString);
    const date = new Date(dateString + 'T00:00:00');
    const formattedDate = format(date, 'EEEE, MMMM dd, yyyy');
    console.log("Formatted date result:", formattedDate);
    return formattedDate;
  } catch (error) {
    console.error("Error formatting date:", error, "Input:", dateString);
    return dateString;
  }
};

const formatDateTime = (dateString: string) => {
  try {
    const date = parseISO(dateString);
    return format(date, 'MMM dd, h:mm a');
  } catch (error) {
    console.error("Error formatting datetime:", error, "Input:", dateString);
    return new Date(dateString).toLocaleDateString();
  }
};

export function CoachAttendanceManager() {
  const { sessionId } = useParams();
  const [selectedSession, setSelectedSession] = useState<string | null>(sessionId || null);
  const [selectedSessionModal, setSelectedSessionModal] = useState<any | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(!!sessionId);
  const [searchTerm, setSearchTerm] = useState("");
  const [sessionSearchTerm, setSessionSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<SessionStatus>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [packageFilter, setPackageFilter] = useState<"All" | "Camp Training" | "Personal Training">("All");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: coachId } = useQuery({
    queryKey: ["coach-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      console.log("Fetching coach ID for user:", user.email);
      const { data: coach, error } = await supabase
        .from("coaches")
        .select("id")
        .eq("auth_id", user.id)
        .single();
      
      if (error) {
        console.error("Error fetching coach ID:", error);
        return null;
      }
      console.log("Found coach ID:", coach?.id);
      return coach?.id;
    },
    enabled: !!user?.id,
  });

  const { data: branches } = useQuery({
    queryKey: ['branches-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: sessions } = useQuery<any[]>({
    queryKey: ["coach-sessions", coachId, branchFilter, packageFilter, statusFilter, sessionSearchTerm],
    queryFn: async () => {
      if (!coachId) return [];
      console.log("Fetching sessions for coach:", coachId);
      
      const today = new Date();
      const pastDate = subDays(today, 30);
      const futureDate = addDays(today, 30);
      
      let query = supabase
        .from("training_sessions")
        .select("id, date, start_time, end_time, status, package_type, branches (name), coaches (name)")
        .eq("coach_id", coachId)
        .gte("date", format(pastDate, 'yyyy-MM-dd'))
        .lte("date", format(futureDate, 'yyyy-MM-dd'));

      if (branchFilter !== "all") {
        query = query.eq('branch_id', branchFilter);
      }
      if (packageFilter !== "All") {
        query = query.eq('package_type', packageFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query.order("date", { ascending: false });
      
      if (error) {
        console.error("Error fetching sessions:", error);
        throw error;
      }
      
      console.log("Fetched sessions:", data);
      return data || [];
    },
    enabled: !!coachId,
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

  const updateAttendance = useMutation({
    mutationFn: async ({ recordId, status }: { recordId: string; status: AttendanceStatus }) => {
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

  const selectedSessionDetails = sessions?.find((s) => s.id === selectedSession);

  const filteredSessions = sessions
    ?.filter((session) => {
      const matchesSearch = session.branches.name.toLowerCase().includes(sessionSearchTerm.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    }) || [];

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
      case "scheduled": return "bg-accent text-accent border-accent";
      case "completed": return "bg-green-100 text-green-700 border-green-200";
      case "cancelled": return "bg-red-100 text-red-700 border-red-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const handleSessionCardClick = (session: any) => {
    setSelectedSessionModal(session);
  };

  const handleBackToCalendar = () => {
    navigate('/dashboard/calendar');
  };

  const handleManageAttendance = (sessionId: string) => {
    setSelectedSession(sessionId);
    setShowAttendanceModal(true);
    setSelectedSessionModal(null);
  };

  return (
    <div className="min-h-screen bg-background pt-4 p-6">
      <div className="max-w-7xl mx-auto space-y-8 -mt-5">
        {/* Header with Back Button */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              onClick={handleBackToCalendar}
              variant="outline"
              className="border-[#8e7a3f] text-[#8e7a3f] hover:bg-[#8e7a3f] hover:text-white transition-all duration-300"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Calendar
            </Button>
          </div>
          <h1 className="text-4xl font-bold text-[#181A18] mb-2 tracking-tight">
            Attendance Management
          </h1>
          <p className="text-lg text-gray-700">
            Track and manage player attendance for your training sessions
          </p>
        </div>

        {/* Session Selection Card - Only show if no sessionId from URL */}
        {!sessionId && (
          <Card className="border-2 border-[#181A18] bg-white/90 backdrop-blur-sm shadow-xl">
            <CardHeader className="border-b border-[#181A18] bg-[#181A18]">
              <CardTitle className="text-2xl font-bold text-[#efeff1] flex items-center">
                <Calendar className="h-6 w-6 mr-3 text-accent" style={{ color: 'accent' }} />
                Your Training Sessions
              </CardTitle>
              <CardDescription className="text-gray-400 text-base">
                Select a training session to manage player attendance
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="mb-8">
                <div className="flex items-center mb-4">
                  <Filter className="h-5 w-5 text-accent mr-2" style={{ color: 'accent' }} />
                  <h3 className="text-lg font-semibold text-foreground">Filter Sessions</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Branch</label>
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                      <SelectTrigger className="border-accent focus:border-accent focus:ring-accent/20">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Branches</SelectItem>
                        {branches?.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Package Type</label>
                    <Select
                      value={packageFilter}
                      onValueChange={(value: "All" | "Camp Training" | "Personal Training") => setPackageFilter(value)}
                    >
                      <SelectTrigger className="border-accent focus:border-accent focus:ring-accent/20">
                        <SelectValue placeholder="Select package type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Sessions</SelectItem>
                        <SelectItem value="Camp Training">Camp Training</SelectItem>
                        <SelectItem value="Personal Training">Personal Training</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <Select value={statusFilter} onValueChange={(value: SessionStatus) => setStatusFilter(value)}>
                      <SelectTrigger className="border-accent focus:border-accent focus:ring-accent/20">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="relative max-w-md mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by branch..."
                    className="pl-10 pr-4 py-3 w-full border-2 border-accent/40 rounded-xl text-sm focus:border-accent focus:ring-accent/20 bg-white"
                    value={sessionSearchTerm}
                    onChange={(e) => setSessionSearchTerm(e.target.value)}
                    style={{ borderColor: 'accent' }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  Showing {filteredSessions.length} session{filteredSessions.length === 1 ? '' : 's'}
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredSessions.map((session) => (
                  <Card
                    key={session.id}
                    className={`cursor-pointer border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg ${
                      selectedSession === session.id
                        ? "border-accent bg-accent/10 shadow-lg scale-105"
                        : "border-accent/20 bg-white hover:border-accent/50"
                    }`}
                    onClick={() => handleSessionCardClick(session)}
                    style={{ borderColor: 'accent' }}
                  >
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-accent" style={{ color: 'accent' }} />
                          <span className="font-semibold text-black text-sm">
                            {format(new Date(session.date + 'T00:00:00'), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <Badge className={`${getStatusBadgeColor(session.status)} border text-xs px-2 py-1`}>
                          {session.status}
                        </Badge>
                      </div>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-accent" style={{ color: 'accent' }} />
                          <span className="text-gray-700 font-medium">
                            {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-accent" style={{ color: 'accent' }} />
                          <span className="text-gray-700">{session.branches.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-accent" style={{ color: 'accent' }} />
                          <span className="text-gray-700">{session.package_type || 'N/A'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredSessions.length === 0 && (
                <div className="py-12 text-center">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {sessionSearchTerm || statusFilter !== "all" || branchFilter !== "all" || packageFilter !== "All" ? "No sessions found" : "No sessions"}
                  </h3>
                  <p className="text-gray-600">
                    {sessionSearchTerm || statusFilter !== "all" || branchFilter !== "all" || packageFilter !== "All" ? "Try adjusting your search terms or filters." : "No scheduled sessions available."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Session Details Modal */}
        <Dialog open={!!selectedSessionModal} onOpenChange={() => setSelectedSessionModal(null)}>
          <DialogContent className="max-w-2xl border-2 border-foreground bg-gradient-to-br from-[#faf0e8]/30 to-white shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-foreground flex items-center">
                <Calendar className="h-6 w-6 mr-3 text-accent" style={{ color: 'accent' }} />
                Session Details
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-base">
                {selectedSessionModal ? formatDate(selectedSessionModal.date) : ''}
              </DialogDescription>
            </DialogHeader>
            {selectedSessionModal && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-accent" style={{ color: 'accent' }} />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Time</p>
                      <p className="font-semibold text-black">
                        {formatTime12Hour(selectedSessionModal.start_time)} - {formatTime12Hour(selectedSessionModal.end_time)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-accent" style={{ color: 'accent' }} />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Branch</p>
                      <p className="font-semibold text-black">{selectedSessionModal.branches.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Users className="h-5 w-5 text-accent" style={{ color: 'accent' }} />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Package Type</p>
                      <p className="font-semibold text-black">{selectedSessionModal.package_type || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge className={`${getStatusBadgeColor(selectedSessionModal.status)} border font-medium px-3 py-1`}>
                      {selectedSessionModal.status.charAt(0).toUpperCase() + selectedSessionModal.status.slice(1)}
                    </Badge>
                  </div>
                </div>
                <div className="flex justify-end">
  <Button
    onClick={() => handleManageAttendance(selectedSessionModal.id)}
    className="bg-accent hover:from-[#fe822d] hover:to-accent text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg"
    style={{ backgroundColor: 'accent' }}
  >
    Manage Attendance
  </Button>
</div>

              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Attendance Management Modal */}
        <Dialog open={showAttendanceModal} onOpenChange={() => setShowAttendanceModal(false)}>
          <DialogContent className="max-w-6xl max-h-[80vh] border-2 border-foreground bg-gradient-to-br from-[#faf0e8]/30 to-white shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-foreground flex items-center">
                <Users className="h-6 w-6 mr-3 text-accent" style={{ color: 'accent' }} />
                Attendance Management
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-base">
                {selectedSessionDetails ? `${formatDate(selectedSessionDetails.date)} • ${selectedSessionDetails.branches.name}` : 'Manage player attendance for this session'}
              </DialogDescription>
            </DialogHeader>
            <div className="p-6">
              {/* Stats */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6 mb-6">
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-gray-700 font-medium">Present: {presentCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-gray-700 font-medium">Absent: {absentCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    <span className="text-gray-700 font-medium">Pending: {pendingCount}</span>
                  </div>
                </div>
              </div>

              {/* Search for Attendance Records */}
              <div className="mb-6">
                <div className="flex items-center mb-4">
                  <Filter className="h-5 w-5 text-accent mr-2" style={{ color: 'accent' }} />
                  <h3 className="text-lg font-semibold text-foreground">Filter Players</h3>
                </div>
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search players..."
                    className="pl-10 pr-4 py-3 w-full border-2 border-accent/40 rounded-xl text-sm focus:border-accent focus:ring-accent/20 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ borderColor: 'accent' }}
                  />
                </div>
              </div>

              {/* Attendance Table */}
              <div className="border-2 border-foreground rounded-2xl bg-white shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-foreground text-white">
                      <tr>
                        <th className="py-4 px-6 text-left font-semibold text-base">Player Name</th>
                        <th className="py-4 px-6 text-left font-semibold text-base">Status</th>
                        <th className="py-4 px-6 text-left font-semibold text-base">Marked At</th>
                        <th className="py-4 px-6 text-left font-semibold text-base">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendanceRecords.map((record, index) => (
                        <tr 
                          key={record.id} 
                          className={`transition-all duration-300 hover:bg-accent/5 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          }`}
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-sm" style={{ backgroundColor: 'accent' }}>
                                {record.students.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </div>
                              <span className="font-semibold text-black text-base">{record.students.name}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-2">
                              {getAttendanceIcon(record.status)}
                              <Badge className={`${getAttendanceBadgeColor(record.status)} border capitalize font-medium text-sm`}>
                                {record.status}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-600 text-sm">
                            {record.marked_at ? (
                              <span className="font-medium">{formatDateTime(record.marked_at)}</span>
                            ) : (
                              <span className="italic text-gray-400">Not marked</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-row items-center space-x-2">
                              {attendanceStatuses.map((status) => (
                                <Button
                                  key={status}
                                  size="sm"
                                  variant={record.status === status ? "default" : "outline"}
                                  onClick={() => handleAttendanceChange(record.id, status)}
                                  className={`transition-all duration-300 hover:scale-105 text-sm ${
                                    record.status === status
                                      ? status === "present"
                                        ? "bg-green-600 hover:bg-green-700 text-white"
                                        : status === "absent"
                                        ? "bg-red-600 hover:bg-red-700 text-white"
                                        : "bg-amber-600 hover:bg-amber-700 text-white"
                                      : "border-accent/30 text-accent hover:bg-accent hover:text-white"
                                  }`}
                                  style={{ borderColor: 'accent', color: record.status === status ? undefined : 'accent' }}
                                >
                                  {getAttendanceIcon(status)}
                                  <span className="ml-1 capitalize hidden sm:inline">{status}</span>
                                </Button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {filteredAttendanceRecords.length === 0 && (
                  <div className="py-12 text-center">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {searchTerm ? 'No players found' : 'No attendance records'}
                    </h3>
                    <p className="text-gray-600 text-base">
                      {searchTerm 
                        ? 'Try adjusting your search terms.' 
                        : 'No attendance records found for this session.'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {!selectedSession && !sessionId && (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: 'accent' }}>
              <Calendar className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-[#181A18] mb-3">Select a Training Session</h3>
            <p className="text-lg text-gray-600">Choose a session from above to start managing attendance.</p>
          </div>
        )}
      </div>
    </div>
  );
}