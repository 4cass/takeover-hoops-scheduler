import { useState, Component, ErrorInfo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge"; // Correct import for Badge
import { Calendar as CalendarIcon, Users, Clock, MapPin, User, ChevronLeft, ChevronRight, Filter, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isBefore, addMonths, subMonths, isAfter, parseISO, getDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/context/AuthContext";
import { CoachCalendarManager } from "./CoachCalendarManager";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

type SessionStatus = Database['public']['Enums']['session_status'];

type Package = {
  id: string;
  name: string;
  is_active: boolean;
};

type TrainingSession = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: SessionStatus;
  package_type: string | null;
  branch_id: string;
  branches: { name: string } | null;
  session_coaches: Array<{
    id: string;
    coach_id: string;
    coaches: { name: string } | null;
  }>;
  session_participants: Array<{
    id: string;
    student_id: string;
    students: { name: string } | null;
  }>;
};

// Error Boundary Component
class CalendarErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: string | null }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary in CalendarManager:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
          <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
            <CalendarIcon className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">Something went wrong</h3>
            <p className="text-sm sm:text-base md:text-lg text-gray-600">
              Error: {this.state.error || "Unknown error"}. Please try refreshing the page or contact support.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const formatTime12Hour = (timeString: string) => {
  try {
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch (error) {
    console.error("Error formatting time:", error);
    return timeString;
  }
};

export function CalendarManager() {
  const { role } = useAuth();
  const isMobile = useIsMobile();

  if (role === 'coach') {
    return <CoachCalendarManager />;
  }

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<string>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [filterPackageType, setFilterPackageType] = useState<string>("All");
  const [currentMonth, setCurrentMonth] = useState<Date>(toZonedTime(new Date(), 'Asia/Manila'));
  const [showUpcomingSessions, setShowUpcomingSessions] = useState(false);
  const [showPastSessions, setShowPastSessions] = useState(false);
  const navigate = useNavigate();

  const timeZone = 'Asia/Manila';

  const { data: sessions, isLoading, error: sessionsError } = useQuery({
    queryKey: ['training-sessions', selectedCoach, selectedBranch, filterPackageType, currentMonth],
    queryFn: async () => {
      console.log("Fetching sessions with filters:", { selectedCoach, selectedBranch, filterPackageType, currentMonth });
      let query = supabase
        .from('training_sessions')
        .select(`
          id,
          date,
          start_time,
          end_time,
          status,
          package_type,
          branch_id,
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
          )
        `)
        .gte('date', format(startOfMonth(currentMonth), 'yyyy-MM-dd'))
        .lte('date', format(endOfMonth(currentMonth), 'yyyy-MM-dd'));

      if (selectedCoach !== "all") {
        query = query.eq('session_coaches.coach_id', selectedCoach);
      }
      if (selectedBranch !== "all") {
        query = query.eq('branch_id', selectedBranch);
      }

      const { data, error } = await query.order('date', { ascending: true });
      if (error) {
        console.error("Error fetching sessions:", error);
        toast.error(`Failed to fetch sessions: ${error.message}`);
        throw error;
      }
      console.log("Fetched sessions:", data);
      return (data || []) as TrainingSession[];
    }
  });

  const { data: coaches, error: coachesError } = useQuery({
    queryKey: ['coaches-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coaches')
        .select('id, name')
        .order('name');
      if (error) {
        console.error("Error fetching coaches:", error);
        toast.error(`Failed to fetch coaches: ${error.message}`);
        throw error;
      }
      console.log('Fetched coaches:', data);
      return data || [];
    }
  });

  const { data: branches, error: branchesError } = useQuery({
    queryKey: ['branches-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');
      if (error) {
        console.error("Error fetching branches:", error);
        toast.error(`Failed to fetch branches: ${error.message}`);
        throw error;
      }
      console.log('Fetched branches:', data);
      return data || [];
    }
  });

  const { data: packages, error: packagesError } = useQuery({
    queryKey: ['packages-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packages')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) {
        console.error("Error fetching packages:", error);
        toast.error(`Failed to fetch packages: ${error.message}`);
        throw error;
      }
      console.log('Fetched packages:', data);
      return (data || []) as Package[];
    }
  });

  const filteredSessions = sessions
    ?.filter((session) => {
      try {
        return filterPackageType === "All" || session.package_type === filterPackageType;
      } catch (error) {
        console.error("Error filtering session:", session, error);
        return false;
      }
    }) || [];

  const firstDayOfMonth = startOfMonth(currentMonth);
  const lastDayOfMonth = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
  const firstDayWeekday = getDay(firstDayOfMonth); // 0 = Sunday, 1 = Monday, etc.
  const paddingDays = Array(firstDayWeekday).fill(null); // Padding for days before the 1st

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'scheduled': return 'default'; // Adjust based on your Badge component's variant options
      case 'completed': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const selectedDateSessions = selectedDate
    ? filteredSessions.filter(session => {
        try {
          const sessionDate = parseISO(session.date);
          return isSameDay(sessionDate, selectedDate);
        } catch (error) {
          console.error("Error parsing session date:", session, error);
          return false;
        }
      }) || []
    : [];

  const today = toZonedTime(new Date(), timeZone);
  const todayDateOnly = new Date(format(today, "yyyy-MM-dd") + "T00:00:00");

  const upcomingSessions = filteredSessions.filter(session => {
    try {
      const sessionDate = parseISO(session.date);
      return (isAfter(sessionDate, todayDateOnly) || isSameDay(sessionDate, todayDateOnly)) &&
             session.status !== 'cancelled' && session.status !== 'completed';
    } catch (error) {
      console.error("Error filtering upcoming session:", session, error);
      return false;
    }
  }) || [];

  const pastSessions = filteredSessions.filter(session => {
    try {
      const sessionDate = parseISO(session.date);
      return session.status === 'completed' || isBefore(sessionDate, todayDateOnly);
    } catch (error) {
      console.error("Error filtering past session:", session, error);
      return false;
    }
  }) || [];

  const handleAttendanceRedirect = (sessionId: string) => {
    console.log("Navigating to attendance for session:", sessionId);
    navigate(`/dashboard/attendance?sessionId=${sessionId}`);
  };

  if (sessionsError || coachesError || branchesError || packagesError) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <CalendarIcon className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">Error loading calendar</h3>
          <p className="text-sm sm:text-base md:text-lg text-gray-600">
            Failed to load data: {(sessionsError || coachesError || branchesError || packagesError as Error)?.message || 'Unknown error'}. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto text-center py-12 sm:py-16">
          <CalendarIcon className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-black mb-3">Loading calendar...</h3>
          <p className="text-sm sm:text-base md:text-lg text-gray-600">Please wait while we fetch the session data.</p>
        </div>
      </div>
    );
  }

  return (
    <CalendarErrorBoundary>
      <div className="min-h-screen bg-background p-3 sm:p-4 lg:p-6 pb-24 md:pb-6">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#242833] tracking-tight">
              Calendar
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-gray-700">
              Manage and view all basketball training sessions
            </p>
          </div>
          <Card className="border-2 border-[#242833] bg-white shadow-xl">
            <CardHeader className="border-b border-[#242833] bg-[#242833] p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-[#efeff1] flex items-center">
                <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                <span className="truncate">Monthly Overview</span>
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs sm:text-sm lg:text-base">
                View and manage training sessions for {format(currentMonth, 'MMMM yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900">Filter Sessions</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Coach</label>
                    <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                      <SelectTrigger className="border-2 border-accent focus:border-accent focus:ring-accent/20 rounded-lg text-xs sm:text-sm h-9 sm:h-10" style={{ borderColor: '#79e58f' }}>
                        <SelectValue placeholder="Select coach" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Coaches</SelectItem>
                        {coaches?.map(coach => (
                          <SelectItem key={coach.id} value={coach.id} className="text-xs sm:text-sm">{coach.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Branch</label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger className="border-2 border-accent focus:border-accent focus:ring-accent/20 rounded-lg text-xs sm:text-sm h-9 sm:h-10" style={{ borderColor: '#79e58f' }}>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Branches</SelectItem>
                        {branches?.map(branch => (
                          <SelectItem key={branch.id} value={branch.id} className="text-xs sm:text-sm">{branch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                    <label className="text-xs sm:text-sm font-medium text-gray-700">Package Type</label>
                    <Select
                      value={filterPackageType}
                      onValueChange={(value: string) => setFilterPackageType(value)}
                    >
                      <SelectTrigger className="border-2 border-accent focus:border-accent focus:ring-accent/20 rounded-lg text-xs sm:text-sm h-9 sm:h-10" style={{ borderColor: '#79e58f' }}>
                        <SelectValue placeholder="Select package type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All" className="text-xs sm:text-sm">All Packages</SelectItem>
                        {packages?.map(pkg => (
                          <SelectItem key={pkg.id} value={pkg.name} className="text-xs sm:text-sm">{pkg.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                  <p className="text-xs sm:text-sm text-gray-600">
                    Showing {filteredSessions.length} session{filteredSessions.length === 1 ? '' : 's'}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button
                      onClick={() => setShowUpcomingSessions(true)}
                      variant="outline"
                      size="sm"
                      className="border-green-500/30 text-green-600 hover:bg-green-500 hover:text-white transition-all duration-300 text-xs sm:text-sm"
                    >
                      <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Upcoming ({upcomingSessions.length})
                    </Button>
                    <Button
                      onClick={() => setShowPastSessions(true)}
                      variant="outline"
                      size="sm"
                      className="border-gray-500/30 text-gray-600 hover:bg-gray-500 hover:text-white transition-all duration-300 text-xs sm:text-sm"
                    >
                      <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Past ({pastSessions.length})
                    </Button>
                  </div>
                </div>
              </div>
              <div className="border-2 border-[#242833] rounded-xl p-3 sm:p-4 lg:p-6 bg-white shadow-lg">
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <Button
                    onClick={handlePrevMonth}
                    variant="outline"
                    size={isMobile ? "sm" : "default"}
                    className="border-[#5bc46d] text-[#5bc46d] hover:bg-[#5bc46d] hover:text-white transition-all duration-300"
                  >
                    <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <h3 className="text-base sm:text-lg lg:text-2xl font-bold text-black">
                    {format(currentMonth, isMobile ? 'MMM yyyy' : 'MMMM yyyy')}
                  </h3>
                  <Button
                    onClick={handleNextMonth}
                    variant="outline"
                    size={isMobile ? "sm" : "default"}
                    className="border-[#5bc46d] text-[#5bc46d] hover:bg-[#5bc46d] hover:text-white transition-all duration-300"
                  >
                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-3 sm:mb-4">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                    <div key={day} className="text-center py-2 sm:py-3 bg-[#242833] text-white font-semibold rounded-lg text-xs sm:text-sm">
                      {isMobile ? day.slice(0, 1) : day.slice(0, 3)}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {paddingDays.map((_, index) => (
                    <div key={`padding-${index}`} className="h-12 sm:h-16 lg:h-20 bg-gray-100 rounded-lg"></div>
                  ))}
                  {daysInMonth.map(day => {
                    const daySessions = filteredSessions.filter(session => isSameDay(parseISO(session.date), day)) || [];
                    const hasScheduled = daySessions.some(s => s.status === 'scheduled');
                    const hasCompleted = daySessions.some(s => s.status === 'completed');
                    const hasCancelled = daySessions.some(s => s.status === 'cancelled');
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, today);
                    
                    return (
                      <button
                        key={day.toString()}
                        onClick={() => setSelectedDate(day)}
                        className={`
                          relative p-1 sm:p-2 lg:p-3 h-12 sm:h-16 lg:h-20 rounded-lg text-left transition-all duration-300 hover:scale-105 hover:shadow-lg
                          overflow-hidden min-w-0
                          ${isSelected 
                            ? 'bg-accent text-white shadow-lg scale-105' 
                            : isToday
                              ? 'bg-accent border-2 border-[#5bc46d] text-white'
                              : daySessions.length > 0
                                ? 'bg-white border border-accent text-black hover:border-[#5bc46d]'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50/50'
                          }
                        `}
                        style={{ borderColor: isSelected || isToday ? '#79e58f' : undefined, backgroundColor: isSelected || isToday ? '#79e58f' : undefined }}
                      >
                        <div className="font-semibold text-xs sm:text-sm lg:text-lg mb-1">
                          {format(day, 'd')}
                        </div>
                        {daySessions.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs opacity-90 truncate">
                              {isMobile ? daySessions.length : `${daySessions.length} session${daySessions.length !== 1 ? 's' : ''}`}
                            </div>
                            <div className="flex space-x-1 justify-center sm:justify-start">
                              {hasScheduled && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></div>}
                              {hasCompleted && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full"></div>}
                              {hasCancelled && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full"></div>}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 sm:gap-3 lg:gap-4 justify-center text-xs sm:text-sm">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                    <span className="text-gray-600">Scheduled</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600">Completed</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full"></div>
                    <span className="text-gray-600">Cancelled</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
            <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl lg:max-w-6xl max-h-[90vh] border-2 border-[#242833] bg-white shadow-lg p-2 sm:p-4 lg:p-5 overflow-y-auto overflow-x-hidden flex flex-col">
              <div className="flex flex-col w-full">
                <DialogHeader className="space-y-2 pb-4">
                  <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 flex items-center">
                    <Eye className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                    <span className="truncate">Sessions on {selectedDate ? format(selectedDate, isMobile ? 'MMM dd, yyyy' : 'EEEE, MMMM dd, yyyy') : ''}</span>
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 text-xs sm:text-sm lg:text-base">
                    View session details for the selected date
                  </DialogDescription>
                </DialogHeader>
                {selectedDateSessions.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {selectedDateSessions.map(session => (
                      <Card key={session.id} className="border border-[#242833] bg-white hover:shadow-lg transition-all duration-300">
                        <CardContent className="p-2 sm:p-3 lg:p-4">
                          <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-[repeat(5,1fr)_auto] gap-2 sm:gap-3 lg:gap-4 sm:items-center">
                            <div className="flex items-center space-x-2 min-w-0">
                              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Time</p>
                                <p className="font-semibold text-black text-xs sm:text-sm truncate">
                                  {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 min-w-0">
                              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Branch</p>
                                <p className="font-semibold text-black text-xs sm:text-sm truncate">{session.branches?.name || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 min-w-0">
                              <User className="h-3 w-3 sm:h-4 sm:w-4 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Coaches</p>
                                <p className="font-semibold text-black text-xs sm:text-sm truncate">
                                  {session.session_coaches.length > 0 
                                    ? session.session_coaches.map(sc => sc.coaches?.name || 'Unknown').join(', ') 
                                    : 'No coaches assigned'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 min-w-0">
                              <Users className="h-3 w-3 sm:h-4 sm:w-4 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Players</p>
                                <p className="font-semibold text-black text-xs sm:text-sm">{session.session_participants?.length || 0}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 min-w-0">
                              <Users className="h-3 w-3 sm:h-4 sm:w-4 text-accent flex-shrink-0" style={{ color: '#79e58f' }} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Package</p>
                                <p className="font-semibold text-black text-xs sm:text-sm truncate">{session.package_type || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-fit flex-shrink-0">
                              <Badge variant={getStatusBadgeVariant(session.status)} className="font-medium px-2 py-1 text-xs sm:text-sm w-fit">
                                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                              </Badge>
                              <Button
                                onClick={() => handleAttendanceRedirect(session.id)}
                                size="sm"
                                className="bg-accent hover:bg-accent/90 text-white font-medium transition-all duration-300 text-xs sm:text-sm min-w-fit w-full sm:w-auto"
                                style={{ backgroundColor: '#79e58f' }}
                              >
                                Attendance
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12 space-y-3 sm:space-y-4">
                    <CalendarIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto" />
                    <div className="space-y-2">
                      <p className="text-base sm:text-lg lg:text-xl text-gray-500">
                        No sessions on this day
                      </p>
                      <p className="text-gray-400 text-xs sm:text-sm lg:text-base max-w-md mx-auto">
                        {filterPackageType !== "All" ? `Try adjusting your package type filter or select a different date.` : `No sessions scheduled for this date.`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showUpcomingSessions} onOpenChange={setShowUpcomingSessions}>
            <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl lg:max-w-6xl max-h-[90vh] border-2 border-green-200 bg-white shadow-lg p-2 sm:p-4 lg:p-5 overflow-y-auto overflow-x-hidden flex flex-col">
              <div className="flex flex-col w-full">
                <DialogHeader className="space-y-2 pb-4">
                  <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-green-800 flex items-center">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 mr-2 sm:mr-3 text-green-600 flex-shrink-0" />
                    <span className="truncate">Upcoming Sessions ({upcomingSessions.length})</span>
                  </DialogTitle>
                  <DialogDescription className="text-green-600 text-xs sm:text-sm lg:text-base">
                    All scheduled sessions for today and future dates
                  </DialogDescription>
                </DialogHeader>
                {upcomingSessions.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {upcomingSessions.map((session) => (
                      <Card key={session.id} className="border border-green-200 bg-white hover:shadow-md transition-all duration-200">
                        <CardContent className="p-2 sm:p-3 lg:p-4">
                          <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-5 sm:gap-3 lg:gap-4 sm:items-center">
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-green-600">Date</p>
                              <p className="font-semibold text-black text-xs sm:text-sm truncate">{format(parseISO(session.date), 'MMM dd, yyyy')}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-green-600">Time</p>
                              <p className="font-semibold text-black text-xs sm:text-sm truncate">
                                {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-green-600">Branch</p>
                              <p className="font-semibold text-black text-xs sm:text-sm truncate">{session.branches?.name || 'N/A'}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-green-600">Coaches</p>
                              <p className="font-semibold text-black text-xs sm:text-sm truncate">
                                {session.session_coaches.length > 0 
                                  ? session.session_coaches.map(sc => sc.coaches?.name || 'Unknown').join(', ') 
                                  : 'No coaches assigned'}
                              </p>
                            </div>
                            <div className="flex justify-end">
                              <Button
                                onClick={() => {
                                  setShowUpcomingSessions(false);
                                  handleAttendanceRedirect(session.id);
                                }}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm min-w-fit w-full sm:w-auto"
                              >
                                Attendance
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12 space-y-3 sm:space-y-4">
                    <Clock className="h-12 w-12 sm:h-16 sm:w-16 text-green-300 mx-auto" />
                    <div className="space-y-2">
                      <p className="text-base sm:text-lg lg:text-xl text-green-600">No upcoming sessions</p>
                      <p className="text-green-500 text-xs sm:text-sm lg:text-base">Schedule new training sessions to get started.</p>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={showPastSessions} onOpenChange={setShowPastSessions}>
            <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl lg:max-w-6xl max-h-[90vh] border-2 border-gray-200 bg-white shadow-lg p-2 sm:p-4 lg:p-5 overflow-y-auto overflow-x-hidden flex flex-col">
              <div className="flex flex-col w-full">
                <DialogHeader className="space-y-2 pb-4">
                  <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 flex items-center">
                    <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 mr-2 sm:mr-3 text-gray-600 flex-shrink-0" />
                    <span className="truncate">Past Sessions ({pastSessions.length})</span>
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 text-xs sm:text-sm lg:text-base">
                    All completed sessions and sessions before today
                  </DialogDescription>
                </DialogHeader>
                {pastSessions.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {pastSessions.map((session) => (
                      <Card key={session.id} className="border border-gray-200 bg-white hover:shadow-md transition-all duration-200">
                        <CardContent className="p-2 sm:p-3 lg:p-4">
                          <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-5 sm:gap-3 lg:gap-4 sm:items-center">
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-600">Date</p>
                              <p className="font-semibold text-black text-xs sm:text-sm truncate">{format(parseISO(session.date), 'MMM dd, yyyy')}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-600">Time</p>
                              <p className="font-semibold text-black text-xs sm:text-sm truncate">
                                {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-600">Branch</p>
                              <p className="font-semibold text-black text-xs sm:text-sm truncate">{session.branches?.name || 'N/A'}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-600">Coaches</p>
                              <p className="font-semibold text-black text-xs sm:text-sm truncate">
                                {session.session_coaches.length > 0 
                                  ? session.session_coaches.map(sc => sc.coaches?.name || 'Unknown').join(', ') 
                                  : 'No coaches assigned'}
                              </p>
                            </div>
                            <div className="flex justify-end">
                              <Button
                                onClick={() => {
                                  setShowPastSessions(false);
                                  handleAttendanceRedirect(session.id);
                                }}
                                size="sm"
                                className="bg-gray-600 hover:bg-gray-700 text-white text-xs sm:text-sm min-w-fit w-full sm:w-auto"
                              >
                                View Details
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12 space-y-3 sm:space-y-4">
                    <CalendarIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto" />
                    <div className="space-y-2">
                      <p className="text-base sm:text-lg lg:text-xl text-gray-500">No past sessions</p>
                      <p className="text-gray-400 text-xs sm:text-sm lg:text-base">Completed sessions will appear here.</p>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </CalendarErrorBoundary>
  );
}