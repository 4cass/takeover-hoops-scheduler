import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, Calendar, MapPin, User, Users, Filter, Search, ChevronLeft, ChevronRight, Eye, Pencil, Activity, AlertCircle, Edit3, GraduationCap, LogIn, LogOut, Package, Save, UserCheck, X, Download } from "lucide-react";
import { exportToCSV } from "@/utils/exportUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { format, addDays, subDays, parse, parseISO, format as formatDateFns } from "date-fns";
import { CoachAttendanceManager } from "./CoachAttendanceManager";
import { Database } from "@/integrations/supabase/types";

type AttendanceStatus = "present" | "absent" | "pending";
type SessionStatus = "scheduled" | "completed" | "cancelled";

interface Coach {
  id: string;
  name: string;
  auth_id: string;
  role: string;
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

interface Student {
  id: string;
  name: string;
}

interface CoachSessionTime {
  id: string;
  session_id: string;
  coach_id: string;
  time_in: string | null;
  time_out: string | null;
  coaches: { name: string } | null;
}

interface TrainingSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: SessionStatus;
  package_type: string | null;
  branch_id: string;
  branches: { name: string };
  session_coaches: Array<{
    id: string;
    coach_id: string;
    coaches: { name: string };
  }>;
  session_participants: Array<{
    id: string;
    student_id: string;
    students: { name: string };
  }>;
  coach_session_times: Array<CoachSessionTime>;
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_at: string | null;
  session_duration: number | null;
  package_cycle: number | null;
  students: { 
    name: string;
    package_type: string | null;
  };
}

interface UpdateAttendanceVariables {
  recordId: string;
  status: AttendanceStatus;
  session_duration?: number;
}

// Utility functions
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

    return formatDateFns(parsedTime, "h:mm a");
  } catch {
    return "Invalid time";
  }
};

const formatDate = (date: string | null | undefined): string => {
  if (!date) return "N/A";
  try {
    return formatDateFns(parseISO(date), "MMMM d, yyyy");
  } catch {
    return "Invalid date";
  }
};

const formatDateTime = (dateTime: string | null | undefined): string => {
  if (!dateTime) return "N/A";
  try {
    return formatDateFns(parseISO(dateTime), "MMMM d, yyyy h:mm a");
  } catch {
    return "Invalid date/time";
  }
};

