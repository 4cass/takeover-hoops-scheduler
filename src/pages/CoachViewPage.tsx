import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, Clock, MapPin, Users, LogIn, LogOut, CheckCircle, XCircle, AlertCircle, User, Download, Mail, Phone, CalendarDays, TrendingUp, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { exportCoachSessionsToExcel } from "@/utils/exportUtils";
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
    session_participants: { student_id: string; students: { name: string } }[];
  };
}

interface StudentAttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: 'present' | 'absent' | 'pending';
  marked_at: string | null;
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

export default function CoachViewPage() {
  const { coachId } = useParams<{ coachId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [recordsBranchFilter, setRecordsBranchFilter] = useState<string>("All");
  const [recordsPackageTypeFilter, setRecordsPackageTypeFilter] = useState<string>("All");
  const [recordsStartDate, setRecordsStartDate] = useState<string>("");
  const [recordsEndDate, setRecordsEndDate] = useState<string>("");
  const [recordsCurrentPage, setRecordsCurrentPage] = useState(1);
  const [studentsModalRecord, setStudentsModalRecord] = useState<SessionRecord | null>(null);
  const itemsPerPage = 10;

  // Fetch coach data
  const { data: coach, isLoading: coachLoading, error: coachError } = useQuery({
    queryKey: ["coach", coachId],
    queryFn: async () => {
      if (!coachId) throw new Error("Coach ID is required");
      const { data, error } = await supabase
        .from("coaches")
        .select("*")
        .eq("id", coachId)
        .single();
      if (error) throw error;
      return data as Coach;
    },
    enabled: !!coachId,
  });

  // Fetch branches for filter
  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch packages for filter
  const { data: packages } = useQuery({
    queryKey: ["packages-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch session records
  const { data: sessionRecords, isLoading: recordsLoading, error: recordsError } = useQuery({
    queryKey: ["session_records", coachId],
    queryFn: async () => {
      if (!coachId) return [];
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
            session_participants (student_id, students (name))
          )
        `)
        .eq("coach_id", coachId)
        .order("date", { ascending: false, referencedTable: "training_sessions" });
      if (error) throw error;
      return data as SessionRecord[];
    },
    enabled: !!coachId,
  });

  // Fetch coach session times
  const { data: coachSessionTimes } = useQuery({
    queryKey: ["coach_session_times", coachId],
    queryFn: async () => {
      if (!coachId) return [];
      const { data, error } = await supabase
        .from("coach_session_times")
        .select("id, coach_id, session_id, time_in, time_out")
        .eq("coach_id", coachId);
      if (error) throw error;
      return data as CoachSessionTime[];
    },
    enabled: !!coachId,
  });

  // Fetch coach attendance records
  const { data: coachAttendanceRecords, refetch: refetchAttendance } = useQuery({
    queryKey: ["coach_attendance_records", coachId],
    queryFn: async () => {
      if (!coachId) return [];
      const { data, error } = await supabase
        .from("coach_attendance_records")
        .select("id, coach_id, session_id, status, marked_at")
        .eq("coach_id", coachId);
      if (error) throw error;
      return data as CoachAttendanceRecord[];
    },
    enabled: !!coachId,
  });

  // Fetch student attendance records for all sessions
  const { data: studentAttendanceRecords } = useQuery({
    queryKey: ["student_attendance_records", sessionRecords],
    queryFn: async () => {
      if (!sessionRecords || sessionRecords.length === 0) return [];
      const sessionIds = sessionRecords
        .map(r => r.training_sessions?.id)
        .filter((id): id is string => !!id);
      if (sessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, session_id, student_id, status, marked_at")
        .in("session_id", sessionIds);
      if (error) throw error;
      return data as StudentAttendanceRecord[];
    },
    enabled: !!sessionRecords && sessionRecords.length > 0,
  });

  // Helper functions
  const getCoachTimeData = (sessionId: string) => {
    return coachSessionTimes?.find(t => t.session_id === sessionId);
  };

  const getCoachAttendance = (sessionId: string) => {
    return coachAttendanceRecords?.find(a => a.session_id === sessionId);
  };

  /** Status: absent overrides; else Present if both time_in & time_out, else Pending */
  const getDisplayStatus = (
    sessionId: string | undefined,
    timeData: CoachSessionTime | null,
    attendanceData: CoachAttendanceRecord | null
  ): 'present' | 'pending' | 'absent' => {
    if (attendanceData?.status === 'absent') return 'absent';
    if (timeData?.time_in && timeData?.time_out) return 'present';
    return 'pending';
  };

  /** Check if coach is late (time_in is after scheduled start_time) */
  const isLate = (
    sessionDate: string | undefined,
    startTime: string | undefined,
    timeIn: string | null
  ): boolean => {
    if (!sessionDate || !startTime || !timeIn) return false;
    
    try {
      // Combine session date and start_time to create scheduled start datetime
      const scheduledStart = new Date(`${sessionDate}T${startTime}`);
      const actualTimeIn = new Date(timeIn);
      
      // Coach is late if time_in is after scheduled start
      return actualTimeIn > scheduledStart;
    } catch {
      return false;
    }
  };

  /** Get student attendance status for a session */
  const getStudentAttendanceStatus = (sessionId: string | undefined, studentId: string): 'present' | 'absent' | 'pending' => {
    if (!sessionId) return 'pending';
    const attendance = studentAttendanceRecords?.find(
      a => a.session_id === sessionId && a.student_id === studentId
    );
    return attendance?.status || 'pending';
  };

  const getPackageBadgeColor = (packageType: string | null) => {
    if (!packageType) return 'bg-gray-100 text-gray-600 border-gray-200';
    const colors = [
      'bg-blue-100 text-blue-700 border-blue-200',
      'bg-emerald-100 text-emerald-700 border-emerald-200',
      'bg-purple-100 text-purple-700 border-purple-200',
      'bg-indigo-100 text-indigo-700 border-indigo-200',
      'bg-teal-100 text-teal-700 border-teal-200',
    ];
    const hash = packageType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Filter session records
  const filteredSessionRecords = (sessionRecords || []).filter((record) => {
    const matchesBranch = recordsBranchFilter === "All" || record.training_sessions?.branch_id === recordsBranchFilter;
    const matchesPackage = recordsPackageTypeFilter === "All" || record.training_sessions?.package_type === recordsPackageTypeFilter;
    const matchesStartDate = !recordsStartDate || (record.training_sessions?.date && record.training_sessions.date >= recordsStartDate);
    const matchesEndDate = !recordsEndDate || (record.training_sessions?.date && record.training_sessions.date <= recordsEndDate);
    return matchesBranch && matchesPackage && matchesStartDate && matchesEndDate;
  });

  const recordsTotalPages = Math.ceil(filteredSessionRecords.length / itemsPerPage);
  const recordsStartIndex = (recordsCurrentPage - 1) * itemsPerPage;
  const recordsEndIndex = recordsStartIndex + itemsPerPage;
  const paginatedSessionRecords = filteredSessionRecords.slice(recordsStartIndex, recordsEndIndex);

  // Calculate statistics
  const totalSessions = sessionRecords?.length || 0;
  const totalStudentsTrained = sessionRecords?.reduce((acc, record) => {
    return acc + (record.training_sessions?.session_participants?.length || 0);
  }, 0) || 0;
  const uniqueStudents = new Set(
    sessionRecords?.flatMap(record => 
      record.training_sessions?.session_participants?.map(p => p.students.name) || []
    ) || []
  ).size;
  const presentSessions = (sessionRecords || []).filter((record) => {
    const sid = record.training_sessions?.id;
    const td = sid ? getCoachTimeData(sid) : null;
    const ad = sid ? getCoachAttendance(sid) : null;
    return getDisplayStatus(sid, td, ad) === 'present';
  }).length;
  const attendanceRate = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0;

  const getPaginationRange = (current: number, total: number) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (current + delta < total - 1) {
      rangeWithDots.push('...', total);
    } else if (total > 1) {
      rangeWithDots.push(total);
    }

    return rangeWithDots.filter((item, index, arr) => arr.indexOf(item) === index);
  };

  const handleRecordsPageChange = (page: number) => {
    setRecordsCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Mark absent mutation
  const markAbsentMutation = useMutation({
    mutationFn: async ({ sessionId, coachId }: { sessionId: string; coachId: string }) => {
      const { error } = await supabase
        .from("coach_attendance_records")
        .upsert({
          coach_id: coachId,
          session_id: sessionId,
          status: "absent",
          marked_at: new Date().toISOString(),
        }, {
          onConflict: "coach_id,session_id"
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach_attendance_records", coachId] });
      refetchAttendance();
      toast.success("Coach marked as absent");
    },
    onError: (error: Error) => {
      toast.error("Failed to mark absent: " + error.message);
    },
  });

  // Mark present mutation
  const markPresentMutation = useMutation({
    mutationFn: async ({ sessionId, coachId }: { sessionId: string; coachId: string }) => {
      const { error } = await supabase
        .from("coach_attendance_records")
        .upsert({
          coach_id: coachId,
          session_id: sessionId,
          status: "present",
          marked_at: new Date().toISOString(),
        }, {
          onConflict: "coach_id,session_id"
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach_attendance_records", coachId] });
      refetchAttendance();
      toast.success("Coach marked as present");
    },
    onError: (error: Error) => {
      toast.error("Failed to mark present: " + error.message);
    },
  });

  // Get coach initials for avatar
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (coachLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#79e58f] border-t-transparent mx-auto"></div>
          <p className="text-gray-600 mt-4 text-sm font-medium">Loading coach details...</p>
        </div>
      </div>
    );
  }

  if (coachError || !coach) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-3">Coach not found</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {coachError ? (coachError as Error).message : "The coach you're looking for doesn't exist or has been removed."}
          </p>
          <Button 
            onClick={() => navigate("/dashboard/coaches")} 
            className="bg-[#79e58f] text-white hover:bg-[#5bc96f] shadow-lg transition-all duration-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Coaches
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-4 p-3 sm:p-4 md:p-6 pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back Button */}
        <Button
          onClick={() => navigate("/dashboard/coaches")}
          variant="ghost"
          className="mb-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200/50 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Coaches
        </Button>

        {/* Coach Profile Card */}
        <Card className="border-0 bg-white shadow-xl rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#242833] to-[#3a3f4d] p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              {/* Avatar */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#79e58f] to-[#5bc96f] flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-lg">
                {getInitials(coach.name)}
              </div>
              
              {/* Coach Info */}
              <div className="text-center sm:text-left flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  {coach.name}
                </h1>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-gray-300 text-sm">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <Mail className="w-4 h-4" />
                    <span>{coach.email}</span>
                  </div>
                  {coach.phone && (
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <Phone className="w-4 h-4" />
                      <span>{coach.phone}</span>
                    </div>
                  )}
                </div>
                <p className="text-gray-400 text-xs mt-2">
                  Member since {format(new Date(coach.created_at), 'MMMM yyyy')}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200">
            <div className="bg-white p-4 sm:p-6 text-center">
              <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 mx-auto mb-2">
                <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-800">{totalSessions}</p>
              <p className="text-xs sm:text-sm text-gray-500">Total Sessions</p>
            </div>
            <div className="bg-white p-4 sm:p-6 text-center">
              <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-100 mx-auto mb-2">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-800">{uniqueStudents}</p>
              <p className="text-xs sm:text-sm text-gray-500">Unique Students</p>
            </div>
            <div className="bg-white p-4 sm:p-6 text-center">
              <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-100 mx-auto mb-2">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-800">{totalStudentsTrained}</p>
              <p className="text-xs sm:text-sm text-gray-500">Total Trained</p>
            </div>
            <div className="bg-white p-4 sm:p-6 text-center">
              <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-100 mx-auto mb-2">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-800">{attendanceRate}%</p>
              <p className="text-xs sm:text-sm text-gray-500">Attendance Rate</p>
            </div>
          </div>
        </Card>

        {/* Session Records Card */}
        <Card className="border-0 bg-white shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-[#242833] to-[#3a3f4d] p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#79e58f]" />
                  Session History
                </CardTitle>
                <p className="text-gray-400 text-xs sm:text-sm mt-1">
                  View all training sessions for this coach
                </p>
              </div>
              {filteredSessionRecords.length > 0 && (
                <Button
                  onClick={() => {
                    const headers = ['Date', 'Session Time', 'Branch', 'Package Type', 'Time In', 'Time Out', 'Status', 'Students', 'Total Students', 'Students Present', 'Students Absent', 'Students Pending'];
                    exportCoachSessionsToExcel(
                      filteredSessionRecords,
                      `${(coach.name || 'coach').replace(/\s+/g, '_')}_sessions`,
                      headers,
                      (record) => {
                        const sessionId = record.training_sessions?.id;
                        const timeData = sessionId ? getCoachTimeData(sessionId) : null;
                        const attendanceData = sessionId ? getCoachAttendance(sessionId) : null;
                        const status = getDisplayStatus(sessionId, timeData, attendanceData);
                        const participants = record.training_sessions?.session_participants ?? [];
                        const students = participants.map((p) => p.students.name);
                        const totalStudents = students.length;
                        
                        // Calculate student attendance counts
                        let studentsPresent = 0;
                        let studentsAbsent = 0;
                        let studentsPending = 0;
                        
                        if (sessionId) {
                          participants.forEach((p) => {
                            const studentStatus = getStudentAttendanceStatus(sessionId, p.student_id);
                            if (studentStatus === 'present') studentsPresent++;
                            else if (studentStatus === 'absent') studentsAbsent++;
                            else studentsPending++;
                          });
                        }
                        
                        return [
                          record.training_sessions?.date ? format(new Date(record.training_sessions.date), 'yyyy-MM-dd') : '',
                          record.training_sessions ? `${formatTime12Hour(record.training_sessions.start_time)} - ${formatTime12Hour(record.training_sessions.end_time)}` : '',
                          record.training_sessions?.branches?.name ?? '',
                          record.training_sessions?.package_type ?? '',
                          timeData?.time_in ? format(new Date(timeData.time_in), 'MM/dd/yyyy hh:mm a') : '',
                          timeData?.time_out ? format(new Date(timeData.time_out), 'MM/dd/yyyy hh:mm a') : '',
                          status,
                          students.join(", ") || '',
                          String(totalStudents),
                          String(studentsPresent),
                          String(studentsAbsent),
                          String(studentsPending)
                        ];
                      },
                      (record) => {
                        const sessionId = record.training_sessions?.id;
                        const timeData = sessionId ? getCoachTimeData(sessionId) : null;
                        const attendanceData = sessionId ? getCoachAttendance(sessionId) : null;
                        return getDisplayStatus(sessionId, timeData, attendanceData);
                      }
                    );
                    toast.success('Session records exported successfully');
                  }}
                  className="bg-[#79e58f] hover:bg-[#5bc96f] text-white text-xs sm:text-sm shadow-lg transition-all duration-300"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Excel
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Filters */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center text-xs sm:text-sm font-medium text-gray-700">
                    <MapPin className="w-4 h-4 mr-2 text-[#79e58f]" />
                    Branch
                  </Label>
                  <Select
                    value={recordsBranchFilter}
                    onValueChange={(value) => setRecordsBranchFilter(value)}
                  >
                    <SelectTrigger className="border-2 border-gray-200 focus:border-[#79e58f] rounded-lg bg-white">
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      <SelectItem value="All">All Branches</SelectItem>
                      {branches?.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center text-xs sm:text-sm font-medium text-gray-700">
                    <Users className="w-4 h-4 mr-2 text-[#79e58f]" />
                    Package Type
                  </Label>
                  <Select
                    value={recordsPackageTypeFilter}
                    onValueChange={(value) => setRecordsPackageTypeFilter(value)}
                  >
                    <SelectTrigger className="border-2 border-gray-200 focus:border-[#79e58f] rounded-lg bg-white">
                      <SelectValue placeholder="Select Package" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      <SelectItem value="All">All Packages</SelectItem>
                      {packages?.map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.name}>
                          {pkg.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center text-xs sm:text-sm font-medium text-gray-700">
                    <Calendar className="w-4 h-4 mr-2 text-[#79e58f]" />
                    Start Date
                  </Label>
                  <Input
                    type="date"
                    value={recordsStartDate}
                    onChange={(e) => setRecordsStartDate(e.target.value)}
                    className="border-2 border-gray-200 focus:border-[#79e58f] rounded-lg bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center text-xs sm:text-sm font-medium text-gray-700">
                    <Calendar className="w-4 h-4 mr-2 text-[#79e58f]" />
                    End Date
                  </Label>
                  <Input
                    type="date"
                    value={recordsEndDate}
                    onChange={(e) => setRecordsEndDate(e.target.value)}
                    className="border-2 border-gray-200 focus:border-[#79e58f] rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600 font-medium">
                Showing <span className="text-[#79e58f] font-bold">{filteredSessionRecords.length}</span> session{filteredSessionRecords.length === 1 ? '' : 's'}
              </p>
            </div>

            {recordsLoading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#79e58f] border-t-transparent mx-auto"></div>
                <p className="text-gray-600 mt-4 text-sm font-medium">Loading session records...</p>
              </div>
            ) : recordsError ? (
              <div className="text-center py-12 bg-red-50 rounded-xl">
                <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className="text-red-600 text-sm font-medium">Error loading records: {(recordsError as Error).message}</p>
              </div>
            ) : filteredSessionRecords.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-xl">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-lg text-gray-600 font-medium mb-2">
                  {recordsBranchFilter !== "All" || recordsPackageTypeFilter !== "All" || recordsStartDate || recordsEndDate ?
                    "No sessions found with the selected filters" :
                    "No session records found"}
                </p>
                <p className="text-sm text-gray-400">
                  {recordsBranchFilter !== "All" || recordsPackageTypeFilter !== "All" || recordsStartDate || recordsEndDate ?
                    "Try adjusting your filters" :
                    "Sessions will appear here once assigned"}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="block md:hidden space-y-4">
                  {paginatedSessionRecords.map((record) => {
                    const sessionId = record.training_sessions?.id;
                    const timeData = sessionId ? getCoachTimeData(sessionId) : null;
                    const attendanceData = sessionId ? getCoachAttendance(sessionId) : null;
                    const status = getDisplayStatus(sessionId, timeData, attendanceData);
                    const students = record.training_sessions?.session_participants || [];
                    const studentCount = students.length;

                    return (
                      <Card
                        key={record.training_sessions?.id || record.id}
                        className="border-0 shadow-md rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300"
                      >
                        {/* Card Header */}
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-lg bg-[#79e58f]/20 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-[#79e58f]" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">
                                  {record.training_sessions ? format(new Date(record.training_sessions.date), 'EEEE') : 'N/A'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {record.training_sessions ? format(new Date(record.training_sessions.date), 'MMM dd, yyyy') : 'N/A'}
                                </p>
                              </div>
                            </div>
                            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${getPackageBadgeColor(record.training_sessions?.package_type)}`}>
                              {record.training_sessions?.package_type || 'N/A'}
                            </span>
                          </div>
                        </div>

                        <CardContent className="p-4 space-y-4">
                          {/* Time & Location */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span className="text-xs text-gray-600">
                                {record.training_sessions ? `${formatTime12Hour(record.training_sessions.start_time)} - ${formatTime12Hour(record.training_sessions.end_time)}` : 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              <span className="text-xs text-gray-600 truncate">{record.training_sessions?.branches?.name || 'N/A'}</span>
                            </div>
                          </div>

                          {/* Time In/Out */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-green-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <LogIn className="w-4 h-4 text-green-600" />
                                <span className="text-xs font-medium text-green-700">Time In</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-green-800">
                                  {timeData?.time_in ? format(new Date(timeData.time_in), 'hh:mm a') : '—'}
                                </p>
                                {timeData?.time_in && isLate(
                                  record.training_sessions?.date,
                                  record.training_sessions?.start_time,
                                  timeData.time_in
                                ) && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-300">
                                    Late
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="bg-red-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <LogOut className="w-4 h-4 text-red-600" />
                                <span className="text-xs font-medium text-red-700">Time Out</span>
                              </div>
                              <p className="text-sm font-semibold text-red-800">
                                {timeData?.time_out ? format(new Date(timeData.time_out), 'hh:mm a') : '—'}
                              </p>
                            </div>
                          </div>

                          {/* Status & Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                            <div className="flex items-center gap-2">
                              {status === 'present' ? (
                                <span className="flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-xs font-semibold">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Present
                                </span>
                              ) : status === 'absent' ? (
                                <span className="flex items-center gap-1.5 bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-xs font-semibold">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Absent
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full text-xs font-semibold">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  Pending
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setStudentsModalRecord(record)}
                                className="text-xs border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                View Students ({studentCount})
                              </Button>
                              {status !== 'present' && sessionId && coachId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => markPresentMutation.mutate({ sessionId, coachId })}
                                  disabled={markPresentMutation.isPending}
                                  className="text-xs border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300"
                                >
                                  Present
                                </Button>
                              )}
                              {status !== 'absent' && sessionId && coachId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => markAbsentMutation.mutate({ sessionId, coachId })}
                                  disabled={markAbsentMutation.isPending}
                                  className="text-xs border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                >
                                  Absent
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block w-full rounded-lg border border-gray-200 bg-white">
                  <table className="table-fixed w-full min-w-0">
                    <thead>
                      <tr className="bg-[#242833] text-white">
                        <th className="py-3 px-3 text-center font-medium text-sm w-[10%]">Date</th>
                        <th className="py-3 px-3 text-center font-medium text-sm w-[11%]">Time</th>
                        <th className="py-3 px-3 text-center font-medium text-sm w-[12%]">Branch</th>
                        <th className="py-3 px-3 text-center font-medium text-sm w-[11%]">Package</th>
                        <th className="py-3 px-3 text-center font-medium text-sm w-[12%]">In / Out</th>
                        <th className="py-3 px-3 text-center font-medium text-sm w-[8%]">Late</th>
                        <th className="py-3 px-3 text-center font-medium text-sm w-[9%]">Status</th>
                        <th className="py-3 px-3 text-center font-medium text-sm w-[7%]">Students</th>
                        <th className="py-3 px-3 text-center font-medium text-sm w-[20%]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedSessionRecords.map((record, index) => {
                        const sessionId = record.training_sessions?.id;
                        const timeData = sessionId ? getCoachTimeData(sessionId) : null;
                        const attendanceData = sessionId ? getCoachAttendance(sessionId) : null;
                        const status = getDisplayStatus(sessionId, timeData, attendanceData);
                        const students = record.training_sessions?.session_participants || [];
                        const studentCount = students.length;

                        return (
                          <tr
                            key={record.training_sessions?.id}
                            className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-gray-100`}
                          >
                            <td className="py-3 px-3 text-sm text-gray-700 text-center align-middle">
                              {record.training_sessions ? format(new Date(record.training_sessions.date), 'MMM d, yyyy') : '—'}
                            </td>
                            <td className="py-3 px-3 text-sm text-gray-700 text-center align-middle">
                              {record.training_sessions ? `${formatTime12Hour(record.training_sessions.start_time)} – ${formatTime12Hour(record.training_sessions.end_time)}` : '—'}
                            </td>
                            <td className="py-3 px-3 text-sm text-gray-700 text-center align-middle break-words">
                              {record.training_sessions?.branches?.name || '—'}
                            </td>
                            <td className="py-3 px-3 text-sm text-center align-middle">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium break-words ${getPackageBadgeColor(record.training_sessions?.package_type)}`}>
                                {record.training_sessions?.package_type || '—'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-xs text-center align-middle">
                              <div className="space-y-1">
                                <div className="flex items-center justify-center gap-1">
                                  <LogIn className="w-3 h-3 text-green-600 shrink-0" />
                                  <span className="text-gray-700">
                                    {timeData?.time_in ? format(new Date(timeData.time_in), 'h:mm a') : '—'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-center gap-1">
                                  <LogOut className="w-3 h-3 text-red-600 shrink-0" />
                                  <span className="text-gray-700">
                                    {timeData?.time_out ? format(new Date(timeData.time_out), 'h:mm a') : '—'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center align-middle">
                              {timeData?.time_in && isLate(
                                record.training_sessions?.date,
                                record.training_sessions?.start_time,
                                timeData.time_in
                              ) ? (
                                <span className="px-2 py-1 rounded text-xs font-bold bg-orange-100 text-orange-700 border border-orange-300">
                                  Late
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center align-middle">
                              <span className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                status === 'present' ? 'bg-green-100 text-green-700' :
                                status === 'absent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {status === 'present' ? <CheckCircle className="w-3 h-3 shrink-0" /> : status === 'absent' ? <XCircle className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
                                {status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : 'Pending'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-sm text-gray-700 text-center align-middle">{studentCount}</td>
                            <td className="py-3 px-3 text-center align-middle">
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setStudentsModalRecord(record)}
                                  className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                                {status !== 'present' && sessionId && coachId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => markPresentMutation.mutate({ sessionId, coachId })}
                                    disabled={markPresentMutation.isPending}
                                    className="h-7 px-2 text-xs text-green-600 hover:bg-green-50"
                                  >
                                    Present
                                  </Button>
                                )}
                                {status !== 'absent' && sessionId && coachId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => markAbsentMutation.mutate({ sessionId, coachId })}
                                    disabled={markAbsentMutation.isPending}
                                    className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                                  >
                                    Absent
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {recordsTotalPages > 1 && (
                  <div className="flex justify-center items-center mt-8 space-x-2 flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleRecordsPageChange(recordsCurrentPage - 1)}
                      disabled={recordsCurrentPage === 1}
                      className="border-2 border-[#79e58f] text-[#79e58f] hover:bg-[#79e58f] hover:text-white w-10 h-10 p-0 rounded-xl transition-all duration-300"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    {getPaginationRange(recordsCurrentPage, recordsTotalPages).map((page, idx) => (
                      page === '...' ? (
                        <span key={`dots-${idx}`} className="px-2 text-gray-400">...</span>
                      ) : (
                        <Button
                          key={page}
                          variant={recordsCurrentPage === page ? "default" : "outline"}
                          onClick={() => handleRecordsPageChange(page as number)}
                          className={`border-2 w-10 h-10 p-0 rounded-xl text-sm font-medium transition-all duration-300 ${
                            recordsCurrentPage === page
                              ? 'bg-[#79e58f] text-white border-[#79e58f] shadow-lg'
                              : 'border-gray-200 text-gray-600 hover:border-[#79e58f] hover:text-[#79e58f]'
                          }`}
                        >
                          {page}
                        </Button>
                      )
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => handleRecordsPageChange(recordsCurrentPage + 1)}
                      disabled={recordsCurrentPage === recordsTotalPages}
                      className="border-2 border-[#79e58f] text-[#79e58f] hover:bg-[#79e58f] hover:text-white w-10 h-10 p-0 rounded-xl transition-all duration-300"
                    >
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* View Students Modal */}
        <Dialog open={!!studentsModalRecord} onOpenChange={(open) => !open && setStudentsModalRecord(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#79e58f]" />
                Students in Session
              </DialogTitle>
            </DialogHeader>
            {studentsModalRecord && (
              <div className="space-y-4">
                <div className="rounded-xl bg-gray-50 p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-gray-800">
                      {format(new Date(studentsModalRecord.training_sessions?.date ?? ''), 'EEEE, MMM dd, yyyy')}
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-600">
                      {studentsModalRecord.training_sessions
                        ? `${formatTime12Hour(studentsModalRecord.training_sessions.start_time)} – ${formatTime12Hour(studentsModalRecord.training_sessions.end_time)}`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{studentsModalRecord.training_sessions?.branches?.name ?? '—'}</span>
                    <span>·</span>
                    <span className={`px-2 py-0.5 rounded-full border ${getPackageBadgeColor(studentsModalRecord.training_sessions?.package_type)}`}>
                      {studentsModalRecord.training_sessions?.package_type ?? '—'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-700">Total students</p>
                    <span className="bg-[#79e58f] text-white px-3 py-1 rounded-full text-sm font-bold">
                      {(studentsModalRecord.training_sessions?.session_participants ?? []).length}
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                    {(studentsModalRecord.training_sessions?.session_participants ?? []).length > 0 ? (
                      <div className="p-2">
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">
                          <div className="col-span-1">#</div>
                          <div className="col-span-7">Student Name</div>
                          <div className="col-span-4 text-center">Status</div>
                        </div>
                        <ul className="divide-y divide-gray-100">
                          {(studentsModalRecord.training_sessions?.session_participants ?? []).map((p, idx) => {
                            const studentStatus = getStudentAttendanceStatus(
                              studentsModalRecord.training_sessions?.id,
                              p.student_id
                            );
                            return (
                              <li key={idx} className="grid grid-cols-12 gap-2 items-center py-2 px-3 text-sm text-gray-800">
                                <span className="col-span-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#79e58f]/20 text-xs font-semibold text-[#79e58f]">
                                  {idx + 1}
                                </span>
                                <span className="col-span-7 truncate">{p.students.name}</span>
                                <div className="col-span-4 flex justify-center">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                    studentStatus === 'present' 
                                      ? 'bg-green-100 text-green-700' 
                                      : studentStatus === 'absent' 
                                        ? 'bg-red-100 text-red-700' 
                                        : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {studentStatus === 'present' ? (
                                      <><CheckCircle className="w-3 h-3 shrink-0" />Present</>
                                    ) : studentStatus === 'absent' ? (
                                      <><XCircle className="w-3 h-3 shrink-0" />Absent</>
                                    ) : (
                                      <><AlertCircle className="w-3 h-3 shrink-0" />Pending</>
                                    )}
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-gray-400">No students assigned to this session.</p>
                    )}
                  </div>
                </div>
                <DialogFooter className="pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setStudentsModalRecord(null)}
                    className="border-gray-300"
                  >
                    Close
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
