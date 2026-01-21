import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Clock, Calendar, MapPin, Users, Filter, Search, Timer, Eye } from "lucide-react";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { format, parseISO, addDays, subDays, parse } from "date-fns";

type AttendanceStatus = "present" | "absent" | "pending";
type SessionStatus = "scheduled" | "completed" | "cancelled" | "all";

const attendanceStatuses = ["present", "absent", "pending"] as const;
type AttendanceStatusLiteral = typeof attendanceStatuses[number];

type CoachSessionTime = {
  id: string;
  session_id: string;
  coach_id: string;
  time_in: string | null;
  time_out: string | null;
};

type Package = {
  id: string;
  name: string;
};

type TrainingSession = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  branch_id: string;
  status: SessionStatus;
  package_id: string | null;
  package_name: string | null;
  branches: { name: string };
  session_participants: Array<{ students: { name: string } }>;
};

const formatTime12Hour = (time: string | null | undefined, date: string | null | undefined): string => {
  if (!time || !date) return "N/A";
  try {
    const timeFormats = ["HH:mm:ss", "HH:mm"];
    let parsedTime: Date | null = null;
    for (const format of timeFormats) {
      try {
        parsedTime = parse(time, format, new Date(date));
        if (!isNaN(parsedTime.getTime())) {
          break;
        }
      } catch {
        // Try next format
      }
    }
    if (!parsedTime || isNaN(parsedTime.getTime())) {
      return "Invalid time";
    }
    return format(parsedTime, "h:mm a");
  } catch {
    return "Invalid time";
  }
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

const formatDateTime = (dateTime: string | null): string => {
  if (!dateTime) return 'N/A';
  try {
    return format(parseISO(dateTime), 'MMM dd, yyyy hh:mm a');
  } catch (error) {
    console.error('Error formatting date-time:', error);
    return 'Invalid Date/Time';
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
  const [packageFilter, setPackageFilter] = useState<string | "All">("All");
  const [activeTab, setActiveTab] = useState<"coaches" | "players">("coaches");
  const [showDurationDialog, setShowDurationDialog] = useState(false);
  const [pendingAttendanceUpdate, setPendingAttendanceUpdate] = useState<{ recordId: string; status: AttendanceStatus } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(0);
  const [showViewModal, setShowViewModal] = useState(false);
  const [updatingRecordId, setUpdatingRecordId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500 text-white border-blue-500';
      case 'completed': return 'bg-green-500 text-white border-green-500';
      case 'cancelled': return 'bg-red-500 text-white border-red-500';
      default: return 'bg-gray-500 text-white border-gray-500';
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

  const { data: packages } = useQuery<Package[]>({
    queryKey: ['packages-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) {
        console.error("Error fetching packages:", error);
        toast.error("Failed to load package types");
        throw error;
      }
      console.log("Fetched packages:", data);
      return data as Package[];
    }
  });

const { data: sessions } = useQuery<TrainingSession[]>({
  queryKey: ["coach-sessions", coachId, branchFilter, packageFilter, statusFilter, sessionSearchTerm],
  queryFn: async () => {
    if (!coachId) return [];
    console.log("Fetching sessions for coach:", coachId);
    
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
    
    // Remove 'any' type and let TypeScript infer from Supabase client
    let query = supabase
      .from("training_sessions")
      .select(`
        id, date, start_time, end_time, branch_id, status, package_id, package_type,
        branches (name),
        session_participants (students (name))
      `)
      .in("id", sessionIds)
      .gte("date", format(pastDate, 'yyyy-MM-dd'))
      .lte("date", format(futureDate, 'yyyy-MM-dd'));

    // Apply filters with type-safe conditions
    if (branchFilter !== "all") {
      query = query.eq('branch_id', branchFilter);
    }
    if (packageFilter !== "All" && typeof packageFilter === "string") {
      query = (query as any).eq('package_id', packageFilter);
    }
    if (statusFilter !== "all") {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query.order("date", { ascending: false });
    
    if (error) {
      console.error("Error fetching sessions:", error);
      throw error;
    }
    
    console.log("Fetched sessions raw:", data);
    return (data || []).map((session: any) => ({
      ...session,
      package_name: session.package_type || session.packages?.name || (session.packages && session.packages.length > 0 ? session.packages[0].name : null) || null,
      package_id: session.package_id || null,
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
        .select(`
          coach_id,
          coaches (name)
        `)
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

  const { data: coachSessionTimes } = useQuery({
    queryKey: ["coach-session-times", selectedSession],
    queryFn: async () => {
      if (!selectedSession) return [];
      console.log("Fetching coach session times for session:", selectedSession);
      const { data, error } = await supabase
        .from("coach_session_times")
        .select("id, session_id, coach_id, time_in, time_out")
        .eq("session_id", selectedSession);
      
      if (error) {
        console.error("Error fetching coach session times:", error);
        throw error;
      }
      
      console.log("Fetched coach session times:", data);
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
        .select(`
          id,
          session_id,
          student_id,
          status,
          marked_at,
          session_duration,
          package_cycle,
          students (name, package_type)
        `)
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

  const { data: coachAttendance } = useQuery({
    queryKey: ["coach-attendance", selectedSession, coachId],
    queryFn: async () => {
      if (!selectedSession || !coachId) return null;
      console.log(`Fetching coach attendance for session: ${selectedSession}, coach: ${coachId}`);
      const { data, error } = await supabase
        .from("coach_session_times")
        .select("id, session_id, coach_id, time_in, time_out")
        .eq("session_id", selectedSession)
        .eq("coach_id", coachId)
        .single();

      if (error) {
        console.error("Error fetching coach attendance:", error);
        return null;
      }
      console.log("Coach attendance:", data);
      return data as CoachSessionTime | null;
    },
    enabled: !!selectedSession && !!coachId,
  });

  const updateCoachAttendance = useMutation({
    mutationFn: async ({ sessionId, field }: { sessionId: string; field: 'time_in' | 'time_out' }) => {
      if (!coachId) throw new Error("Coach ID not found");
      console.log(`Updating ${field} for session: ${sessionId}, coach: ${coachId}, user: ${user?.id}`);

      const currentTime = new Date().toISOString();

      // Validate coach_id matches authenticated user
      const { data: coach, error: coachError } = await supabase
        .from("coaches")
        .select("id, role")
        .eq("auth_id", user?.id)
        .single();

      if (coachError || !coach || (coach.id !== coachId && coach.role !== 'admin')) {
        console.error(`Coach ID validation failed:`, coachError, { expected: coachId, found: coach?.id, role: coach?.role });
        throw new Error(`Invalid coach ID: ${coachError?.message || 'Coach ID does not match authenticated user or user is not admin'}`);
      }

      // Invalidate cache
      await queryClient.invalidateQueries({ queryKey: ["coach-attendance", sessionId, coachId] });
      await queryClient.invalidateQueries({ queryKey: ["coach-session-times", sessionId] });

      // Check for existing record
      const { data: existingRecords, error: fetchError } = await supabase
        .from("coach_session_times")
        .select("id, session_id, coach_id, time_in, time_out")
        .eq("session_id", sessionId)
        .eq("coach_id", coachId);

      if (fetchError) {
        console.error(`Error checking existing record for ${field}:`, fetchError, fetchError.details, fetchError.hint, fetchError.code);
        throw new Error(`Failed to check existing record: ${fetchError.message}`);
      }

      console.log(`Existing records for session_id: ${sessionId}, coach_id: ${coachId}`, existingRecords);

      let data: CoachSessionTime;
      if (existingRecords && existingRecords.length === 1) {
        // Update existing record
        const { data: updatedData, error: updateError } = await supabase
          .from("coach_session_times")
          .update({ [field]: currentTime })
          .eq("session_id", sessionId)
          .eq("coach_id", coachId)
          .select("id, session_id, coach_id, time_in, time_out")
          .single();

        if (updateError) {
          console.error(`Error updating ${field}:`, updateError, updateError.details, updateError.hint, updateError.code);
          throw new Error(`Failed to update ${field}: ${updateError.message}`);
        }
        data = updatedData as CoachSessionTime;
      } else if (existingRecords && existingRecords.length > 1) {
        console.error(`Multiple records found for session_id: ${sessionId}, coach_id: ${coachId}`, existingRecords);
        throw new Error(`Multiple attendance records found for this coach and session`);
      } else if (field === 'time_in') {
        // Insert new record for time_in
        const { data: insertedData, error: insertError } = await supabase
          .from("coach_session_times")
          .insert({
            session_id: sessionId,
            coach_id: coachId,
            time_in: currentTime,
          })
          .select("id, session_id, coach_id, time_in, time_out")
          .single();

        if (insertError) {
          console.error(`Error inserting ${field}:`, insertError, insertError.details, insertError.hint, insertError.code);
          throw new Error(`Failed to insert ${field}: ${insertError.message}`);
        }
        data = insertedData as CoachSessionTime;
      } else {
        console.error(`No record found for time_out: session_id: ${sessionId}, coach_id: ${coachId}`);
        throw new Error(`Cannot record time_out: No existing attendance record found`);
      }

      // Update session status to 'completed' on time_out
      if (field === 'time_out') {
        const { error: sessionError } = await supabase
          .from("training_sessions")
          .update({ status: 'completed' })
          .eq("id", sessionId);

        if (sessionError) {
          console.error(`Error updating session status:`, sessionError, sessionError.details, sessionError.hint, sessionError.code);
          throw new Error(`Failed to update session status: ${sessionError.message}`);
        }
      }

      console.log(`Successfully updated ${field}:`, data);
      return data;
    },
    onSuccess: (data, variables) => {
      toast.success(`${variables.field === 'time_in' ? 'Time In' : 'Time Out'} recorded successfully`);
      queryClient.setQueryData(["coach-attendance", variables.sessionId, coachId], data);
      queryClient.invalidateQueries({ queryKey: ["coach-attendance", variables.sessionId, coachId] });
      queryClient.invalidateQueries({ queryKey: ["coach-session-times", variables.sessionId] });
      queryClient.invalidateQueries({ queryKey: ["coach-sessions", coachId, branchFilter, packageFilter, statusFilter, sessionSearchTerm] });
    },
    onError: (error, variables) => {
      console.error(`Failed to record ${variables.field}:`, error);
      toast.error(`Failed to record ${variables.field}: ${error.message}`);
    },
  });

  const updateAttendance = useMutation({
    mutationFn: async ({ recordId, status, session_duration }: { recordId: string; status: AttendanceStatus; session_duration?: number }) => {
      console.log("Updating attendance:", recordId, status, session_duration);
      const updateData: any = { 
        status, 
        marked_at: status !== "pending" ? new Date().toISOString() : null 
      };
      
      // Find record for student_id and existing cycle
      const targetRecord = attendanceRecords?.find((r) => r.id === recordId);
      
      // Check if this is a Personal Training package
      const packageType = targetRecord?.students?.package_type?.toLowerCase() || '';
      const isPersonalPackage = packageType.includes('personal');

      // Only set session_duration for Personal Training packages when marking as present
      if (status === 'present') {
        if (isPersonalPackage) {
          // For Personal Training packages, require duration to be provided
          if (session_duration !== undefined && session_duration !== null && session_duration > 0) {
            updateData.session_duration = Number(session_duration);
            console.log('Setting session_duration to:', updateData.session_duration, 'for Personal Training package');
          } else {
            // If no duration provided for personal package, default to 1.0
            updateData.session_duration = 1.0;
            console.log('Using default session_duration: 1.0 for Personal Training package');
          }
        } else {
          // For non-personal packages, always use 1.0
          updateData.session_duration = 1.0;
          console.log('Using default session_duration: 1.0 for non-personal package');
        }

        // Determine package_cycle if missing
        if (targetRecord?.package_cycle == null && targetRecord?.student_id) {
          const { count: historyCount } = await (supabase as any)
            .from("student_package_history")
            .select("id", { count: "exact", head: true })
            .eq("student_id", targetRecord.student_id);
          const cycle = (historyCount || 0) + 1;
          updateData.package_cycle = cycle;
        }
      }
      
      console.log('Updating attendance with data:', updateData);
      const { error } = await supabase
        .from("attendance_records")
        .update(updateData)
        .eq("id", recordId);
      if (error) {
        console.error("Error updating attendance:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Attendance updated");
      queryClient.invalidateQueries({ queryKey: ["attendance", selectedSession] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setUpdatingRecordId(null);
    },
    onError: (error) => {
      console.error("Attendance update failed:", error);
      toast.error("Failed to update attendance");
      setUpdatingRecordId(null);
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
    const record = attendanceRecords?.find(r => r.id === recordId);
    const packageType = record?.students?.package_type?.toLowerCase() || '';
    const isPersonalPackage = packageType.includes('personal');
    
    // If marking as present and package is personal, show duration dialog
    if (status === 'present' && isPersonalPackage) {
      setPendingAttendanceUpdate({ recordId, status });
      setSelectedDuration(record?.session_duration || 0);
      setShowDurationDialog(true);
    } else {
      // For non-personal packages or non-present status, update directly
      setUpdatingRecordId(recordId);
      updateAttendance.mutate({ recordId, status });
    }
  };

  const handleDurationConfirm = () => {
    if (pendingAttendanceUpdate) {
      console.log('handleDurationConfirm - selectedDuration:', selectedDuration);
      if (selectedDuration <= 0) {
        console.error('Invalid duration selected:', selectedDuration);
        toast.error('Please select a valid duration');
        return;
      }
      setUpdatingRecordId(pendingAttendanceUpdate.recordId);
      updateAttendance.mutate({ 
        recordId: pendingAttendanceUpdate.recordId, 
        status: pendingAttendanceUpdate.status,
        session_duration: selectedDuration
      });
      setShowDurationDialog(false);
      setPendingAttendanceUpdate(null);
      setSelectedDuration(0);
    }
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
      case "pending": return "bg-gray-50 text-amber-700 border-amber-200";
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

  const handleView = (session: TrainingSession) => {
    setSelectedSession(session.id);
    setShowViewModal(true);
  };

  return (
    <>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .hide-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .hide-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 3px;
        }
        .hide-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #cbd5e1;
        }
        .hide-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }
        .hide-scrollbar:hover {
          scrollbar-color: #cbd5e1 transparent;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #79e58f #e5e7eb;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #e5e7eb;
          border-radius: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #79e58f 0%, #5bc46d 100%);
          border-radius: 8px;
          border: 2px solid #e5e7eb;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #5bc46d 0%, #4db35e 100%);
        }
        .custom-scrollbar::-webkit-scrollbar-corner {
          background: #e5e7eb;
        }
      `}</style>
      <div className="min-h-screen bg-background p-3 sm:p-4 lg:p-6 pb-24 md:pb-6">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 lg:space-y-8">
        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#242833] tracking-tight">
              Attendance Management
            </h1>
            <p className="text-sm sm:text-base text-gray-700">
              Track and manage player attendance for your training sessions
            </p>
          </div>
        </div>

        {!sessionId && (
          <Card className="border-2 border-[#242833] bg-white/90 backdrop-blur-sm shadow-lg relative overflow-visible">
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
              <rect
                x="2"
                y="2"
                width="calc(100% - 4)"
                height="calc(100% - 4)"
                fill="none"
                stroke="#79e58f"
                strokeWidth="2"
                rx="8"
              />
            </svg>
            <CardHeader className="border-b border-[#242833] bg-[#242833] p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-[#efeff1] flex items-center">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 mr-2 sm:mr-3 text-accent" style={{ color: '#79e58f' }} />
                Your Training Sessions
              </CardTitle>
              <CardDescription className="text-gray-400 text-sm sm:text-base">
                Select a training session to manage player attendance
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 lg:p-8 overflow-visible">
              <div className="mb-6 space-y-4 sm:space-y-6">
                <div className="flex items-center mb-4">
                  <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-accent mr-2" style={{ color: '#79e58f' }} />
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-foreground">Filter Sessions</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Branch</label>
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                      <SelectTrigger className="border-accent focus:border-accent focus:ring-accent/20 text-xs sm:text-sm h-8 sm:h-10" style={{ borderColor: '#79e58f' }}>
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
                      onValueChange={setPackageFilter}
                    >
                      <SelectTrigger className="border-accent focus:border-accent focus:ring-accent/20 text-xs sm:text-sm h-8 sm:h-10" style={{ borderColor: '#79e58f' }}>
                        <SelectValue placeholder="Select package type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Sessions</SelectItem>
                        {packages?.map(pkg => (
                          <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Status</label>
                    <Select value={statusFilter} onValueChange={(value: SessionStatus) => setStatusFilter(value)}>
                      <SelectTrigger className="border-accent focus:border-accent focus:ring-accent/20 text-xs sm:text-sm h-8 sm:h-10" style={{ borderColor: '#79e58f' }}>
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
                    style={{ borderColor: '#79e58f' }}
                  />
                </div>
                <p className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredSessions.length} session{filteredSessions.length === 1 ? '' : 's'}
                </p>
              </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSessions.map((session) => (
                  <Card
                    key={session.id}
                    className={`bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden ${
                      selectedSession === session.id ? "ring-2 ring-[#79e58f] ring-offset-2" : ""
                    }`}
                  >
                    {/* Header */}
                    <div className="bg-[#242833] p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 bg-[#79e58f] rounded-full flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-white font-semibold text-sm leading-tight">
                              {format(new Date(session.date + 'T00:00:00'), 'MMM dd, yyyy')}
                            </p>
                            <p className="text-gray-400 text-xs">
                              {format(new Date(session.date + 'T00:00:00'), 'EEEE')}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
                          session.status === 'completed' 
                            ? 'bg-emerald-500 text-white' 
                            : session.status === 'cancelled' 
                              ? 'bg-red-500 text-white' 
                              : 'bg-blue-500 text-white'
                        }`}>
                          {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                        </span>
                      </div>
                      {/* Package Type Badge */}
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 bg-[#79e58f]/20 text-[#79e58f] rounded text-xs font-medium">
                          {session.package_name || 'No Package'}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <CardContent className="p-4">
                      {/* Time Highlight */}
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg mb-3">
                        <Clock className="w-4 h-4 text-[#79e58f] flex-shrink-0" />
                        <span className="text-sm font-medium text-[#242833]">
                          {formatTime12Hour(session.start_time, session.date)} - {formatTime12Hour(session.end_time, session.date)}
                        </span>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="text-center p-2 bg-gray-50 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Branch</p>
                          <p className="text-xs font-semibold text-gray-900 truncate">{session.branches.name}</p>
                        </div>
                        <div className="text-center p-2 bg-emerald-50 rounded-lg">
                          <p className="text-[10px] text-emerald-600 uppercase">Players</p>
                          <p className="text-sm font-bold text-emerald-700">{session.session_participants?.length || 0}</p>
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleView(session);
                          }}
                          className="text-xs h-8 px-3 text-white"
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
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleManageAttendance(session.id);
                          }}
                          className="text-xs h-8 px-3 bg-[#79e58f] hover:bg-[#5bc46d] text-white"
                        >
                          Manage
                        </Button>
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

        <Dialog open={!!selectedSessionModal} onOpenChange={() => setSelectedSessionModal(null)}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md md:max-w-lg lg:max-w-2xl border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
            <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
              <DialogTitle className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                </div>
                <span className="truncate">Session Details</span>
              </DialogTitle>
              <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13">
                {selectedSessionModal ? formatDate(selectedSessionModal.date) : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="p-3 sm:p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar">
              {selectedSessionModal && (
                <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Time</p>
                      <p className="font-semibold text-black text-sm sm:text-base">
                        {formatTime12Hour(selectedSessionModal.start_time, selectedSessionModal.date)} - {formatTime12Hour(selectedSessionModal.end_time, selectedSessionModal.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Branch</p>
                      <p className="font-semibold text-black text-sm sm:text-base">{selectedSessionModal.branches.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Package Type</p>
                      <p className="font-semibold text-black text-sm sm:text-base">{selectedSessionModal.package_name || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Players</p>
                      <p className="font-semibold text-black text-sm sm:text-base">{selectedSessionModal.session_participants?.length || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge className={`${getStatusBadgeColor(selectedSessionModal.status)} font-medium px-2 sm:px-3 py-1 text-xs sm:text-sm`}>
                      {selectedSessionModal.status.charAt(0).toUpperCase() + selectedSessionModal.status.slice(1)}
                    </Badge>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => handleManageAttendance(selectedSessionModal.id)}
                    className="bg-accent hover:bg-accent/90 text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg text-sm sm:text-base px-4 sm:px-6"
                    style={{ backgroundColor: '#79e58f' }}
                  >
                    Manage Attendance
                  </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* View Modal */}
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-3xl border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
            <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
              <DialogTitle className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                </div>
                <span className="truncate">Session Details</span>
              </DialogTitle>
              <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13">
                View details of the selected training session
              </DialogDescription>
            </DialogHeader>
            <div className="p-3 sm:p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar">
              {selectedSessionDetails && (
                <div className="space-y-4">
                  <div className="p-3 sm:p-4 rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-accent" style={{ color: "#79e58f" }} />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">
                          Date: {formatDate(selectedSessionDetails.date)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">
                          Time: {formatTime12Hour(selectedSessionDetails.start_time, selectedSessionDetails.date)} - {formatTime12Hour(selectedSessionDetails.end_time, selectedSessionDetails.date)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Branch: {selectedSessionDetails?.branches.name || "N/A"}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">
                          Package: {selectedSessionDetails?.package_name || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">
                          Players: {selectedSessionDetails?.session_participants?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm font-medium text-gray-700">Coach Attendance</Label>
                    <div className="border-2 rounded-lg p-3 max-h-48 overflow-y-auto bg-white shadow-sm hide-scrollbar" style={{ borderColor: "#242833" }}>
                      {sessionCoaches?.length === 0 ? (
                        <p className="text-xs sm:text-sm text-gray-600">No coaches assigned.</p>
                      ) : (
                        sessionCoaches?.map((sc) => {
                          const coachTime = coachSessionTimes?.find((cst) => cst.coach_id === sc.coach_id);
                          return (
                            <div key={sc.coach_id} className="flex flex-col space-y-2 p-2 border-b last:border-b-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs sm:text-sm font-medium text-gray-700">{sc.coaches.name}</span>
                              </div>
                              <div className="flex flex-col space-y-1">
                                <span className="text-xs sm:text-sm text-gray-600">Time In: {formatDateTime(coachTime?.time_in)}</span>
                                <span className="text-xs sm:text-sm text-gray-600">Time Out: {formatDateTime(coachTime?.time_out)}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm font-medium text-gray-700">Participants</Label>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mb-4 gap-2">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Present: {presentCount}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <XCircle className="w-4 h-4 text-red-600" />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Absent: {absentCount}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Pending: {pendingCount}</span>
                      </div>
                    </div>
                    <div className="border-2 rounded-lg p-3 max-h-48 overflow-y-auto bg-white shadow-sm hide-scrollbar" style={{ borderColor: "#242833" }}>
                      {filteredAttendanceRecords.length === 0 ? (
                        <p className="text-xs sm:text-sm text-gray-600">No participants assigned.</p>
                      ) : (
                        filteredAttendanceRecords.map((record) => (
                          <div key={record.id} className="flex items-center justify-between p-2">
                            <div className="flex items-center space-x-3">
                              <span className="text-xs sm:text-sm text-gray-700">{record.students.name}</span>
                              <Badge className={`font-medium ${getAttendanceBadgeColor(record.status)} text-xs`}>
                                {getAttendanceIcon(record.status)}
                                <span className="ml-1 capitalize">{record.status}</span>
                              </Badge>
                            </div>
                          </div>
                        ))
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
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAttendanceModal} onOpenChange={() => {
          setShowAttendanceModal(false);
          setActiveTab('coaches');
          if (sessionId) {
            setSelectedSession(null);
            navigate('/dashboard/attendance');
          }
        }}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl md:max-w-2xl lg:max-w-4xl border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
            <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
              <DialogTitle className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate">Manage Attendance</span>
                  {selectedSessionDetails && (
                    <span className="text-[10px] sm:text-xs md:text-sm font-normal block text-gray-300 mt-0.5 truncate">
                      {formatDate(selectedSessionDetails.date)} • {formatTime12Hour(selectedSessionDetails.start_time, selectedSessionDetails.date)}
                    </span>
                  )}
                </div>
              </DialogTitle>
              <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13 hidden sm:block">
                Update attendance for players and coaches
              </DialogDescription>
            </DialogHeader>
            <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="p-3 sm:p-4 rounded-lg bg-gray-50 border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm text-gray-700">
                      <span className="font-medium">Coaches:</span>{" "}
                      {sessionCoaches?.map(c => c.coaches.name).join(', ') || 'N/A'}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-700">
                      <span className="font-medium">Branch:</span> {selectedSessionDetails?.branches?.name || 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm text-gray-700">
                      <span className="font-medium">Package Type:</span> {selectedSessionDetails?.package_name || 'N/A'}
                    </p>
                    <div className="text-xs sm:text-sm text-gray-700">
                      <span className="font-medium">Status:</span>{" "}
                      <Badge className={`${getStatusBadgeColor(selectedSessionDetails?.status || '')} text-xs sm:text-sm`}>
                        {selectedSessionDetails?.status ? selectedSessionDetails.status.charAt(0).toUpperCase() + selectedSessionDetails.status.slice(1) : 'N/A'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-b border-gray-200">
                <nav className="flex space-x-4 sm:space-x-8" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('coaches')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                      activeTab === 'coaches'
                        ? 'border-[#79e58f] text-[#79e58f]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm">Coach Attendance</span>
                      <span className="bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">
                        {sessionCoaches?.length || 0}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('players')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                      activeTab === 'players'
                        ? 'border-[#79e58f] text-[#79e58f]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm">Player Attendance</span>
                      <span className="bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">
                        {filteredAttendanceRecords?.length || 0}
                      </span>
                    </div>
                  </button>
                </nav>
              </div>

              <div className="min-h-[300px] sm:min-h-[400px]">
                {activeTab === 'coaches' ? (
                  <div className="space-y-4">
                    <div className="border-2 rounded-lg p-3 sm:p-4 max-h-64 sm:max-h-80 overflow-y-auto bg-white shadow-sm hide-scrollbar" style={{ borderColor: "#242833" }}>
                      {sessionCoaches?.length === 0 ? (
                        <p className="text-xs sm:text-sm text-gray-600 text-center py-8">No coaches assigned.</p>
                      ) : (
                        <div className="space-y-4">
                          {sessionCoaches?.map((sc) => (
                            <div key={sc.coach_id} className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                                <span className="text-sm sm:text-base font-medium text-gray-700">{sc.coaches.name}</span>
                                {sc.coach_id === coachId && (
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => selectedSession && updateCoachAttendance.mutate({ sessionId: selectedSession, field: 'time_in' })}
                                      disabled={updateCoachAttendance.isPending || !!coachAttendance?.time_in}
                                      className="bg-green-600 text-white hover:bg-green-700 flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm"
                                    >
                                      Time In
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => selectedSession && updateCoachAttendance.mutate({ sessionId: selectedSession, field: 'time_out' })}
                                      disabled={updateCoachAttendance.isPending || !!coachAttendance?.time_out || !coachAttendance?.time_in}
                                      className="bg-red-600 text-white hover:bg-red-700 flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm"
                                    >
                                      Time Out
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                                <div>
                                  <span className="text-xs sm:text-sm text-gray-600 block mb-1">Time In:</span>
                                  <span className="text-xs sm:text-sm font-medium">
                                    {sc.coach_id === coachId ? formatDateTime(coachAttendance?.time_in) : 'Restricted: Only you can view your own time records'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-xs sm:text-sm text-gray-600 block mb-1">Time Out:</span>
                                  <span className="text-xs sm:text-sm font-medium">
                                    {sc.coach_id === coachId ? formatDateTime(coachAttendance?.time_out) : 'Restricted: Only you can view your own time records'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Search className="h-3 w-3 sm:h-4 sm:w-4 text-accent mr-2" style={{ color: '#79e58f' }} />
                        <h3 className="text-sm sm:text-base font-semibold text-[#242833]">Search Players</h3>
                      </div>
                      <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search by player name..."
                          className="pl-8 sm:pl-10 pr-4 py-2 w-full border-2 border-accent/40 rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-1 focus:ring-accent bg-white"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          style={{ borderColor: '#79e58f' }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 lg:gap-6 p-3 sm:p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Present: {presentCount}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Absent: {absentCount}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600" />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Pending: {pendingCount}</span>
                      </div>
                    </div>
                    <div className="border-2 rounded-lg p-3 sm:p-4 max-h-64 sm:max-h-80 overflow-y-auto bg-white shadow-sm hide-scrollbar" style={{ borderColor: "#242833" }}>
                      {filteredAttendanceRecords.length === 0 ? (
                        <p className="text-xs sm:text-sm text-gray-600 text-center py-8">
                          {searchTerm ? 'No players found.' : 'No attendance records'}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {filteredAttendanceRecords.map((record) => (
                            <div key={record.id} className="flex flex-col gap-3 p-3 sm:p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm" style={{ backgroundColor: '#79e58f' }}>
                                    {record.students.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </div>
                                  <div>
                                    <span className="text-sm sm:text-base font-semibold text-gray-800 block">{record.students.name}</span>
                                    <span className="text-xs text-gray-500">{record.students.package_type || 'No package'}</span>
                                  </div>
                                </div>
                                <Badge className={`font-medium ${getAttendanceBadgeColor(record.status)} text-xs hidden sm:flex`}>
                                  {getAttendanceIcon(record.status)}
                                  <span className="ml-1 capitalize">{record.status}</span>
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleAttendanceChange(record.id, 'present')}
                                  disabled={updatingRecordId === record.id}
                                  className={`flex-1 sm:flex-none h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    record.status === 'present'
                                      ? 'bg-green-600 text-white shadow-md ring-2 ring-green-300'
                                      : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                                  }`}
                                >
                                  {updatingRecordId === record.id ? (
                                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                                  )}
                                  Present
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleAttendanceChange(record.id, 'absent')}
                                  disabled={updatingRecordId === record.id}
                                  className={`flex-1 sm:flex-none h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    record.status === 'absent'
                                      ? 'bg-red-600 text-white shadow-md ring-2 ring-red-300'
                                      : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                                  }`}
                                >
                                  {updatingRecordId === record.id ? (
                                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                                  )}
                                  Absent
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleAttendanceChange(record.id, 'pending')}
                                  disabled={updatingRecordId === record.id}
                                  className={`flex-1 sm:flex-none h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    record.status === 'pending'
                                      ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-300'
                                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                  }`}
                                >
                                  {updatingRecordId === record.id ? (
                                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                                  )}
                                  Pending
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-row flex-wrap justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAttendanceModal(false);
                    setActiveTab('coaches');
                    if (sessionId) {
                      setSelectedSession(null);
                      navigate('/dashboard/attendance');
                    }
                  }}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 min-w-fit w-auto px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    toast.success("Attendance saved successfully!");
                    setShowAttendanceModal(false);
                    setActiveTab('coaches');
                    if (sessionId) {
                      setSelectedSession(null);
                      navigate('/dashboard/attendance');
                    }
                  }}
                  className="bg-accent hover:bg-[#5bc46d] text-white min-w-fit w-auto px-3 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm"
                  style={{ backgroundColor: "#79e58f" }}
                >
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Session Duration Dialog */}
        <Dialog open={showDurationDialog} onOpenChange={setShowDurationDialog}>
          <DialogContent className="w-[90vw] max-w-[90vw] sm:max-w-sm md:max-w-md border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
            <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
              <DialogTitle className="text-sm sm:text-base md:text-lg font-bold text-white flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                  <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                </div>
                <span className="truncate">Session Duration</span>
              </DialogTitle>
              <DialogDescription className="text-[10px] sm:text-xs md:text-sm text-gray-300 mt-1 ml-9 sm:ml-11 md:ml-13">
                Select duration for Personal Training
              </DialogDescription>
            </DialogHeader>
            <div className="p-3 sm:p-4 md:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div className="space-y-2">
                <Label htmlFor="duration" className="text-sm font-medium text-gray-700">
                  Duration
                </Label>
                <Select
                  value={selectedDuration > 0 ? selectedDuration.toString() : undefined}
                  onValueChange={(value) => {
                    const duration = parseFloat(value);
                    console.log('Duration selected:', value, 'parsed as:', duration);
                    setSelectedDuration(duration);
                  }}
                >
                  <SelectTrigger id="duration" className="w-full border-2 border-gray-200 rounded-lg focus:border-[#79e58f] focus:ring-[#79e58f]/20">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.5">0.5 Session (30 mins)</SelectItem>
                    <SelectItem value="1">1 Session (1 hour)</SelectItem>
                    <SelectItem value="1.5">1.5 Sessions (1.5 hours)</SelectItem>
                    <SelectItem value="2">2 Sessions (2 hours)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-2">
                  {selectedDuration > 0 ? (
                    <>This will deduct {selectedDuration} {selectedDuration === 1 ? 'session' : 'sessions'} from the student's remaining sessions.</>
                  ) : (
                    <>Please select a duration.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDurationDialog(false);
                  setPendingAttendanceUpdate(null);
                  setSelectedDuration(0);
                }}
                className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDurationConfirm}
                disabled={selectedDuration <= 0}
                className="bg-green-600 hover:bg-green-700 text-white transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Confirm
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {!selectedSession && !sessionId && (
          <div className="hidden md:block text-center py-8 sm:py-16">
            <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-24 lg:h-24 rounded-full bg-accent flex items-center justify-center mx-auto mb-4 sm:mb-6" style={{ backgroundColor: '#79e58f' }}>
              <Calendar className="w-6 h-6 sm:w-8 sm:h-8 lg:w-12 lg:h-12 text-white" />
            </div>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-[#242833] mb-2 sm:mb-3">Select a Training Session</h3>
            <p className="text-sm sm:text-base lg:text-lg text-gray-600">Choose a session from above to start managing attendance.</p>
          </div>
        )}
        </div>
      </div>
    </>
  );
}