import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarIcon, Users, Clock, MapPin, ChevronLeft, ChevronRight, Filter, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isBefore, addMonths, subMonths, isAfter, parseISO } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

type SessionStatus = Database['public']['Enums']['session_status'];

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

const formatTime12Hour = (timeString: string) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export function CoachCalendarManager() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [filterPackageType, setFilterPackageType] = useState<string | "All">("All");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [showUpcomingSessions, setShowUpcomingSessions] = useState(false);
  const [showPastSessions, setShowPastSessions] = useState(false);
  const navigate = useNavigate();

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
      console.log("Coach ID:", coach?.id);
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
      console.log("Branches:", data);
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

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['coach-training-sessions', coachId, selectedBranch, filterPackageType, currentMonth],
    queryFn: async () => {
      if (!coachId) return [];
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

      // Fetch sessions from 6 months before current month to 1 month after
      const startDate = subMonths(startOfMonth(currentMonth), 6);
      const endDate = addMonths(endOfMonth(currentMonth), 1);

      // Use any type to avoid TS2589
      let query: any = supabase
        .from('training_sessions')
        .select(`
          id, date, start_time, end_time, branch_id, status, package_id,
          branches (name),
          packages (name),
          session_participants (
            students (name)
          )
        `)
        .in('id', sessionIds)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      if (selectedBranch !== "all") {
        query = query.eq('branch_id', selectedBranch);
      }
      if (filterPackageType !== "All" && typeof filterPackageType === "string") {
        query = query.eq('package_id', filterPackageType);
      }

      const { data, error } = await query.order('date', { ascending: true });
      if (error) {
        console.error("Error fetching sessions:", error);
        throw error;
      }
      console.log("Sessions result:", data);
      return (data || []).map((session: any) => ({
        ...session,
        package_name: session.packages?.name || null,
        package_id: session.package_id || null,
      })) as TrainingSession[];
    },
    enabled: !!coachId
  });

  const filteredSessions = sessions
    ?.filter((session) =>
      filterPackageType === "All" || session.package_id === filterPackageType
    ) || [];

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500 text-white border-blue-500';
      case 'completed': return 'bg-green-500 text-white border-green-500';
      case 'cancelled': return 'bg-red-500 text-white border-red-500';
      default: return 'bg-gray-500 text-white border-gray-500';
    }
  };

  const getDayStatusColor = (daySessions: TrainingSession[]) => {
    if (daySessions.some(session => session.status === 'scheduled')) {
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-500',
        hoverBg: 'hover:bg-blue-100',
        hoverBorder: 'hover:border-blue-600',
        dot: 'bg-blue-500',
        text: 'text-black'
      };
    } else if (daySessions.some(session => session.status === 'completed')) {
      return {
        bg: 'bg-green-50',
        border: 'border-green-500',
        hoverBg: 'hover:bg-green-100',
        hoverBorder: 'hover:border-green-600',
        dot: 'bg-green-500',
        text: 'text-black'
      };
    } else if (daySessions.some(session => session.status === 'cancelled')) {
      return {
        bg: 'bg-red-50',
        border: 'border-red-500',
        hoverBg: 'hover:bg-red-100',
        hoverBorder: 'hover:border-red-600',
        dot: 'bg-red-500',
        text: 'text-black'
      };
    }
    return {
      bg: 'bg-white',
      border: 'border-gray-200',
      hoverBg: 'hover:bg-gray-50',
      hoverBorder: '',
      dot: '',
      text: 'text-gray-700'
    };
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const selectedDateSessions = selectedDate
    ? filteredSessions.filter(session => {
        const sessionDate = parseISO(session.date);
        return isSameDay(sessionDate, selectedDate);
      }) || []
    : [];

  const today = new Date();
  const todayDateOnly = new Date(format(today, "yyyy-MM-dd") + "T00:00:00");

  const upcomingSessions = filteredSessions.filter(session => {
    const sessionDate = parseISO(session.date);
    return (isAfter(sessionDate, todayDateOnly) || isSameDay(sessionDate, todayDateOnly)) &&
           session.status !== 'cancelled' && session.status !== 'completed';
  }) || [];

  const pastSessions = filteredSessions.filter(session => {
    const sessionDate = parseISO(session.date);
    return session.status === 'completed' || isBefore(sessionDate, todayDateOnly);
  }) || [];

  const handleAttendanceRedirect = (sessionId: string) => {
    navigate(`/dashboard/attendance/${sessionId}`);
  };

  const handleDateClick = (day: Date) => {
    const daySessions = filteredSessions.filter(session => isSameDay(parseISO(session.date), day));
    if (daySessions.length > 0) {
      setSelectedDate(day);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-4 p-2 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#181A18] mb-2 tracking-tight">
            My Calendar
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-700 font-bold">
            View and manage your basketball training sessions
          </p>
        </div>

        {/* Main Calendar Card */}
        <Card className="border-2 border-[#181A18] bg-white shadow-xl">
          <CardHeader className="border-b border-[#181A18] bg-[#181A18] p-3 sm:p-6">
            <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-[#efeff1] flex items-center">
              <CalendarIcon className="h-4 sm:h-5 lg:h-6 w-4 sm:w-5 lg:w-6 mr-2 sm:mr-3 text-[#8e7a3f]" />
              Monthly Overview
            </CardTitle>
            <CardDescription className="text-gray-400 text-xs sm:text-sm lg:text-base font-bold">
              View your training sessions for {format(currentMonth, 'MMMM yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6">
            
            {/* Filters */}
            <div className="mb-4 sm:mb-6">
              <div className="flex items-center mb-3 sm:mb-4">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-[#8e7a3f] mr-2" />
                <h3 className="text-sm sm:text-base lg:text-lg font-bold text-gray-900">Filter Sessions</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-xs sm:text-sm font-bold text-gray-700">Branch</label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="border-2 border-[#8e7a3f] focus:border-[#8e7a3f] focus:ring-[#8e7a3f]/20 rounded-lg text-xs sm:text-sm py-2 h-8 sm:h-10">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-2 border-[#8e7a3f] z-50">
                      <SelectItem value="all">All Branches</SelectItem>
                      {branches?.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col space-y-2">
                  <label className="text-xs sm:text-sm font-bold text-gray-700">Package Type</label>
                  <Select
                    value={filterPackageType}
                    onValueChange={setFilterPackageType}
                  >
                    <SelectTrigger className="border-2 border-[#8e7a3f] focus:border-[#8e7a3f] focus:ring-[#8e7a3f]/20 rounded-lg text-xs sm:text-sm py-2 h-8 sm:h-10">
                      <SelectValue placeholder="Select package type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-2 border-[#8e7a3f] z-50">
                      <SelectItem value="All">All Sessions</SelectItem>
                      {packages?.map(pkg => (
                        <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-3 sm:mt-4 gap-3 sm:gap-4">
                <p className="text-xs sm:text-sm text-gray-600 font-bold">
                  Showing {filteredSessions.length} session{filteredSessions.length === 1 ? '' : 's'}
                </p>
                {/* Quick Access Buttons */}
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <Button
                    onClick={() => setShowUpcomingSessions(true)}
                    variant="outline"
                    size="sm"
                    className="border-green-500/30 text-green-600 hover:bg-green-500 hover:text-white transition-all duration-300 flex-1 sm:flex-initial font-bold text-xs sm:text-sm"
                  >
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Upcoming ({upcomingSessions.length})
                  </Button>
                  <Button
                    onClick={() => setShowPastSessions(true)}
                    variant="outline"
                    size="sm"
                    className="border-gray-500/30 text-gray-600 hover:bg-gray-500 hover:text-white transition-all duration-300 flex-1 sm:flex-initial font-bold text-xs sm:text-sm"
                  >
                    <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Past ({pastSessions.length})
                  </Button>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="border-2 border-[#181A18] rounded-xl p-3 sm:p-4 lg:p-6 bg-white shadow-lg">
              
              {/* Calendar Navigation */}
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <Button
                  onClick={handlePrevMonth}
                  variant="outline"
                  size="sm"
                  className="border-[#8e7a3f] text-[#8e7a3f] hover:bg-[#8e7a3f] hover:text-white transition-all duration-300 h-8 w-8 sm:h-10 sm:w-10 p-0"
                >
                  <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <h3 className="text-base sm:text-lg lg:text-2xl font-bold text-black">
                  {format(currentMonth, 'MMMM yyyy')}
                </h3>
                <Button
                  onClick={handleNextMonth}
                  variant="outline"
                  size="sm"
                  className="border-[#8e7a3f] text-[#8e7a3f] hover:bg-[#8e7a3f] hover:text-white transition-all duration-300 h-8 w-8 sm:h-10 sm:w-10 p-0"
                >
                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
              
              {/* Days of Week Header */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-3 sm:mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center py-2 sm:py-3 bg-[#181A18] text-white font-bold rounded-lg text-xs sm:text-sm">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {daysInMonth.map(day => {
                  const daySessions = filteredSessions.filter(session => isSameDay(parseISO(session.date), day)) || [];
                  const isToday = isSameDay(day, new Date());
                  const hasSessions = daySessions.length > 0;
                  const statusColor = getDayStatusColor(daySessions);
                  
                  return (
                    <button
                      key={day.toString()}
                      onClick={() => handleDateClick(day)}
                      className={`
                        relative p-1 sm:p-2 lg:p-3 h-12 sm:h-16 lg:h-20 rounded-lg text-left transition-all duration-300 hover:scale-105 hover:shadow-lg
                        overflow-hidden min-w-0 cursor-pointer border-2
                        ${isToday 
                          ? 'bg-[#8e7a3f] border-[#8e7a3f] text-white'
                          : hasSessions
                            ? `${statusColor.bg} ${statusColor.border} ${statusColor.text} ${statusColor.hoverBg} ${statusColor.hoverBorder}`
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="font-bold text-xs sm:text-sm lg:text-lg mb-1">
                        {format(day, 'd')}
                      </div>
                      {hasSessions && (
                        <div className="space-y-1">
                          <div className="text-xs font-bold opacity-90 truncate">
                            {daySessions.length}
                          </div>
                          <div className={`w-2 h-2 sm:w-3 sm:h-3 ${statusColor.dot} rounded-full absolute top-1 right-1`}></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {/* Legend */}
              <div className="mt-3 sm:mt-4 lg:mt-6 flex flex-wrap gap-2 sm:gap-3 lg:gap-4 justify-center text-xs sm:text-sm">
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600 font-bold">Scheduled</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600 font-bold">Completed</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600 font-bold">Cancelled</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-[#8e7a3f] rounded-full"></div>
                  <span className="text-gray-600 font-bold">Today</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date Sessions Modal */}
        <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl border-2 border-[#181A18] bg-white shadow-lg overflow-x-hidden max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 flex items-center">
                <Eye className="h-4 sm:h-5 w-4 sm:w-5 mr-2 sm:mr-3 text-[#8e7a3f]" />
                Sessions on {selectedDate ? format(selectedDate, 'EEEE, MMMM dd, yyyy') : ''}
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-xs sm:text-sm lg:text-base font-bold">
                View and manage your sessions for the selected date
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-2 sm:pr-4">
              <div className="space-y-3 sm:space-y-4">
                {selectedDateSessions.length > 0 ? (
                  selectedDateSessions.map(session => (
                    <Card key={session.id} className="border border-[#181A18] bg-white hover:shadow-lg transition-all duration-300">
                      <CardContent className="p-3 sm:p-4 lg:p-6">
                        <div className="space-y-4">
                          {/* Session Information Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <div className="flex items-center space-x-2 min-w-0">
                              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-[#8e7a3f] flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-600">Time</p>
                                <p className="font-bold text-black text-xs sm:text-sm truncate">
                                  {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 min-w-0">
                              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-[#8e7a3f] flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-600">Branch</p>
                                <p className="font-bold text-black text-xs sm:text-sm truncate">{session.branches.name}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 min-w-0">
                              <Users className="h-3 w-3 sm:h-4 sm:w-4 text-[#8e7a3f] flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-600">Players</p>
                                <p className="font-bold text-black text-xs sm:text-sm">{session.session_participants?.length || 0}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 min-w-0">
                              <Users className="h-3 w-3 sm:h-4 sm:w-4 text-[#8e7a3f] flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-600">Package</p>
                                <p className="font-bold text-black text-xs sm:text-sm truncate">{session.package_name || 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Status and Action Section */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-gray-100">
                            <Badge variant={session.status as "scheduled" | "completed" | "cancelled"} className="font-bold px-3 py-1 text-xs">
                              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                            </Badge>
                            <Button
                              onClick={() => handleAttendanceRedirect(session.id)}
                              className="bg-[#8e7a3f] hover:bg-[#8e7a3f]/90 text-white font-bold transition-all duration-300 w-full sm:w-auto text-xs sm:text-sm"
                              size="sm"
                            >
                              Manage Attendance
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-6 sm:py-8 lg:py-12">
                    <CalendarIcon className="h-8 sm:h-12 lg:h-16 w-8 sm:w-12 lg:w-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
                    <p className="text-base sm:text-lg lg:text-xl text-gray-500 mb-2 font-bold">
                      No sessions on this day
                    </p>
                    <p className="text-gray-400 text-xs sm:text-sm lg:text-base font-bold">
                      No sessions scheduled for this date.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Upcoming Sessions Modal */}
        <Dialog open={showUpcomingSessions} onOpenChange={setShowUpcomingSessions}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-6xl max-h-[80vh] border-2 border-green-200 bg-white shadow-lg overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-green-800 flex items-center">
                <Clock className="h-5 sm:h-6 w-5 sm:w-6 mr-3 text-green-600" />
                Upcoming Sessions ({upcomingSessions.length})
              </DialogTitle>
              <DialogDescription className="text-green-600 text-sm sm:text-base font-bold">
                All scheduled sessions for today and future dates
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              {upcomingSessions.length > 0 ? (
                <div className="space-y-4">
                  {upcomingSessions.map((session) => (
                    <Card key={session.id} className="border border-green-200 bg-white hover:shadow-md transition-all duration-200">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 items-center">
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-green-600">Date</p>
                            <p className="font-bold text-black text-sm truncate">{format(parseISO(session.date), 'MMM dd, yyyy')}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-green-600">Time</p>
                            <p className="font-bold text-black text-sm truncate">
                              {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-green-600">Branch</p>
                            <p className="font-bold text-black text-sm truncate">{session.branches.name}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-green-600">Package</p>
                            <p className="font-bold text-black text-sm truncate">{session.package_name || 'N/A'}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-green-600">Players</p>
                            <p className="font-bold text-black text-sm">{session.session_participants?.length || 0}</p>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              onClick={() => {
                                setShowUpcomingSessions(false);
                                handleAttendanceRedirect(session.id);
                              }}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto min-w-fit text-xs sm:text-sm font-bold"
                            >
                              Manage Attendance
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <Clock className="h-12 sm:h-16 w-12 sm:w-16 text-green-300 mx-auto mb-4" />
                  <p className="text-lg sm:text-xl text-green-600 mb-2 font-bold">No upcoming sessions</p>
                  <p className="text-green-500 text-sm sm:text-base font-bold">Schedule new training sessions to get started.</p>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Past Sessions Modal */}
        <Dialog open={showPastSessions} onOpenChange={setShowPastSessions}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-6xl max-h-[80vh] border-2 border-gray-200 bg-white shadow-lg overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center">
                <CalendarIcon className="h-5 sm:h-6 w-5 sm:w-6 mr-3 text-gray-600" />
                Past Sessions ({pastSessions.length})
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-sm sm:text-base font-bold">
                All completed sessions or sessions from past dates
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              {pastSessions.length > 0 ? (
                <div className="space-y-4">
                  {pastSessions.map((session) => (
                    <Card key={session.id} className="border border-gray-200 bg-white hover:shadow-md transition-all duration-200">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 items-center">
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-gray-600">Date</p>
                            <p className="font-bold text-black text-sm truncate">{format(parseISO(session.date), 'MMM dd, yyyy')}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-gray-600">Time</p>
                            <p className="font-bold text-black text-sm truncate">
                              {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-gray-600">Branch</p>
                            <p className="font-bold text-black text-sm truncate">{session.branches.name}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-gray-600">Package</p>
                            <p className="font-bold text-black text-sm truncate">{session.package_name || 'N/A'}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-gray-600">Players</p>
                            <p className="font-bold text-black text-sm">{session.session_participants?.length || 0}</p>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              onClick={() => {
                                setShowPastSessions(false);
                                handleAttendanceRedirect(session.id);
                              }}
                              size="sm"
                              className="bg-gray-600 hover:bg-gray-700 text-white w-full sm:w-auto min-w-fit text-xs sm:text-sm font-bold"
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
                <div className="text-center py-8 sm:py-12">
                  <CalendarIcon className="h-12 sm:h-16 w-12 sm:w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-lg sm:text-xl text-gray-500 mb-2 font-bold">No past sessions</p>
                  <p className="text-gray-400 text-sm sm:text-base font-bold">Completed or past sessions will appear here.</p>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}