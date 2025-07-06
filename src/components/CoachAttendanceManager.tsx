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
import { TimeTrackingButtons } from "./TimeTrackingButtons";
import { SessionTimeDetails } from "./SessionTimeDetails";

type AttendanceStatus = "present" | "absent" | "pending";
type SessionStatus = "scheduled" | "completed" | "cancelled" | "all";

const attendanceStatuses = ["present", "absent", "pending"] as const;
type AttendanceStatusLiteral = typeof attendanceStatuses[number];

type TrainingSession = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  branch_id: string;
  status: SessionStatus;
  package_type: "Camp Training" | "Personal Training" | null;
  branches: { name: string };
  session_participants: Array<{ students: { name: string } }>;
};

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

export function CoachAttendanceManager() {
  const { sessionId } = useParams();
  const [selectedSession, setSelectedSession] = useState<string | null>(sessionId || null);
  const [selectedSessionModal, setSelectedSessionModal] = useState<TrainingSession | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(!!sessionId);
  const [searchTerm, setSearchTerm] = useState("");
  const [sessionSearchTerm, setSessionSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<SessionStatus>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [packageFilter, setPackageFilter] = useState<"All" | "Camp Training" | "Personal Training">("All");
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "scheduled": return "scheduled";
      case "completed": return "completed"; 
      case "cancelled": return "cancelled";
      default: return "default";
    }
  };

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
      if (error) {
        console.error("Error fetching branches:", error);
        throw error;
      }
      console.log("Fetched branches:", data);
      return data;
    }
  });

  const { data: sessions } = useQuery<TrainingSession[]>({
    queryKey: ["coach-sessions", coachId, branchFilter, packageFilter, statusFilter, sessionSearchTerm],
    queryFn: async () => {
      if (!coachId) return [];
      console.log("Fetching sessions for coach:", coachId);
      
      // Fetch session IDs from session_coaches
      const coachSessionsRes = await supabase
        .from('session_coaches')
        .select('session_id')
        .eq('coach_id', coachId);

      if (coachSessionsRes.error) {
        console.error("Error fetching coach sessions:", coachSessionsRes.error);
        throw coachSessionsRes.error;
      }

      const sessionIds = coachSessionsRes.data?.map(s => s.session_id) || [];
      console.log("Session IDs from session_coaches:", sessionIds);

      const today = new Date();
      const pastDate = subDays(today, 30);
      const futureDate = addDays(today, 30);
      
      let query = supabase
        .from("training_sessions")
        .select(`
          id, date, start_time, end_time, branch_id, status, package_type,
          branches (name),
          session_participants (students (name))
        `)
        .in("id", sessionIds)
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
      // Map package_type to the correct union type
      return (data || []).map((session: any) => ({
        ...session,
        package_type: session.package_type === "Camp Training"
          ? "Camp Training"
          : session.package_type === "Personal Training"
          ? "Personal Training"
          : null,
      })) as TrainingSession[];
    },
    enabled: !!coachId,
  });

  const { data: sessionCoaches } = useQuery({
    queryKey: ["session-coaches", selectedSession],
    queryFn: async () => {
      if (!selectedSession) return [];
      console.log("Fetching coaches for session:", selectedSession);
      const { data, error } = await supabase
        .from("session_coaches")
        .select("coach_id, coaches (name)")
        .eq("session_id", selectedSession);
      
      if (error) {
        console.error("Error fetching session coaches:", error);
        throw error;
      }
      
      console.log("Fetched session coaches:", data);
      return data || [];
    },
    enabled: !!selectedSession,
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

  const handleSessionCardClick = (session: TrainingSession) => {
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
    <div className="min-h-screen bg-background p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header with Back Button */}
        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#181A18] tracking-tight">
              Attendance Management
            </h1>
            <p className="text-sm sm:text-base text-gray-700">
              Track and manage player attendance for your training sessions
            </p>
          </div>
        </div>

        {/* Session Selection Card - Only show if no sessionId from URL */}
        {!sessionId && (
          <Card className="border-2 border-[#181A18] bg-white/90 backdrop-blur-sm shadow-lg">
            <CardHeader className="border-b border-[#181A18] bg-[#181A18] p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-[#efeff1] flex items-center">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 mr-2 sm:mr-3 text-accent" style={{ color: '#BEA877' }} />
                Your Training Sessions
              </CardTitle>
              <CardDescription className="text-gray-400 text-sm sm:text-base">
                Select a training session to manage player attendance
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 lg:p-8">
              <div className="mb-6 space-y-4 sm:space-y-6">
                <div className="flex items-center mb-4">
                  <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-accent mr-2" style={{ color: '#BEA877' }} />
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-foreground">Filter Sessions</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Branch</label>
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                      <SelectTrigger className="border-accent focus:border-accent focus:ring-accent/20 text-xs sm:text-sm h-8 sm:h-10" style={{ borderColor: '#BEA877' }}>
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
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Package Type</label>
                    <Select
                      value={packageFilter}
                      onValueChange={(value: "All" | "Camp Training" | "Personal Training") => setPackageFilter(value)}
                    >
                      <SelectTrigger className="border-accent focus:border-accent focus:ring-accent/20 text-xs sm:text-sm h-8 sm:h-10" style={{ borderColor: '#BEA877' }}>
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
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Status</label>
                    <Select value={statusFilter} onValueChange={(value: SessionStatus) => setStatusFilter(value)}>
                      <SelectTrigger className="border-accent focus:border-accent focus:ring-accent/20 text-xs sm:text-sm h-8 sm:h-10" style={{ borderColor: '#BEA877' }}>
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
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by branch..."
                    className="pl-8 sm:pl-10 pr-4 py-2 sm:py-3 w-full border-2 border-accent/40 rounded-xl text-xs sm:text-sm focus:border-accent focus:ring-accent/20 bg-white"
                    value={sessionSearchTerm}
                    onChange={(e) => setSessionSearchTerm(e.target.value)}
                    style={{ borderColor: '#BEA877' }}
                  />
                </div>
                <p className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredSessions.length} session{filteredSessions.length === 1 ? '' : 's'}
                </p>
              </div>

              <div className="grid gap-3 sm:gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSessions.map((session) => (
                  <Card
                    key={session.id}
                    className={`cursor-pointer border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg ${
                      selectedSession === session.id
                        ? "border-accent bg-accent/10 shadow-lg scale-105"
                        : "border-accent/20 bg-white hover:border-accent/50"
                    }`}
                    onClick={() => handleSessionCardClick(session)}
                    style={{ borderColor: '#BEA877' }}
                  >
                    <CardContent className="p-3 sm:p-4 lg:p-5 space-y-2 sm:space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-accent" style={{ color: '#BEA877' }} />
                          <span className="font-semibold text-black text-xs sm:text-sm">
                            {format(new Date(session.date + 'T00:00:00'), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <Badge variant={getStatusVariant(session.status)} className="text-xs font-medium">
                          {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-xs sm:text-sm">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                          <span className="text-gray-700 font-medium">
                            {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                          <span className="text-gray-700 truncate">{session.branches.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="w-3 h-3 sm:w-4 sm:h-4 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                          <span className="text-gray-700 truncate">{session.package_type || 'N/A'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="w-3 h-3 sm:w-4 sm:h-4 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                          <span className="text-gray-700 truncate">Players: {session.session_participants?.length || 0}</span>
                        </div>

                        {/* Add Time Tracking Buttons for each session card */}
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <TimeTrackingButtons sessionId={session.id} isAdmin={role === 'admin'} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredSessions.length === 0 && (
                <div className="py-8 sm:py-12 text-center">
                  <Calendar className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                    {sessionSearchTerm || statusFilter !== "all" || branchFilter !== "all" || packageFilter !== "All" ? "No sessions found" : "No sessions"}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600">
                    {sessionSearchTerm || statusFilter !== "all" || branchFilter !== "all" || packageFilter !== "All" ? "Try adjusting your search terms or filters." : "No scheduled sessions available."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Session Details Modal */}
        <Dialog open={!!selectedSessionModal} onOpenChange={() => setSelectedSessionModal(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg lg:max-w-2xl border-2 border-foreground bg-gradient-to-br from-[#faf0e8]/30 to-white shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground flex items-center">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 mr-2 sm:mr-3 text-accent" style={{ color: '#BEA877' }} />
                Session Details
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-sm sm:text-base">
                {selectedSessionModal ? formatDate(selectedSessionModal.date) : ''}
              </DialogDescription>
            </DialogHeader>
            {selectedSessionModal && (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Time</p>
                      <p className="font-semibold text-black text-sm sm:text-base">
                        {formatTime12Hour(selectedSessionModal.start_time)} - {formatTime12Hour(selectedSessionModal.end_time)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Branch</p>
                      <p className="font-semibold text-black text-sm sm:text-base">{selectedSessionModal.branches.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Package Type</p>
                      <p className="font-semibold text-black text-sm sm:text-base">{selectedSessionModal.package_type || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Players</p>
                      <p className="font-semibold text-black text-sm sm:text-base">{selectedSessionModal.session_participants?.length || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge variant={getStatusVariant(selectedSessionModal.status)} className="font-medium px-2 sm:px-3 py-1 text-xs sm:text-sm">
                      {selectedSessionModal.status.charAt(0).toUpperCase() + selectedSessionModal.status.slice(1)}
                    </Badge>
                  </div>
                </div>

                {/* Add Session Time Details */}
                <div className="border-t pt-4">
                  <SessionTimeDetails sessionId={selectedSessionModal.id} />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => handleManageAttendance(selectedSessionModal.id)}
                    className="bg-accent hover:bg-accent/90 text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg text-sm sm:text-base px-4 sm:px-6"
                    style={{ backgroundColor: '#BEA877' }}
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
          <DialogContent className="max-w-[95vw] sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] border-2 border-[#181A18] bg-white shadow-lg p-3 sm:p-4 lg:p-6">
            <div className="flex-1 overflow-y-auto">
              <DialogHeader className="pb-4 border-b border-gray-200 space-y-2 sm:space-y-3">
                <DialogTitle className="text-base sm:text-lg lg:text-xl font-bold text-[#181A18] flex items-center flex-wrap gap-2">
                  <span>Manage Attendance</span>
                  {selectedSessionDetails && (
                    <span className="text-xs sm:text-sm font-normal text-gray-500">
                      - {format(new Date(selectedSessionDetails.date + 'T00:00:00'), 'EEE, MMM dd, yyyy')} at {formatTime12Hour(selectedSessionDetails.start_time)}
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-gray-600 text-left text-xs sm:text-sm">
                  Update attendance for players in this training session
                </DialogDescription>

                {/* Session Details */}
                <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3 text-xs sm:text-sm lg:text-base">
                  <div className="flex flex-row gap-4 sm:gap-6">
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="font-medium text-gray-600">Coaches:</span>
                      <span className="text-black truncate">
                        {sessionCoaches?.map(c => c.coaches.name).join(', ') || 'N/A'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="font-medium text-gray-600">Branch:</span>
                      <span className="text-black truncate">{selectedSessionDetails?.branches?.name || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex flex-row gap-4 sm:gap-6">
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="font-medium text-gray-600">Package:</span>
                      <span className="text-black truncate">{selectedSessionDetails?.package_type || 'N/A'}</span>
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="font-medium text-gray-600">Status:</span>
                      <Badge variant={getStatusVariant(selectedSessionDetails?.status || '')} className="text-xs sm:text-sm">
                        {selectedSessionDetails?.status ? selectedSessionDetails.status.charAt(0).toUpperCase() + selectedSessionDetails.status.slice(1) : 'N/A'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-row gap-4 sm:gap-6">
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="font-medium text-gray-600">Players:</span>
                      <span className="text-black truncate">{selectedSessionDetails?.session_participants?.length || 0}</span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* Add Time Tracking Section */}
              {selectedSession && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 lg:p-6 bg-gray-50 rounded-lg">
                  <h3 className="text-sm sm:text-base font-semibold text-[#181A18] mb-3">Time Tracking</h3>
                  <TimeTrackingButtons sessionId={selectedSession} isAdmin={role === 'admin'} />
                </div>
              )}

              {/* Search Players */}
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 lg:p-6">
                <div className="flex items-center mb-3">
                  <Search className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 mr-2" />
                  <h3 className="text-sm sm:text-base font-semibold text-[#181A18]">Search Players</h3>
                </div>
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by player name..."
                    className="pl-8 sm:pl-10 pr-4 py-2 w-full border-2 border-accent/40 rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-1 focus:ring-accent bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ borderColor: '#BEA877' }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 p-3 sm:p-4 lg:p-6">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                  <span className="text-gray-700">Present: <strong>{presentCount}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
                  <span className="text-gray-700">Absent: <strong>{absentCount}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600" />
                  <span className="text-gray-700">Pending: <strong>{pendingCount}</strong></span>
                </div>
              </div>

              {/* Players List */}
              <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 lg:p-6">
                {filteredAttendanceRecords.map((record) => (
                  <div 
                    key={record.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 gap-2 sm:gap-3"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-xs sm:text-sm flex-shrink-0" style={{ backgroundColor: '#BEA877' }}>
                        {record.students.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-black text-xs sm:text-sm lg:text-base block truncate">{record.students.name}</span>
                        <div className="flex items-center space-x-2 mt-1">
                          {getAttendanceIcon(record.status)}
                          <Badge className={`${getAttendanceBadgeColor(record.status)} text-xs sm:text-sm capitalize`}>
                            {record.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-row items-center space-x-2 justify-end sm:justify-start">
                      <Select
                        value={record.status}
                        onValueChange={(value: AttendanceStatusLiteral) => handleAttendanceChange(record.id, value)}
                      >
                        <SelectTrigger className="w-24 sm:w-28 lg:w-32 h-7 sm:h-8 lg:h-9 text-xs sm:text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600" />
                              <span className="text-xs sm:text-sm">Pending</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="present">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                              <span className="text-xs sm:text-sm">Present</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="absent">
                            <div className="flex items-center gap-2">
                              <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
                              <span className="text-xs sm:text-sm">Absent</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredAttendanceRecords.length === 0 && (
                <div className="py-8 sm:py-12 text-center p-3 sm:p-4 lg:p-6">
                  <Users className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                    {searchTerm ? 'No players found' : 'No attendance records'}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600">
                    {searchTerm 
                      ? 'Try adjusting your search terms.' 
                      : 'No attendance records found for this session.'
                    }
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-gray-200 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 flex flex-row justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAttendanceModal(false)}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 min-w-fit w-auto px-2 sm:px-3 text-xs sm:text-sm"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    toast.success("Attendance saved successfully!");
                    setShowAttendanceModal(false);
                  }}
                  className="bg-accent hover:bg-accent/90 text-white min-w-fit w-auto px-2 sm:px-3 text-xs sm:text-sm"
                  style={{ backgroundColor: '#BEA877' }}
                >
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {!selectedSession && !sessionId && (
          <div className="text-center py-8 sm:py-16">
            <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-24 lg:h-24 rounded-full bg-accent flex items-center justify-center mx-auto mb-4 sm:mb-6" style={{ backgroundColor: '#BEA877' }}>
              <Calendar className="w-6 h-6 sm:w-8 sm:h-8 lg:w-12 lg:h-12 text-white" />
            </div>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-[#181A18] mb-2 sm:mb-3">Select a Training Session</h3>
            <p className="text-sm sm:text-base lg:text-lg text-gray-600">Choose a session from above to start managing attendance.</p>
          </div>
        )}
      </div>
    </div>
  );
}
