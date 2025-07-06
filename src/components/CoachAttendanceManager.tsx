
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { format, addDays, subDays } from "date-fns";
import { SessionFilters } from "./attendance/SessionFilters";
import { SessionCard } from "./attendance/SessionCard";
import { SessionDetailsModal } from "./attendance/SessionDetailsModal";
import { AttendanceModal } from "./attendance/AttendanceModal";

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

  const { data: coachId } = useQuery({
    queryKey: ["coach-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: coach, error } = await supabase
        .from("coaches")
        .select("id")
        .eq("auth_id", user.id)
        .single();
      
      if (error) {
        console.error("Error fetching coach ID:", error);
        return null;
      }
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
      return data;
    }
  });

  const { data: sessions } = useQuery<TrainingSession[]>({
    queryKey: ["coach-sessions", coachId, branchFilter, packageFilter, statusFilter, sessionSearchTerm],
    queryFn: async () => {
      if (!coachId) return [];
      
      const coachSessionsRes = await supabase
        .from('session_coaches')
        .select('session_id')
        .eq('coach_id', coachId);

      if (coachSessionsRes.error) {
        console.error("Error fetching coach sessions:", coachSessionsRes.error);
        throw coachSessionsRes.error;
      }

      const sessionIds = coachSessionsRes.data?.map(s => s.session_id) || [];

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
      const { data, error } = await supabase
        .from("session_coaches")
        .select("coach_id, coaches (name)")
        .eq("session_id", selectedSession);
      
      if (error) {
        console.error("Error fetching session coaches:", error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!selectedSession,
  });

  const { data: attendanceRecords } = useQuery<any[]>({
    queryKey: ["attendance", selectedSession],
    queryFn: async () => {
      if (!selectedSession) return [];
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, session_id, student_id, status, marked_at, students (name)")
        .eq("session_id", selectedSession)
        .order("created_at", { ascending: true });
      
      if (error) {
        console.error("Error fetching attendance:", error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!selectedSession,
  });

  const updateAttendance = useMutation({
    mutationFn: async ({ recordId, status }: { recordId: string; status: AttendanceStatus }) => {
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

  const handleAttendanceChange = (recordId: string, status: AttendanceStatusLiteral) => {
    updateAttendance.mutate({ recordId, status });
  };

  const handleSessionCardClick = (session: TrainingSession) => {
    setSelectedSessionModal(session);
  };

  const handleManageAttendance = (sessionId: string) => {
    setSelectedSession(sessionId);
    setShowAttendanceModal(true);
    setSelectedSessionModal(null);
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 lg:space-y-8">
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
              <SessionFilters
                branchFilter={branchFilter}
                setBranchFilter={setBranchFilter}
                packageFilter={packageFilter}
                setPackageFilter={setPackageFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                sessionSearchTerm={sessionSearchTerm}
                setSessionSearchTerm={setSessionSearchTerm}
                branches={branches}
                filteredSessionsCount={filteredSessions.length}
              />

              <div className="grid gap-3 sm:gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    selectedSession={selectedSession}
                    onSessionClick={handleSessionCardClick}
                    userRole={role}
                  />
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

        <SessionDetailsModal
          session={selectedSessionModal}
          isOpen={!!selectedSessionModal}
          onClose={() => setSelectedSessionModal(null)}
          onManageAttendance={handleManageAttendance}
        />

        <AttendanceModal
          isOpen={showAttendanceModal}
          onClose={() => setShowAttendanceModal(false)}
          selectedSession={selectedSession}
          selectedSessionDetails={selectedSessionDetails}
          sessionCoaches={sessionCoaches}
          attendanceRecords={attendanceRecords}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onAttendanceChange={handleAttendanceChange}
          userRole={role}
        />
        
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
