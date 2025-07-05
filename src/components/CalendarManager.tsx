import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarIcon, Users, Clock, MapPin, User, ChevronLeft, ChevronRight, Filter, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isBefore, addMonths, subMonths, isAfter, parseISO } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/context/AuthContext";
import { CoachCalendarManager } from "./CoachCalendarManager";

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

  // If user is a coach, show coach-specific calendar
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
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-background pt-4 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#181A18] mb-2 tracking-tight">
            Calendar
          </h1>
          <p className="text-base sm:text-lg text-gray-700">
            Manage and view all basketball training sessions
          </p>
        </div>

        {/* Main Calendar Card */}
        <Card className="border-2 border-[#181A18] bg-white shadow-xl">
          <CardHeader className="border-b border-[#181A18] bg-[#181A18]">
            <CardTitle className="text-xl sm:text-2xl font-bold text-[#efeff1] flex items-center">
              <CalendarIcon className="h-5 sm:h-6 w-5 sm:w-6 mr-3 text-accent" style={{ color: 'accent' }} />
              Monthly Overview
            </CardTitle>
            <CardDescription className="text-gray-400 text-sm sm:text-base">
              View and manage training sessions for {format(currentMonth, 'MMMM yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            
            {/* Filters */}
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <Filter className="h-4 sm:h-5 w-4 sm:w-5 text-accent mr-2" style={{ color: 'accent' }} />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Filter Sessions</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700">Coach</label>
                  <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                    <SelectTrigger className="border-2 border-accent focus:border-[accent] focus:ring-[accent]/20 rounded-lg text-sm py-2 w-full">
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
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700">Branch</label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="border-2 border-accent focus:border-[accent] focus:ring-[accent]/20 rounded-lg text-sm py-2 w-full">
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
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700">Package Type</label>
                  <Select
                    value={filterPackageType}
                    onValueChange={(value: "All" | "Camp Training" | "Personal Training") => setFilterPackageType(value)}
                  >
                    <SelectTrigger className="border-2 border-accent focus:border-[accent] focus:ring-[accent]/20 rounded-lg text-sm py-2 w-full">
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 gap-4">
                <p className="text-sm text-gray-600">
                  Showing {filteredSessions.length} session{filteredSessions.length === 1 ? '' : 'es'}
                </p>
                {/* Quick Access Buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setShowUpcomingSessions(true)}
                    variant="outline"
                    size="sm"
                    className="border-green-500/30 text-green-600 hover:bg-green-500 hover:text-white transition-all duration-300 w-full sm:w-auto min-w-fit"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Upcoming ({upcomingSessions.length})
                  </Button>
                  <Button
                    onClick={() => setShowPastSessions(true)}
                    variant="outline"
                    size="sm"
                    className="border-gray-500/30 text-gray-600 hover:bg-gray-500 hover:text-white transition-all duration-300 w-full sm:w-auto min-w-fit"
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Past ({pastSessions.length})
                  </Button>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="border-2 border-[#181A18] rounded-xl p-4 sm:p-6 bg-white shadow-lg">
              
              {/* Calendar Navigation */}
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <Button
                  onClick={handlePrevMonth}
                  variant="outline"
                  size="sm"
                  className="border-[#8e7a3f] text-[#8e7a3f] hover:bg-[#8e7a3f] hover:text-white transition-all duration-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="text-lg sm:text-2xl font-bold text-black">
                  {format(currentMonth, 'MMMM yyyy')}
                </h3>
                <Button
                  onClick={handleNextMonth}
                  variant="outline"
                  size="sm"
                  className="border-[#8e7a3f] text-[#8e7a3f] hover:bg-[#8e7a3f] hover:text-white transition-all duration-300"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Days of Week Header */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-4">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                  <div key={day} className="text-center py-2 sm:py-3 bg-[#181A18] text-white font-semibold rounded-lg text-xs sm:text-sm">
                    {day.slice(0, 3)}
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
                        relative p-2 sm:p-3 h-16 sm:h-20 rounded-lg text-left transition-all duration-300 hover:scale-105 hover:shadow-lg
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
                      style={{ borderColor: daySessions.length > 0 || isSelected ? 'accent' : undefined }}
                    >
                      <div className="font-semibold text-sm sm:text-lg mb-1">
                        {format(day, 'd')}
                      </div>
                      {daySessions.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs opacity-90 truncate">
                            {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
                          </div>
                          <div className="flex space-x-1">
                            {hasScheduled && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
                            {hasCompleted && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                            {hasCancelled && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {/* Legend */}
              <div className="mt-4 sm:mt-6 flex flex-wrap gap-3 sm:gap-4 justify-center text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">Scheduled</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600">Cancelled</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sessions Modal */}
        <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
          <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-6xl border-2 border-[#181A18] bg-white shadow-lg overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
                <Eye className="h-4 sm:h-5 w-4 sm:w-5 mr-3 text-accent" style={{ color: 'accent' }} />
                Sessions on {selectedDate ? format(selectedDate, 'EEEE, MMMM dd, yyyy') : ''}
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-sm sm:text-base">
                View session details for the selected date
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedDateSessions.length > 0 ? (
                <div className="space-y-4">
                  {selectedDateSessions.map(session => (
                    <Card key={session.id} className="border border-[#181A18] bg-white hover:shadow-lg transition-all duration-300">
                      <CardContent className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 sm:gap-4 items-center">
                          <div className="flex items-center space-x-2 min-w-0">
                            <Clock className="h-4 w-4 text-accent flex-shrink-0" style={{ color: 'accent' }} />
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-600">Time</p>
                              <p className="font-semibold text-black text-sm truncate">
                                {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 min-w-0">
                            <MapPin className="h-4 w-4 text-accent flex-shrink-0" style={{ color: 'accent' }} />
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-600">Branch</p>
                              <p className="font-semibold text-black text-sm truncate">{session.branches.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 min-w-0">
                            <User className="h-4 w-4 text-accent flex-shrink-0" style={{ color: 'accent' }} />
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-600">Coach</p>
                              <p className="font-semibold text-black text-sm truncate">{session.coaches.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 min-w-0">
                            <Users className="h-4 w-4 text-accent flex-shrink-0" style={{ color: 'accent' }} />
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-600">Players</p>
                              <p className="font-semibold text-black text-sm">{session.session_participants?.length || 0}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 min-w-0">
                            <Users className="h-4 w-4 text-accent flex-shrink-0" style={{ color: 'accent' }} />
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-600">Package</p>
                              <p className="font-semibold text-black text-sm truncate">{session.package_type || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 min-w-0">
                            <Badge variant={getStatusBadgeVariant(session.status)} className="font-medium px-2 sm:px-3 py-1 text-xs sm:text-sm truncate">
                              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                            </Badge>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              onClick={() => handleAttendanceRedirect(session.id)}
                              className="bg-accent hover:bg-[accent]/90 text-white font-medium transition-all duration-300 w-full sm:w-auto min-w-fit text-xs sm:text-sm"
                              style={{ backgroundColor: 'accent' }}
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
                  <CalendarIcon className="h-12 sm:h-16 w-12 sm:w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-lg sm:text-xl text-gray-500 mb-2">
                    No sessions on this day
                  </p>
                  <p className="text-gray-400 text-sm sm:text-base">
                    {filterPackageType !== "All" ? `Try adjusting your package type filter or select a different date.` : `No sessions scheduled for this date.`}
                  </p>
                </div>
              )}
            </div>
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
              <DialogDescription className="text-green-600 text-sm sm:text-base">
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
                            <p className="text-xs sm:text-sm font-medium text-green-600">Date</p>
                            <p className="font-semibold text-black text-sm truncate">{format(parseISO(session.date), 'MMM dd, yyyy')}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-green-600">Time</p>
                            <p className="font-semibold text-black text-sm truncate">
                              {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-green-600">Branch</p>
                            <p className="font-semibold text-black text-sm truncate">{session.branches.name}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-green-600">Coach</p>
                            <p className="font-semibold text-black text-sm truncate">{session.coaches.name}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-green-600">Players</p>
                            <p className="font-semibold text-black text-sm">{session.session_participants?.length || 0}</p>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              onClick={() => {
                                setShowUpcomingSessions(false);
                                handleAttendanceRedirect(session.id);
                              }}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto min-w-fit text-xs sm:text-sm"
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
                  <p className="text-lg sm:text-xl text-green-600 mb-2">No upcoming sessions</p>
                  <p className="text-green-500 text-sm sm:text-base">Schedule new training sessions to get started.</p>
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
              <DialogDescription className="text-gray-600 text-sm sm:text-base">
                All completed sessions and sessions before today
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
                            <p className="text-xs sm:text-sm font-medium text-gray-600">Date</p>
                            <p className="font-semibold text-black text-sm truncate">{format(parseISO(session.date), 'MMM dd, yyyy')}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-600">Time</p>
                            <p className="font-semibold text-black text-sm truncate">
                              {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-600">Branch</p>
                            <p className="font-semibold text-black text-sm truncate">{session.branches.name}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-600">Coach</p>
                            <p className="font-semibold text-black text-sm truncate">{session.coaches.name}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-600">Players</p>
                            <p className="font-semibold text-black text-sm">{session.session_participants?.length || 0}</p>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              onClick={() => {
                                setShowPastSessions(false);
                                handleAttendanceRedirect(session.id);
                              }}
                              size="sm"
                              className="bg-gray-600 hover:bg-gray-700 text-white w-full sm:w-auto min-w-fit text-xs sm:text-sm"
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
                  <p className="text-lg sm:text-xl text-gray-500 mb-2">No past sessions</p>
                  <p className="text-gray-400 text-sm sm:text-base">Completed sessions will appear here.</p>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
