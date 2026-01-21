import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { Calendar, Clock, Eye, MapPin, Plus, Trash2, User, Users, Filter, Search, ChevronLeft, ChevronRight, Pencil, Download, Package } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { exportToCSV } from "@/utils/exportUtils";

type SessionStatus = Database['public']['Enums']['session_status'];

type Package = {
  id: string;
  name: string;
};

type Student = {
  id: string;
  name: string;
  remaining_sessions: number;
  current_remaining_sessions?: number;
  branch_id: string | null;
  package_type: string | null;
  sessions?: number | null;
  attendance_records?: Array<{
    session_duration: number | null;
    package_cycle: number | null;
    status: string;
    training_sessions?: {
      package_cycle: number | null;
    } | null;
  }>;
  student_package_history?: Array<{
    id: string;
    sessions: number | null;
    remaining_sessions: number | null;
    captured_at: string;
  }>;
};

type CoachSessionTime = {
  id: string;
  session_id: string;
  coach_id: string;
  time_in: string | null;
  time_out: string | null;
  coaches: { name: string } | null;
};

type TrainingSession = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  branch_id: string;
  notes: string | null;
  status: SessionStatus;
  package_type: string | null;
  branches: { name: string };
  session_coaches: Array<{
    id: string;
    coach_id: string;
    coaches: { name: string; email?: string };
  }>;
  session_participants: Array<{
    id: string;
    student_id: string;
    students: { name: string; email?: string };
  }>;
  coach_session_times: Array<CoachSessionTime>;
};

// Helper functions
const formatDisplayDate = (dateString: string) => {
  try {
    const date = parseISO(dateString);
    return format(date, 'MMM dd, yyyy');
  } catch (error) {
    console.error('Error formatting display date:', error);
    return 'Invalid Date';
  }
};

const formatDisplayTime = (timeString: string) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dateTimeString = `${today}T${timeString}`;
    const date = parseISO(dateTimeString);
    return format(date, 'hh:mm a');
  } catch (error) {
    console.error('Error formatting display time:', error);
    return 'Invalid Time';
  }
};

const formatDateTime = (dateTime: string | null): string => {
  if (!dateTime) return 'Not recorded';
  try {
    return format(parseISO(dateTime), 'MMM dd, yyyy hh:mm a');
  } catch (error) {
    console.error('Error formatting date-time:', error);
    return 'Invalid Date/Time';
  }
};

const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Updated function to return styles for status text
const getStatusStyles = (status: string) => {
  switch (status) {
    case 'scheduled': return 'bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md';
    case 'completed': return 'bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-md';
    case 'cancelled': return 'bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md';
    default: return 'bg-gray-50 text-gray-700 border border-gray-200 px-2 py-1 rounded-md';
  }
};

