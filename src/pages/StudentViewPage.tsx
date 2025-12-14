import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ArrowLeft, Filter, MapPin, Users, Calendar, Clock, User, ChevronLeft, ChevronRight, DollarSign, CreditCard, Edit, Plus, CalendarIcon, Mail, Phone, Building2, Package, Target, TrendingUp, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addMonths, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  sessions: number | null;
  remaining_sessions: number | null;
  branch_id: string | null;
  package_type: string | null;
  created_at: string;
  enrollment_date: string | null;
  expiration_date: string | null;
  total_training_fee: number | null;
  downpayment: number | null;
  remaining_balance: number | null;
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

interface AttendanceRecord {
  session_id: string;
  student_id: string;
  package_cycle?: number | null;
  status: "present" | "absent" | "pending";
  session_duration?: number | null;
  training_sessions: {
    date: string;
    start_time: string;
    end_time: string;
    branch_id: string;
    package_type: string | null;
    branches: { name: string } | null;
    session_coaches: Array<{
      id: string;
      coach_id: string;
      coaches: { name: string } | null;
    }>;
  };
}

interface StudentPayment {
  id: string;
  student_id: string;
  payment_amount: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PackageHistory {
  id: string;
  student_id: string;
  package_type: string | null;
  sessions: number | null;
  remaining_sessions: number | null;
  enrollment_date: string | null;
  expiration_date: string | null;
  captured_at: string;
  reason: string | null;
}

export default function StudentViewPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [recordsBranchFilter, setRecordsBranchFilter] = useState<string>("All");
  const [recordsPackageTypeFilter, setRecordsPackageTypeFilter] = useState<string>("All");
  const [recordsCurrentPage, setRecordsCurrentPage] = useState(1);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isNewPackageDialogOpen, setIsNewPackageDialogOpen] = useState(false);
  const [isEditPackageDialogOpen, setIsEditPackageDialogOpen] = useState(false);
  const [isRetrieveDialogOpen, setIsRetrieveDialogOpen] = useState(false);
  const [isPackageHistoryModalOpen, setIsPackageHistoryModalOpen] = useState(false);
  const [packageSessionsModal, setPackageSessionsModal] = useState<{
    open: boolean;
    title: string;
    sessions: AttendanceRecord[];
  }>({ open: false, title: "", sessions: [] });
  const deleteHistoryMutation = useMutation({
    mutationFn: async (historyId: string) => {
      const { error } = await supabase.from("student_package_history").delete().eq("id", historyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-package-history", studentId] });
      toast.success("Package history deleted");
    },
    onError: (error: any) => {
      toast.error("Failed to delete package history: " + error.message);
    },
  });
  const expireCurrentPackageMutation = useMutation({
    mutationFn: async () => {
      if (!student) throw new Error("No student loaded");
      const today = format(new Date(), "yyyy-MM-dd");
      const { error } = await supabase
        .from("students")
        .update({
          expiration_date: today,
          remaining_sessions: 0,
        })
        .eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-package-history", studentId] });
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "students-select",
      });
      toast.success("Current package expired");
    },
    onError: (error: any) => {
      toast.error("Failed to expire package: " + error.message);
    },
  });

  const retrievePackageMutation = useMutation({
    mutationFn: async () => {
      if (!student) throw new Error("No student loaded");
      const currentExpirationDate = new Date(student.expiration_date || new Date());
      const newExpirationDate = format(addDays(currentExpirationDate, retrieveFormData.extendDays), "yyyy-MM-dd");

      const updateData: any = {
        expiration_date: newExpirationDate,
      };

      // Only update sessions if a value is provided
      if (retrieveFormData.allowedSessions && retrieveFormData.allowedSessions.trim() !== '') {
        const newSessions = parseInt(retrieveFormData.allowedSessions);
        if (newSessions > 0) {
          updateData.sessions = newSessions;
          // If setting new sessions, also reset remaining_sessions to the new total
          updateData.remaining_sessions = newSessions;
        }
      }

      const { error } = await supabase
        .from("students")
        .update(updateData)
        .eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: () => {
      const sessionMessage = retrieveFormData.allowedSessions && retrieveFormData.allowedSessions.trim() !== ''
        ? ` and sessions set to ${retrieveFormData.allowedSessions}`
        : '';
      toast.success(`Package retrieved successfully! Extended by ${retrieveFormData.extendDays} days${sessionMessage}.`);
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-package-history", studentId] });
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "students-select",
      });
      setIsRetrieveDialogOpen(false);
      setRetrieveFormData({ extendDays: 30, allowedSessions: '' }); // Reset form
    },
    onError: (error: any) => {
      toast.error("Failed to retrieve package: " + error.message);
    },
  });

  const itemsPerPage = 6;

  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    phone: "",
    sessions: 8,
    branch_id: null as string | null,
    package_type: null as string | null,
    enrollment_date: null as Date | null,
  });

  const [newPackageFormData, setNewPackageFormData] = useState({
    package_type: null as string | null,
    sessions: 8,
    enrollment_date: new Date(),
    expiration_date: null as Date | null,
  });

  const [editPackageFormData, setEditPackageFormData] = useState({
    package_type: null as string | null,
    sessions: 8,
    enrollment_date: new Date(),
    expiration_date: null as Date | null,
  });

  const [retrieveFormData, setRetrieveFormData] = useState({
    extendDays: 30,
    allowedSessions: '',
  });

  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .single();
      if (error) throw error;
      return data as Student;
    },
    enabled: !!studentId,
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

  const { data: packages } = useQuery<Package[], Error>({
    queryKey: ["packages-select"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("packages")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as Package[];
    },
  });

  const { data: attendanceRecords, isLoading: recordsLoading, error: recordsError } = useQuery({
    queryKey: ["attendance_records", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("attendance_records")
        .select(`
          session_id,
          student_id,
          package_cycle,
          session_duration,
          status,
          training_sessions (
            date,
            start_time,
            end_time,
            branch_id,
            package_type,
            branches (name),
            session_coaches (
              id,
              coach_id,
              coaches (name)
            )
          )
        `)
        .eq("student_id", studentId)
        .order("date", { ascending: false, referencedTable: "training_sessions" });
      if (error) throw error;
      return (data as any) || [];
    },
    enabled: !!studentId,
  });

  const { data: studentPayments } = useQuery({
    queryKey: ["student-payments", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("student_payments")
        .select("*")
        .eq("student_id", studentId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data as StudentPayment[];
    },
    enabled: !!studentId,
  });

  const { data: packageHistory } = useQuery({
    queryKey: ["student-package-history", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("student_package_history")
        .select("*")
        .eq("student_id", studentId)
        .order("captured_at", { ascending: false });
      if (error) {
        toast.error("Failed to load package history");
        throw error;
      }
      return (data || []) as PackageHistory[];
    },
    enabled: !!studentId,
  });

  useEffect(() => {
    if (student) {
      setEditFormData({
        name: student.name,
        email: student.email,
        phone: student.phone || "",
        sessions: student.sessions || 0,
        branch_id: student.branch_id || null,
        package_type: student.package_type || null,
        enrollment_date: student.enrollment_date ? new Date(student.enrollment_date) : null,
      });
    }
  }, [student]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...studentData }: typeof editFormData & { id: string }) => {
      // Calculate remaining_sessions from attendance records: total_sessions - sum of attended session durations
      const { data: attendanceData } = await supabase
        .from("attendance_records")
        .select("session_duration")
        .eq("student_id", id)
        .eq("status", "present");
      
      const usedSessions = attendanceData?.reduce((sum, record) => sum + (record.session_duration || 0), 0) || 0;
      
      // New remaining = new total - used sessions from attendance
      const newRemaining = Math.max(0, studentData.sessions - usedSessions);
      
      const { data, error } = await supabase
        .from("students")
        .update({
          name: studentData.name,
          email: studentData.email,
          phone: studentData.phone || null,
          sessions: studentData.sessions,
          remaining_sessions: newRemaining,
          branch_id: studentData.branch_id,
          package_type: studentData.package_type,
          enrollment_date: studentData.enrollment_date ? format(studentData.enrollment_date, 'yyyy-MM-dd') : null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      toast.success("Player updated successfully");
      setIsEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error("Failed to update player: " + error.message);
    },
  });


  // Determine current package window early for filtering
  const latestHistoryCapture = packageHistory && packageHistory.length > 0
    ? new Date(packageHistory[0].captured_at)
    : null;
  // Start of current package: prefer last archived capture (renewal point); fallback to enrollment_date
  const packageStart = latestHistoryCapture
    ? latestHistoryCapture
    : student?.enrollment_date
      ? new Date(student.enrollment_date)
      : null;
  const packageEnd = student?.expiration_date ? new Date(student.expiration_date) : null;

  // Session history table: show only current package window/cycle
  const filteredAttendanceRecords = attendanceRecords?.filter((record) => {
    const currentCycle = (packageHistory?.length || 0) + 1;
    const sessionDate = record.training_sessions?.date ? new Date(record.training_sessions.date) : null;

    const inCycle =
      record.package_cycle != null
        ? record.package_cycle === currentCycle
        : (() => {
            if (!sessionDate) return false;
            if (packageStart && sessionDate < packageStart) return false;
            if (packageEnd && sessionDate > packageEnd) return false;
            return true;
          })();

    if (!inCycle) return false;

    return (
      (recordsBranchFilter === "All" || record.training_sessions.branch_id === recordsBranchFilter) &&
      (recordsPackageTypeFilter === "All" || record.training_sessions.package_type === recordsPackageTypeFilter)
    );
  }) || [];

  const recordsTotalPages = Math.ceil(filteredAttendanceRecords.length / itemsPerPage);
  const recordsStartIndex = (recordsCurrentPage - 1) * itemsPerPage;
  const recordsEndIndex = recordsStartIndex + itemsPerPage;
  const paginatedRecords = filteredAttendanceRecords.slice(recordsStartIndex, recordsEndIndex);

  const getPaginationRange = (current: number, total: number) => {
    const maxPagesToShow = 3;
    let start = Math.max(1, current - 1);
    let end = Math.min(total, start + maxPagesToShow - 1);
    if (end - start + 1 < maxPagesToShow) {
      start = Math.max(1, end - maxPagesToShow + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const handleRecordsPageChange = (page: number) => {
    setRecordsCurrentPage(page);
  };

  const getPackageBadgeColor = (packageType: string | null) => {
    if (!packageType) return 'bg-gray-50 text-gray-700 border-gray-200';
    const colors = [
      'bg-blue-50 text-blue-700 border-blue-200',
      'bg-green-50 text-green-700 border-green-200',
      'bg-purple-50 text-purple-700 border-purple-200',
      'bg-indigo-50 text-indigo-700 border-indigo-200',
      'bg-teal-50 text-teal-700 border-teal-200',
    ];
    const hash = packageType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (student) {
      updateMutation.mutate({ ...editFormData, id: student.id });
    }
  };

  const createNewPackageMutation = useMutation({
    mutationFn: async (packageData: typeof newPackageFormData & { student_id: string }) => {
      const { data: currentStudent, error: currentStudentError } = await supabase
        .from("students")
        .select("package_type, sessions, remaining_sessions, enrollment_date, expiration_date")
        .eq("id", packageData.student_id)
        .single();

      if (currentStudentError) {
        console.error("Failed to fetch current student before renewal:", currentStudentError);
      }

      const shouldArchivePackage =
        currentStudent &&
        (currentStudent.package_type ||
          currentStudent.sessions !== null ||
          currentStudent.remaining_sessions !== null ||
          currentStudent.enrollment_date ||
          currentStudent.expiration_date);

      if (shouldArchivePackage) {
        const totalSessions = Number(currentStudent?.sessions || 0);
        const remainingSessions = Number(currentStudent?.remaining_sessions || 0);
        const usedSessions = totalSessions - remainingSessions;
        const expirationDate = currentStudent?.expiration_date ? new Date(currentStudent.expiration_date) : null;
        const now = new Date();

        let endReason = "renewal";
        if (remainingSessions <= 0 || usedSessions >= totalSessions) {
          endReason = "renewal - completed";
        } else if (expirationDate && now > expirationDate) {
          endReason = "renewal - expired";
        } else {
          endReason = "renewal - early";
        }

        const { error: historyError } = await supabase
          .from("student_package_history")
          .insert([
            {
              student_id: packageData.student_id,
              package_type: currentStudent?.package_type ?? null,
              sessions: currentStudent?.sessions ?? null,
              remaining_sessions: currentStudent?.remaining_sessions ?? null,
              enrollment_date: currentStudent?.enrollment_date ?? null,
              expiration_date: currentStudent?.expiration_date ?? null,
              reason: endReason,
            },
          ]);

        if (historyError) {
          const historyStatus = (historyError as any)?.status || (historyError as any)?.statusCode;
          const historyMessage =
            historyError.message ||
            historyError.hint ||
            historyError.details ||
            historyError.code ||
            "Unknown error archiving previous package";

          const missingHistoryTable =
            historyStatus === 404 ||
            historyError.code === "PGRST301" ||
            (historyMessage && historyMessage.toLowerCase().includes("student_package_history"));

          console.error("Failed to archive previous package:", historyError);

          if (missingHistoryTable) {
            throw new Error(
              "Package history table not found. Run migration 20251211000000_add_student_package_history.sql in Supabase and retry."
            );
          }

          throw new Error(historyMessage);
        }
      }

      // When creating a new package, remaining_sessions equals total_sessions (no sessions used yet)
      const { data, error } = await supabase
        .from("students")
        .update({
          package_type: packageData.package_type,
          sessions: packageData.sessions,
          remaining_sessions: packageData.sessions, // New package: all sessions are remaining
          enrollment_date: packageData.enrollment_date ? format(packageData.enrollment_date, 'yyyy-MM-dd') : null,
          expiration_date: packageData.expiration_date ? format(packageData.expiration_date, 'yyyy-MM-dd') : null,
        })
        .eq("id", packageData.student_id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-package-history", studentId] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === "students-select",
      });
      toast.success("New package session created successfully");
      setIsNewPackageDialogOpen(false);
      setNewPackageFormData({
        package_type: null,
        sessions: 8,
        enrollment_date: new Date(),
        expiration_date: null,
      });
    },
    onError: (error: any) => {
      const message =
        error?.message ||
        error?.hint ||
        error?.details ||
        error?.code ||
        "Unknown error while creating package session. Ensure package history migration is applied.";
      toast.error("Failed to create new package session: " + message);
    },
  });

  const handleNewPackageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (student) {
      createNewPackageMutation.mutate({ ...newPackageFormData, student_id: student.id });
    }
  };

  const editPackageMutation = useMutation({
    mutationFn: async (packageData: typeof editPackageFormData & { student_id: string }) => {
      // Calculate remaining_sessions from attendance records
      const { data: attendanceData } = await supabase
        .from("attendance_records")
        .select("session_duration")
        .eq("student_id", packageData.student_id)
        .eq("status", "present");

      const usedSessions = attendanceData?.reduce((sum, record) => sum + (record.session_duration || 0), 0) || 0;

      // New remaining = new total - used sessions
      const newRemaining = Math.max(0, packageData.sessions - usedSessions);

      const { data, error } = await supabase
        .from("students")
        .update({
          package_type: packageData.package_type,
          sessions: packageData.sessions,
          remaining_sessions: newRemaining,
          enrollment_date: packageData.enrollment_date ? format(packageData.enrollment_date, 'yyyy-MM-dd') : null,
          expiration_date: packageData.expiration_date ? format(packageData.expiration_date, 'yyyy-MM-dd') : null,
        })
        .eq("id", packageData.student_id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === "students-select",
      });
      toast.success("Package session updated successfully");
      setIsEditPackageDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error("Failed to update package session: " + error.message);
    },
  });

  const handleEditPackageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (student) {
      editPackageMutation.mutate({ ...editPackageFormData, student_id: student.id });
    }
  };

  const handleRetrievePackageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    retrievePackageMutation.mutate();
  };

  // Helper function to determine package status
  const getPackageStatus = (totalSessions: number, remainingSessions: number, expirationDate: Date | null) => {
    const usedSessions = totalSessions - remainingSessions;
    const currentDate = new Date();
    
    if (remainingSessions <= 0 || usedSessions >= totalSessions) {
      return { status: 'completed' as const, statusColor: 'bg-blue-50 text-blue-700 border-blue-200', statusText: 'Completed' };
    } else if (expirationDate && currentDate > expirationDate) {
      return { status: 'expired' as const, statusColor: 'bg-red-50 text-red-700 border-red-200', statusText: 'Expired' };
    } else {
      return { status: 'ongoing' as const, statusColor: 'bg-green-50 text-green-700 border-green-200', statusText: 'Ongoing' };
    }
  };

  if (studentLoading) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto" style={{ borderColor: '#BEA877' }}></div>
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3 mt-4">Loading player details...</h3>
          <p className="text-sm sm:text-base md:text-lg text-gray-600">Please wait while we fetch the player data.</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">Player not found</h3>
          <Button onClick={() => navigate("/dashboard/students")} className="bg-accent hover:bg-[#8e7a3f] text-white" style={{ backgroundColor: '#BEA877' }}>
            Back to Players
          </Button>
        </div>
      </div>
    );
  }

  const currentCycle = (packageHistory?.length || 0) + 1;

  const attendanceInCurrentPackage =
    (attendanceRecords?.filter((record) => record.package_cycle === currentCycle) ??
      attendanceRecords?.filter((record) => {
        const sessionDate = record.training_sessions?.date ? new Date(record.training_sessions.date) : null;
        if (!sessionDate) return false;
        if (packageStart && sessionDate < packageStart) return false;
        if (packageEnd && sessionDate > packageEnd) return false;
        return true;
      }) ??
      []) || [];

  const total = Number(student.sessions) || 0;
  const usedSessions =
    attendanceInCurrentPackage
      ?.filter((record) => record.status === "present")
      ?.reduce((sum, record) => sum + (record.session_duration ?? 1), 0) || 0;
  const remaining = Math.max(0, total - usedSessions);
  const progressPercentage = total > 0 ? (usedSessions / total) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-4 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-2">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard/students")}
              className="border-2 border-accent text-accent hover:bg-accent hover:text-white text-xs sm:text-sm"
              style={{ borderColor: '#BEA877', color: '#BEA877' }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#181818] tracking-tight">
                {student.name}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">Player profile and records</p>
            </div>
          </div>
        </div>

        {/* Personal & Training Information Card */}
        <Card className="border-2 border-[#181A18] bg-white shadow-lg overflow-hidden">
          <CardHeader className="border-b border-[#181A18] bg-gradient-to-r from-[#181A18] to-[#2a2c2a] p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold text-white flex items-center">
                  <Users className="h-5 w-5 mr-2 text-accent" style={{ color: '#BEA877' }} />
                  Personal & Training Information
                </CardTitle>
                <CardDescription className="text-gray-300 text-xs sm:text-sm mt-1">
                  Complete player profile and training details
                </CardDescription>
              </div>
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-2 border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-white text-xs sm:text-sm whitespace-nowrap"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Player
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-2xl border-2 border-gray-200 bg-white shadow-lg overflow-y-auto max-h-[90vh] p-4 sm:p-5">
                  <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg font-bold text-gray-900">Edit Player</DialogTitle>
                    <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                      Update player information
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col space-y-2 min-w-0">
                        <Label htmlFor="name" className="text-gray-700 font-medium text-xs sm:text-sm truncate">Name</Label>
                        <Input
                          id="name"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
                          required
                          className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                          style={{ borderColor: '#BEA877' }}
                        />
                      </div>
                      <div className="flex flex-col space-y-2 min-w-0">
                        <Label htmlFor="email" className="text-gray-700 font-medium text-xs sm:text-sm truncate">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={editFormData.email}
                          onChange={(e) => setEditFormData((prev) => ({ ...prev, email: e.target.value }))}
                          required
                          className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                          style={{ borderColor: '#BEA877' }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col space-y-2 min-w-0">
                        <Label htmlFor="phone" className="text-gray-700 font-medium text-xs sm:text-sm truncate">Phone</Label>
                        <Input
                          id="phone"
                          value={editFormData.phone}
                          onChange={(e) => setEditFormData((prev) => ({ ...prev, phone: e.target.value }))}
                          className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                          style={{ borderColor: '#BEA877' }}
                        />
                      </div>
                      <div className="flex flex-col space-y-2 min-w-0">
                        <Label htmlFor="branch_id" className="text-gray-700 font-medium text-xs sm:text-sm truncate">Branch</Label>
                        <Select
                          value={editFormData.branch_id ?? undefined}
                          onValueChange={(value) => setEditFormData((prev) => ({ ...prev, branch_id: value }))}
                        >
                          <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
                            <SelectValue placeholder="Select Branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches?.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id} className="text-xs sm:text-sm">
                                {branch.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2 min-w-0">
                      <Label htmlFor="package_type" className="text-gray-700 font-medium text-xs sm:text-sm truncate">Package Type</Label>
                      <Select
                        value={editFormData.package_type ?? undefined}
                        onValueChange={(value) => setEditFormData((prev) => ({ ...prev, package_type: value }))}
                      >
                        <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
                          <SelectValue placeholder="Select Package Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {packages?.map((pkg) => (
                            <SelectItem key={pkg.id} value={pkg.name} className="text-xs sm:text-sm">
                              {pkg.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col space-y-2 min-w-0">
                      <Label htmlFor="sessions" className="text-gray-700 font-medium text-xs sm:text-sm truncate">Total Sessions</Label>
                      <Input
                        id="sessions"
                        type="number"
                        min="0"
                        value={editFormData.sessions}
                        onChange={(e) => setEditFormData((prev) => ({ ...prev, sessions: parseInt(e.target.value) || 0 }))}
                        className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                        style={{ borderColor: '#BEA877' }}
                        disabled={role === 'coach'}
                      />
                      <p className="text-xs text-gray-500 mt-1">Remaining sessions will be calculated automatically based on attendance records</p>
                    </div>
                    <div className="flex flex-col space-y-2 min-w-0">
                      <Label className="text-gray-700 font-medium text-xs sm:text-sm truncate">Enrollment Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal border-2 rounded-lg text-xs sm:text-sm",
                              !editFormData.enrollment_date && "text-muted-foreground"
                            )}
                            style={{ borderColor: '#BEA877' }}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editFormData.enrollment_date ? format(editFormData.enrollment_date, "MM/dd/yyyy") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={editFormData.enrollment_date || undefined}
                            onSelect={(date) => setEditFormData((prev) => ({ ...prev, enrollment_date: date || null }))}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditDialogOpen(false)}
                        className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                      >
                        {updateMutation.isPending ? "Updating..." : "Update"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Session Progress */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-green-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Session Progress</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Total Sessions</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-700">{total}</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Attended</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-700">
                    {(() => {
                      const used = Number(usedSessions);
                      const remainder = used % 1;
                      if (remainder === 0) {
                        return used.toString();
                      } else {
                        return used.toFixed(1);
                      }
                    })()}
                  </p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Remaining</p>
                  <p className="text-xl sm:text-2xl font-bold text-orange-700">
                    {(() => {
                      const rem = Number(remaining) || 0;
                      return rem % 1 === 0 ? rem.toString() : rem.toFixed(1);
                    })()}
                  </p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Progress</p>
                  <p className="text-xl sm:text-2xl font-bold text-purple-700">{progressPercentage.toFixed(1)}%</p>
                </div>
              </div>
              <div className="mt-4">
                <Progress value={progressPercentage} className="h-3 w-full max-w-full" />
              </div>
            </div>
          </CardContent>
        </Card>


        {/* Package History Modal */}
        <Dialog open={isPackageHistoryModalOpen} onOpenChange={setIsPackageHistoryModalOpen}>
          <DialogContent className="w-[95vw] max-w-4xl border-2 border-gray-200 bg-white shadow-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 flex items-center">
                <Clock className="h-5 w-5 mr-2 text-accent" style={{ color: '#BEA877' }} />
                Package History
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                Previous package sessions are stored when renewing
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
            {packageHistory && packageHistory.length > 0 ? (
              (() => {
                const sortedHistory = [...packageHistory].sort(
                  (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
                );

                const historyWithSessions = sortedHistory.map((pkg, idx) => {
                  const next = sortedHistory[idx + 1];
                  const start = pkg.enrollment_date
                    ? new Date(pkg.enrollment_date)
                    : pkg.captured_at
                      ? new Date(pkg.captured_at)
                      : null;
                  const nextCapture = next ? new Date(next.captured_at) : null;
                  const end = nextCapture
                    ? nextCapture
                    : pkg.expiration_date
                      ? new Date(pkg.expiration_date)
                      : pkg.captured_at
                        ? new Date(pkg.captured_at)
                        : null;

                  return {
                    pkg,
                    start,
                    end,
                  };
                });

                const displayHistory = [...historyWithSessions].reverse(); // newest first

                return (
                  <div className="space-y-3">
                    {displayHistory.map((entry, idx) => {
                      const totalCount = displayHistory.length;
                      const sequenceNumber = totalCount - idx; // oldest = 1st, newest = nth (matching prior labeling)
                      const toOrdinal = (n: number) => {
                        const j = n % 10;
                        const k = n % 100;
                        if (j === 1 && k !== 11) return `${n}st`;
                        if (j === 2 && k !== 12) return `${n}nd`;
                        if (j === 3 && k !== 13) return `${n}rd`;
                        return `${n}th`;
                      };
                      const ordinal = toOrdinal(sequenceNumber);
                      const cycleLabel = sequenceNumber === 1 ? "initial package" : "renewal";
                      const { pkg, start, end } = entry;

                      const cycleNumber = sequenceNumber;
                      const packageCycleMatches = attendanceRecords?.filter(
                        (record) => record.package_cycle === cycleNumber
                      );

                      const sessionsInPackage =
                        (packageCycleMatches && packageCycleMatches.length > 0
                          ? packageCycleMatches
                          : attendanceRecords?.filter((record) => {
                              const sessionDate = record.training_sessions?.date
                                ? new Date(record.training_sessions.date)
                                : null;
                              if (!sessionDate) return false;
                              if (start && sessionDate < start) return false;
                              if (end && sessionDate >= end) return false;
                              return true;
                            })) || [];

                      const attendedSessionsTotal = sessionsInPackage
                        .filter((record) => record.status === "present")
                        .reduce((sum, record) => sum + (record.session_duration ?? 1), 0);

                      return (
                        <div key={pkg.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              Package {ordinal} ({cycleLabel}) {pkg.package_type ? `• ${pkg.package_type}` : ""}
                            </p>
                            <p className="text-xs text-gray-500">
                              Captured {format(new Date(pkg.captured_at), "MMM dd, yyyy")}
                              {pkg.reason ? ` • ${pkg.reason}` : ""}
                            </p>
                          </div>
                          <div className="text-xs text-gray-700 text-right space-y-1">
                            <p>
                              Total: {pkg.sessions ?? "N/A"} | Remaining: {pkg.remaining_sessions ?? "N/A"}
                            </p>
                            <p>
                              Start: {start ? format(start, "MM/dd/yyyy") : "N/A"} | End: {end ? format(end, "MM/dd/yyyy") : "—"}
                            </p>
                            <p>
                              Attended: {attendedSessionsTotal % 1 === 0 ? attendedSessionsTotal.toString() : attendedSessionsTotal.toFixed(1)} sessions
                            </p>
                            <div className="pt-2 border-t border-gray-200 flex items-center justify-between gap-2 flex-wrap">
                              <div className="text-xs sm:text-sm text-gray-700">
                                Sessions in this package ({sessionsInPackage.length})
                              </div>
                              <div className="flex items-center gap-2">
                                {sessionsInPackage.length > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs sm:text-sm"
                                    onClick={() =>
                                      setPackageSessionsModal({
                                        open: true,
                                        title: `Package ${ordinal} sessions`,
                                        sessions: sessionsInPackage,
                                      })
                                    }
                                  >
                                    View
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs sm:text-sm text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => {
                                    if (deleteHistoryMutation.isPending) return;
                                    const confirmed = window.confirm("Delete this package history entry?");
                                    if (!confirmed) return;
                                    deleteHistoryMutation.mutate(pkg.id);
                                  }}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              <p className="text-sm text-gray-600">No previous packages recorded yet.</p>
            )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Session Records Card */}
        <Card className="border-2 border-[#181A18] bg-white shadow-lg overflow-hidden">
          <CardHeader className="border-b border-[#181A18] bg-gradient-to-r from-[#181A18] to-[#2a2c2a] p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold text-white flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-accent" style={{ color: '#BEA877' }} />
                  Session Records
                </CardTitle>
                <CardDescription className="text-gray-300 text-xs sm:text-sm mt-1">
                  View package sessions and attendance history for this player
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => setIsPackageHistoryModalOpen(true)}
                className="border-2 border-white/20 text-white hover:bg-white hover:text-gray-900 text-xs sm:text-sm whitespace-nowrap"
              >
                <Clock className="h-4 w-4 mr-2" />
                Package History
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">

            {/* Package Sessions Section */}
            {student && (() => {
              const totalSessions = Number(student.sessions) || 0;
              const usedSessions =
                attendanceInCurrentPackage
                  ?.filter((record) => record.status === "present")
                  ?.reduce((sum, record) => sum + (record.session_duration ?? 1), 0) || 0;
              const remainingSessions = Math.max(0, totalSessions - usedSessions);
              const expirationDate = student.expiration_date ? new Date(student.expiration_date) : null;
              const enrollmentDate = student.enrollment_date ? new Date(student.enrollment_date) : null;
              const packageStatus = getPackageStatus(totalSessions, remainingSessions, expirationDate);
              const isCurrent = packageStatus.status === 'ongoing';
              
              return (
                <div className="mb-6 space-y-4">
                  {/* Current/Latest Package Session */}
                  <div className={`p-3 sm:p-4 rounded-lg border-2 ${
                    isCurrent
                      ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
                      : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${
                          isCurrent ? 'bg-green-200' : 'bg-gray-200'
                        }`}>
                          <Package className={`h-5 w-5 ${
                            isCurrent ? 'text-green-700' : 'text-gray-600'
                          }`} />
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                            {isCurrent ? 'Current Package Session' : 'Latest Package Session'}
                          </h3>
                          <p className="text-xs text-gray-600">
                            {isCurrent ? 'Active package in use' : `${packageStatus.statusText} package`}
                          </p>
                        </div>
                      </div>
                          <div className="flex gap-2 flex-wrap justify-end">
                            <Button
                              onClick={() => {
                                if (student) {
                                  setEditPackageFormData({
                                    package_type: student.package_type,
                                    sessions: student.sessions || 8,
                                    enrollment_date: student.enrollment_date ? new Date(student.enrollment_date) : new Date(),
                                    expiration_date: student.expiration_date ? new Date(student.expiration_date) : addMonths(new Date(), 1),
                                  });
                                  setIsEditPackageDialogOpen(true);
                                }
                              }}
                              variant="outline"
                              className="border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white text-xs sm:text-sm whitespace-nowrap"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Package
                            </Button>
                            {isCurrent && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs sm:text-sm text-red-600 border-red-200 hover:bg-red-50"
                                disabled={expireCurrentPackageMutation.isPending}
                                onClick={() => {
                                  const confirmed = window.confirm("Expire the current package now?");
                                  if (!confirmed) return;
                                  expireCurrentPackageMutation.mutate();
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Expire Package
                              </Button>
                            )}
                            {packageStatus.status === 'expired' && (
                              <Dialog open={isRetrieveDialogOpen} onOpenChange={setIsRetrieveDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm whitespace-nowrap mr-2"
                                  >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Retrieve Package
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="w-[95vw] max-w-md border-2 border-gray-200 bg-white shadow-lg p-4 sm:p-5">
                                  <DialogHeader>
                                    <DialogTitle className="text-base sm:text-lg font-bold text-gray-900">Retrieve Expired Package</DialogTitle>
                                    <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                                      Extend the expiration date and optionally set session limits to reactivate this expired package
                                    </DialogDescription>
                                  </DialogHeader>
                                  <form onSubmit={handleRetrievePackageSubmit} className="space-y-4">
                                    <div className="flex flex-col space-y-2">
                                      <Label htmlFor="extend_days" className="text-gray-700 font-medium text-xs sm:text-sm">Extend by (days)</Label>
                                      <Input
                                        id="extend_days"
                                        type="number"
                                        min="1"
                                        max="365"
                                        value={retrieveFormData.extendDays}
                                        onChange={(e) => {
                                          const extendDays = parseInt(e.target.value) || 30;
                                          setRetrieveFormData((prev) => ({ ...prev, extendDays }));
                                        }}
                                        className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                                        style={{ borderColor: '#BEA877' }}
                                        placeholder="30"
                                      />
                                      <p className="text-xs text-gray-500">
                                        New expiration date: {retrieveFormData.extendDays > 0 && student.expiration_date ?
                                          format(addDays(new Date(student.expiration_date), retrieveFormData.extendDays), 'MMM dd, yyyy') :
                                          'Select days to see new date'}
                                      </p>
                                    </div>
                                    <div className="flex flex-col space-y-2">
                                      <Label htmlFor="allowed_sessions" className="text-gray-700 font-medium text-xs sm:text-sm">Allowed Sessions (optional)</Label>
                                      <Input
                                        id="allowed_sessions"
                                        type="number"
                                        min="1"
                                        value={retrieveFormData.allowedSessions}
                                        onChange={(e) => {
                                          setRetrieveFormData((prev) => ({ ...prev, allowedSessions: e.target.value }));
                                        }}
                                        className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                                        style={{ borderColor: '#BEA877' }}
                                        placeholder={`${student.sessions || 'Current sessions'}`}
                                      />
                                      <p className="text-xs text-gray-500">
                                        Leave empty to keep current ({student.sessions || '0'} sessions) or enter new session limit
                                      </p>
                                    </div>
                                    <div className="flex gap-3 pt-4">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsRetrieveDialogOpen(false)}
                                        className="flex-1 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 text-xs sm:text-sm"
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        type="submit"
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm"
                                        disabled={retrievePackageMutation.isPending}
                                      >
                                        {retrievePackageMutation.isPending ? "Retrieving..." : "Retrieve Package"}
                                      </Button>
                                    </div>
                                  </form>
                                </DialogContent>
                              </Dialog>
                            )}
                            {packageStatus.status !== 'ongoing' && (
                              <Dialog open={isNewPackageDialogOpen} onOpenChange={setIsNewPackageDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm whitespace-nowrap"
                                  >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Renew Package
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="w-[95vw] max-w-md border-2 border-gray-200 bg-white shadow-lg p-4 sm:p-5">
                                  <DialogHeader>
                                    <DialogTitle className="text-base sm:text-lg font-bold text-gray-900">Create New Package Session</DialogTitle>
                                    <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                                      Create a new package session for this player (renewal)
                                    </DialogDescription>
                                  </DialogHeader>
                                  <form onSubmit={handleNewPackageSubmit} className="space-y-4">
                                    <div className="flex flex-col space-y-2">
                                      <Label htmlFor="new_package_type" className="text-gray-700 font-medium text-xs sm:text-sm">Package Type</Label>
                                      <Select
                                        value={newPackageFormData.package_type ?? undefined}
                                        onValueChange={(value) => setNewPackageFormData((prev) => ({ ...prev, package_type: value }))}
                                      >
                                        <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
                                          <SelectValue placeholder="Select Package Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {packages?.map((pkg) => (
                                            <SelectItem key={pkg.id} value={pkg.name} className="text-xs sm:text-sm">
                                              {pkg.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="flex flex-col space-y-2">
                                      <Label htmlFor="new_sessions" className="text-gray-700 font-medium text-xs sm:text-sm">Total Sessions</Label>
                                      <Input
                                        id="new_sessions"
                                        type="number"
                                        min="0"
                                        value={newPackageFormData.sessions}
                                        onChange={(e) => {
                                          const sessions = parseInt(e.target.value) || 0;
                                          setNewPackageFormData((prev) => ({ ...prev, sessions }));
                                        }}
                                        required
                                        className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                                        style={{ borderColor: '#BEA877' }}
                                      />
                                      <p className="text-xs text-gray-500 mt-1">Remaining sessions will be set equal to total sessions for new packages</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="flex flex-col space-y-2">
                                        <Label className="text-gray-700 font-medium text-xs sm:text-sm">Start Date</Label>
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button
                                              variant="outline"
                                              className={cn(
                                                "w-full justify-start text-left font-normal border-2 rounded-lg text-xs sm:text-sm",
                                                !newPackageFormData.enrollment_date && "text-muted-foreground"
                                              )}
                                              style={{ borderColor: '#BEA877' }}
                                            >
                                              <CalendarIcon className="mr-2 h-4 w-4" />
                                              {newPackageFormData.enrollment_date ? format(newPackageFormData.enrollment_date, "MM/dd/yyyy") : <span>Pick a date</span>}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-0" align="start">
                                            <CalendarComponent
                                              mode="single"
                                              selected={newPackageFormData.enrollment_date || undefined}
                                              onSelect={(date) => setNewPackageFormData((prev) => ({ ...prev, enrollment_date: date || new Date() }))}
                                              initialFocus
                                              className={cn("p-3 pointer-events-auto")}
                                            />
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                      <div className="flex flex-col space-y-2">
                                        <Label className="text-gray-700 font-medium text-xs sm:text-sm">Expiry Date</Label>
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button
                                              variant="outline"
                                              className={cn(
                                                "w-full justify-start text-left font-normal border-2 rounded-lg text-xs sm:text-sm",
                                                !newPackageFormData.expiration_date && "text-muted-foreground"
                                              )}
                                              style={{ borderColor: '#BEA877' }}
                                            >
                                              <CalendarIcon className="mr-2 h-4 w-4" />
                                              {newPackageFormData.expiration_date ? format(newPackageFormData.expiration_date, "MM/dd/yyyy") : <span>Pick a date</span>}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-0" align="start">
                                            <CalendarComponent
                                              mode="single"
                                              selected={newPackageFormData.expiration_date || undefined}
                                              onSelect={(date) => setNewPackageFormData((prev) => ({ ...prev, expiration_date: date || null }))}
                                              initialFocus
                                              className={cn("p-3 pointer-events-auto")}
                                            />
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                    </div>
                                    <div className="flex justify-end space-x-3 pt-4 flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsNewPackageDialogOpen(false)}
                                        className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        type="submit"
                                        disabled={createNewPackageMutation.isPending}
                                        className="bg-green-600 hover:bg-green-700 text-white transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                                      >
                                        {createNewPackageMutation.isPending ? "Creating..." : "Create Package"}
                                      </Button>
                                    </div>
                                  </form>
                                </DialogContent>
                              </Dialog>
                            )}
                        </div>
                        <Dialog open={isEditPackageDialogOpen} onOpenChange={setIsEditPackageDialogOpen}>
                          <DialogContent className="w-[95vw] max-w-md border-2 border-gray-200 bg-white shadow-lg p-4 sm:p-5">
                            <DialogHeader>
                              <DialogTitle className="text-base sm:text-lg font-bold text-gray-900">Edit Package Session</DialogTitle>
                              <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                                Edit the current package session details
                              </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleEditPackageSubmit} className="space-y-4">
                              <div className="flex flex-col space-y-2">
                                <Label htmlFor="edit_package_type" className="text-gray-700 font-medium text-xs sm:text-sm">Package Type</Label>
                                <Select
                                  value={editPackageFormData.package_type ?? undefined}
                                  onValueChange={(value) => setEditPackageFormData((prev) => ({ ...prev, package_type: value }))}
                                >
                                  <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#BEA877' }}>
                                    <SelectValue placeholder="Select Package Type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {packages?.map((pkg) => (
                                      <SelectItem key={pkg.id} value={pkg.name} className="text-xs sm:text-sm">
                                        {pkg.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex flex-col space-y-2">
                                <Label htmlFor="edit_sessions" className="text-gray-700 font-medium text-xs sm:text-sm">Total Sessions</Label>
                                <Input
                                  id="edit_sessions"
                                  type="number"
                                  min="0"
                                  value={editPackageFormData.sessions}
                                  onChange={(e) => {
                                    const sessions = parseInt(e.target.value) || 0;
                                    setEditPackageFormData((prev) => ({ ...prev, sessions }));
                                  }}
                                  required
                                  className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                                  style={{ borderColor: '#BEA877' }}
                                />
                                <p className="text-xs text-gray-500 mt-1">Remaining sessions will be recalculated based on attendance records</p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col space-y-2">
                                  <Label className="text-gray-700 font-medium text-xs sm:text-sm">Start Date</Label>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          "w-full justify-start text-left font-normal border-2 rounded-lg text-xs sm:text-sm",
                                          !editPackageFormData.enrollment_date && "text-muted-foreground"
                                        )}
                                        style={{ borderColor: '#BEA877' }}
                                      >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {editPackageFormData.enrollment_date ? format(editPackageFormData.enrollment_date, "MM/dd/yyyy") : <span>Pick a date</span>}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <CalendarComponent
                                        mode="single"
                                        selected={editPackageFormData.enrollment_date || undefined}
                                        onSelect={(date) => setEditPackageFormData((prev) => ({ ...prev, enrollment_date: date || new Date() }))}
                                        initialFocus
                                        className={cn("p-3 pointer-events-auto")}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div className="flex flex-col space-y-2">
                                  <Label className="text-gray-700 font-medium text-xs sm:text-sm">Expiry Date</Label>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          "w-full justify-start text-left font-normal border-2 rounded-lg text-xs sm:text-sm",
                                          !editPackageFormData.expiration_date && "text-muted-foreground"
                                        )}
                                        style={{ borderColor: '#BEA877' }}
                                      >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {editPackageFormData.expiration_date ? format(editPackageFormData.expiration_date, "MM/dd/yyyy") : <span>Pick a date</span>}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <CalendarComponent
                                        mode="single"
                                        selected={editPackageFormData.expiration_date || undefined}
                                        onSelect={(date) => setEditPackageFormData((prev) => ({ ...prev, expiration_date: date || addMonths(new Date(), 1) }))}
                                        initialFocus
                                        className={cn("p-3 pointer-events-auto")}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </div>
                              <div className="flex justify-end space-x-3 pt-4 flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setIsEditPackageDialogOpen(false)}
                                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="submit"
                                  disabled={editPackageMutation.isPending}
                                  className="bg-blue-600 hover:bg-blue-700 text-white transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                                >
                                  {editPackageMutation.isPending ? "Updating..." : "Update Package"}
                                </Button>
                              </div>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3 mb-3">
                          <div className="p-2 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Player Name</p>
                            <p className="text-sm font-semibold text-gray-900">{student.name}</p>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Branch</p>
                            <p className="text-sm font-semibold text-gray-900">{branches?.find(b => b.id === student.branch_id)?.name || 'N/A'}</p>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Package Type</p>
                            <p className="text-sm font-semibold text-gray-900">{student.package_type || 'N/A'}</p>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Total Sessions</p>
                            <p className="text-sm font-semibold text-gray-900">{totalSessions}</p>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Used Sessions</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {usedSessions % 1 === 0 ? usedSessions.toString() : usedSessions.toFixed(1)}
                            </p>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Remaining Sessions</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {remainingSessions % 1 === 0 ? remainingSessions.toString() : remainingSessions.toFixed(1)}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div className="p-2 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Start Date</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {enrollmentDate ? format(enrollmentDate, 'MMM dd, yyyy') : 'N/A'}
                            </p>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Expiry Date</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {expirationDate ? format(expirationDate, 'MMM dd, yyyy') : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Package Status</p>
                            <Badge className={`${packageStatus.statusColor} border px-3 py-1 text-xs sm:text-sm font-medium`}>
                              {packageStatus.statusText}
                            </Badge>
                          </div>
                        </div>
                        {totalSessions > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                              <span>Progress</span>
                              <span>{((usedSessions / totalSessions) * 100).toFixed(1)}%</span>
                            </div>
                            <Progress value={(usedSessions / totalSessions) * 100} className="h-2" />
                          </div>
                        )}
                      </div>
                    </div>


                  {/* Past Package Sessions (when renewing is possible) */}
                  {packageStatus.status === 'expired' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Package className="h-5 w-5 text-gray-600" />
                        </div>
                        <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">Expired Package Session</h3>
                      </div>
                      <div className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3">
                          <div className="p-2 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Package Type</p>
                            <p className="text-sm font-semibold text-gray-900">{student.package_type || 'N/A'}</p>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Total Sessions</p>
                            <p className="text-sm font-semibold text-gray-900">{totalSessions}</p>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Used Sessions</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {usedSessions % 1 === 0 ? usedSessions.toString() : usedSessions.toFixed(1)}
                            </p>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Remaining Sessions</p>
                            <p className={`text-sm font-semibold ${packageStatus.status === 'expired' ? 'text-red-600' : 'text-gray-900'}`}>
                              {remainingSessions % 1 === 0 ? remainingSessions.toString() : remainingSessions.toFixed(1)}
                              {packageStatus.status === 'expired' && (
                                <span className="text-xs text-red-500 ml-1">(Unusable)</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                          <div className="p-2 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Start Date</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {enrollmentDate ? format(enrollmentDate, 'MMM dd, yyyy') : 'N/A'}
                            </p>
                          </div>
                          <div className="p-2 bg-white rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-1">Expiry Date</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {expirationDate ? format(expirationDate, 'MMM dd, yyyy') : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Package Status</p>
                            <Badge className={`${packageStatus.statusColor} border px-3 py-1 text-xs sm:text-sm font-medium`}>
                              {packageStatus.statusText}
                            </Badge>
                          </div>
                          {packageStatus.status === 'expired' && (
                            <p className="text-xs text-red-600 font-medium">
                              ⚠️ Remaining sessions cannot be used
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {recordsLoading ? (
              <div className="text-center py-8 sm:py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto" style={{ borderColor: '#BEA877' }}></div>
                <p className="text-gray-600 mt-2 text-xs sm:text-sm">Loading attendance records...</p>
              </div>
            ) : recordsError ? (
              <p className="text-red-600 text-xs sm:text-sm">Error loading records: {(recordsError as Error).message}</p>
            ) : !filteredAttendanceRecords || filteredAttendanceRecords.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 text-xs sm:text-sm">No attendance records found for this player.</p>
              </div>
            ) : null}

            {/* Session History Table */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="mb-4">
                <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">Session History</h3>
                <p className="text-xs sm:text-sm text-gray-600">Player attendance records with durations</p>
              </div>
              <div className="space-y-2">
                <div className="px-1 sm:px-2">
                  <table className="w-full rounded-lg border-2 border-[#181A18]">
                    <thead className="bg-[#181A18] text-[#efeff1]">
                      <tr>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">
                          <Calendar className="w-4 h-4 inline mr-2" />Date
                        </th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">
                          <Clock className="w-4 h-4 inline mr-2" />Time
                        </th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">
                          <MapPin className="w-4 h-4 inline mr-2" />Branch
                        </th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">
                          <User className="w-4 h-4 inline mr-2" />Coaches
                        </th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">
                          Duration
                        </th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRecords.map((record, index) => (
                        <tr
                          key={record.session_id}
                          className={`transition-all duration-300 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}
                        >
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate">
                            {format(new Date(record.training_sessions.date), "MMM dd, yyyy")}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate">
                            {format(new Date(`1970-01-01T${record.training_sessions.start_time}`), "hh:mm a")} -
                            {format(new Date(`1970-01-01T${record.training_sessions.end_time}`), "hh:mm a")}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate">{record.training_sessions.branches?.name || 'N/A'}</td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate">
                            {record.training_sessions.session_coaches.length > 0
                              ? record.training_sessions.session_coaches.map(sc => sc.coaches?.name || 'Unknown').join(', ')
                              : 'No coaches assigned'}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate">
                            {(() => {
                              const dur = record.session_duration ?? 1;
                              const hours = Math.floor(dur);
                              const minutes = Math.round((dur - hours) * 60);
                              const parts = [];
                              if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
                              if (minutes > 0) parts.push(`${minutes} mins`);
                              const label = parts.length > 0 ? parts.join(" ") : "0 mins";
                              const sessionsLabel = dur % 1 === 0 ? dur.toString() : dur.toFixed(1);
                              return `${label} (${sessionsLabel} session${dur === 1 ? "" : "s"})`;
                            })()}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            <span
                              className={`px-2 py-1 rounded-full text-xs sm:text-sm font-medium truncate max-w-full ${
                                record.status === "present"
                                  ? "bg-green-50 text-green-700 border border-green-200"
                                  : record.status === "absent"
                                  ? "bg-red-50 text-red-700 border border-red-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {recordsTotalPages > 1 && (
                  <div className="flex justify-center items-center mt-4 sm:mt-6 space-x-2 flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleRecordsPageChange(recordsCurrentPage - 1)}
                      disabled={recordsCurrentPage === 1}
                      className="border-2 border-accent text-accent hover:bg-accent hover:text-white w-8 h-8 sm:w-10 sm:h-10 p-0 flex items-center justify-center"
                      style={{ borderColor: '#BEA877', color: '#BEA877' }}
                    >
                      <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                    {getPaginationRange(recordsCurrentPage, recordsTotalPages).map((page) => (
                      <Button
                        key={page}
                        variant={recordsCurrentPage === page ? "default" : "outline"}
                        onClick={() => handleRecordsPageChange(page)}
                        className={`border-2 w-8 h-8 sm:w-10 sm:h-10 p-0 flex items-center justify-center text-xs sm:text-sm ${
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
                      className="border-2 border-accent text-accent hover:bg-accent hover:text-white w-8 h-8 sm:w-10 sm:h-10 p-0 flex items-center justify-center"
                      style={{ borderColor: '#BEA877', color: '#BEA877' }}
                    >
                      <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={packageSessionsModal.open} onOpenChange={(open) => setPackageSessionsModal((prev) => ({ ...prev, open }))}>
          <DialogContent className="w-[98vw] max-w-5xl border-2 border-gray-200 bg-white shadow-lg p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-bold text-gray-900">
                {packageSessionsModal.title || "Package Sessions"}
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-xs sm:text-sm">
                Sessions recorded in this package window
              </DialogDescription>
            </DialogHeader>
            <div className="text-xs sm:text-sm text-gray-700 mb-3">
              {(() => {
                const totalDur = packageSessionsModal.sessions.reduce((sum, s) => sum + (s.session_duration ?? 1), 0);
                const hours = Math.floor(totalDur);
                const minutes = Math.round((totalDur - hours) * 60);
                const parts = [];
                if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
                if (minutes > 0) parts.push(`${minutes} mins`);
                const label = parts.length > 0 ? parts.join(" ") : "0 mins";
                return <>Total duration: {label}</>;
              })()}
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-auto">
              {packageSessionsModal.sessions.length > 0 ? (
                <div className="px-1 sm:px-2">
                  <table className="w-full rounded-lg border-2 border-[#181A18]">
                    <thead className="bg-[#181A18] text-[#efeff1]">
                      <tr>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">
                          <Calendar className="w-4 h-4 inline mr-2" />Date
                        </th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">
                          <Clock className="w-4 h-4 inline mr-2" />Time
                        </th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">
                          <MapPin className="w-4 h-4 inline mr-2" />Branch
                        </th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">
                          <User className="w-4 h-4 inline mr-2" />Coaches
                        </th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">
                          Duration
                        </th>
                        <th className="py-2 sm:py-3 px-2 sm:px-4 text-left font-semibold text-xs sm:text-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packageSessionsModal.sessions.map((session, index) => {
                        const dateLabel = session.training_sessions?.date
                          ? format(new Date(session.training_sessions.date), "MMM dd, yyyy")
                          : "N/A";
                        const timeLabel =
                          session.training_sessions?.start_time && session.training_sessions?.end_time
                            ? `${format(new Date(`1970-01-01T${session.training_sessions.start_time}`), "hh:mm a")} - ${format(new Date(`1970-01-01T${session.training_sessions.end_time}`), "hh:mm a")}`
                            : "N/A";
                        const branchLabel = session.training_sessions?.branches?.name || "N/A";
                        const coachesLabel =
                          session.training_sessions?.session_coaches
                            ?.map((sc) => sc.coaches?.name)
                            .filter(Boolean)
                            .join(", ") || "No coaches assigned";

                        return (
                          <tr
                            key={session.session_id}
                            className={`transition-all duration-300 ${
                              index % 2 === 0 ? "bg-white" : "bg-gray-50"
                            } hover:bg-gray-100`}
                          >
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate">
                              {dateLabel}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate">
                              {timeLabel}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate">
                              {branchLabel}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate">
                              {coachesLabel}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate">
                              {(() => {
                                const dur = session.session_duration ?? 1;
                                const hours = Math.floor(dur);
                                const minutes = Math.round((dur - hours) * 60);
                                const parts = [];
                                if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
                                if (minutes > 0) parts.push(`${minutes} mins`);
                                const label = parts.length > 0 ? parts.join(" ") : "0 mins";
                                const sessionsLabel = dur % 1 === 0 ? dur.toString() : dur.toFixed(1);
                                return `${label} (${sessionsLabel} session${dur === 1 ? "" : "s"})`;
                              })()}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                              <span
                                className={`px-2 py-1 rounded-full text-xs sm:text-sm font-medium truncate max-w-full ${
                                  session.status === "present"
                                    ? "bg-green-50 text-green-700 border border-green-200"
                                    : session.status === "absent"
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {session.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-gray-600">No sessions recorded.</p>
              )}
            </div>
            <div className="flex justify-end pt-3">
              <Button variant="outline" onClick={() => setPackageSessionsModal({ open: false, title: "", sessions: [] })}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>


      </div>
    </div>
  );
}
