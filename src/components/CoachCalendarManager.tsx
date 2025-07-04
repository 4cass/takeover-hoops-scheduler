
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CalendarDays, Clock, MapPin, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, isAfter, isBefore, startOfDay } from "date-fns";
import { useNavigate } from "react-router-dom";

interface TrainingSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  package_type: string;
  branches: { name: string };
  coaches: { name: string };
}

const formatTime12Hour = (timeString: string) => {
  const [hours, minutes] = timeString.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case "scheduled": return "bg-blue-100 text-blue-800 border-blue-200 font-bold";
    case "completed": return "bg-green-100 text-green-800 border-green-200 font-bold";
    case "cancelled": return "bg-red-100 text-red-800 border-red-200 font-bold";
    default: return "bg-gray-100 text-gray-800 border-gray-200 font-bold";
  }
};

export function CoachCalendarManager() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [showUpcomingModal, setShowUpcomingModal] = useState(false);
  const [showPastModal, setShowPastModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const { user } = useAuth();
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
      return coach?.id;
    },
    enabled: !!user?.id,
  });

  const { data: sessions } = useQuery<TrainingSession[]>({
    queryKey: ["coach-sessions", coachId, currentMonth],
    queryFn: async () => {
      if (!coachId) return [];
      
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, date, start_time, end_time, status, package_type, branches (name), coaches (name)")
        .eq("coach_id", coachId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      
      if (error) {
        console.error("Error fetching sessions:", error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!coachId,
  });

  const { data: allSessions } = useQuery<TrainingSession[]>({
    queryKey: ["coach-all-sessions", coachId],
    queryFn: async () => {
      if (!coachId) return [];
      
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, date, start_time, end_time, status, package_type, branches (name), coaches (name)")
        .eq("coach_id", coachId)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      
      if (error) {
        console.error("Error fetching all sessions:", error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!coachId,
  });

  const today = startOfDay(new Date());
  const upcomingSessions = allSessions?.filter((session) => 
    isAfter(parseISO(session.date), today) || isSameDay(parseISO(session.date), today)
  ) || [];
  const pastSessions = allSessions?.filter((session) => 
    isBefore(parseISO(session.date), today)
  ) || [];

  const sessionsOnSelectedDate = sessions?.filter((session) =>
    selectedDate && isSameDay(parseISO(session.date), selectedDate)
  ) || [];

  const datesWithSessions = sessions?.map(session => parseISO(session.date)) || [];
  
  // Create a map of dates to session counts
  const sessionCounts = sessions?.reduce((acc, session) => {
    const dateKey = session.date;
    acc[dateKey] = (acc[dateKey] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const handleManageAttendance = (sessionId: string) => {
    navigate(`/dashboard/attendance/${sessionId}`);
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      const sessionsForDate = sessions?.filter(session => 
        isSameDay(parseISO(session.date), date)
      ) || [];
      if (sessionsForDate.length > 0) {
        setShowSessionsModal(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-8">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-[#181A18] mb-2 tracking-tight">
            Training Calendar
          </h1>
          <p className="text-base sm:text-lg text-gray-700 font-medium">
            View and manage your training sessions
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Button
            onClick={() => setShowUpcomingModal(true)}
            variant="outline"
            className="border-[#ff6b35] text-[#ff6b35] hover:bg-[#ff6b35] hover:text-white font-bold p-3 sm:p-4 h-auto"
          >
            <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <div className="text-left">
              <div className="text-sm sm:text-base">Upcoming Sessions</div>
              <div className="text-xs opacity-75">{upcomingSessions.length} sessions</div>
            </div>
          </Button>
          <Button
            onClick={() => setShowPastModal(true)}
            variant="outline"
            className="border-[#181A18] text-[#181A18] hover:bg-[#181A18] hover:text-white font-bold p-3 sm:p-4 h-auto"
          >
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <div className="text-left">
              <div className="text-sm sm:text-base">Past Sessions</div>
              <div className="text-xs opacity-75">{pastSessions.length} sessions</div>
            </div>
          </Button>
        </div>

        {/* Calendar Section */}
        <Card className="border-2 border-[#181A18] bg-white/90 backdrop-blur-sm shadow-xl">
          <CardHeader className="border-b border-[#181A18] bg-[#181A18] p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg sm:text-2xl font-bold text-[#efeff1] flex items-center">
                <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-[#ff6b35]" />
                {format(currentMonth, 'MMMM yyyy')}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handlePreviousMonth}
                  variant="outline"
                  size="sm"
                  className="border-[#ff6b35] text-[#ff6b35] hover:bg-[#ff6b35] hover:text-white h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleNextMonth}
                  variant="outline"
                  size="sm"
                  className="border-[#ff6b35] text-[#ff6b35] hover:bg-[#ff6b35] hover:text-white h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardDescription className="text-gray-400 text-sm sm:text-base font-medium">
              Click on a date with sessions to view details
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="w-full">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="w-full"
                classNames={{
                  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
                  month: "space-y-4 w-full",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-sm font-bold",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-[#ff6b35] text-[#ff6b35] hover:bg-[#ff6b35] hover:text-white",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse space-y-1",
                  head_row: "flex w-full",
                  head_cell: "text-muted-foreground rounded-md w-full font-bold text-[0.8rem] flex-1 text-center",
                  row: "flex w-full mt-2",
                  cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 flex-1 h-12 sm:h-14",
                  day: "h-full w-full p-1 font-bold aria-selected:opacity-100 hover:bg-[#ff6b35] hover:text-white rounded-md transition-colors relative flex items-center justify-center",
                  day_range_end: "day-range-end",
                  day_selected: "bg-[#ff6b35] text-white hover:bg-[#ff6b35] hover:text-white focus:bg-[#ff6b35] focus:text-white",
                  day_today: "bg-gray-100 text-gray-900 font-bold border-2 border-[#ff6b35]",
                  day_outside: "text-muted-foreground opacity-50 aria-selected:bg-[#ff6b35]/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                  day_disabled: "text-muted-foreground opacity-50",
                  day_range_middle: "aria-selected:bg-[#ff6b35] aria-selected:text-white",
                  day_hidden: "invisible",
                }}
                components={{
                  Day: ({ date, ...props }) => {
                    const dateKey = format(date, 'yyyy-MM-dd');
                    const sessionCount = sessionCounts[dateKey] || 0;
                    const hasSession = sessionCount > 0;
                    
                    return (
                      <div className="relative w-full h-full">
                        <button
                          {...props}
                          className={`h-full w-full p-1 font-bold rounded-md transition-colors relative flex flex-col items-center justify-center ${
                            hasSession 
                              ? 'bg-green-100 border-2 border-green-500 hover:bg-green-200' 
                              : 'hover:bg-[#ff6b35] hover:text-white'
                          } ${
                            selectedDate && isSameDay(date, selectedDate)
                              ? 'bg-[#ff6b35] text-white'
                              : hasSession
                              ? 'text-green-800'
                              : 'text-gray-900'
                          }`}
                        >
                          <span className="text-xs sm:text-sm">{format(date, 'd')}</span>
                          {hasSession && (
                            <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">
                              {sessionCount}
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  }
                }}
                modifiers={{
                  hasSession: datesWithSessions,
                }}
              />
            </div>
            
            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#ff6b35] rounded"></div>
                <span className="text-gray-700 font-bold">Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border-2 border-green-500 rounded relative">
                  <div className="absolute -top-1 -right-1 bg-green-500 rounded-full h-3 w-3"></div>
                </div>
                <span className="text-gray-700 font-bold">Has Sessions</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-100 border-2 border-[#ff6b35] rounded"></div>
                <span className="text-gray-700 font-bold">Today</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sessions Modal for Selected Date */}
        <Dialog open={showSessionsModal} onOpenChange={setShowSessionsModal}>
          <DialogContent className="max-w-[95vw] sm:max-w-3xl border-2 border-[#181A18] bg-gradient-to-br from-[#faf0e8]/30 to-white shadow-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-[#181A18] flex items-center">
                <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-[#ff6b35]" />
                Sessions for {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'Selected Date'}
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-sm sm:text-base font-bold">
                {sessionsOnSelectedDate.length} session{sessionsOnSelectedDate.length === 1 ? '' : 's'} scheduled
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 sm:space-y-4">
              {sessionsOnSelectedDate.map((session) => (
                <Card
                  key={session.id}
                  className="border-2 border-[#ff6b35]/20 bg-white hover:border-[#ff6b35]/50 transition-all duration-300 hover:shadow-md cursor-pointer"
                  onClick={() => setSelectedSession(session)}
                >
                  <CardContent className="p-3 sm:p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-[#ff6b35]" />
                        <span className="font-bold text-[#181A18] text-sm sm:text-base">
                          {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                        </span>
                      </div>
                      <Badge className={`${getStatusBadgeColor(session.status)} border text-xs px-2 py-1 w-fit`}>
                        {session.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-[#ff6b35] flex-shrink-0" />
                        <span className="text-gray-700 font-bold">{session.branches.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-[#ff6b35] flex-shrink-0" />
                        <span className="text-gray-700 font-bold">{session.package_type || 'N/A'}</span>
                      </div>
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleManageAttendance(session.id);
                      }}
                      className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold transition-all duration-300 text-sm"
                      size="sm"
                    >
                      Manage Attendance
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Upcoming Sessions Modal */}
        <Dialog open={showUpcomingModal} onOpenChange={setShowUpcomingModal}>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl border-2 border-[#181A18] bg-gradient-to-br from-[#faf0e8]/30 to-white shadow-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-[#181A18] flex items-center">
                <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-[#ff6b35]" />
                Upcoming Sessions
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-sm sm:text-base font-bold">
                {upcomingSessions.length} upcoming session{upcomingSessions.length === 1 ? '' : 's'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 sm:space-y-4">
              {upcomingSessions.map((session) => (
                <Card
                  key={session.id}
                  className="border-2 border-[#ff6b35]/20 bg-white hover:border-[#ff6b35]/50 transition-all duration-300 hover:shadow-md"
                >
                  <CardContent className="p-3 sm:p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <CalendarDays className="w-4 h-4 text-[#ff6b35]" />
                        <span className="font-bold text-[#181A18] text-sm sm:text-base">
                          {format(parseISO(session.date), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <Badge className={`${getStatusBadgeColor(session.status)} border text-xs px-2 py-1 w-fit`}>
                        {session.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-[#ff6b35] flex-shrink-0" />
                        <span className="text-gray-700 font-bold">
                          {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-[#ff6b35] flex-shrink-0" />
                        <span className="text-gray-700 font-bold">{session.branches.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 sm:col-span-2">
                        <Users className="w-4 h-4 text-[#ff6b35] flex-shrink-0" />
                        <span className="text-gray-700 font-bold">{session.package_type || 'N/A'}</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleManageAttendance(session.id)}
                      className="w-full bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold transition-all duration-300 text-sm"
                      size="sm"
                    >
                      Manage Attendance
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Past Sessions Modal */}
        <Dialog open={showPastModal} onOpenChange={setShowPastModal}>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl border-2 border-[#181A18] bg-gradient-to-br from-[#faf0e8]/30 to-white shadow-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-[#181A18] flex items-center">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-[#ff6b35]" />
                Past Sessions
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-sm sm:text-base font-bold">
                {pastSessions.length} past session{pastSessions.length === 1 ? '' : 's'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 sm:space-y-4">
              {pastSessions.map((session) => (
                <Card
                  key={session.id}
                  className="border-2 border-gray-200 bg-white hover:border-gray-300 transition-all duration-300 hover:shadow-md"
                >
                  <CardContent className="p-3 sm:p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <CalendarDays className="w-4 h-4 text-gray-500" />
                        <span className="font-bold text-[#181A18] text-sm sm:text-base">
                          {format(parseISO(session.date), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <Badge className={`${getStatusBadgeColor(session.status)} border text-xs px-2 py-1 w-fit`}>
                        {session.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-700 font-bold">
                          {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-700 font-bold">{session.branches.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 sm:col-span-2">
                        <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-700 font-bold">{session.package_type || 'N/A'}</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleManageAttendance(session.id)}
                      className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold transition-all duration-300 text-sm"
                      size="sm"
                    >
                      View Attendance
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Session Details Modal */}
        <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl border-2 border-[#181A18] bg-gradient-to-br from-[#faf0e8]/30 to-white shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-[#181A18] flex items-center">
                <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-[#ff6b35]" />
                Session Details
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-sm sm:text-base font-bold">
                {selectedSession ? format(parseISO(selectedSession.date), 'EEEE, MMMM dd, yyyy') : ''}
              </DialogDescription>
            </DialogHeader>
            {selectedSession && (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-[#ff6b35] flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-gray-600">Time</p>
                      <p className="font-bold text-[#181A18] text-sm sm:text-base">
                        {formatTime12Hour(selectedSession.start_time)} - {formatTime12Hour(selectedSession.end_time)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-[#ff6b35] flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-gray-600">Branch</p>
                      <p className="font-bold text-[#181A18] text-sm sm:text-base">{selectedSession.branches.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-[#ff6b35] flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-gray-600">Package Type</p>
                      <p className="font-bold text-[#181A18] text-sm sm:text-base">{selectedSession.package_type || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge className={`${getStatusBadgeColor(selectedSession.status)} border font-bold px-2 sm:px-3 py-1 text-xs sm:text-sm w-fit`}>
                      {selectedSession.status.charAt(0).toUpperCase() + selectedSession.status.slice(1)}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedSession(null)}
                    className="order-2 sm:order-1 font-bold"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      handleManageAttendance(selectedSession.id);
                      setSelectedSession(null);
                    }}
                    className="bg-[#ff6b35] hover:bg-[#ff6b35]/90 text-white font-bold transition-all duration-300 hover:scale-105 hover:shadow-lg order-1 sm:order-2"
                  >
                    Manage Attendance
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