export function SessionsManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isParticipantsDialogOpen, setIsParticipantsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPackageType, setFilterPackageType] = useState<string>("All");
  const [branchFilter, setBranchFilter] = useState<string>("All");
  const [coachFilter, setCoachFilter] = useState<string>("All");
  const [sortOrder, setSortOrder] = useState<"Newest to Oldest" | "Oldest to Newest">("Newest to Oldest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const [formData, setFormData] = useState({
    date: "",
    start_time: "",
    end_time: "",
    branch_id: "",
    notes: "",
    status: "scheduled" as SessionStatus,
    package_type: "",
  });

  const queryClient = useQueryClient();

  const { role, coachData } = useAuth();
  const coachId = role === "coach" ? coachData?.id : null; // <-- DB ID, not auth.id

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['training-sessions', coachId], // include coachId so it refetches if changes
    queryFn: async () => {
      let query = supabase
        .from('training_sessions')
        .select(`
          id,
          date,
          start_time,
          end_time,
          branch_id,
          notes,
          status,
          package_type,
          branches (name),
          session_coaches (
            id,
            coach_id,
            coaches (name)
          ),
          session_participants (
            id,
            student_id,
            students (name)
          ),
          coach_session_times (
            id,
            session_id,
            coach_id,
            time_in,
            time_out,
            coaches (name)
          )
        `)
        .order('date', { ascending: false });

    if (role === "coach" && coachId) {
      const { data: coachSessions, error: csError } = await supabase
        .from('session_coaches')
        .select('session_id')
        .eq('coach_id', coachId);

      if (csError) throw csError;

      const sessionIds = coachSessions?.map(cs => cs.session_id) || [];
      console.log('Coach sessions data:', coachSessions);
      console.log('Derived session IDs:', sessionIds);

      if (sessionIds.length > 0) {
        query = query.in('id', sessionIds);
      } else {
        return [];
      }
    }

    const { data, error: qError } = await query;
    if (qError) throw qError;

    return data as TrainingSession[];
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
      return data;
    }
  });

  const { data: coaches, isLoading: coachesLoading, error: coachesError } = useQuery({
    queryKey: ['coaches-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coaches')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: packages, isLoading: packagesLoading, error: packagesError } = useQuery({
    queryKey: ['packages-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data as Package[];
    },
  });

  const { data: students, isLoading: studentsLoading, error: studentsError } = useQuery({
    queryKey: ['students-select', formData.branch_id, formData.package_type],
    queryFn: async () => {
      if (!formData.branch_id || !formData.package_type) return [];
      const pkgFilter = (formData.package_type || "").trim();
      const isPersonal = pkgFilter.toLowerCase().includes("personal");

      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          name,
          remaining_sessions,
          branch_id,
          package_type,
          expiration_date,
          sessions,
          attendance_records (
            session_duration,
            package_cycle,
            status,
            training_sessions (
              package_cycle
            )
          ),
          student_package_history (
            id,
            sessions,
            remaining_sessions,
            captured_at
          )
        `)
        .eq('branch_id', formData.branch_id)
        .order('name');

      if (error) {
        console.error('Error fetching students:', error, { branch_id: formData.branch_id, package_type: formData.package_type });
        throw new Error(`Failed to fetch students: ${error.message}`);
      }

      const filtered =
        data?.map((s) => {
          // Calculate current cycle remaining sessions
          const packageHistory = s.student_package_history || [];
          const currentCycle = packageHistory.length + 1;

          // Count sessions used in current cycle
          const currentCycleSessionsUsed = ((s.attendance_records as any) || [])
            .filter((record: any) =>
              record.status === 'present' &&
              ((record.package_cycle === currentCycle) ||
               (record.training_sessions?.package_cycle === currentCycle))
            )
            .reduce((total: number, record: any) => total + (record.session_duration || 1), 0);

          // Current remaining sessions = total sessions - sessions used in current cycle
          const currentRemainingSessions = Math.max(0, (s.sessions || 0) - currentCycleSessionsUsed);

          return {
            ...s,
            current_remaining_sessions: currentRemainingSessions
          };
        })
        .filter((s) => {
          const pkg = (s.package_type || "").trim().toLowerCase();
          const target = pkgFilter.toLowerCase();
          const expiryOk = !s.expiration_date || new Date(s.expiration_date) >= new Date();
          if (!expiryOk) return false;
          if (isPersonal && !pkg) return true; // allow null/empty for personal
          return pkg.includes(target);
        }) || [];

      if (filtered.length === 0) {
        console.warn('No students found for:', { branch_id: formData.branch_id, package_type: formData.package_type, filteredFrom: data?.length || 0 });
      }

      return filtered as any;
    },
    enabled: !!formData.branch_id && !!formData.package_type,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

  // Force-refresh student list when dialog opens or filters change
  useEffect(() => {
    if (isDialogOpen) {
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'students-select',
      });
      queryClient.refetchQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'students-select',
      });
    }
  }, [isDialogOpen, formData.branch_id, formData.package_type, queryClient]);

  const createMutation = useMutation({
    mutationFn: async (session: typeof formData) => {
      if (!session.package_type) throw new Error('Package type is required');
      if (selectedCoaches.length === 0) throw new Error('At least one coach must be selected');

      // Validate student session limits
      const invalidStudents = selectedStudents
        .map(studentId => students?.find(s => s.id === studentId))
        .filter(student => student && student.remaining_sessions <= 0);
      
      if (invalidStudents.length > 0) {
        throw new Error(
          `The following students have no remaining sessions: ${invalidStudents
            .map(s => s!.name)
            .join(', ')}. Please increase their session count.`
        );
      }

      // Check for conflicts for all selected coaches
      for (const coachId of selectedCoaches) {
        const { data: conflicts } = await supabase
          .from('session_coaches')
          .select('session_id, training_sessions!inner(date, start_time, end_time)')
          .eq('coach_id', coachId)
          .eq('training_sessions.date', session.date)
          .lte('training_sessions.start_time', session.end_time)
          .gte('training_sessions.end_time', session.start_time);

        if (conflicts && conflicts.length > 0) {
          const coachName = coaches?.find(c => c.id === coachId)?.name;
          throw new Error(`Coach ${coachName} is already scheduled for a session on this date/time.`);
        }
      }

      // Package cycle will be determined when attendance is taken
      const sessionPackageCycle = null;

      // Create a single session
      const { data: sessionResult, error: sessionError } = await supabase
        .from('training_sessions')
        .insert([{ ...session, package_cycle: sessionPackageCycle }])
        .select(`
          id,
          date,
          start_time,
          end_time,
          branch_id,
          notes,
          status,
          package_type,
          branches (name),
          session_coaches (
            id,
            coach_id,
            coaches (name, email)
          ),
          session_participants (
            id,
            student_id,
            students (name, email)
          ),
          coach_session_times (
            id,
            session_id,
            coach_id,
            time_in,
            time_out,
            coaches (name)
          )
        `)
        .single();
      
      if (sessionError) {
        console.error('Session creation error:', sessionError);
        throw sessionError;
      }

      const createdSession = sessionResult as TrainingSession;

      // Insert session_coaches entries
      if (selectedCoaches.length > 0) {
        const { error: coachesError } = await supabase
          .from('session_coaches')
          .insert(
            selectedCoaches.map(coachId => ({
              session_id: createdSession.id,
              coach_id: coachId
            }))
          );

        if (coachesError) {
          console.error('Session coaches insert error:', coachesError);
          throw coachesError;
        }
      }

      // Add participants
      if (selectedStudents.length > 0) {
        const { error: participantsError } = await supabase
          .from('session_participants')
          .insert(
            selectedStudents.map(studentId => ({
              session_id: createdSession.id,
              student_id: studentId
            }))
          );
        
        if (participantsError) {
          console.error('Session participants insert error:', participantsError);
          throw participantsError;
        }

        const { error: attendanceError } = await supabase
          .from('attendance_records')
          .insert(
            selectedStudents.map(studentId => ({
              session_id: createdSession.id,
              student_id: studentId,
              status: 'pending' as const,
              package_cycle: sessionPackageCycle
            }))
          );
        
        if (attendanceError) {
          console.error('Attendance records insert error:', attendanceError);
          throw attendanceError;
        }
      }

      // Send email notifications to coaches and students
      try {
        // Get coach emails
        const coachEmails: Array<{ email: string; name: string }> = [];
        const coachIds = createdSession.session_coaches.map(sc => sc.coach_id);
        
        if (coachIds.length > 0) {
          const { data: coachData } = await supabase
            .from('coaches')
            .select('id, email, name')
            .in('id', coachIds);

          coachData?.forEach(coach => {
            if (coach.email) {
              const sessionCoach = createdSession.session_coaches.find(sc => sc.coach_id === coach.id);
              coachEmails.push({ 
                email: coach.email, 
                name: coach.name || sessionCoach?.coaches?.name || 'Coach'
              });
            }
          });
        }

        // Get student emails
        const studentEmails: Array<{ email: string; name: string }> = [];
        const studentIds = createdSession.session_participants.map(sp => sp.student_id);
        
        if (studentIds.length > 0) {
          const { data: studentData } = await supabase
            .from('students')
            .select('id, email, name')
            .in('id', studentIds);

          studentData?.forEach(student => {
            if (student.email) {
              const sessionParticipant = createdSession.session_participants.find(sp => sp.student_id === student.id);
              studentEmails.push({ 
                email: student.email, 
                name: student.name || sessionParticipant?.students?.name || 'Student'
              });
            }
          });
        }

        // Send email notifications if we have recipients
        if (coachEmails.length > 0 || studentEmails.length > 0) {
          const { data: functionData, error: functionError } = await supabase.functions.invoke(
            'send-session-notification',
            {
              body: {
                sessionId: createdSession.id,
                date: createdSession.date,
                startTime: createdSession.start_time,
                endTime: createdSession.end_time,
                branchName: createdSession.branches?.name || 'Unknown Branch',
                packageType: createdSession.package_type,
                coachEmails: coachEmails.map(c => c.email),
                studentEmails: studentEmails.map(s => s.email),
                coachNames: coachEmails.map(c => c.name),
                studentNames: studentEmails.map(s => s.name),
              },
            }
          );

          if (functionError) {
            console.error('Error sending email notifications:', functionError);
            // Don't fail the session creation if email fails - error is logged
          } else {
            console.log('Email notifications sent:', functionData);
            const sentCount = (functionData?.results?.coaches?.filter((r: any) => r.success).length || 0) +
                             (functionData?.results?.students?.filter((r: any) => r.success).length || 0);
            if (sentCount > 0) {
              console.log(`Successfully sent ${sentCount} notification email(s)`);
              // Store success message to show in onSuccess
              (createdSession as any).emailNotificationSent = sentCount;
            }
          }
        }
      } catch (emailError: any) {
        console.error('Error in email notification process:', emailError);
        // Don't fail the session creation if email fails
      }

      return createdSession;
    },
    onSuccess: (data: any) => {
      console.log('Created session:', data);
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      
      const emailCount = data.emailNotificationSent || 0;
      if (emailCount > 0) {
        toast.success(`Training session created successfully! ${emailCount} notification email${emailCount > 1 ? 's' : ''} sent.`);
      } else {
        toast.success(`Training session created successfully with ${selectedCoaches.length} coach${selectedCoaches.length > 1 ? 'es' : ''}`);
      }
      resetForm();
    },
    onError: (error) => {
      console.error('Create mutation error:', error);
      toast.error('Failed to create session: ' + error.message);
    }
  });

  const handleSelectAllStudents = (selectAll: boolean) => {
    if (!students) return;

    const eligibleIds = students
      .filter(student => (student.current_remaining_sessions ?? student.remaining_sessions) > 0)
      .map(student => student.id);

    if (selectAll) {
      setSelectedStudents(eligibleIds);
    } else {
      setSelectedStudents(prev => prev.filter(id => !eligibleIds.includes(id)));
    }
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...session }: typeof formData & { id: string }) => {
      if (!session.package_type) throw new Error('Package type is required');
      if (selectedCoaches.length === 0) throw new Error('At least one coach must be selected');

      // Fetch fresh student data for validation
      if (selectedStudents.length > 0) {
        const { data: freshStudents, error: fetchStudentsError } = await supabase
          .from('students')
          .select(`
            id,
            name,
            remaining_sessions,
            sessions,
            branch_id,
            package_type,
            expiration_date,
            attendance_records (
              session_duration,
              package_cycle,
              status,
              training_sessions (
                package_cycle
              )
            ),
            student_package_history (
              id,
              sessions,
              remaining_sessions,
              captured_at
            )
          `)
          .in('id', selectedStudents);

        if (fetchStudentsError) {
          console.error('Error fetching students for validation:', fetchStudentsError);
          throw new Error('Failed to validate students: ' + fetchStudentsError.message);
        }

        // Calculate accurate remaining sessions for each student
        const studentsWithAccurateSessions = (freshStudents || []).map((s: any) => {
          const packageHistory = s.student_package_history || [];
          const currentCycle = packageHistory.length + 1;

          // Count sessions used in current cycle
          const currentCycleSessionsUsed = ((s.attendance_records as any) || [])
            .filter((record: any) =>
              record.status === 'present' &&
              ((record.package_cycle === currentCycle) ||
               (record.training_sessions?.package_cycle === currentCycle))
            )
            .reduce((total: number, record: any) => total + (record.session_duration || 1), 0);

          // Current remaining sessions = total sessions - sessions used in current cycle
          const currentRemainingSessions = Math.max(0, (s.sessions || 0) - currentCycleSessionsUsed);

          return {
            ...s,
            current_remaining_sessions: currentRemainingSessions
          };
        });

        // Validate student session limits using accurate data
        const invalidStudents = studentsWithAccurateSessions
          .filter(student => {
            const remaining = student.current_remaining_sessions ?? student.remaining_sessions ?? 0;
            return remaining <= 0;
          });
        
        if (invalidStudents.length > 0) {
          throw new Error(
            `The following students have no remaining sessions: ${invalidStudents
              .map(s => s.name)
              .join(', ')}. Please increase their session count.`
          );
        }
      }

      // Check for conflicts
      for (const coachId of selectedCoaches) {
        const { data: conflicts } = await supabase
          .from('session_coaches')
          .select('session_id, training_sessions!inner(date, start_time, end_time)')
          .eq('coach_id', coachId)
          .eq('training_sessions.date', session.date)
          .lte('training_sessions.start_time', session.end_time)
          .gte('training_sessions.end_time', session.start_time)
          .neq('session_id', id);

        if (conflicts && conflicts.length > 0) {
          const coachName = coaches?.find(c => c.id === coachId)?.name;
          throw new Error(`Coach ${coachName} is already scheduled for another session on this date/time.`);
        }
      }

      const { data, error } = await supabase
        .from('training_sessions')
        .update({ ...session })
        .eq('id', id)
        .select(`
          id,
          date,
          start_time,
          end_time,
          branch_id,
          notes,
          status,
          package_type,
          branches (name),
          session_coaches (
            id,
            coach_id,
            coaches (name)
          ),
          session_participants (
            id,
            student_id,
            students (name)
          ),
          coach_session_times (
            id,
            session_id,
            coach_id,
            time_in,
            time_out,
            coaches (name)
          )
        `)
        .single();
      
      if (error) {
        console.error('Session update error:', error);
        throw error;
      }

      // Update session_coaches
      await supabase
        .from('session_coaches')
        .delete()
        .eq('session_id', id);

      if (selectedCoaches.length > 0) {
        const { error: coachesError } = await supabase
          .from('session_coaches')
          .insert(
            selectedCoaches.map(coachId => ({
              session_id: id,
              coach_id: coachId
            }))
          );

        if (coachesError) {
          console.error('Session coaches update error:', coachesError);
          throw coachesError;
        }
      }

      // Get existing participants and attendance records before updating
      const { data: existingParticipants, error: fetchParticipantsError } = await supabase
        .from('session_participants')
        .select('student_id')
        .eq('session_id', id);

      if (fetchParticipantsError) {
        console.error('Error fetching existing participants:', fetchParticipantsError);
        throw fetchParticipantsError;
      }

      const { data: existingAttendance, error: fetchAttendanceError } = await supabase
        .from('attendance_records')
        .select('student_id, status, session_duration, package_cycle')
        .eq('session_id', id);

      if (fetchAttendanceError) {
        console.error('Error fetching existing attendance:', fetchAttendanceError);
        throw fetchAttendanceError;
      }

      const existingStudentIds = (existingParticipants as { student_id: string }[] | null)?.map(p => p.student_id) || [];
      const existingAttendanceData = Array.isArray(existingAttendance) 
        ? (existingAttendance as unknown as Array<{ student_id: string; status: string; session_duration: number | null; package_cycle: number | null }>)
        : [];
      const existingAttendanceMap = new Map(
        existingAttendanceData.map(ar => [ar.student_id, { status: ar.status, session_duration: ar.session_duration, package_cycle: ar.package_cycle }])
      );

      // Determine which students to add and remove
      const studentsToAdd = selectedStudents.filter(id => !existingStudentIds.includes(id));
      const studentsToRemove = existingStudentIds.filter(id => !selectedStudents.includes(id));

      // Remove participants and their attendance records
      if (studentsToRemove.length > 0) {
        const { error: removeParticipantsError } = await supabase
          .from('session_participants')
          .delete()
          .eq('session_id', id)
          .in('student_id', studentsToRemove);

        if (removeParticipantsError) {
          console.error('Error removing participants:', removeParticipantsError);
          throw removeParticipantsError;
        }

        const { error: removeAttendanceError } = await supabase
          .from('attendance_records')
          .delete()
          .eq('session_id', id)
          .in('student_id', studentsToRemove);

        if (removeAttendanceError) {
          console.error('Error removing attendance records:', removeAttendanceError);
          throw removeAttendanceError;
        }
      }

      // Add new participants and create attendance records for them
      if (studentsToAdd.length > 0) {
        const { error: addParticipantsError } = await supabase
          .from('session_participants')
          .insert(
            studentsToAdd.map(studentId => ({
              session_id: id,
              student_id: studentId
            }))
          );

        if (addParticipantsError) {
          console.error('Error adding participants:', addParticipantsError);
          throw addParticipantsError;
        }

        // Create attendance records for new participants only
        const { error: addAttendanceError } = await supabase
          .from('attendance_records')
          .insert(
            studentsToAdd.map(studentId => ({
              session_id: id,
              student_id: studentId,
              status: 'pending' as const
            }))
          );

        if (addAttendanceError) {
          console.error('Error adding attendance records:', addAttendanceError);
          throw addAttendanceError;
        }
      }

      // If no students selected, remove all participants and attendance records
      if (selectedStudents.length === 0 && existingStudentIds.length > 0) {
        const { error: removeAllParticipantsError } = await supabase
          .from('session_participants')
          .delete()
          .eq('session_id', id);

        if (removeAllParticipantsError) {
          console.error('Error removing all participants:', removeAllParticipantsError);
          throw removeAllParticipantsError;
        }

        const { error: removeAllAttendanceError } = await supabase
          .from('attendance_records')
          .delete()
          .eq('session_id', id);

        if (removeAllAttendanceError) {
          console.error('Error removing all attendance records:', removeAllAttendanceError);
          throw removeAllAttendanceError;
        }
      }

      return data as TrainingSession;
    },
    onSuccess: () => {
      console.log('Updated session, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Training session updated successfully');
      resetForm();
    },
    onError: (error) => {
      console.error('Update mutation error:', error);
      toast.error('Failed to update session: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete related records in session_participants
      const { error: participantsError } = await supabase
        .from('session_participants')
        .delete()
        .eq('session_id', id);
      
      if (participantsError) {
        console.error('Session participants delete error:', participantsError);
        throw new Error(`Failed to delete session participants: ${participantsError.message}`);
      }

      // Delete related records in session_coaches
      const { error: coachesError } = await supabase
        .from('session_coaches')
        .delete()
        .eq('session_id', id);
      
      if (coachesError) {
        console.error('Session coaches delete error:', coachesError);
        throw new Error(`Failed to delete session coaches: ${coachesError.message}`);
      }

      // Delete related records in attendance_records
      const { error: attendanceError } = await supabase
        .from('attendance_records')
        .delete()
        .eq('session_id', id);
      
      if (attendanceError) {
        console.error('Attendance records delete error:', attendanceError);
        throw new Error(`Failed to delete attendance records: ${attendanceError.message}`);
      }

      // Delete the session
      const { error: sessionError } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', id);
      
      if (sessionError) {
        console.error('Session delete error:', sessionError);
        throw new Error(`Failed to delete session: ${sessionError.message}`);
      }
    },
    onSuccess: () => {
      console.log('Deleted session and related records, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Training session deleted successfully');
      setCurrentPage(1);
    },
    onError: (error) => {
      console.error('Delete mutation error:', error);
      toast.error('Failed to delete session: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      date: "",
      start_time: "",
      end_time: "",
      branch_id: "",
      notes: "",
      status: "scheduled" as SessionStatus,
      package_type: "",
    });
    setSelectedStudents([]);
    setSelectedCoaches([]);
    setEditingSession(null);
    setIsDialogOpen(false);
    setIsParticipantsDialogOpen(false);
    setIsViewDialogOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.branch_id) {
      toast.error('Please select a branch');
      return;
    }

    if (!formData.package_type) {
      toast.error('Please select a package type');
      return;
    }

    if (selectedCoaches.length === 0) {
      toast.error('Please select at least one coach');
      return;
    }

    if (!formData.date) {
      toast.error('Please select a date');
      return;
    }

    if (!formData.start_time || !formData.end_time) {
      toast.error('Please select start and end times');
      return;
    }

    // Fetch fresh student data for validation
    if (selectedStudents.length > 0) {
      try {
        const { data: freshStudents, error: fetchStudentsError } = await supabase
          .from('students')
          .select(`
            id,
            name,
            remaining_sessions,
            sessions,
            branch_id,
            package_type,
            expiration_date,
            attendance_records (
              session_duration,
              package_cycle,
              status,
              training_sessions (
                package_cycle
              )
            ),
            student_package_history (
              id,
              sessions,
              remaining_sessions,
              captured_at
            )
          `)
          .in('id', selectedStudents);

        if (fetchStudentsError) {
          console.error('Error fetching students for validation:', fetchStudentsError);
          toast.error('Failed to validate students: ' + fetchStudentsError.message);
          return;
        }

        // Calculate accurate remaining sessions for each student
        const studentsWithAccurateSessions = (freshStudents || []).map((s: any) => {
          const packageHistory = s.student_package_history || [];
          const currentCycle = packageHistory.length + 1;

          // Count sessions used in current cycle
          const currentCycleSessionsUsed = ((s.attendance_records as any) || [])
            .filter((record: any) =>
              record.status === 'present' &&
              ((record.package_cycle === currentCycle) ||
               (record.training_sessions?.package_cycle === currentCycle))
            )
            .reduce((total: number, record: any) => total + (record.session_duration || 1), 0);

          // Current remaining sessions = total sessions - sessions used in current cycle
          const currentRemainingSessions = Math.max(0, (s.sessions || 0) - currentCycleSessionsUsed);

          return {
            ...s,
            current_remaining_sessions: currentRemainingSessions
          };
        });

        // Validate student session limits using accurate data
        const invalidStudents = studentsWithAccurateSessions
          .filter(student => {
            const remaining = student.current_remaining_sessions ?? student.remaining_sessions ?? 0;
            return remaining <= 0;
          });
        
        if (invalidStudents.length > 0) {
          toast.error(
            `The following students have no remaining sessions: ${invalidStudents
              .map(s => s.name)
              .join(', ')}. Please increase their session count in the Players Manager.`
          );
          return;
        }
      } catch (error: any) {
        console.error('Error validating students:', error);
        toast.error('Failed to validate students: ' + (error.message || 'Unknown error'));
        return;
      }
    }

    // Check for conflicts
    const hasConflict = sessions?.some(session =>
      session.date === formData.date &&
      (
        (formData.start_time < session.end_time) &&
        (formData.end_time > session.start_time)
      ) &&
      selectedCoaches.some(coachId => session.session_coaches.some(sc => sc.coach_id === coachId)) &&
      (!editingSession || editingSession.id !== session.id)
    );

    if (hasConflict) {
      toast.error('One or more selected coaches are already scheduled for a session on this date/time.');
      return;
    }

    if (editingSession) {
      updateMutation.mutate({ ...formData, id: editingSession.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (session: TrainingSession) => {
    setEditingSession(session);
    setFormData({
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      branch_id: session.branch_id,
      notes: session.notes || "",
      status: session.status,
      package_type: session.package_type || "",
    });
    setSelectedStudents(session.session_participants?.map(p => p.student_id) || []);
    setSelectedCoaches(session.session_coaches?.map(sc => sc.coach_id) || []);
    setIsDialogOpen(true);
  };

  const handleView = (session: TrainingSession) => {
    setSelectedSession(session);
    setIsViewDialogOpen(true);
  };

  const handleManageParticipants = (session: TrainingSession) => {
    setSelectedSession(session);
    setFormData(prev => ({
      ...prev,
      branch_id: session.branch_id,
      package_type: session.package_type || "",
    }));
    setSelectedStudents(session.session_participants?.map(p => p.student_id) || []);
    setIsParticipantsDialogOpen(true);
  };

  const handleCoachToggle = (coachId: string) => {
    setSelectedCoaches(prev => {
      if (prev.includes(coachId)) {
        return prev.filter(id => id !== coachId);
      } else {
        return [...prev, coachId];
      }
    });
  };

  const filteredSessions = sessions
    ?.filter((session) =>
      (session.session_coaches.some(sc => sc.coaches.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
       session.branches.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterPackageType === "All" || session.package_type === filterPackageType) &&
      (branchFilter === "All" || session.branch_id === branchFilter) &&
      (coachFilter === "All" || session.session_coaches.some(sc => sc.coach_id === coachFilter))
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-3 sm:p-4 md:p-5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto" style={{ borderColor: '#79e58f' }}></div>
          <span className="mt-2 text-gray-600 text-xs sm:text-sm">Loading sessions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-4 p-3 sm:p-4 md:p-5 pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#242833] mb-2 tracking-tight">Sessions Manager</h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-700">Manage session information</p>
        </div>
        <Card className="border-2 border-[#242833] bg-white shadow-xl overflow-hidden">
          <CardHeader className="border-b border-[#242833] bg-[#242833] p-3 sm:p-4 md:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-[#efeff1] flex items-center">
                  <Calendar className="h-4 sm:h-5 w-4 sm:w-5 mr-2 text-accent" style={{ color: '#79e58f' }} />
                  Training Sessions
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs sm:text-sm">
                  View and manage all basketball training sessions
                </CardDescription>
              </div>
              {role === 'admin' && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => resetForm()}
                      className="bg-accent hover:bg-[#5bc46d] text-white transition-all duration-300 hover:scale-105 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                      style={{ backgroundColor: '#79e58f' }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Schedule New Session
                    </Button>
                  </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
                    <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
                      <DialogTitle className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white flex items-center gap-2 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                        </div>
                        <span className="truncate">{editingSession ? 'Edit Training Session' : 'Schedule New Session'}</span>
                      </DialogTitle>
                      <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13 hidden sm:block">
                        {editingSession ? 'Update session details and participants' : 'Create a new training session for your players'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="p-3 sm:p-4 md:p-5 overflow-y-auto flex-1 custom-scrollbar">
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col space-y-2 min-w-0">
                            <Label htmlFor="branch" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                              <MapPin className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                              Branch Location
                            </Label>
                            <Select 
                              value={formData.branch_id} 
                              onValueChange={(value) => {
                                setFormData(prev => ({ ...prev, branch_id: value, package_type: "" }));
                                setSelectedStudents([]);
                                setSelectedCoaches([]);
                              }}
                            >
                              <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#79e58f' }}>
                                <SelectValue placeholder="Select branch" />
                              </SelectTrigger>
                              <SelectContent>
                                {branches?.map(branch => (
                                  <SelectItem key={branch.id} value={branch.id} className="text-xs sm:text-sm">
                                    {branch.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col space-y-2 min-w-0">
                            <Label htmlFor="package_type" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                              <Users className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                              Package Type
                            </Label>
                            <Select
                              value={formData.package_type}
                              onValueChange={(value) => {
                                setFormData(prev => ({ ...prev, package_type: value }));
                                setSelectedStudents([]);
                                setSelectedCoaches([]);
                              }}
                              disabled={!formData.branch_id || packagesLoading}
                            >
                              <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#79e58f' }}>
                                <SelectValue placeholder={formData.branch_id ? (packagesLoading ? "Loading packages..." : "Select package type") : "Select branch first"} />
                              </SelectTrigger>
                              <SelectContent>
                                {packages?.map(pkg => (
                                  <SelectItem key={pkg.id} value={pkg.name} className="text-xs sm:text-sm">
                                    {pkg.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {packagesError && (
                              <p className="text-xs sm:text-sm text-red-600">Error loading packages: {(packagesError as Error).message}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2 min-w-0">
                          <Label htmlFor="coach" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                            <User className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                            Select Coaches
                          </Label>
                          <div className="border-2 rounded-lg p-3 max-h-48 overflow-y-auto bg-white shadow-sm" style={{ borderColor: '#242833' }}>
                            {coachesLoading ? (
                              <p className="text-xs sm:text-sm text-gray-600">Loading coaches...</p>
                            ) : coachesError ? (
                              <p className="text-xs sm:text-sm text-red-600">Error loading coaches: {(coachesError as Error).message}</p>
                            ) : coaches?.length === 0 ? (
                              <p className="text-xs sm:text-sm text-gray-600">No coaches available.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {coaches?.map(coach => (
                                  <div key={coach.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-white transition-colors min-w-0">
                                    <input
                                      type="checkbox"
                                      id={`coach-${coach.id}`}
                                      checked={selectedCoaches.includes(coach.id)}
                                      onChange={() => handleCoachToggle(coach.id)}
                                      className="w-4 h-4 rounded border-2 border-accent text-accent focus:ring-accent flex-shrink-0"
                                      style={{ borderColor: '#79e58f', accentColor: '#79e58f' }}
                                      disabled={formData.package_type === "Personal Training" && selectedCoaches.length === 1 && !selectedCoaches.includes(coach.id)}
                                    />
                                    <Label htmlFor={`coach-${coach.id}`} className="flex-1 text-xs sm:text-sm cursor-pointer truncate">
                                      {coach.name}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-gray-600 mt-2">
                              Selected: {selectedCoaches.length} coach{selectedCoaches.length === 1 ? '' : 'es'}
                            </p>
                          </div>
                          {coachesError && (
                            <p className="text-xs sm:text-sm text-red-600 mt-1">Error loading coaches: {(coachesError as Error).message}</p>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col space-y-2 min-w-0">
                            <Label htmlFor="date" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                              <Calendar className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                              Session Date
                            </Label>
                            <Input
                              id="date"
                              type="date"
                              value={formData.date}
                              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                              required
                              className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                              disabled={!formData.branch_id}
                              style={{ borderColor: '#79e58f' }}
                            />
                          </div>
                          <div className="flex flex-col space-y-2 min-w-0">
                            <Label htmlFor="status" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                              <Users className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                              Session Status
                            </Label>
                            <Select 
                              value={formData.status} 
                              onValueChange={(value: SessionStatus) => setFormData(prev => ({ ...prev, status: value }))}
                              disabled={!formData.branch_id}
                            >
                              <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#79e58f' }}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="scheduled" className="text-xs sm:text-sm">Scheduled</SelectItem>
                                <SelectItem value="completed" className="text-xs sm:text-sm">Completed</SelectItem>
                                <SelectItem value="cancelled" className="text-xs sm:text-sm">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex flex-col space-y-2 min-w-0">
                            <Label htmlFor="start_time" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                              <Clock className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                              Start Time
                            </Label>
                            <Input
                              id="start_time"
                              type="time"
                              value={formData.start_time}
                              onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                              required
                              className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                              disabled={!formData.branch_id}
                              style={{ borderColor: '#79e58f' }}
                            />
                          </div>
                          <div className="flex flex-col space-y-2 min-w-0">
                            <Label htmlFor="end_time" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                              <Clock className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                              End Time
                            </Label>
                            <Input
                              id="end_time"
                              type="time"
                              value={formData.end_time}
                              onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                              required
                              className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                              disabled={!formData.branch_id}
                              style={{ borderColor: '#79e58f' }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2 min-w-0">
                          <Label className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                            <Users className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                            Select Players ({selectedStudents.length} selected)
                          </Label>
                          <div className="border-2 rounded-lg p-3 max-h-48 overflow-y-auto bg-white shadow-sm" style={{ borderColor: '#242833' }}>
                            {formData.branch_id && formData.package_type ? (
                              studentsLoading ? (
                                <p className="text-xs sm:text-sm text-gray-600">Loading students...</p>
                              ) : studentsError ? (
                                <p className="text-xs sm:text-sm text-red-600">Error loading students: {(studentsError as Error).message}</p>
                              ) : students?.length === 0 ? (
                                <p className="text-xs sm:text-sm text-gray-600">
                                  No students found for branch "{branches?.find(b => b.id === formData.branch_id)?.name}" and package "{formData.package_type}".
                                </p>
                              ) : (
                                <>
                                  <div className="flex items-center space-x-2 mb-2 p-2 rounded-md hover:bg-white transition-colors">
                                    <input
                                      type="checkbox"
                                      id="select-all-students"
                                      checked={
                                        students.filter(s => (s.current_remaining_sessions ?? s.remaining_sessions) > 0).every(s => selectedStudents.includes(s.id)) &&
                                        students.filter(s => (s.current_remaining_sessions ?? s.remaining_sessions) > 0).length > 0
                                      }
                                      onChange={(e) => handleSelectAllStudents(e.target.checked)}
                                      className="w-4 h-4 rounded border-2 border-accent text-accent focus:ring-accent flex-shrink-0"
                                      style={{ borderColor: '#79e58f', accentColor: '#79e58f' }}
                                    />
                                    <Label htmlFor="select-all-students" className="text-xs sm:text-sm cursor-pointer">
                                      Select All Players
                                    </Label>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {students.map(student => (
                                      <div key={student.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-white transition-colors min-w-0">
                                        <input
                                          type="checkbox"
                                          id={student.id}
                                          checked={selectedStudents.includes(student.id)}
                                          onChange={(e) => {
                                            const currentRemaining = student.current_remaining_sessions ?? student.remaining_sessions ?? 0;
                                            if (currentRemaining <= 0) {
                                              toast.error(
                                                `${student.name} has no remaining sessions in their current package. Please renew their package or increase their session count.`
                                              );
                                              return;
                                            }
                                            if (e.target.checked) {
                                              setSelectedStudents(prev => [...prev, student.id]);
                                            } else {
                                              setSelectedStudents(prev => prev.filter(id => id !== student.id));
                                            }
                                          }}
                                          className="w-4 h-4 rounded border-2 border-accent text-accent focus:ring-accent flex-shrink-0"
                                          style={{ borderColor: '#79e58f', accentColor: '#79e58f' }}
                                          disabled={(student.current_remaining_sessions ?? student.remaining_sessions ?? 0) <= 0}
                                        />
                                        <Label
                                          htmlFor={student.id}
                                          className={`flex-1 text-xs sm:text-sm cursor-pointer truncate ${
                                            (student.current_remaining_sessions ?? student.remaining_sessions ?? 0) <= 0 ? 'text-gray-400' : ''
                                          }`}
                                        >
                                          {student.name} ({student.current_remaining_sessions ?? student.remaining_sessions ?? 0} sessions left)
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )
                            ) : (
                              <p className="text-xs sm:text-sm text-gray-600">Select a branch and package type to view available students.</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2 min-w-0">
                          <Label htmlFor="notes" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                            <Eye className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                            Session Notes (Optional)
                          </Label>
                          <Input
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Add any special notes or instructions for this session..."
                            className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm"
                            disabled={!formData.branch_id}
                            style={{ borderColor: '#79e58f' }}
                          />
                        </div>
                        <div className="flex flex-row justify-end gap-2 pt-4 border-t border-gray-200">
                          {editingSession && (
                            <Button 
                              type="button" 
                              variant="destructive" 
                              onClick={() => {
                                if (editingSession) {
                                  deleteMutation.mutate(editingSession.id);
                                  resetForm();
                                }
                              }}
                              disabled={deleteMutation.isPending || !formData.branch_id}
                              className="bg-red-600 text-white hover:bg-red-700 min-w-fit w-auto px-2 sm:px-3 text-xs sm:text-sm"
                            >
                              Delete
                            </Button>
                          )}
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={resetForm} 
                            className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 min-w-fit w-auto px-2 sm:px-3 text-xs sm:text-sm"
                          >
                            Close
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={
                              createMutation.isPending || 
                              updateMutation.isPending || 
                              !formData.branch_id || 
                              !formData.package_type || 
                              selectedCoaches.length === 0 ||
                              !formData.date ||
                              !formData.start_time ||
                              !formData.end_time
                            }
                            className="bg-accent hover:bg-[#5bc46d] text-white min-w-fit w-auto px-2 sm:px-3 text-xs sm:text-sm"
                            style={{ backgroundColor: '#79e58f' }}
                          >
                            {editingSession ? 'Update' : 'Create'}
                          </Button>
                        </div>
                      </form>
                    </div>
                </DialogContent>
              </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-5">
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <Filter className="h-4 sm:h-5 w-4 sm:w-5 text-accent mr-2" style={{ color: '#79e58f' }} />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Filter Sessions</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-3 md:gap-4">
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="search-sessions" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                    <Search className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                    Search Sessions
                  </Label>
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="search-sessions"
                      type="text"
                      placeholder="Search by coach or branch..."
                      className="pl-10 pr-4 py-2 w-full border-2 border-accent rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-accent/20"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ borderColor: '#79e58f' }}
                    />
                  </div>
                </div>
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="filter-package" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                    <Users className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                    Package Type
                  </Label>
                  <Select
                    value={filterPackageType}
                    onValueChange={(value) => setFilterPackageType(value)}
                  >
                    <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#79e58f' }}>
                      <SelectValue placeholder="Select package type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All" className="text-xs sm:text-sm">All Sessions</SelectItem>
                      {packages?.map(pkg => (
                        <SelectItem key={pkg.id} value={pkg.name} className="text-xs sm:text-sm">
                          {pkg.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="filter-branch" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                    <MapPin className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                    Branch
                  </Label>
                  <Select
                    value={branchFilter}
                    onValueChange={(value) => setBranchFilter(value)}
                  >
                    <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#79e58f' }}>
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
                {role === 'admin' && (
                  <div className="flex flex-col space-y-2 min-w-0">
                    <Label htmlFor="filter-coach" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                      <User className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                      Coach
                    </Label>
                    <Select
                      value={coachFilter}
                      onValueChange={(value) => setCoachFilter(value)}
                    >
                      <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#79e58f' }}>
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
                )}
                <div className="flex flex-col space-y-2 min-w-0">
                  <Label htmlFor="sort-order" className="flex items-center text-xs sm:text-sm font-medium text-gray-700 truncate">
                    <Calendar className="w-4 h-4 mr-2 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                    Sort Order
                  </Label>
                  <Select
                    value={sortOrder}
                    onValueChange={(value: "Newest to Oldest" | "Oldest to Newest") => setSortOrder(value)}
                  >
                    <SelectTrigger className="border-2 border-gray-200 rounded-lg focus:border-accent focus:ring-accent/20 w-full text-xs sm:text-sm" style={{ borderColor: '#79e58f' }}>
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
                  Showing {filteredSessions.length} session{filteredSessions.length === 1 ? '' : 's'}
                </p>
                {filteredSessions.length > 0 && (
                  <Button
                    onClick={() => {
                      const headers = ['Date', 'Start Time', 'End Time', 'Branch', 'Package Type', 'Status', 'Coaches', 'Participants', 'Notes'];
                      exportToCSV(
                        filteredSessions,
                        'sessions_report',
                        headers,
                        (session) => [
                          format(parseISO(session.date), 'yyyy-MM-dd'),
                          session.start_time || '',
                          session.end_time || '',
                          session.branches?.name || '',
                          session.package_type || '',
                          session.status || '',
                          session.session_coaches?.map(sc => sc.coaches?.name).filter(Boolean).join('; ') || '',
                          session.session_participants?.map(sp => sp.students?.name).filter(Boolean).join('; ') || '',
                          session.notes || ''
                        ]
                      );
                      toast.success('Sessions report exported to Excel successfully');
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
              <div className="text-center py-10 sm:py-12 md:py-16">
                <Calendar className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2">
                  {searchTerm || filterPackageType !== "All" || branchFilter !== "All" || coachFilter !== "All" ? 'No sessions found' : "No Training Sessions"}
                </h3>
                <p className="text-gray-600 text-xs sm:text-sm md:text-base mb-4">
                  {searchTerm || filterPackageType !== "All" || branchFilter !== "All" || coachFilter !== "All" ? "Try adjusting your search or filter." : "Get started by scheduling your first training session"}
                </p>
                <Button 
                  onClick={() => setIsDialogOpen(true)}
                  className="bg-accent hover:bg-[#5bc46d] text-white w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                  style={{ backgroundColor: '#79e58f' }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule First Session
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                  {paginatedSessions.map((session) => (
                    <Card 
                      key={session.id} 
                      className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                    >
                      {/* Header with Date & Status - Dark Background */}
                      <div className="bg-[#242833] p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 bg-[#79e58f] rounded-full flex items-center justify-center flex-shrink-0">
                              <Calendar className="w-5 h-5 text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-white text-sm leading-tight line-clamp-1">
                                {formatDisplayDate(session.date)}
                              </h3>
                              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {formatDisplayTime(session.start_time)} - {formatDisplayTime(session.end_time)}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 capitalize ${
                            session.status === 'scheduled' 
                              ? 'bg-emerald-500 text-white' 
                              : session.status === 'cancelled' 
                                ? 'bg-red-500 text-white' 
                                : 'bg-blue-500 text-white'
                          }`}>
                            {session.status}
                          </span>
                        </div>
                        
                        {/* Package & Branch */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 bg-[#79e58f]/20 text-[#79e58f] rounded text-xs font-medium">
                            {session.package_type || 'No Package'}
                          </span>
                          <span className="inline-flex items-center text-xs text-gray-400">
                            <MapPin className="w-3 h-3 mr-1" />
                            {session.branches.name}
                          </span>
                        </div>
                      </div>
                      
                      {/* Stats Section */}
                      <div className="p-4 flex-1 flex flex-col">
                        {/* Session Stats Grid */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="text-center p-2.5 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-100">
                            <p className="text-[10px] text-slate-500 uppercase font-medium">Coaches</p>
                            <p className="text-lg font-bold text-slate-700">{session.session_coaches.length}</p>
                          </div>
                          <div className="text-center p-2.5 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-100">
                            <p className="text-[10px] text-emerald-600 uppercase font-medium">Players</p>
                            <p className="text-lg font-bold text-emerald-600">{session.session_participants?.length || 0}</p>
                          </div>
                        </div>
                        
                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {/* Coaches Info */}
                          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                            <p className="text-slate-400 text-[10px] uppercase font-medium mb-1 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Coaches
                            </p>
                            <p className="font-medium text-slate-700 text-xs line-clamp-2">
                              {session.session_coaches.length > 0 
                                ? session.session_coaches.map(sc => sc.coaches.name).join(', ') 
                                : <span className="text-slate-400">None</span>}
                            </p>
                          </div>
                          
                          {/* Notes - Always show area for consistent height */}
                          <div className={`rounded-lg p-2.5 border ${session.notes ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                            <p className={`text-[10px] uppercase font-medium mb-1 flex items-center gap-1 ${session.notes ? 'text-amber-500' : 'text-slate-400'}`}>
                              <Eye className="w-3 h-3" />
                              Notes
                            </p>
                            <p className={`text-xs line-clamp-2 ${session.notes ? 'text-amber-700' : 'text-slate-400 italic'}`}>
                              {session.notes || 'No notes'}
                            </p>
                          </div>
                        </div>
                        
                        {/* Spacer to push buttons to bottom */}
                        <div className="flex-1" />
                        
                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleView(session)}
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
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(session)}
                              className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50 rounded-lg"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleManageParticipants(session)}
                              className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                              title="Manage Participants"
                            >
                              <Users className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex justify-center items-center mt-6 space-x-2 flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="border-2 border-accent text-accent hover:bg-accent hover:text-white w-10 h-10 p-0 flex items-center justify-center"
                      style={{ borderColor: '#79e58f', color: '#79e58f' }}
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
                          backgroundColor: currentPage === page ? '#79e58f' : 'transparent',
                          borderColor: '#79e58f',
                          color: currentPage === page ? 'white' : '#79e58f'
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
                      style={{ borderColor: '#79e58f', color: '#79e58f' }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl md:max-w-3xl border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
            <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
              <DialogTitle className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                  <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                </div>
                <span className="truncate">Session Details</span>
              </DialogTitle>
              <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13 hidden sm:block">
                View all details for the selected training session
              </DialogDescription>
            </DialogHeader>
            <div className="p-3 sm:p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
              <div className="p-3 sm:p-4 rounded-lg border border-gray-200 bg-gray-50 overflow-x-auto">
                <div className="space-y-2 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-700 truncate">
                    <span className="font-medium">Session Date:</span>{' '}
                    {selectedSession?.date ? formatDisplayDate(selectedSession.date) : 'Invalid Date'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-700 truncate">
                    <span className="font-medium">Time:</span>{' '}
                    {selectedSession?.start_time && selectedSession?.end_time
                      ? `${formatDisplayTime(selectedSession.start_time)} - ${formatDisplayTime(selectedSession.end_time)}`
                      : 'Invalid Time'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-700 truncate">
                    <span className="font-medium">Branch:</span> {selectedSession?.branches.name || 'N/A'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-700 truncate">
                    <span className="font-medium">Coaches:</span>{' '}
                    {selectedSession?.session_coaches.length > 0
                      ? selectedSession.session_coaches.map(sc => sc.coaches.name).join(', ')
                      : 'No coaches assigned'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-700 truncate">
                    <span className="font-medium">Package Type:</span> {selectedSession?.package_type || 'Not specified'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-700 truncate">
                    <span className="font-medium">Status:</span> {selectedSession?.status || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Participants</Label>
                <div className="border-2 rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50" style={{ borderColor: '#242833' }}>
                  {selectedSession?.session_participants?.length === 0 ? (
                    <p className="text-xs sm:text-sm text-gray-600">No participants assigned.</p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedSession?.session_participants?.map(participant => (
                        <li key={participant.id} className="text-xs sm:text-sm text-gray-700 truncate">
                          {participant.students.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Coach Attendance Records</Label>
                <div className="border-2 rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50" style={{ borderColor: '#242833' }}>
                  {selectedSession?.session_coaches?.length === 0 ? (
                    <p className="text-xs sm:text-sm text-gray-600">No coaches assigned.</p>
                  ) : (
                    selectedSession?.session_coaches?.map((sc) => {
                      const coachTime = selectedSession.coach_session_times?.find((cst) => cst.coach_id === sc.coach_id);
                      return (
                        <div key={sc.id} className="bg-white rounded-lg p-3 border border-gray-200 mb-2 last:mb-0">
                          <div className="flex flex-col space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs sm:text-sm font-medium text-gray-700">{sc.coaches.name}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2 bg-gray-50 rounded-lg">
                              <div>
                                <span className="text-xs sm:text-sm text-gray-600 block mb-1">Time In:</span>
                                <span className="text-xs sm:text-sm font-medium">{formatDateTime(coachTime?.time_in)}</span>
                              </div>
                              <div>
                                <span className="text-xs sm:text-sm text-gray-600 block mb-1">Time Out:</span>
                                <span className="text-xs sm:text-sm font-medium">{formatDateTime(coachTime?.time_out)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              {selectedSession?.notes && (
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm font-medium text-gray-700">Session Notes</Label>
                  <div className="p-3 sm:p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <p className="text-xs sm:text-sm text-gray-700">{selectedSession.notes}</p>
                  </div>
                </div>
              )}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => setIsViewDialogOpen(false)}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isParticipantsDialogOpen} onOpenChange={setIsParticipantsDialogOpen}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl border-0 shadow-2xl p-0 max-h-[85vh] sm:max-h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden" style={{ backgroundColor: '#f8f9fa' }}>
            <DialogHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 flex-shrink-0" style={{ background: '#242833' }}>
              <DialogTitle className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(121, 229, 143, 0.2)' }}>
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" style={{ color: '#79e58f' }} />
                </div>
                <span className="truncate">Manage Session Participants</span>
              </DialogTitle>
              <DialogDescription className="text-gray-300 text-xs sm:text-sm mt-1 ml-9 sm:ml-11 md:ml-13 hidden sm:block">
                Add or remove players from this training session
              </DialogDescription>
            </DialogHeader>
            <div className="p-3 sm:p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
              <div className="p-3 sm:p-4 rounded-lg border border-gray-200 bg-gray-50 overflow-x-auto">
                <div className="space-y-2 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-700 truncate">
                    <span className="font-medium">Session Date:</span>{' '}
                    {selectedSession?.date ? formatDisplayDate(selectedSession.date) : 'Invalid Date'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-700 truncate">
                    <span className="font-medium">Package Type:</span> {selectedSession?.package_type || 'Not specified'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-700 truncate">
                    <span className="font-medium">Coaches:</span> {selectedSession?.session_coaches.length > 0 ? selectedSession.session_coaches.map(sc => sc.coaches.name).join(', ') : 'No coaches assigned'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Currently selected: {selectedStudents.length} players
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium text-gray-700">Available Players</Label>
                <div className="border-2 rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50" style={{ borderColor: '#242833' }}>
                  {studentsLoading ? (
                    <p className="text-xs sm:text-sm text-gray-600">Loading students...</p>
                  ) : studentsError ? (
                    <p className="text-xs sm:text-sm text-red-600">Error loading students: {(studentsError as Error).message}</p>
                  ) : students?.length === 0 ? (
                    <p className="text-xs sm:text-sm text-gray-600">
                      No students found for branch "{branches?.find(b => b.id === formData.branch_id)?.name}" and package "{formData.package_type}".
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {students?.map(student => (
                        <div key={student.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-white transition-colors min-w-0">
                          <input
                            type="checkbox"
                            id={`participant-${student.id}`}
                            checked={selectedStudents.includes(student.id)}
                            onChange={(e) => {
                              const remainingSessions = student.current_remaining_sessions ?? student.remaining_sessions ?? 0;
                              if (remainingSessions <= 0) {
                                toast.error(
                                  `${student.name} has no remaining sessions. Please increase their session count in the Players Manager.`
                                );
                                return;
                              }
                              if (e.target.checked) {
                                setSelectedStudents(prev => [...prev, student.id]);
                              } else {
                                setSelectedStudents(prev => prev.filter(id => id !== student.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-2 border-accent text-accent focus:ring-accent flex-shrink-0"
                            style={{ borderColor: '#79e58f', accentColor: '#79e58f' }}
                            disabled={(student.current_remaining_sessions ?? student.remaining_sessions ?? 0) <= 0}
                          />
                          <Label 
                            htmlFor={`participant-${student.id}`} 
                            className={`flex-1 text-xs sm:text-sm cursor-pointer truncate ${
                              (student.current_remaining_sessions ?? student.remaining_sessions ?? 0) <= 0 ? 'text-gray-400' : ''
                            }`}
                          >
                            {student.name} ({student.current_remaining_sessions ?? student.remaining_sessions ?? 0} sessions left)
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsParticipantsDialogOpen(false)}
                  className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!selectedSession) return;

                    // Fetch fresh student data for validation
                    const { data: freshStudents, error: fetchStudentsError } = await supabase
                      .from('students')
                      .select(`
                        id,
                        name,
                        remaining_sessions,
                        sessions,
                        branch_id,
                        package_type,
                        expiration_date,
                        attendance_records (
                          session_duration,
                          package_cycle,
                          status,
                          training_sessions (
                            package_cycle
                          )
                        ),
                        student_package_history (
                          id,
                          sessions,
                          remaining_sessions,
                          captured_at
                        )
                      `)
                      .in('id', selectedStudents);

                    if (fetchStudentsError) {
                      console.error('Error fetching students for validation:', fetchStudentsError);
                      toast.error('Failed to validate students: ' + fetchStudentsError.message);
                      return;
                    }

                    // Calculate accurate remaining sessions for each student
                    const studentsWithAccurateSessions = (freshStudents || []).map((s: any) => {
                      const packageHistory = s.student_package_history || [];
                      const currentCycle = packageHistory.length + 1;

                      // Count sessions used in current cycle
                      const currentCycleSessionsUsed = ((s.attendance_records as any) || [])
                        .filter((record: any) =>
                          record.status === 'present' &&
                          ((record.package_cycle === currentCycle) ||
                           (record.training_sessions?.package_cycle === currentCycle))
                        )
                        .reduce((total: number, record: any) => total + (record.session_duration || 1), 0);

                      // Current remaining sessions = total sessions - sessions used in current cycle
                      const currentRemainingSessions = Math.max(0, (s.sessions || 0) - currentCycleSessionsUsed);

                      return {
                        ...s,
                        current_remaining_sessions: currentRemainingSessions,
                        calculated_remaining: currentRemainingSessions > 0
                      };
                    });

                    // Validate student session limits using accurate data
                    const invalidStudents = studentsWithAccurateSessions
                      .filter(student => {
                        const remaining = student.current_remaining_sessions ?? student.remaining_sessions ?? 0;
                        return remaining <= 0;
                      });
                    
                    if (invalidStudents.length > 0) {
                      toast.error(
                        `The following students have no remaining sessions: ${invalidStudents
                          .map(s => s.name)
                          .join(', ')}. Please increase their session count in the Players Manager.`
                      );
                      return;
                    }

                    try {
                      // Get existing participants and attendance records before updating
                      const { data: existingParticipants, error: fetchParticipantsError } = await supabase
                        .from('session_participants')
                        .select('student_id')
                        .eq('session_id', selectedSession.id);

                      if (fetchParticipantsError) {
                        console.error('Error fetching existing participants:', fetchParticipantsError);
                        toast.error('Failed to fetch existing participants: ' + fetchParticipantsError.message);
                        return;
                      }

                      const { data: existingAttendance, error: fetchAttendanceError } = await supabase
                        .from('attendance_records')
                        .select('student_id, status, session_duration, package_cycle')
                        .eq('session_id', selectedSession.id);

                      if (fetchAttendanceError) {
                        console.error('Error fetching existing attendance:', fetchAttendanceError);
                        toast.error('Failed to fetch existing attendance: ' + fetchAttendanceError.message);
                        return;
                      }

                      const existingStudentIds = Array.isArray(existingParticipants)
                        ? (existingParticipants as { student_id: string }[]).map(p => p.student_id)
                        : [];
                      const existingAttendanceData = Array.isArray(existingAttendance) 
                        ? (existingAttendance as unknown as Array<{ student_id: string; status: string; session_duration: number | null; package_cycle: number | null }>)
                        : [];
                      const existingAttendanceMap = new Map(
                        existingAttendanceData.map(ar => [ar.student_id, { status: ar.status, session_duration: ar.session_duration, package_cycle: ar.package_cycle }])
                      );

                      // Determine which students to add and remove
                      const studentsToAdd = selectedStudents.filter(id => !existingStudentIds.includes(id));
                      const studentsToRemove = existingStudentIds.filter(id => !selectedStudents.includes(id));

                      // Remove participants and their attendance records
                      if (studentsToRemove.length > 0) {
                        const { error: removeParticipantsError } = await supabase
                          .from('session_participants')
                          .delete()
                          .eq('session_id', selectedSession.id)
                          .in('student_id', studentsToRemove);

                        if (removeParticipantsError) {
                          console.error('Error removing participants:', removeParticipantsError);
                          toast.error('Failed to remove participants: ' + removeParticipantsError.message);
                          return;
                        }

                        const { error: removeAttendanceError } = await supabase
                          .from('attendance_records')
                          .delete()
                          .eq('session_id', selectedSession.id)
                          .in('student_id', studentsToRemove);

                        if (removeAttendanceError) {
                          console.error('Error removing attendance records:', removeAttendanceError);
                          toast.error('Failed to remove attendance records: ' + removeAttendanceError.message);
                          return;
                        }
                      }

                      // Add new participants and create attendance records for them
                      if (studentsToAdd.length > 0) {
                        const { error: addParticipantsError } = await supabase
                          .from('session_participants')
                          .insert(
                            studentsToAdd.map(studentId => ({
                              session_id: selectedSession.id,
                              student_id: studentId
                            }))
                          );

                        if (addParticipantsError) {
                          console.error('Error adding participants:', addParticipantsError);
                          toast.error('Failed to add participants: ' + addParticipantsError.message);
                          return;
                        }

                        // Create attendance records for new participants only
                        const { error: addAttendanceError } = await supabase
                          .from('attendance_records')
                          .insert(
                            studentsToAdd.map(studentId => ({
                              session_id: selectedSession.id,
                              student_id: studentId,
                              status: 'pending' as const
                            }))
                          );

                        if (addAttendanceError) {
                          console.error('Error adding attendance records:', addAttendanceError);
                          toast.error('Failed to add attendance records: ' + addAttendanceError.message);
                          return;
                        }
                      }

                      // If no students selected, remove all participants and attendance records
                      if (selectedStudents.length === 0 && existingStudentIds.length > 0) {
                        const { error: removeAllParticipantsError } = await supabase
                          .from('session_participants')
                          .delete()
                          .eq('session_id', selectedSession.id);

                        if (removeAllParticipantsError) {
                          console.error('Error removing all participants:', removeAllParticipantsError);
                          toast.error('Failed to remove all participants: ' + removeAllParticipantsError.message);
                          return;
                        }

                        const { error: removeAllAttendanceError } = await supabase
                          .from('attendance_records')
                          .delete()
                          .eq('session_id', selectedSession.id);

                        if (removeAllAttendanceError) {
                          console.error('Error removing all attendance records:', removeAllAttendanceError);
                          toast.error('Failed to remove all attendance records: ' + removeAllAttendanceError.message);
                          return;
                        }
                      }

                      queryClient.invalidateQueries({ queryKey: ['training-sessions'] });
                      queryClient.invalidateQueries({ queryKey: ['attendance-records'] });
                      toast.success('Participants updated successfully');
                      setIsParticipantsDialogOpen(false);
                    } catch (error: any) {
                      console.error('Error updating participants:', error);
                      toast.error('Failed to update participants: ' + (error.message || 'Unknown error'));
                    }
                  }}
                  className="bg-accent hover:bg-[#5bc46d] text-white w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                  style={{ backgroundColor: '#79e58f' }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}