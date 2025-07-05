import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar as CalendarIcon, Users, Clock, MapPin, User, ChevronLeft, ChevronRight, Filter, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isBefore, addMonths, subMonths, isAfter, parseISO } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/context/AuthContext";
import { CoachCalendarManager } from "./CoachCalendarManager";
import { useIsMobile } from "@/hooks/use-mobile";

type SessionStatus = Database['public']['Enums']['session_status'];

type TrainingSession = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  branch_id: string;
  coach_id: string;
  status: SessionStatus;
  package_type: "Camp Training" | "Personal Training" | null;
  branches: { name: string };
  coaches: { name: string };
  session_participants: Array<{ students: { name: string } }>;
};

const formatTime12Hour = (timeString: string) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
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
  const [filterPackageType, setFilterPackageType] = useState<"All" | "Camp Training" | "Personal Training">("All");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [showUpcomingSessions, setShowUpcomingSessions] = useState(false);
  const [showPastSessions, setShowPastSessions] = useState(false);
  const [visibleSessions, setVisibleSessions] = useState(1);
  const [visibleUpcomingSessions, setVisibleUpcomingSessions] = useState(1);
  const [visiblePastSessions, setVisiblePastSessions] = useState(1);
  const navigate = useNavigate();

  // Reset visible sessions when modals open/close
  useEffect(() => {
    if (selectedDate) {
      setVisibleSessions(1);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (showUpcomingSessions) {
      setVisibleUpcomingSessions(1);
    }
  }, [showUpcomingSessions]);

  useEffect(() => {
    if (showPastSessions) {
      setVisiblePastSessions(1);
    }
  }, [showPastSessions]);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['training-sessions', selectedCoach, selectedBranch, filterPackageType, currentMonth],
    queryFn: async () => {
      let query = supabase
        .from('training_sessions')
        .select(`
          id, date, start_time, end_time, branch_id, coach_id, status, package_type,
          branches (name),
          coaches (name),
          session_participants (
            students (name)
          )
        `)
        .gte('date', format(startOfMonth(currentMonth), 'yyyy-MM-dd'))
        .lte('date', format(endOfMonth(currentMonth), 'yyyy-MM-dd'));

      if (selectedCoach !== "all") {
        query = query.eq('coach_id', selectedCoach);
      }
      if (selectedBranch !== "all") {
        query = query.eq('branch_id', selectedBranch);
      }

      const { data, error } = await query.order('date', { ascending: true });
      if (error) throw error;
      return data as TrainingSession[];
    }
  });

  const { data: coaches } = useQuery({
    queryKey: ['coaches-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coaches')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    }
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

  const filteredSessions = sessions
    ?.filter((session) =>
      filterPackageType === "All" || session.package_type === filterPackageType
    ) || [];

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'scheduled': return 'scheduled';
      case 'completed': return 'completed';
      case 'cancelled': return 'cancelled';
      default: return 'default';
    }
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
    navigate(`/dashboard/attendance?sessionId=${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#181A18] tracking-tight">
            Calendar
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-700">
            Manage and view all basketball training sessions
          </p>
        </div>

        {/* Main Calendar Card */}
        <Card className="border-2 border-[#181A18] bg-white shadow-xl">
          <CardHeader className="border-b border-[#181A18] bg-[#181A18] p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-[#efeff1] flex items-center">
              <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-accent flex-shrink-0" />
              <span className="truncate">Monthly Overview</span>
            </CardTitle>
            <CardDescription className="text-gray-400 text-xs sm:text-sm lg:text-base">
              View and manage training sessions for {format(currentMonth, 'MMMM yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
            
            {/* Filters */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" />
                <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900">Filter Sessions</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium text-gray-700">Coach</label>
                  <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                    <SelectTrigger className="border-2 border-accent focus:border-accent focus:ring-accent/20 rounded-lg text-xs sm:text-sm h-9 sm:h-10">
                      <SelectValue placeholder="Select coach" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Coaches</SelectItem>
                      {coaches?.map(coach => (
                        <SelectItem key={coach.id} value={coach.id}>{coach.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-medium text-gray-700">Branch</label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="border-2 border-accent focus:border-accent focus:ring-accent/20 rounded-lg text-xs sm:text-sm h-9 sm:h-10">
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
                
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <label className="text-xs sm:text-sm font-medium text-gray-700">Package Type</label>
                  <Select
                    value={filterPackageType}
                    onValueChange={(value: "All" | "Camp Training" | "Personal Training") => setFilterPackageType(value)}
                  >
                    <SelectTrigger className="border-2 border-accent focus:border-accent focus:ring-accent/20 rounded-lg text-xs sm:text-sm h-9 sm:h-10">
                      <SelectValue placeholder="Select package type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Sessions</SelectItem>
                      <SelectItem value="Camp Training">Camp Training</SelectItem>
                      <SelectItem value="Personal Training">Personal Training</SelectItem>
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

            {/* Calendar Grid */}
            <div className="border-2 border-[#181A18] rounded-xl p-3 sm:p-4 lg:p-6 bg-white shadow-lg">
              
              {/* Calendar Navigation */}
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <Button
                  onClick={handlePrevMonth}
                  variant="outline"
                  size={isMobile ? "sm" : "default"}
                  className="border-[#8e7a3f] text-[#8e7a3f] hover:bg-[#8e7a3f] hover:text-white transition-all duration-300"
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
                  className="border-[#8e7a3f] text-[#8e7a3f] hover:bg-[#8e7a3f] hover:text-white transition-all duration-300"
                >
                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
              
              {/* Days of Week Header */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-3 sm:mb-4">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                  <div key={day} className="text-center py-2 sm:py-3 bg-[#181A18] text-white font-semibold rounded-lg text-xs sm:text-sm">
                    {isMobile ? day.slice(0, 1) : day.slice(0, 3)}
                  </div>
                ))}
              </div>
              
              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {daysInMonth.map(day => {
                  const daySessions = filteredSessions.filter(session => isSameDay(parseISO(session.date), day)) || [];
                  const hasScheduled = daySessions.some(s => s.status === 'scheduled');
                  const hasCompleted = daySessions.some(s => s.status === 'completed');
                  const hasCancelled = daySessions.some(s => s.status === 'cancelled');
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  
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
                            ? 'bg-accent border-2 border-[#8e7a3f] text-white'
                            : daySessions.length > 0
                              ? 'bg-white border border-accent text-black hover:border-[#8e7a3f]'
                              : 'bg-white border border-gray-200 text-gray-700 hover:bg-[#faf0e8]/50'
                        }
                      `}
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
              
              {/* Legend */}
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

        {/* Sessions Modal */}
        <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl lg:max-w-6xl max-h-[60vh] border-2 border-[#181A18] bg-white shadow-lg p-2 sm:p-4 lg:p-5 overflow-y-auto overflow-x-hidden flex flex-col">
            <div className="flex flex-col w-full">
              <DialogHeader className="space-y-2 pb-4">
                <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 flex items-center">
                  <Eye className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 text-accent flex-shrink-0" />
                  <span className="truncate">Sessions on {selectedDate ? format(selectedDate, isMobile ? 'MMM dd, yyyy' : 'EEEE, MMMM dd, yyyy') : ''}</span>
                </DialogTitle>
                <DialogDescription className="text-gray-600 text-xs sm:text-sm lg:text-base">
                  View session details for the selected date
                </DialogDescription>
              </DialogHeader>
              
              {selectedDateSessions.length > 0 ? (
                <div className="space-y-2">
                  {selectedDateSessions.slice(0, visibleSessions).map(session => (
                    <Card key={session.id} className="border border-[#181A18] bg-white hover:shadow-lg transition-all duration-300">
                      <CardContent className="p-2">
                        <div className="space-y-2 sm:grid sm:grid-cols-2 lg:grid-cols-[repeat(5,1fr)_auto] gap-2 sm:items-center">
                          <div className="flex items-center space-x-2 min-w-0">
                            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-accent flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-medium text-gray-600">Time</p>
                              <p className="font-semibold text-black text-xs sm:text-sm truncate">
                                {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 min-w-0">
                            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-accent flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-medium text-gray-600">Branch</p>
                              <p className="font-semibold text-black text-xs sm:text-sm truncate">{session.branches.name}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 min-w-0">
                            <User className="h-3 w-3 sm:h-4 sm:w-4 text-accent flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-medium text-gray-600">Coach</p>
                              <p className="font-semibold text-black text-xs sm:text-sm truncate">{session.coaches.name}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 min-w-0">
                            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-accent flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-medium text-gray-600">Players</p>
                              <p className="font-semibold text-black text-xs sm:text-sm">{session.session_participants?.length || 0}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 min-w-0">
                            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-accent flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-medium text-gray-600">Package</p>
                              <p className="font-semibold text-black text-xs sm:text-sm truncate">{session.package_type || 'N/A'}</p>
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-fit flex-shrink-0">
                            <Badge variant={getStatusBadgeVariant(session.status)} className="font-medium px-2 py-1 text-xs sm:text-sm w-fit">
                              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                            </Badge>
                            <Button
                              onClick={() => handleAttendanceRedirect(session.id)}
                              size="sm"
                              className="bg-accent hover:bg-accent/90 text-white font-medium transition-all duration-300 text-xs sm:text-sm min-w-fit w-full sm:w-auto"
                            >
                              Attendance
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {visibleSessions < selectedDateSessions.length && (
                    <div className="flex justify-center mt-2">
                      <Button
                        onClick={() => setVisibleSessions(prev => prev + 1)}
                        size="sm"
                        variant="outline"
                        className="border-accent text-accent hover:bg-accent hover:text-white text-xs sm:text-sm"
                      >
                        Show More
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 space-y-2">
                  <CalendarIcon className="h-8 w-8 text-gray-300 mx-auto" />
                  <div className="space-y-2">
                    <p className="text-sm sm:text-base text-gray-500">
                      No sessions on this day
                    </p>
                    <p className="text-gray-400 text-xs sm:text-sm max-w-md mx-auto">
                      {filterPackageType !== "All" ? `Try adjusting your package type filter or select a different date.` : `No sessions scheduled for this date.`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Upcoming Sessions Modal */}
        <Dialog open={showUpcomingSessions} onOpenChange={setShowUpcomingSessions}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl lg:max-w-6xl max-h-[60vh] border-2 border-green-200 bg-white shadow-lg p-2 sm:p-4 lg:p-5 overflow-y-auto overflow-x-hidden flex flex-col">
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
                <div className="space-y-2">
                  {upcomingSessions.slice(0, visibleUpcomingSessions).map((session) => (
                    <Card key={session.id} className="border border-green-200 bg-white hover:shadow-md transition-all duration-200">
                      <CardContent className="p-2">
                        <div className="space-y-2 sm:grid sm:grid-cols-2 lg:grid-cols-5 sm:gap-2 sm:items-center">
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
                            <p className="font-semibold text-black text-xs sm:text-sm truncate">{session.branches.name}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-green-600">Coach</p>
                            <p className="font-semibold text-black text-xs sm:text-sm truncate">{session.coaches.name}</p>
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
                  {visibleUpcomingSessions < upcomingSessions.length && (
                    <div className="flex justify-center mt-2">
                      <Button
                        onClick={() => setVisibleUpcomingSessions(prev => prev + 1)}
                        size="sm"
                        variant="outline"
                        className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white text-xs sm:text-sm"
                      >
                        Show More
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 space-y-2">
                  <Clock className="h-8 w-8 text-green-300 mx-auto" />
                  <div className="space-y-2">
                    <p className="text-sm sm:text-base text-green-600">No upcoming sessions</p>
                    <p className="text-green-500 text-xs sm:text-sm">Schedule new training sessions to get started.</p>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Past Sessions Modal */}
        <Dialog open={showPastSessions} onOpenChange={setShowPastSessions}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl lg:max-w-6xl max-h-[60vh] border-2 border-gray-200 bg-white shadow-lg p-2 sm:p-4 lg:p-5 overflow-y-auto overflow-x-hidden flex flex-col">
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
                <div className="space-y-2">
                  {pastSessions.slice(0, visiblePastSessions).map((session) => (
                    <Card key={session.id} className="border border-gray-200 bg-white hover:shadow-md transition-all duration-200">
                      <CardContent className="p-2">
                        <div className="space-y-2 sm:grid sm:grid-cols-2 lg:grid-cols-5 sm:gap-2 sm:items-center">
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
                            <p className="font-semibold text-black text-xs sm:text-sm truncate">{session.branches.name}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-600">Coach</p>
                            <p className="font-semibold text-black text-xs sm:text-sm truncate">{session.coaches.name}</p>
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
                  {visiblePastSessions < pastSessions.length && (
                    <div className="flex justify-center mt-2">
                      <Button
                        onClick={() => setVisiblePastSessions(prev => prev + 1)}
                        size="sm"
                        variant="outline"
                        className="border-gray-600 text-gray-600 hover:bg-gray-600 hover:text-white text-xs sm:text-sm"
                      >
                        Show More
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 space-y-2">
                  <CalendarIcon className="h-8 w-8 text-gray-300 mx-auto" />
                  <div className="space-y-2">
                    <p className="text-sm sm:text-base text-gray-500">No past sessions</p>
                    <p className="text-gray-400 text-xs sm:text-sm">Completed sessions will appear here.</p>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}