export function AttendanceManager() {
  const { role, user } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionIdFromUrl = searchParams.get("sessionId");
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'coaches' | 'players'>('coaches');
  const [selectedSession, setSelectedSession] = useState<string | null>(sessionIdFromUrl);
  const [searchTerm, setSearchTerm] = useState("");
  const [sessionSearchTerm, setSessionSearchTerm] = useState("");
  const [filterPackageType, setFilterPackageType] = useState<string>("All");
  const [filterSessionStatus, setFilterSessionStatus] = useState<"All" | SessionStatus>("All");
  const [branchFilter, setBranchFilter] = useState<string>("All");
  const [coachFilter, setCoachFilter] = useState<string>("All");
  const [sortOrder, setSortOrder] = useState<"Newest to Oldest" | "Oldest to Newest">("Newest to Oldest");
  const [showDurationDialog, setShowDurationDialog] = useState(false);
  const [pendingAttendanceUpdate, setPendingAttendanceUpdate] = useState<{ recordId: string; status: AttendanceStatus } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(0);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentCoachId, setCurrentCoachId] = useState<string | null>(null);
  const itemsPerPage = 6;

  useEffect(() => {
    if (sessionIdFromUrl) {
      setSelectedSession(sessionIdFromUrl);
      setShowAttendanceModal(true);
    }
  }, [sessionIdFromUrl]);

  useEffect(() => {
    const fetchCoachId = async () => {
      if (user) {
        const { data, error } = await supabase
          .from("coaches")
          .select("id")
          .eq("auth_id", user.id)
          .single();
        if (error) {
          console.error("Error fetching coach ID:", error);
          toast.error("Failed to fetch coach ID");
          return;
        }
        setCurrentCoachId(data.id);
      }
    };
    fetchCoachId();
  }, [user]);

  const { data: sessions, isLoading: sessionsLoading, error: sessionsError } = useQuery<TrainingSession[], Error>({
    queryKey: ["sessions"],
    queryFn: async () => {
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
          branches (name),
          session_coaches (id, coach_id, coaches (name)),
          session_participants (id, student_id, students (name)),
          coach_session_times (id, session_id, coach_id, time_in, time_out, coaches (name))
        `)
        .gte("date", format(pastDate, "yyyy-MM-dd"))
        .lte("date", format(futureDate, "yyyy-MM-dd"))
        .order("date", { ascending: sortOrder === "Oldest to Newest" });

      if (error) {
        console.error("Error fetching sessions:", error);
        toast.error(`Failed to fetch sessions: ${error.message}`);
        throw error;
      }

      return (data || []) as TrainingSession[];
    },
  });

  const { data: branches, isLoading: branchesLoading, error: branchesError } = useQuery<Branch[], Error>({
    queryKey: ["branches-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .order("name");

      if (error) {
        console.error("Error fetching branches:", error);
        toast.error(`Failed to fetch branches: ${error.message}`);
        throw error;
      }
      return (data || []) as Branch[];
    },
  });

  const { data: coaches, isLoading: coachesLoading, error: coachesError } = useQuery<Coach[], Error>({
    queryKey: ["coaches-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coaches")
        .select("id, name, auth_id, role")
        .order("name");

      if (error) {
        console.error("Error fetching coaches:", error);
        toast.error(`Failed to fetch coaches: ${error.message}`);
        throw error;
      }
      return (data || []) as Coach[];
    },
  });

  const { data: packages, isLoading: packagesLoading, error: packagesError } = useQuery<Package[], Error>({
    queryKey: ["packages-select"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("packages")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error("Error fetching packages:", error);
        toast.error(`Failed to fetch packages: ${error.message}`);
        throw error;
      }
      return (data || []) as Package[];
    },
  });

  const { data: attendanceRecords, isLoading: attendanceLoading, error: attendanceError } = useQuery<AttendanceRecord[], Error>({
    queryKey: ["attendance", selectedSession],
    queryFn: async () => {
      if (!selectedSession) return [];
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
        toast.error(`Failed to fetch attendance records: ${error.message}`);
        throw error;
      }

      return (data as any) || [];
    },
    enabled: !!selectedSession,
  });

  const updateAttendance = useMutation<void, Error, UpdateAttendanceVariables>({
    mutationFn: async ({ recordId, status, session_duration }) => {
      const updateData: any = { 
        status, 
        marked_at: status !== "pending" ? new Date().toISOString() : null 
      };
      // Find record for student_id and existing cycle
      const targetRecord = attendanceRecords?.find((r) => r.id === recordId);

      // Always explicitly set session_duration when marking as present
      // This prevents the database default (1.0) from being used
      if (status === 'present') {
        if (session_duration !== undefined && session_duration !== null && session_duration > 0) {
          // Use the provided duration (for personal packages)
          updateData.session_duration = Number(session_duration); // Ensure it's a number
          console.log('Setting session_duration to:', updateData.session_duration, 'type:', typeof updateData.session_duration);
        } else {
          // For non-personal packages marking as present, default to 1.0
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
      console.log('session_duration value being sent:', updateData.session_duration, 'type:', typeof updateData.session_duration);
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
    },
    onError: (error) => {
      console.error("Attendance update failed:", error);
      toast.error(`Failed to update attendance: ${error.message}`);
    },
  });

  const timeInMutation = useMutation<
    CoachSessionTime,
    Error,
    { sessionId: string; coachId: string }
  >({
    mutationFn: async ({ sessionId, coachId }) => {
      if (role !== "admin" && role !== "coach") {
        throw new Error("User does not have permission to log time");
      }

      const { data, error } = await supabase
        .from("coach_session_times")
        .upsert(
          { session_id: sessionId, coach_id: coachId, time_in: new Date().toISOString() },
          { onConflict: "session_id,coach_id" }
        )
        .select("id, session_id, coach_id, time_in, time_out, coaches(name)")
        .single();

      if (error || !data) {
        console.error("Time in error:", error || "No data returned");
        throw new Error(error?.message || "No data returned from upsert");
      }

      const { error: logError } = await supabase.from("activity_logs").insert({
        user_id: coachId,
        user_type: role || "admin",
        session_id: sessionId,
        activity_type: "time_in",
        activity_description: `Coach timed in at ${formatDateTime(new Date().toISOString())}`,
      });

      if (logError) {
        console.error("Error logging time in:", logError);
        throw new Error(
          logError.message.includes("row-level security")
            ? "Permission denied: Check activity_logs RLS policy"
            : logError.message
        );
      }

      return { ...data, coaches: data.coaches || null } as CoachSessionTime;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      toast.success("Successfully timed in");
    },
    onError: (error) => {
      console.error("Time in error:", error);
      toast.error(`Failed to record time in: ${error.message}`);
    },
  });

  const timeOutMutation = useMutation<
    CoachSessionTime,
    Error,
    { sessionId: string; coachId: string }
  >({
    mutationFn: async ({ sessionId, coachId }) => {
      const { data, error } = await supabase
        .from("coach_session_times")
        .update({ time_out: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("coach_id", coachId)
        .select("id, session_id, coach_id, time_in, time_out, coaches(name)")
        .single();

      if (error || !data) {
        console.error("Time out error:", error || "No data returned");
        throw new Error(error?.message || "No data returned from update");
      }

      const { error: logError } = await supabase.from("activity_logs").insert({
        user_id: coachId,
        user_type: role || "admin",
        session_id: sessionId,
        activity_type: "time_out",
        activity_description: `Coach timed out at ${formatDateTime(new Date().toISOString())}`,
      });

      if (logError) {
        console.error("Error logging time out:", logError);
        throw new Error(
          logError.message.includes("row-level security")
            ? "Permission denied: Check activity_logs RLS policy"
            : logError.message
        );
      }

      return { ...data, coaches: data.coaches || null } as CoachSessionTime;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      toast.success("Successfully timed out");
    },
    onError: (error) => {
      console.error("Time out error:", error);
      toast.error(`Failed to record time out: ${error.message}`);
    },
  });

  const updateCoachTimeMutation = useMutation<
    void,
    Error,
    { sessionId: string; coachId: string; time_in?: string | null; time_out?: string | null }
  >({
    mutationFn: async ({ sessionId, coachId, time_in, time_out }) => {
      const updates: { time_in?: string | null; time_out?: string | null; updated_at: string } = {
        updated_at: new Date().toISOString(),
      };
      if (time_in !== undefined) updates.time_in = time_in;
      if (time_out !== undefined) updates.time_out = time_out;

      const { error } = await supabase
        .from("coach_session_times")
        .update(updates)
        .eq("session_id", sessionId)
        .eq("coach_id", coachId);

      if (error) {
        console.error("Update coach time error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Coach time updated");
    },
    onError: (error) => {
      console.error("Update coach time error:", error);
      toast.error(`Failed to update coach time: ${error.message}`);
    },
  });

  const markCoachAbsentMutation = useMutation<
    void,
    Error,
    { sessionId: string; coachId: string }
  >({
    mutationFn: async ({ sessionId, coachId }) => {
      // Mark coach as absent in coach_attendance_records
      // First try to update if record exists
      const { data: existingRecord, error: selectError } = await (supabase as any)
        .from("coach_attendance_records")
        .select("id")
        .eq("session_id", sessionId)
        .eq("coach_id", coachId)
        .maybeSingle();

      // If table doesn't exist or other error, provide helpful message
      if (selectError) {
        // Check if it's a table not found error
        if (selectError.code === 'PGRST116' || selectError.message?.includes('relation') || selectError.message?.includes('does not exist')) {
          throw new Error("Coach attendance table not found. Please run the database migration first.");
        }
        // For other errors, still try to insert/update
        console.warn("Error checking existing record:", selectError);
      }

      if (existingRecord) {
        // Update existing record
        const { error } = await (supabase as any)
          .from("coach_attendance_records")
          .update({
            status: "absent",
            marked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRecord.id);

        if (error) {
          console.error("Mark coach absent error:", error);
          throw new Error(error.message || "Failed to update coach attendance");
        }
      } else {
        // Insert new record
        const { error } = await (supabase as any)
          .from("coach_attendance_records")
          .insert({
            session_id: sessionId,
            coach_id: coachId,
            status: "absent",
            marked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.error("Mark coach absent error:", error);
          // Check if it's a table not found error
          if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
            throw new Error("Coach attendance table not found. Please run the database migration first.");
          }
          throw new Error(error.message || "Failed to mark coach as absent");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Coach marked as absent");
    },
    onError: (error) => {
      console.error("Mark coach absent error:", error);
      toast.error(`Failed to mark coach as absent: ${error.message}`);
    },
  });

  const selectedSessionDetails = sessions?.find((s) => s.id === selectedSession);

  const filteredSessions = sessions
    ?.filter(
      (session) =>
        (session.session_coaches.some((sc) => sc.coaches.name.toLowerCase().includes(sessionSearchTerm.toLowerCase())) ||
          session.branches.name.toLowerCase().includes(sessionSearchTerm.toLowerCase())) &&
        (filterPackageType === "All" || session.package_type === filterPackageType) &&
        (filterSessionStatus === "All" || session.status === filterSessionStatus) &&
        (branchFilter === "All" || session.branch_id === branchFilter) &&
        (coachFilter === "All" || session.session_coaches.some((sc) => sc.coach_id === coachFilter))
    )
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

  const handleAttendanceChange = (recordId: string, status: AttendanceStatus) => {
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
      updateAttendance.mutate({ recordId, status });
    }
  };

  const handleDurationConfirm = () => {
    if (pendingAttendanceUpdate) {
      console.log('handleDurationConfirm - selectedDuration:', selectedDuration, 'type:', typeof selectedDuration);
      if (selectedDuration <= 0) {
        console.error('Invalid duration selected:', selectedDuration);
        toast.error('Please select a valid duration');
        return;
      }
      updateAttendance.mutate({ 
        recordId: pendingAttendanceUpdate.recordId, 
        status: pendingAttendanceUpdate.status,
        session_duration: selectedDuration
      });
      setShowDurationDialog(false);
      setPendingAttendanceUpdate(null);
      setSelectedDuration(0); // Reset after use
    }
  };

  // Generate duration options (30mins, 1hr, 1hr 30mins, 2hrs, etc.)
  const durationOptions = Array.from({ length: 12 }, (_, i) => {
    // Start from 30 mins (0.5 hours), then increment by 30 mins each time
    const totalMinutes = 30 + (i * 30); // 30, 60, 90, 120, etc.
    const durationValue = totalMinutes / 60; // Convert to hours (0.5 = 30mins, 1.0 = 1hr, 1.5 = 1hr 30mins)
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    let label = '';
    if (hours === 0) {
      label = '30 mins';
    } else if (minutes === 0) {
      label = hours === 1 ? '1 hr' : `${hours} hrs`;
    } else {
      label = hours === 1 ? '1 hr 30 mins' : `${hours} hrs 30 mins`;
    }
    
    return { value: durationValue, label };
  });

  const getAttendanceIcon = (status: AttendanceStatus) => {
    switch (status) {
      case "present":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "absent":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-amber-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getAttendanceBadgeColor = (status: AttendanceStatus) => {
    switch (status) {
      case "present":
        return "bg-green-50 text-green-700 border-green-200";
      case "absent":
        return "bg-red-50 text-red-700 border-red-200";
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "completed":
        return "bg-green-50 text-green-700 border-green-200";
      case "cancelled":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const handleView = (session: TrainingSession) => {
    setSelectedSession(session.id);
    setShowViewModal(true);
  };

  if (sessionsLoading || branchesLoading || coachesLoading || packagesLoading) {
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

  if (sessionsError || branchesError || coachesError || packagesError) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <Users className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">Error loading data</h3>
          <p className="text-sm sm:text-base md:text-lg text-gray-600">Failed to load data. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-4 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#181818] mb-2 tracking-tight">Attendance Manager</h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-700">Track and manage player and coach attendance for training sessions</p>
        </div>

        <Card className="border-2 border-[#181A18] bg-white shadow-xl">
          <CardHeader className="border-b border-[#181A18] bg-[#181A18] p-3 sm:p-4 md:p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
              <div>
                <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                  <Calendar className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" style={{ color: "#BEA877" }} />
                  Training Sessions
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs sm:text-sm">
                  Select a training session to manage player and coach attendance
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-5">
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <Filter className="h-4 sm:h-5 w-4 sm:w-5 text-accent mr-2" style={{ color: "#BEA877" }} />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Filter Sessions</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="session-search" className="flex items-center text-xs sm:text-sm font-medium text-gray-700">
                    <Search className="w-4 h-4 mr-2 text-accent" style={{ color: "#BEA877" }} />
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
                      style={{ borderColor: "#BEA877" }}
                    />
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="filter-package" className="flex items-center text-xs sm:text-sm font-medium text-gray-700">
                    <Users className="w-4 h-4 mr-2 text-accent" style={{ color: "#BEA877" }} />
                    Package Type
                  </Label>
                  <Select
                    value={filterPackageType}
                    onValueChange={(value: string) => setFilterPackageType(value)}
                  >
                    <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: "#BEA877" }}>
                      <SelectValue placeholder="Select package type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All" className="text-xs sm:text-sm">All Packages</SelectItem>
                      {packages?.map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.name} className="text-xs sm:text-sm">{pkg.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="filter-branch" className="flex items-center text-xs sm:text-sm font-medium text-gray-700">
                    <MapPin className="w-4 h-4 mr-2 text-accent" style={{ color: "#BEA877" }} />
                    Branch
                  </Label>
                  <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: "#BEA877" }}>
                      <SelectValue placeholder="Select branch" />
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
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="filter-coach" className="flex items-center text-xs sm:text-sm font-medium text-gray-700">
                    <User className="w-4 h-4 mr-2 text-accent" style={{ color: "#BEA877" }} />
                    Coach
                  </Label>
                  <Select value={coachFilter} onValueChange={setCoachFilter}>
                    <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: "#BEA877" }}>
                      <SelectValue placeholder="Select coach" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All" className="text-xs sm:text-sm">All Coaches</SelectItem>
                      {coaches?.map((coach) => (
                        <SelectItem key={coach.id} value={coach.id} className="text-xs sm:text-sm">
                          {coach.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="filter-status" className="flex items-center text-xs sm:text-sm font-medium text-gray-700">
                    <Calendar className="w-4 h-4 mr-2 text-accent" style={{ color: "#BEA877" }} />
                    Session Status
                  </Label>
                  <Select value={filterSessionStatus} onValueChange={(value: "All" | SessionStatus) => setFilterSessionStatus(value)}>
                    <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: "#BEA877" }}>
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
                <div className="flex flex-col space-y-2">
                  <Label htmlFor="sort-order" className="flex items-center text-xs sm:text-sm font-medium text-gray-700">
                    <Calendar className="w-4 h-4 mr-2 text-accent" style={{ color: "#BEA877" }} />
                    Sort Order
                  </Label>
                  <Select value={sortOrder} onValueChange={(value: "Newest to Oldest" | "Oldest to Newest") => setSortOrder(value)}>
                    <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: "#BEA877" }}>
                      <SelectValue placeholder="Select sort order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Newest to Oldest" className="text-xs sm:text-sm">Newest to Oldest</SelectItem>
                      <SelectItem value="Oldest to Newest" className="text-xs sm:text-sm">Oldest to Newest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs sm:text-sm text-gray-600">
                  Showing {filteredSessions.length} session{filteredSessions.length === 1 ? "" : "s"}
                </p>
                {filteredSessions.length > 0 && (
                  <Button
                    onClick={() => {
                      const headers = ['Date', 'Start Time', 'End Time', 'Branch', 'Package Type', 'Status', 'Coaches', 'Participants Count'];
                      exportToCSV(
                        filteredSessions,
                        'attendance_sessions_report',
                        headers,
                        (session) => [
                          format(parseISO(session.date), 'yyyy-MM-dd'),
                          session.start_time || '',
                          session.end_time || '',
                          session.branches?.name || '',
                          session.package_type || '',
                          session.status || '',
                          session.session_coaches?.map(sc => sc.coaches?.name).filter(Boolean).join('; ') || '',
                          String(session.session_participants?.length || 0)
                        ]
                      );
                      toast.success('Attendance sessions report exported to Excel successfully');
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm transition-all duration-300"
                  >
                    <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Export Excel
                  </Button>
                )}
              </div>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="text-center py-12 sm:py-16">
                <Calendar className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2">
                  {sessionSearchTerm || filterPackageType !== "All" || filterSessionStatus !== "All" || branchFilter !== "All" || coachFilter !== "All"
                    ? "No sessions found"
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
                <div className="grid gap-3 sm:gap-4 md:gap-5 lg:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 w-full min-w-0">
                  {paginatedSessions.map((session) => (
                    <Card
                      key={session.id}
                      className="border-2 transition-all duration-300 hover:shadow-lg rounded-lg border-accent w-full min-w-0 max-w-full min-h-[180px] overflow-hidden"
                      style={{ borderColor: "#BEA877" }}
                    >
                      <CardHeader className="pb-2 sm:pb-3">
                        <div className="flex flex-wrap justify-between items-center gap-2 mb-2 min-w-0">
                          <div className="flex items-center space-x-2 min-w-0">
                            <Calendar className="w-4 sm:w-5 h-4 sm:h-5 text-accent flex-shrink-0" style={{ color: "#BEA877" }} />
                            <h3 className="font-bold text-sm sm:text-base md:text-lg text-gray-900 truncate">{formatDate(session.date)}</h3>
                          </div>
                          <Badge className={`font-medium ${getStatusBadgeColor(session.status)} text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1`}>{session.status}</Badge>
                        </div>
                        <div className="flex items-center space-x-2 text-gray-600 min-w-0">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                          <span className="text-xs sm:text-sm md:text-base truncate">
                            {formatTime12Hour(session.start_time, session.date)} - {formatTime12Hour(session.end_time, session.date)}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 lg:p-5 space-y-2 sm:space-y-3">
                        <div className="flex items-center space-x-2 min-w-0">
                          <User className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                          <span className="text-xs sm:text-sm md:text-base truncate">
                            <span className="font-medium">Coaches:</span>{" "}
                            {session.session_coaches.length > 0
                              ? session.session_coaches.map((sc) => sc.coaches.name).join(", ")
                              : "No coaches assigned"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 min-w-0">
                          <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                          <span className="text-xs sm:text-sm md:text-base truncate">
                            <span className="font-medium">Branch:</span> {session.branches.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 min-w-0">
                          <Users className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                          <span className="text-xs sm:text-sm md:text-base truncate">
                            <span className="font-medium">Package:</span> {session.package_type || "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <Users className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                            <span className="text-xs sm:text-sm md:text-base font-medium truncate">{session.session_participants?.length || 0} Players</span>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleView(session)}
                              className="bg-blue-600 text-white hover:bg-blue-700 w-8 h-8 sm:w-10 sm:h-10 p-0 flex items-center justify-center"
                            >
                              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSession(session.id);
                                setShowAttendanceModal(true);
                              }}
                              className="bg-yellow-600 text-white hover:bg-yellow-700 w-8 h-8 sm:w-10 sm:h-10 p-0 flex items-center justify-center"
                            >
                              <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center items-center mt-6 space-x-2 flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="border-2 border-accent text-accent hover:bg-accent hover:text-white w-8 h-8 sm:w-10 sm:h-10 p-0 flex items-center justify-center"
                      style={{ borderColor: "#BEA877", color: "#BEA877" }}
                    >
                      <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        onClick={() => handlePageChange(page)}
                        className={`border-2 w-8 h-8 sm:w-10 sm:h-10 p-0 flex items-center justify-center text-xs sm:text-sm ${
                          currentPage === page ? "bg-accent text-white" : "border-accent text-accent hover:bg-accent hover:text-white"
                        }`}
                        style={{
                          backgroundColor: currentPage === page ? "#BEA877" : "transparent",
                          borderColor: "#BEA877",
                          color: currentPage === page ? "white" : "#BEA877",
                        }}
                      >
                        {page}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="border-2 border-accent text-accent hover:bg-accent hover:text-white w-8 h-8 sm:w-10 sm:h-10 p-0 flex items-center justify-center"
                      style={{ borderColor: "#BEA877", color: "#BEA877" }}
                    >
                      <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl md:max-w-3xl border-2 border-gray-200 bg-white shadow-lg p-3 sm:p-4 md:p-5">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-base sm:text-lg md:text-xl font-bold text-gray-900">Session Details</DialogTitle>
              <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                View details of the selected training session
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 sm:p-4 rounded-lg border border-gray-200 bg-gray-50">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-accent" style={{ color: "#BEA877" }} />
                    <span className="text-xs sm:text-sm font-medium text-gray-700">
                      Date: {selectedSessionDetails ? formatDate(selectedSessionDetails.date) : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700">
                      Time:{" "}
                      {selectedSessionDetails
                        ? `${formatTime12Hour(selectedSessionDetails.start_time, selectedSessionDetails.date)} - ${formatTime12Hour(selectedSessionDetails.end_time, selectedSessionDetails.date)}`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Branch: {selectedSessionDetails?.branches.name || "N/A"}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700">
                      Coaches:{" "}
                      {selectedSessionDetails?.session_coaches.length > 0
                        ? selectedSessionDetails.session_coaches.map((sc) => sc.coaches.name).join(", ")
                        : "No coaches assigned"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700">
                      Package: {selectedSessionDetails?.package_type || "N/A"}
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
                <div className="border-2 rounded-lg p-3 max-h-48 overflow-y-auto bg-[#faf0e8]" style={{ borderColor: "#181A18" }}>
                  {selectedSessionDetails?.session_coaches?.length === 0 ? (
                    <p className="text-xs sm:text-sm text-gray-600">No coaches assigned.</p>
                  ) : (
                    selectedSessionDetails?.session_coaches?.map((sc) => {
                      const coachTime = selectedSessionDetails.coach_session_times?.find((cst) => cst.coach_id === sc.coach_id);
                      return (
                        <div key={sc.id} className="flex flex-col space-y-2 p-2 border-b last:border-b-0">
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
                <div className="border-2 rounded-lg p-3 max-h-48 overflow-y-auto bg-[#faf0e8]" style={{ borderColor: "#181A18" }}>
                  {attendanceLoading ? (
                    <p className="text-xs sm:text-sm text-gray-600">Loading participants...</p>
                  ) : attendanceError ? (
                    <p className="text-xs sm:text-sm text-red-600">Error loading participants: {(attendanceError as Error).message}</p>
                  ) : selectedSessionDetails?.session_participants?.length === 0 ? (
                    <p className="text-xs sm:text-sm text-gray-600">No participants assigned.</p>
                  ) : (
                    selectedSessionDetails?.session_participants?.map((participant) => {
                      const attendance = filteredAttendanceRecords?.find((record) => record.student_id === participant.student_id);
                      return (
                        <div key={participant.id} className="flex items-center justify-between p-2">
                          <div className="flex items-center space-x-3">
                            <span className="text-xs sm:text-sm text-gray-700">{participant.students.name}</span>
                            <Badge className={`font-medium ${getAttendanceBadgeColor(attendance?.status || "pending")} text-xs`}>
                              {getAttendanceIcon(attendance?.status || "pending")}
                              <span className="ml-1 capitalize">{attendance?.status || "pending"}</span>
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
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl border-2 border-gray-200 bg-white shadow-lg p-4 sm:p-6">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                Manage Attendance
                {selectedSessionDetails && (
                  <span className="text-xs sm:text-sm font-normal ml-2">
                    - {formatDate(selectedSessionDetails.date)} at {formatTime12Hour(selectedSessionDetails.start_time, selectedSessionDetails.date)}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                Update attendance for players and coaches in this training session
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 sm:space-y-6">
              <div className="p-3 sm:p-4 rounded-lg bg-gray-50 border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm text-gray-700">
                      <span className="font-medium">Coaches:</span>{" "}
                      {selectedSessionDetails?.session_coaches.length > 0
                        ? selectedSessionDetails.session_coaches.map((sc) => sc.coaches.name).join(", ")
                        : "No coaches assigned"}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-700">
                      <span className="font-medium">Branch:</span> {selectedSessionDetails?.branches.name || "N/A"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs sm:text-sm text-gray-700">
                      <span className="font-medium">Package Type:</span> {selectedSessionDetails?.package_type || "N/A"}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-700">
                      <span className="font-medium">Status:</span>{" "}
                      <Badge className={getStatusBadgeColor(selectedSessionDetails?.status || "")}>{selectedSessionDetails?.status || "N/A"}</Badge>
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-b border-gray-200">
                <nav className="flex space-x-4 sm:space-x-8" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('coaches')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                      activeTab === 'coaches'
                        ? 'border-[#BEA877] text-[#BEA877]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm">Coach Attendance</span>
                      <span className="bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">
                        {selectedSessionDetails?.session_coaches?.length || 0}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('players')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                      activeTab === 'players'
                        ? 'border-[#BEA877] text-[#BEA877]'
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
                    <div className="border-2 rounded-lg p-3 sm:p-4 max-h-64 sm:max-h-80 overflow-y-auto bg-[#faf0e8]" style={{ borderColor: "#181A18" }}>
                      {selectedSessionDetails?.session_coaches?.length === 0 ? (
                        <p className="text-xs sm:text-sm text-gray-600 text-center py-8">No coaches assigned.</p>
                      ) : (
                        <div className="space-y-4">
                          {selectedSessionDetails?.session_coaches?.map((sc) => {
                            const coachTime = selectedSessionDetails.coach_session_times?.find((cst) => cst.coach_id === sc.coach_id);
                            return (
                              <div key={sc.id} className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                                  <span className="text-sm sm:text-base font-medium text-gray-700">{sc.coaches.name}</span>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => timeInMutation.mutate({ sessionId: selectedSessionDetails!.id, coachId: sc.coach_id })}
                                      disabled={!!selectedSessionDetails?.coach_session_times?.find((cst) => cst.coach_id === sc.coach_id && cst.time_in)}
                                      className="bg-green-600 text-white hover:bg-green-700 flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm"
                                    >
                                      Time In
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => timeOutMutation.mutate({ sessionId: selectedSessionDetails!.id, coachId: sc.coach_id })}
                                      disabled={!coachTime?.time_in || !!coachTime?.time_out || timeOutMutation.isPending}
                                      className="bg-red-600 text-white hover:bg-red-700 flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm"
                                    >
                                      Time Out
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => markCoachAbsentMutation.mutate({ sessionId: selectedSessionDetails!.id, coachId: sc.coach_id })}
                                      disabled={markCoachAbsentMutation.isPending}
                                      className="bg-orange-600 text-white hover:bg-orange-700 flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm"
                                    >
                                      Absent
                                    </Button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                                  <div>
                                    <span className="text-xs sm:text-sm text-gray-600 block mb-1">Time In:</span>
                                    <span className="text-xs sm:text-sm font-medium">{formatDateTime(coachTime?.time_in) || "Not recorded"}</span>
                                  </div>
                                  <div>
                                    <span className="text-xs sm:text-sm text-gray-600 block mb-1">Time Out:</span>
                                    <span className="text-xs sm:text-sm font-medium">{formatDateTime(coachTime?.time_out) || "Not recorded"}</span>
                                  </div>
                                </div>
                                <div className="border-t pt-3">
                                  <Label className="text-xs sm:text-sm font-medium text-gray-700 mb-2 block">Edit Time</Label>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <Label className="text-xs text-gray-500 mb-1 block">Time In</Label>
                                      <Input
                                        type="datetime-local"
                                        value={coachTime?.time_in ? format(parseISO(coachTime.time_in), "yyyy-MM-dd'T'HH:mm") : ""}
                                        onChange={(e) => {
                                          const newTime = e.target.value ? new Date(e.target.value).toISOString() : null;
                                          updateCoachTimeMutation.mutate({
                                            sessionId: selectedSessionDetails!.id,
                                            coachId: sc.coach_id,
                                            time_in: newTime,
                                          });
                                        }}
                                        className="w-full border-2 border-gray-200 rounded-lg text-xs sm:text-sm"
                                        style={{ borderColor: "#BEA877" }}
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-gray-500 mb-1 block">Time Out</Label>
                                      <Input
                                        type="datetime-local"
                                        value={coachTime?.time_out ? format(parseISO(coachTime.time_out), "yyyy-MM-dd'T'HH:mm") : ""}
                                        onChange={(e) => {
                                          const newTime = e.target.value ? new Date(e.target.value).toISOString() : null;
                                          updateCoachTimeMutation.mutate({
                                            sessionId: selectedSessionDetails!.id,
                                            coachId: sc.coach_id,
                                            time_out: newTime,
                                          });
                                        }}
                                        className="w-full border-2 border-gray-200 rounded-lg text-xs sm:text-sm"
                                        style={{ borderColor: "#BEA877" }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="search" className="flex items-center text-xs sm:text-sm font-medium text-gray-700">
                        <Search className="w-4 h-4 mr-2 text-accent" style={{ color: "#BEA877" }} />
                        Search Players
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="search"
                          placeholder="Search by player name..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 pr-4 py-2 w-full border-2 border-accent rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-accent/20"
                          style={{ borderColor: "#BEA877" }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg border">
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
                    <div className="border-2 rounded-lg p-3 sm:p-4 max-h-64 sm:max-h-80 overflow-y-auto bg-[#faf0e8]" style={{ borderColor: "#181A18" }}>
                      {attendanceLoading ? (
                        <p className="text-center text-gray-600 py-8 text-xs sm:text-sm">Loading attendance records...</p>
                      ) : attendanceError ? (
                        <p className="text-center text-red-600 py-8 text-xs sm:text-sm">Error loading attendance: {(attendanceError as Error).message}</p>
                      ) : filteredAttendanceRecords.length === 0 ? (
                        <p className="text-center text-gray-600 py-8 text-xs sm:text-sm">
                          {searchTerm ? "No players found." : "No players registered for this session."}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex justify-end mb-2">
                            <Button
                              onClick={() => {
                                const headers = ['Student Name', 'Package Type', 'Status', 'Session Duration', 'Marked At'];
                                exportToCSV(
                                  filteredAttendanceRecords,
                                  'attendance_records_report',
                                  headers,
                                  (record) => [
                                    record.students?.name || '',
                                    record.students?.package_type || '',
                                    record.status || '',
                                    record.session_duration ? String(record.session_duration) : '',
                                    record.marked_at ? format(parseISO(record.marked_at), 'yyyy-MM-dd HH:mm') : ''
                                  ]
                                );
                                toast.success('Attendance records report exported to Excel successfully');
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm transition-all duration-300"
                            >
                              <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                              Export CSV
                            </Button>
                          </div>
                          {filteredAttendanceRecords.map((record) => (
                            <div key={record.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-white rounded-lg border border-gray-200">
                              <div className="flex items-center space-x-3">
                                <span className="text-xs sm:text-sm font-medium text-gray-700">{record.students.name}</span>
                                <Badge className={`font-medium ${getAttendanceBadgeColor(record.status)} text-xs`}>
                                  {getAttendanceIcon(record.status)}
                                  <span className="ml-1 capitalize">{record.status}</span>
                                </Badge>
                              </div>
                              <Select
                                value={record.status}
                                onValueChange={(value: AttendanceStatus) => handleAttendanceChange(record.id, value)}
                              >
                                <SelectTrigger
                                  className="w-full sm:w-40 border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 text-xs sm:text-sm"
                                  style={{ borderColor: "#BEA877" }}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {["present", "absent", "pending"].map((status) => (
                                    <SelectItem key={status} value={status} className="text-xs sm:text-sm">
                                      <div className="flex items-center space-x-2">
                                        {getAttendanceIcon(status as AttendanceStatus)}
                                        <span className="capitalize">{status}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAttendanceModal(false);
                    setSearchTerm("");
                    setActiveTab('coaches');
                    if (sessionIdFromUrl) {
                      setSelectedSession(null);
                    }
                  }}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 px-4 py-2 text-xs sm:text-sm order-2 sm:order-1"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowAttendanceModal(false);
                    setSearchTerm("");
                    setActiveTab('coaches');
                    if (sessionIdFromUrl) {
                      setSelectedSession(null);
                    }
                  }}
                  className="bg-accent hover:bg-[#8e7a3f] text-white px-4 py-2 text-xs sm:text-sm order-1 sm:order-2"
                  style={{ backgroundColor: "#BEA877" }}
                >
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showDurationDialog} onOpenChange={setShowDurationDialog}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md border-2 border-gray-200 bg-white shadow-lg p-3 sm:p-4 md:p-5">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                Session Duration
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                Select the duration of this session. Each hour equals 1 session.
              </DialogDescription>
            </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <Label className="text-gray-700 font-medium text-xs sm:text-sm">
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
                    <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {durationOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()} className="text-xs sm:text-sm">
                          {option.label}
                        </SelectItem>
                      ))}
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
              <div className="flex justify-end space-x-3 pt-4 flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDurationDialog(false);
                    setPendingAttendanceUpdate(null);
                  }}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
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
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}