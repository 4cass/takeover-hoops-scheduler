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
import { ArrowLeft, Filter, MapPin, Users, Calendar, Clock, User, ChevronLeft, ChevronRight, DollarSign, CreditCard, Edit, Plus, CalendarIcon, Mail, Phone, Building2, Package, Target, TrendingUp, Trash2, RefreshCw, Eye, FileText } from "lucide-react";
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
  const [isSessionHistoryModalOpen, setIsSessionHistoryModalOpen] = useState(false);
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
        // Check expired FIRST - if expiration date has passed, it's expired (even if remaining is 0)
        if (expirationDate && now > expirationDate) {
          endReason = "renewal - expired";
        } else if (remainingSessions <= 0 || usedSessions >= totalSessions) {
          // Only mark as completed if not expired and all sessions are used
          endReason = "renewal - completed";
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
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-[#79e58f] animate-spin mx-auto"></div>
          <p className="text-sm text-gray-500 mt-4">Loading player...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Player not found</h3>
          <p className="text-sm text-gray-500 mb-6">The player you're looking for doesn't exist or has been removed.</p>
          <Button 
            onClick={() => navigate("/dashboard/students")} 
            className="bg-[#79e58f] hover:bg-[#5bc46d] text-white px-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
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

  const packageStatus = getPackageStatus(total, remaining, student.expiration_date ? new Date(student.expiration_date) : null);
  

  return (
    <div className="min-h-screen bg-[#FAFAF9] p-3 sm:p-4 md:p-6 pb-24 md:pb-6">
      <div className="max-w-6xl mx-auto space-y-5">
        
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard/students")}
          className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Players
        </Button>

        {/* Player Profile Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Dark Header */}
          <div className="bg-[#242833] px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col items-center sm:flex-row sm:items-center gap-4 sm:gap-5">
              {/* Avatar */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#79e58f] rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xl sm:text-2xl font-bold text-white">
                  {student.name.charAt(0).toUpperCase()}
                </span>
              </div>
              
              {/* Name & Status */}
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-1.5">
                  <h1 className="text-lg sm:text-xl font-bold text-white truncate">{student.name}</h1>
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                    packageStatus.status === 'ongoing' 
                      ? 'bg-emerald-500 text-white' 
                      : packageStatus.status === 'expired'
                        ? 'bg-red-500 text-white'
                        : 'bg-blue-500 text-white'
                  }`}>
                    {packageStatus.statusText}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-sm text-gray-400">
                  {student.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-gray-500" />
                      {student.email}
                    </span>
                  )}
                  {student.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-gray-500" />
                      {student.phone}
                    </span>
                  )}
                  {branches?.find(b => b.id === student.branch_id)?.name && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-500" />
                      {branches?.find(b => b.id === student.branch_id)?.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            <div className="px-4 py-3.5 text-center">
              <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mb-0.5">Package</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{student.package_type || '—'}</p>
            </div>
            <div className="px-4 py-3.5 text-center">
              <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mb-0.5">Sessions</p>
              <p className="text-sm font-semibold text-gray-900">
                <span className="text-[#79e58f]">{remaining % 1 === 0 ? remaining : remaining.toFixed(1)}</span> / {total}
              </p>
            </div>
            <div className="px-4 py-3.5 text-center">
              <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mb-0.5">Expires</p>
              <p className="text-sm font-semibold text-gray-900">
                {student.expiration_date ? format(new Date(student.expiration_date), 'MMM dd') : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Package History Modal */}
        <Dialog open={isPackageHistoryModalOpen} onOpenChange={setIsPackageHistoryModalOpen}>
          <DialogContent className="w-[95vw] max-w-4xl border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
            <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
              <DialogTitle className="text-sm sm:text-base md:text-lg font-bold text-white flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                </div>
                <span className="truncate">Package History</span>
              </DialogTitle>
              <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13 hidden sm:block">
                Previous package sessions are stored when renewing
              </DialogDescription>
            </DialogHeader>
            <div className="p-3 sm:p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar">
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

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Left Column - Current Package */}
          <div className="lg:col-span-2 space-y-5">
            
            {/* Current Package Card */}
            {student && (() => {
              const totalSessions = Number(student.sessions) || 0;
              const usedSessionsCalc =
                attendanceInCurrentPackage
                  ?.filter((record) => record.status === "present")
                  ?.reduce((sum, record) => sum + (record.session_duration ?? 1), 0) || 0;
              const remainingSessions = Math.max(0, totalSessions - usedSessionsCalc);
              const expirationDate = student.expiration_date ? new Date(student.expiration_date) : null;
              const enrollmentDate = student.enrollment_date ? new Date(student.enrollment_date) : null;
              const pkgStatus = getPackageStatus(totalSessions, remainingSessions, expirationDate);
              const isCurrent = pkgStatus.status === 'ongoing';
              
              const progressPercent = totalSessions > 0 ? Math.min(100, (usedSessionsCalc / totalSessions) * 100) : 0;
              
              return (
                <Card className="border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
                  <CardHeader className="pb-3 pt-4 px-5 bg-gray-50/50 border-b border-gray-100/50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <Package className="w-4 h-4 text-[#79e58f]" />
                        Current Package
                      </CardTitle>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        isCurrent
                          ? 'bg-emerald-500 text-white'
                          : pkgStatus.status === 'expired'
                            ? 'bg-red-500 text-white'
                            : 'bg-blue-500 text-white'
                      }`}>
                        {pkgStatus.statusText}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5">
                    {/* Package Name */}
                    <p className="text-lg font-bold text-[#79e58f] mb-4">{student.package_type || 'No package assigned'}</p>

                    {/* Session Progress */}
                    <div className="mb-5">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600">Session Progress</span>
                        <span className="font-semibold text-gray-900">
                          {usedSessionsCalc % 1 === 0 ? usedSessionsCalc : usedSessionsCalc.toFixed(1)} of {totalSessions} used
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCurrent ? 'bg-[#79e58f]' : pkgStatus.status === 'expired' ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">
                        <span className="font-medium text-[#79e58f]">{remainingSessions % 1 === 0 ? remainingSessions : remainingSessions.toFixed(1)}</span> sessions remaining
                      </p>
                    </div>

                    {/* Date & Branch Info */}
                    <div className="grid grid-cols-3 gap-2 mb-5">
                      <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                        <p className="text-[10px] sm:text-xs text-emerald-600 mb-0.5 font-medium">Start Date</p>
                        <p className="text-xs sm:text-sm font-semibold text-gray-900">
                          {enrollmentDate ? format(enrollmentDate, 'MMM dd, yy') : '—'}
                        </p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                        <p className="text-[10px] sm:text-xs text-orange-600 mb-0.5 font-medium">Expiry Date</p>
                        <p className="text-xs sm:text-sm font-semibold text-gray-900">
                          {expirationDate ? format(expirationDate, 'MMM dd, yy') : '—'}
                        </p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <p className="text-[10px] sm:text-xs text-purple-600 mb-0.5 font-medium">Branch</p>
                        <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                          {branches?.find(b => b.id === student.branch_id)?.name || '—'}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSessionHistoryModalOpen(true)}
                        className="text-xs text-white"
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
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                        View Sessions
                      </Button>
                      <Button
                        size="sm"
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
                        className="text-xs bg-blue-500 text-white hover:bg-blue-600"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1.5" />
                        Edit Package
                      </Button>
                      {isCurrent && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-red-200 text-red-600 hover:bg-red-50"
                          disabled={expireCurrentPackageMutation.isPending}
                          onClick={() => {
                            const confirmed = window.confirm("Expire the current package now?");
                            if (!confirmed) return;
                            expireCurrentPackageMutation.mutate();
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Expire
                        </Button>
                      )}
                      {pkgStatus.status === 'expired' && (
                        <Dialog open={isRetrieveDialogOpen} onOpenChange={setIsRetrieveDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              className="text-xs bg-orange-500 hover:bg-orange-600 text-white"
                            >
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                              Retrieve
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[95vw] max-w-md border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
                            <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
                              <DialogTitle className="text-sm sm:text-base md:text-lg font-bold text-white flex items-center gap-2 sm:gap-3">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                                  <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                                </div>
                                <span className="truncate">Retrieve Expired Package</span>
                              </DialogTitle>
                              <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13 hidden sm:block">
                                Extend the expiration date to reactivate this package
                              </DialogDescription>
                            </DialogHeader>
                            <div className="p-3 sm:p-4 md:p-5 overflow-y-auto flex-1 custom-scrollbar">
                            <form onSubmit={handleRetrievePackageSubmit} className="space-y-4 mt-4">
                              <div className="space-y-2">
                                <Label htmlFor="extend_days" className="text-gray-700 text-sm">Extend by (days)</Label>
                                <Input
                                  id="extend_days"
                                  type="number"
                                  min="1"
                                  max="365"
                                  value={retrieveFormData.extendDays}
                                  onChange={(e) => setRetrieveFormData((prev) => ({ ...prev, extendDays: parseInt(e.target.value) || 30 }))}
                                  className="border-gray-200"
                                  placeholder="30"
                                />
                                <p className="text-xs text-gray-500">
                                  New expiration: {retrieveFormData.extendDays > 0 && student.expiration_date ?
                                    format(addDays(new Date(student.expiration_date), retrieveFormData.extendDays), 'MMM dd, yyyy') :
                                    '—'}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="allowed_sessions" className="text-gray-700 text-sm">New Sessions (optional)</Label>
                                <Input
                                  id="allowed_sessions"
                                  type="number"
                                  min="1"
                                  value={retrieveFormData.allowedSessions}
                                  onChange={(e) => setRetrieveFormData((prev) => ({ ...prev, allowedSessions: e.target.value }))}
                                  className="border-gray-200"
                                  placeholder={`${student.sessions || '—'}`}
                                />
                              </div>
                              <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" onClick={() => setIsRetrieveDialogOpen(false)} className="flex-1">
                                  Cancel
                                </Button>
                                <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white" disabled={retrievePackageMutation.isPending}>
                                  {retrievePackageMutation.isPending ? "..." : "Retrieve"}
                                </Button>
                              </div>
                            </form>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      {pkgStatus.status !== 'ongoing' && (
                        <Dialog open={isNewPackageDialogOpen} onOpenChange={setIsNewPackageDialogOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" className="text-xs bg-emerald-500 text-white hover:bg-emerald-600">
                              <Plus className="w-3.5 h-3.5 mr-1.5" />
                              New Package
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[95vw] max-w-md border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
                            <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
                              <DialogTitle className="text-sm sm:text-base md:text-lg font-bold text-white flex items-center gap-2 sm:gap-3">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                                </div>
                                <span className="truncate">Create New Package</span>
                              </DialogTitle>
                              <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13 hidden sm:block">
                                Start a new package session (renewal)
                              </DialogDescription>
                            </DialogHeader>
                            <div className="p-3 sm:p-4 md:p-5 overflow-y-auto flex-1 custom-scrollbar">
                            <form onSubmit={handleNewPackageSubmit} className="space-y-4">
                              <div className="space-y-2">
                                <Label className="text-gray-700 text-sm">Package Type</Label>
                                <Select
                                  value={newPackageFormData.package_type ?? undefined}
                                  onValueChange={(value) => setNewPackageFormData((prev) => ({ ...prev, package_type: value }))}
                                >
                                  <SelectTrigger className="border-gray-200">
                                    <SelectValue placeholder="Select package" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {packages?.map((pkg) => (
                                      <SelectItem key={pkg.id} value={pkg.name}>{pkg.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-gray-700 text-sm">Total Sessions</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={newPackageFormData.sessions}
                                  onChange={(e) => setNewPackageFormData((prev) => ({ ...prev, sessions: parseInt(e.target.value) || 0 }))}
                                  required
                                  className="border-gray-200"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label className="text-gray-700 text-sm">Start Date</Label>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newPackageFormData.enrollment_date && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {newPackageFormData.enrollment_date ? format(newPackageFormData.enrollment_date, "MM/dd/yy") : "Pick"}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <CalendarComponent mode="single" selected={newPackageFormData.enrollment_date || undefined} onSelect={(date) => setNewPackageFormData((prev) => ({ ...prev, enrollment_date: date || new Date() }))} initialFocus />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-gray-700 text-sm">Expiry Date</Label>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newPackageFormData.expiration_date && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {newPackageFormData.expiration_date ? format(newPackageFormData.expiration_date, "MM/dd/yy") : "Pick"}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <CalendarComponent mode="single" selected={newPackageFormData.expiration_date || undefined} onSelect={(date) => setNewPackageFormData((prev) => ({ ...prev, expiration_date: date || null }))} initialFocus />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </div>
                              <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" onClick={() => setIsNewPackageDialogOpen(false)} className="flex-1">Cancel</Button>
                                <Button type="submit" disabled={createNewPackageMutation.isPending} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white">
                                  {createNewPackageMutation.isPending ? "..." : "Create"}
                                </Button>
                              </div>
                            </form>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Edit Package Dialog */}
            <Dialog open={isEditPackageDialogOpen} onOpenChange={setIsEditPackageDialogOpen}>
              <DialogContent className="w-[95vw] max-w-md border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
                <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
                  <DialogTitle className="text-sm sm:text-base md:text-lg font-bold text-white flex items-center gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                      <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                    </div>
                    <span className="truncate">Edit Package</span>
                  </DialogTitle>
                  <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13 hidden sm:block">Update the current package details</DialogDescription>
                </DialogHeader>
                <div className="p-3 sm:p-4 md:p-5 overflow-y-auto flex-1 custom-scrollbar">
                <form onSubmit={handleEditPackageSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700 text-sm">Package Type</Label>
                    <Select value={editPackageFormData.package_type ?? undefined} onValueChange={(value) => setEditPackageFormData((prev) => ({ ...prev, package_type: value }))}>
                      <SelectTrigger className="border-gray-200"><SelectValue placeholder="Select package" /></SelectTrigger>
                      <SelectContent>
                        {packages?.map((pkg) => (<SelectItem key={pkg.id} value={pkg.name}>{pkg.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700 text-sm">Total Sessions</Label>
                    <Input type="number" min="0" value={editPackageFormData.sessions} onChange={(e) => setEditPackageFormData((prev) => ({ ...prev, sessions: parseInt(e.target.value) || 0 }))} required className="border-gray-200" />
                    <p className="text-xs text-gray-500">Remaining will be recalculated from attendance</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-gray-700 text-sm">Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editPackageFormData.enrollment_date && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editPackageFormData.enrollment_date ? format(editPackageFormData.enrollment_date, "MM/dd/yy") : "Pick"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent mode="single" selected={editPackageFormData.enrollment_date || undefined} onSelect={(date) => setEditPackageFormData((prev) => ({ ...prev, enrollment_date: date || new Date() }))} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-700 text-sm">Expiry Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editPackageFormData.expiration_date && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editPackageFormData.expiration_date ? format(editPackageFormData.expiration_date, "MM/dd/yy") : "Pick"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent mode="single" selected={editPackageFormData.expiration_date || undefined} onSelect={(date) => setEditPackageFormData((prev) => ({ ...prev, expiration_date: date || addMonths(new Date(), 1) }))} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsEditPackageDialogOpen(false)} className="flex-1">Cancel</Button>
                    <Button type="submit" disabled={editPackageMutation.isPending} className="flex-1 bg-[#242833] hover:bg-[#2a2c2a] text-white">
                      {editPackageMutation.isPending ? "..." : "Update"}
                    </Button>
                  </div>
                </form>
                </div>
              </DialogContent>
            </Dialog>

          </div>

          {/* Right Column - Package History & Quick Info */}
          <div className="space-y-5">
            
            {/* Package History Card */}
            <Card className="border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
              <CardHeader className="pb-3 pt-4 px-5 bg-blue-50/50 border-b border-blue-100/50">
                <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Package History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {packageHistory && packageHistory.length > 0 ? (
                  (() => {
                    const sortedHistory = [...packageHistory].sort(
                      (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
                    );

                    const historyWithSessions = sortedHistory.map((pkg, idx) => {
                      const next = sortedHistory[idx + 1];
                      const start = pkg.enrollment_date ? new Date(pkg.enrollment_date) : pkg.captured_at ? new Date(pkg.captured_at) : null;
                      const nextCapture = next ? new Date(next.captured_at) : null;
                      const end = nextCapture ? nextCapture : pkg.expiration_date ? new Date(pkg.expiration_date) : null;
                      return { pkg, start, end };
                    });

                    const displayHistory = [...historyWithSessions].reverse();

                    return (
                      <div className="space-y-3">
                        {displayHistory.slice(0, 5).map((entry, idx) => {
                          const totalCount = displayHistory.length;
                          const sequenceNumber = totalCount - idx;
                          const { pkg, start, end } = entry;
                          const cycleNumber = sequenceNumber;
                          const packageCycleMatches = attendanceRecords?.filter((r) => r.package_cycle === cycleNumber);
                          const sessionsInPackage = (packageCycleMatches && packageCycleMatches.length > 0 ? packageCycleMatches : attendanceRecords?.filter((r) => {
                            const d = r.training_sessions?.date ? new Date(r.training_sessions.date) : null;
                            if (!d) return false;
                            if (start && d < start) return false;
                            if (end && d >= end) return false;
                            return true;
                          })) || [];
                          const attended = sessionsInPackage.filter((r) => r.status === "present").reduce((s, r) => s + (r.session_duration ?? 1), 0);
                          
                          // Determine package status - check expired FIRST
                          const totalSess = pkg.sessions ?? 0;
                          const remainingSess = pkg.remaining_sessions ?? 0;
                          const expDate = pkg.expiration_date ? new Date(pkg.expiration_date) : null;
                          // Check if reason contains "expired" for accurate status
                          const reasonIndicatesExpired = pkg.reason?.toLowerCase().includes('expired');
                          const isExpired = reasonIndicatesExpired || (expDate && new Date() > expDate);
                          const isCompleted = !isExpired && (remainingSess <= 0 || attended >= totalSess);
                          const statusText = isExpired ? 'Expired' : isCompleted ? 'Completed' : 'Ended';
                          const statusColor = isExpired ? 'bg-red-500 text-white' : isCompleted ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white';

                          return (
                            <div key={pkg.id} className="p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors shadow-sm">
                              {/* Header Row */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#79e58f] text-white text-xs font-bold">{sequenceNumber}</span>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">{pkg.package_type || 'Package'}</p>
                                    <p className="text-xs text-gray-400">{pkg.reason || 'Archived'}</p>
                                  </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColor}`}>
                                  {statusText}
                                </span>
                              </div>
                              
                              {/* Stats Row */}
                              <div className="grid grid-cols-3 gap-2 mb-3">
                                <div className="text-center p-2 bg-gray-50 rounded-lg">
                                  <p className="text-[10px] text-gray-400 uppercase">Total</p>
                                  <p className="text-sm font-bold text-gray-900">{totalSess}</p>
                                </div>
                                <div className="text-center p-2 bg-emerald-50 rounded-lg">
                                  <p className="text-[10px] text-emerald-600 uppercase">Used</p>
                                  <p className="text-sm font-bold text-emerald-700">{attended % 1 === 0 ? attended : attended.toFixed(1)}</p>
                                </div>
                                <div className="text-center p-2 bg-orange-50 rounded-lg">
                                  <p className="text-[10px] text-orange-600 uppercase">Left</p>
                                  <p className="text-sm font-bold text-orange-700">{remainingSess}</p>
                                </div>
                              </div>
                              
                              {/* Dates & Actions */}
                              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                <p className="text-xs text-gray-500">
                                  {start ? format(start, "MMM dd") : "—"} → {end ? format(end, "MMM dd, yyyy") : "—"}
                                </p>
                                <div className="flex items-center gap-1">
                                  {sessionsInPackage.length > 0 && (
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-white" style={{ backgroundColor: '#1e3a8a' }} onClick={() => setPackageSessionsModal({ open: true, title: `Package #${sequenceNumber} Sessions`, sessions: sessionsInPackage })} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1e40af'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1e3a8a'; }}>
                                      <Eye className="w-3 h-3 mr-1" />
                                      View
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => { if (!deleteHistoryMutation.isPending && window.confirm("Delete this package history?")) deleteHistoryMutation.mutate(pkg.id); }}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {displayHistory.length > 5 && (
                          <Button variant="outline" className="w-full text-xs border-[#79e58f] text-[#79e58f] hover:bg-[#79e58f] hover:text-white" onClick={() => setIsPackageHistoryModalOpen(true)}>
                            View all {displayHistory.length} packages
                          </Button>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">No previous packages</p>
                    <p className="text-xs text-gray-400 mt-1">History will appear here after renewals</p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Package Sessions Modal */}
        <Dialog open={packageSessionsModal.open} onOpenChange={(open) => setPackageSessionsModal((prev) => ({ ...prev, open }))}>
          <DialogContent className="w-[98vw] max-w-4xl border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
            <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
              <DialogTitle className="text-sm sm:text-base md:text-lg font-bold text-white flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                </div>
                <span className="truncate">{packageSessionsModal.title || "Package Sessions"}</span>
              </DialogTitle>
              <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13 hidden sm:block">
                {packageSessionsModal.sessions.length} sessions • Total: {(() => {
                  const total = packageSessionsModal.sessions.filter(s => s.status === 'present').reduce((sum, s) => sum + (s.session_duration ?? 1), 0);
                  return total % 1 === 0 ? total : total.toFixed(1);
                })()} attended
              </DialogDescription>
            </DialogHeader>
            <div className="p-3 sm:p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar">
              {packageSessionsModal.sessions.length > 0 ? (
                <div className="space-y-2">
                  {packageSessionsModal.sessions.map((session) => (
                    <div key={session.session_id} className={`flex items-center justify-between p-3 rounded-lg transition-colors border ${
                      session.status === "present" ? "bg-emerald-50/50 border-emerald-100 hover:bg-emerald-100/50" : session.status === "absent" ? "bg-red-50/50 border-red-100 hover:bg-red-100/50" : "bg-gray-50/50 border-gray-100 hover:bg-gray-100/50"
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">
                            {session.training_sessions?.date ? format(new Date(session.training_sessions.date), "MMM dd, yyyy") : "N/A"}
                          </span>
                          <span className="text-xs text-gray-500">
                            {session.training_sessions?.start_time && session.training_sessions?.end_time 
                              ? `${format(new Date(`1970-01-01T${session.training_sessions.start_time}`), "h:mm a")} - ${format(new Date(`1970-01-01T${session.training_sessions.end_time}`), "h:mm a")}`
                              : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                          <span>{session.training_sessions?.branches?.name || "—"}</span>
                          <span>•</span>
                          <span>{session.training_sessions?.session_coaches?.map((sc) => sc.coaches?.name).filter(Boolean).join(", ") || "No coach"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs font-medium text-[#79e58f]">{session.session_duration ?? 1} hr</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          session.status === "present" ? "bg-emerald-500 text-white" : session.status === "absent" ? "bg-red-500 text-white" : "bg-amber-500 text-white"
                        }`}>{session.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">No sessions recorded</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Session History Modal */}
        <Dialog open={isSessionHistoryModalOpen} onOpenChange={setIsSessionHistoryModalOpen}>
          <DialogContent className="w-[98vw] max-w-4xl border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
            <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
              <DialogTitle className="text-sm sm:text-base md:text-lg font-bold text-white flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                </div>
                <span className="truncate">Session History</span>
              </DialogTitle>
              <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13 hidden sm:block">
                Current package attendance records ({filteredAttendanceRecords.length} sessions)
              </DialogDescription>
            </DialogHeader>
            <div className="p-3 sm:p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar">
              {paginatedRecords.length > 0 ? (
                <div className="space-y-2">
                  {paginatedRecords.map((record, idx) => (
                    <div key={record.session_id} className={`flex items-center justify-between p-3 rounded-lg transition-colors border ${
                      record.status === "present" ? "bg-emerald-50/50 border-emerald-100 hover:bg-emerald-100/50" : record.status === "absent" ? "bg-red-50/50 border-red-100 hover:bg-red-100/50" : "bg-gray-50/50 border-gray-100 hover:bg-gray-100/50"
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">
                            {format(new Date(record.training_sessions.date), "MMM dd, yyyy")}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(`1970-01-01T${record.training_sessions.start_time}`), "h:mm a")} - {format(new Date(`1970-01-01T${record.training_sessions.end_time}`), "h:mm a")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                          <span>{record.training_sessions.branches?.name || "—"}</span>
                          <span>•</span>
                          <span>{record.training_sessions.session_coaches.length > 0 ? record.training_sessions.session_coaches.map(sc => sc.coaches?.name).filter(Boolean).join(', ') : 'No coach'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs font-medium text-[#79e58f]">{record.session_duration ?? 1} hr</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          record.status === "present" ? "bg-emerald-500 text-white" : record.status === "absent" ? "bg-red-500 text-white" : "bg-amber-500 text-white"
                        }`}>{record.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">No sessions in current package</p>
              )}
            </div>
            {recordsTotalPages > 1 && (
              <div className="flex justify-center items-center pt-4 gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => handleRecordsPageChange(recordsCurrentPage - 1)} disabled={recordsCurrentPage === 1} className="h-8 w-8 p-0">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600 px-3">{recordsCurrentPage} / {recordsTotalPages}</span>
                <Button variant="ghost" size="sm" onClick={() => handleRecordsPageChange(recordsCurrentPage + 1)} disabled={recordsCurrentPage === recordsTotalPages} className="h-8 w-8 p-0">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>


      </div>
    </div>
  );
}
