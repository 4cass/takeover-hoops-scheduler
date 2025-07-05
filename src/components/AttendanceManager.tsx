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
          ),
          session_coaches (
            id,
            coach_id,
            coaches (name)
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
      
      // Group sessions by unique combination of date, start_time, end_time, branch_id, package_type
      const groupedSessions = new Map();
      
      data?.forEach(session => {
        const key = `${session.date}-${session.start_time}-${session.end_time}-${session.branch_id}-${session.package_type}`;
        
        if (groupedSessions.has(key)) {
          // Merge coaches and participants
          const existingSession = groupedSessions.get(key);
          
          // Add coaches from session_coaches
          if (session.session_coaches) {
            session.session_coaches.forEach(sc => {
              if (!existingSession.session_coaches.some(esc => esc.coach_id === sc.coach_id)) {
                existingSession.session_coaches.push(sc);
              }
            });
          }
          
          // Add main coach if not already included
          if (session.coach_id && session.coaches) {
            const mainCoachExists = existingSession.session_coaches.some(sc => sc.coach_id === session.coach_id);
            if (!mainCoachExists) {
              existingSession.session_coaches.push({
                id: `main-${session.coach_id}`,
                coach_id: session.coach_id,
                coaches: session.coaches
              });
            }
          }
          
          // Merge participants (avoid duplicates)
          if (session.session_participants) {
            session.session_participants.forEach(sp => {
              if (!existingSession.session_participants.some(esp => esp.student_id === sp.student_id)) {
                existingSession.session_participants.push(sp);
              }
            });
          }
        } else {
          // Initialize session_coaches array
          const sessionCoaches = [];
          
          // Add coaches from session_coaches relation
          if (session.session_coaches) {
            sessionCoaches.push(...session.session_coaches);
          }
          
          // Add main coach if not already included
          if (session.coach_id && session.coaches) {
            const mainCoachExists = sessionCoaches.some(sc => sc.coach_id === session.coach_id);
            if (!mainCoachExists) {
              sessionCoaches.push({
                id: `main-${session.coach_id}`,
                coach_id: session.coach_id,
                coaches: session.coaches
              });
            }
          }
          
          groupedSessions.set(key, {
            ...session,
            session_coaches: sessionCoaches,
            session_participants: session.session_participants || []
          });
        }
      });
      
      return Array.from(groupedSessions.values());
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
      
      // Get the selected session to find all related sessions (in case of multi-coach camps)
      const selectedSessionDetails = sessions?.find(s => s.id === selectedSession);
      if (!selectedSessionDetails) return [];
      
      // For camp training sessions, we need to get attendance from all sessions with the same time/date/branch
      let sessionIds = [selectedSession];
      
      if (selectedSessionDetails.package_type === 'Camp Training') {
        // Find all sessions with same date, time, branch, and package type
        const relatedSessions = sessions?.filter(s => 
          s.date === selectedSessionDetails.date &&
          s.start_time === selectedSessionDetails.start_time &&
          s.end_time === selectedSessionDetails.end_time &&
          s.branch_id === selectedSessionDetails.branch_id &&
          s.package_type === selectedSessionDetails.package_type
        ) || [];
        
        sessionIds = relatedSessions.map(s => s.id);
      }
      
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, session_id, student_id, status, marked_at, students (name)")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: true });
      
      if (error) {
        console.error("Error fetching attendance:", error);
        throw error;
      }
      
      console.log("Fetched attendance records:", data);
      
      // Remove duplicates by student_id (keep the first record for each student)
      const uniqueAttendance = [];
      const seenStudents = new Set();
      
      data?.forEach(record => {
        if (!seenStudents.has(record.student_id)) {
          seenStudents.add(record.student_id);
          uniqueAttendance.push(record);
        }
      });
      
      return uniqueAttendance;
    },
    enabled: !!selectedSession && !!sessions,
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
    ?.filter((session) => {
      // Get coach names for filtering
      const coachNames = [];
      if (session.session_coaches && Array.isArray(session.session_coaches)) {
        session.session_coaches.forEach(sc => {
          if (sc.coaches && sc.coaches.name) {
            coachNames.push(sc.coaches.name);
          }
        });
      }
      
      const allCoachNames = coachNames.join(' ').toLowerCase();
      const branchName = session.branches?.name?.toLowerCase() || '';
      
      const matchesSearch = allCoachNames.includes(sessionSearchTerm.toLowerCase()) ||
                           branchName.includes(sessionSearchTerm.toLowerCase());
      const matchesPackage = filterPackageType === "All" || session.package_type === filterPackageType;
      const matchesStatus = filterSessionStatus === "All" || session.status === filterSessionStatus;
      const matchesBranch = branchFilter === "All" || session.branch_id === branchFilter;
      const matchesCoach = coachFilter === "All" || 
                          (session.session_coaches && Array.isArray(session.session_coaches) && 
                           session.session_coaches.some(sc => sc.coach_id === coachFilter));
      
      return matchesSearch && matchesPackage && matchesStatus && matchesBranch && matchesCoach;
    })
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === "Newest to Oldest" ? dateB - dateA : dateA - dateB;
    }) || [];

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
      case "absent" : return <XCircle className="w-4 h-4 text-red-600" />;
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
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <Users className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">Loading attendance...</h3>
          <p className="text-sm sm:text-base md:text-lg text-gray-600">Please wait while we fetch the session data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-4 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#181818] mb-2 tracking-tight">Attendance Manager</h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-700">Track and manage player attendance for training sessions</p>
        </div>

        <Card className="border-2 border-[#181A18] bg-white shadow-xl overflow-hidden">
          <CardHeader className="border-b border-[#181A18] bg-[#181A18] p-3 sm:p-4 md:p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
              <div>
                <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                  <Calendar className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" style={{ color: '#BEA877' }} />
                  Training Sessions
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs sm:text-sm">
                  Select a training session to manage player attendance
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-5">
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <Filter className="h-4 sm:h-5 w-4 sm:w-5 text-accent mr-2" style={{ color: '#BEA877' }} />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Filter Sessions</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="session-search" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                    <Search className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                    Search Sessions
                  </Label>
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="session-search"
                      placeholder="Search by coach or branch..."
                      className="pl-10 pr-4 py-2 w-full border-2 border-accent rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-accent/20"
                      value={sessionSearchTerm}
                      onChange={(e) => setSessionSearchTerm(e.target.value)}
                      style={{ borderColor: '#BEA877' }}
                    />
                  </div>
                </div>
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="filter-package" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                    <Users className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                    Package Type
                  </Label>
                  <Select
                    value={filterPackageType}
                    onValueChange={(value: "All" | "Camp Training" | "Personal Training") => setFilterPackageType(value)}
                  >
                    <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
                      <SelectValue placeholder="Select package type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All" className="text-xs sm:text-sm">All Sessions</SelectItem>
                      <SelectItem value="Camp Training" className="text-xs sm:text-sm">Camp Training</SelectItem>
                      <SelectItem value="Personal Training" className="text-xs sm:text-sm">Personal Training</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All" className="text-xs sm:text-sm">All Branches</SelectItem>
                      {branches?.map(branch => (
                        <SelectItem key={branch.id} value={branch.id} className="text-xs sm:text-sm">
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="filter-coach" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                    <User className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                    Coach
                  </Label>
                  <Select
                    value={coachFilter}
                    onValueChange={(value) => setCoachFilter(value)}
                  >
                    <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
                      <SelectValue placeholder="Select coach" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All" className="text-xs sm:text-sm">All Coaches</SelectItem>
                      {coaches?.map(coach => (
                        <SelectItem key={coach.id} value={coach.id} className="text-xs sm:text-sm">
                          {coach.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="filter-status" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                    <Calendar className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                    Session Status
                  </Label>
                  <Select
                    value={filterSessionStatus}
                    onValueChange={(value: "All" | SessionStatus) => setFilterSessionStatus(value)}
                  >
                    <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All" className="text-xs sm:text-sm">All Statuses</SelectItem>
                      <SelectItem value="scheduled" className="text-xs sm:text-sm">Scheduled</SelectItem>
                      <SelectItem value="completed" className="text-xs sm:text-sm">Completed</SelectItem>
                      <SelectItem value="cancelled" className="text-xs sm:text-sm">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="sort-order" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                    <Calendar className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                    Sort Order
                  </Label>
                  <Select
                    value={sortOrder}
                    onValueChange={(value: "Newest to Oldest" | "Oldest to Newest") => setSortOrder(value)}
                  >
                    <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
                      <SelectValue placeholder="Select sort order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Newest to Oldest" className="text-xs sm:text-sm">Newest to Oldest</SelectItem>
                      <SelectItem value="Oldest to Newest" className="text-xs sm:text-sm">Oldest to Newest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 mt-3">
                Showing {filteredSessions.length} session{filteredSessions.length === 1 ? '' : 's'}
              </p>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="text-center py-12 sm:py-16">
                <Calendar className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2">
                  {sessionSearchTerm || filterPackageType !== "All" || filterSessionStatus !== "All" || branchFilter !== "All" || coachFilter !== "All" 
                    ? `No sessions found` 
                    : "No Training Sessions"}
                </h3>
                <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-6">
                  {sessionSearchTerm || filterPackageType !== "All" || filterSessionStatus !== "All" || branchFilter !== "All" || coachFilter !== "All" 
                    ? "Try adjusting your search or filter." 
                    : "No sessions available to manage attendance."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                  {paginatedSessions.map((session) => {
                    // Get coach names
                    const coachNames = [];
                    if (session.session_coaches && Array.isArray(session.session_coaches)) {
                      session.session_coaches.forEach(sc => {
                        if (sc.coaches && sc.coaches.name) {
                          coachNames.push(sc.coaches.name);
                        }
                      });
                    }
                    
                    return (
                      <Card 
                        key={session.id} 
                        className="border-2 transition-all duration-300 hover:shadow-lg rounded-lg border-accent overflow-hidden"
                        style={{ borderColor: '#BEA877' }}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                            <div className="flex items-center space-x-2 min-w-0">
                              <Calendar className="w-4 sm:w-5 h-4 sm:h-5 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                              <h3 className="font-bold text-base sm:text-lg text-gray-900 truncate">
                                {formatDate(session.date)}
                              </h3>
                            </div>
                            <Badge className={`font-medium ${getStatusBadgeColor(session.status)} text-xs sm:text-sm truncate max-w-full`}>
                              {session.status}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2 text-gray-600 min-w-0">
                            <Clock className="w-4 h-4 flex-shrink-0" />
                            <span className="text-xs sm:text-sm truncate">
                              {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center space-x-2 min-w-0">
                            <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <span className="text-xs sm:text-sm truncate">
                              <span className="font-medium">Coach:</span> {coachNames.join(', ') || 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 min-w-0">
                            <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <span className="text-xs sm:text-sm truncate"><span className="font-medium">Branch:</span> {session.branches.name}</span>
                          </div>
                          <div className="flex items-center space-x-2 min-w-0">
                            <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <span className="text-xs sm:text-sm truncate"><span className="font-medium">Package:</span> {session.package_type || 'N/A'}</span>
                          </div>
                          <div className="flex items-center justify-between min-w-0">
                            <div className="flex items-center space-x-2 min-w-0">
                              <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <span className="text-xs sm:text-sm font-medium">{session.session_participants?.length || 0} Players</span>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleView(session)}
                                className="bg-blue-600 text-white hover:bg-blue-700 w-10 h-10 p-0 flex items-center justify-center"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedSession(session.id);
                                  setShowAttendanceModal(true);
                                }}
                                className="bg-yellow-600 text-white hover:bg-yellow-700 w-10 h-10 p-0 flex items-center justify-center"
                              >
                                <Pencil className="w-4 h-4" />
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
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl md:max-w-3xl border-2 border-gray-200 bg-white shadow-lg overflow-x-hidden p-3 sm:p-4 md:p-5">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-base sm:text-lg md:text-xl font-bold text-gray-900">Session Details</DialogTitle>
              <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                View details of the selected training session
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 sm:p-4 rounded-lg border border-gray-200 bg-gray-50 overflow-x-auto">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center space-x-2 min-w-0">
                    <Calendar className="w-4 h-4 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                      Date: {selectedSessionDetails ? formatDate(selectedSessionDetails.date) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 min-w-0">
                    <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                      Time: {selectedSessionDetails 
                        ? `${formatTime12Hour(selectedSessionDetails.start_time)} - ${formatTime12Hour(selectedSessionDetails.end_time)}` 
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 min-w-0">
                    <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                      Branch: {selectedSessionDetails?.branches.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 min-w-0">
                    <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                      Coach: {selectedSessionDetails?.session_coaches?.map(sc => sc.coaches?.name).filter(Boolean).join(', ') || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 min-w-0">
                    <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                      Package: {selectedSessionDetails?.package_type || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 min-w-0">
                    <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700">
                      Players: {selectedSessionDetails?.session_participants?.length || 0}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Participants</Label>
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mb-4 gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">Present: {presentCount}</span>
                  </div>
                  <div className="flex items-center space-x-2 min-w-0">
                    <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">Absent: {absentCount}</span>
                  </div>
                  <div className="flex items-center space-x-2 min-w-0">
                    <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">Pending: {pendingCount}</span>
                  </div>
                </div>
                <div className="border-2 rounded-lg p-3 max-h-48 overflow-y-auto bg-[#faf0e8]" style={{ borderColor: '#181A18' }}>
                  {selectedSessionDetails?.session_participants?.length === 0 ? (
                    <p className="text-xs sm:text-sm text-gray-600">No participants assigned.</p>
                  ) : (
                    selectedSessionDetails?.session_participants?.map(participant => {
                      const attendance = attendanceRecords?.find(record => record.student_id === participant.student_id);
                      return (
                        <div key={participant.id} className="flex items-center justify-between p-2 min-w-0">
                          <div className="flex items-center space-x-3 min-w-0">
                            <span className="text-xs sm:text-sm text-gray-700 truncate">{participant.students.name}</span>
                            <Badge className={`font-medium ${getAttendanceBadgeColor(attendance?.status || 'pending')} text-xs sm:text-sm flex-shrink-0`}>
                              {getAttendanceIcon(attendance?.status || 'pending')}
                              <span className="ml-1 capitalize">{attendance?.status || 'pending'}</span>
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => setShowViewModal(false)}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAttendanceModal} onOpenChange={setShowAttendanceModal}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl md:max-w-3xl border-2 border-gray-200 bg-white shadow-lg overflow-x-hidden p-3 sm:p-4 md:p-5">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                Manage Attendance
                {selectedSessionDetails && (
                  <span className="text-xs sm:text-sm font-normal ml-2 truncate">
                    - {formatDate(selectedSessionDetails.date)} at {formatTime12Hour(selectedSessionDetails.start_time)}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                Update attendance for players in this training session
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 sm:p-4 rounded-lg bg-gray-50 border border-gray-200 overflow-x-auto">
                <p className="text-xs sm:text-sm text-gray-700 mb-1 truncate">
                  <span className="font-medium">Coach:</span> {selectedSessionDetails?.session_coaches?.map(sc => sc.coaches?.name).filter(Boolean).join(', ') || 'N/A'}
                </p>
                <p className="text-xs sm:text-sm text-gray-700 mb-1 truncate">
                  <span className="font-medium">Branch:</span> {selectedSessionDetails?.branches?.name || 'N/A'}
                </p>
                <p className="text-xs sm:text-sm text-gray-700 mb-1 truncate">
                  <span className="font-medium">Package Type:</span> {selectedSessionDetails?.package_type || 'N/A'}
                </p>
                <p className="text-xs sm:text-sm text-gray-700">
                  <span className="font-medium">Status:</span>{' '}
                  <Badge className={getStatusBadgeColor(selectedSessionDetails?.status || '')}>
                    {selectedSessionDetails?.status || 'N/A'}
                  </Badge>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="search" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                  <Search className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
                  Search Players
                </Label>
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search by player name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border-2 border-accent rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-accent/20"
                    style={{ borderColor: '#BEA877' }}
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mb-4 gap-2">
                <div className="flex items-center space-x-2 min-w-0">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">Present: {presentCount}</span>
                </div>
                <div className="flex items-center space-x-2 min-w-0">
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">Absent: {absentCount}</span>
                </div>
                <div className="flex items-center space-x-2 min-w-0">
                  <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">Pending: {pendingCount}</span>
                </div>
              </div>
              <div className="border-2 rounded-lg p-3 max-h-48 overflow-y-auto bg-[#faf0e8]" style={{ borderColor: '#181A18' }}>
                {filteredAttendanceRecords.length === 0 ? (
                  <p className="text-center text-gray-600 py-4 text-xs sm:text-sm">
                    {searchTerm ? "No players found." : "No players registered for this session."}
                  </p>
                ) : (
                  filteredAttendanceRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-2 border-b last:border-b-0 min-w-0">
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">{record.students.name}</span>
                        <Badge className={`font-medium ${getAttendanceBadgeColor(record.status)} text-xs sm:text-sm flex-shrink-0`}>
                          {getAttendanceIcon(record.status)}
                          <span className="ml-1 capitalize">{record.status}</span>
                        </Badge>
                      </div>
                      <Select
                        value={record.status}
                        onValueChange={(value: AttendanceStatusLiteral) => handleAttendanceChange(record.id, value)}
                      >
                        <SelectTrigger className="w-32 sm:w-40 border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 text-xs sm:text-sm flex-shrink-0" style={{ borderColor: '#BEA877' }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {attendanceStatuses.map((status) => (
                            <SelectItem key={status} value={status} className="text-xs sm:text-sm">
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
              <div className="flex flex-row justify-end gap-2 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAttendanceModal(false);
                    setSearchTerm("");
                    if (sessionIdFromUrl) {
                      setSelectedSession(null);
                    }
                  }}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 min-w-fit w-auto px-2 sm:px-3 text-xs sm:text-sm"
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
                  className="bg-accent hover:bg-[#8e7a3f] text-white min-w-fit w-auto px-2 sm:px-3 text-xs sm:text-sm"
                  style={{ backgroundColor: '#BEA877' }}
                >
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
