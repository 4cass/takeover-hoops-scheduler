
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
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
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
    case "scheduled": return "bg-blue-100 text-blue-700 border-blue-200";
    case "completed": return "bg-green-100 text-green-700 border-green-200";
    case "cancelled": return "bg-red-100 text-red-700 border-red-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

export function CoachCalendarManager() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
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

  const sessionsOnSelectedDate = sessions?.filter((session) =>
    selectedDate && isSameDay(parseISO(session.date), selectedDate)
  ) || [];

  const datesWithSessions = sessions?.map(session => parseISO(session.date)) || [];

  const handleManageAttendance = (sessionId: string) => {
    navigate(`/dashboard/attendance/${sessionId}`);
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-8">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-[#181A18] mb-2 tracking-tight">
            Training Calendar
          </h1>
          <p className="text-base sm:text-lg text-gray-700">
            View and manage your training sessions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          {/* Calendar Section */}
          <Card className="border-2 border-[#181A18] bg-white/90 backdrop-blur-sm shadow-xl">
            <CardHeader className="border-b border-[#181A18] bg-[#181A18] p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg sm:text-2xl font-bold text-[#efeff1] flex items-center">
                  <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-accent" />
                  {format(currentMonth, 'MMMM yyyy')}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={handlePreviousMonth}
                    variant="outline"
                    size="sm"
                    className="border-accent text-accent hover:bg-accent hover:text-white h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleNextMonth}
                    variant="outline"
                    size="sm"
                    className="border-accent text-accent hover:bg-accent hover:text-white h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription className="text-gray-400 text-sm sm:text-base">
                Click on a date to view sessions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <div className="w-full overflow-x-auto">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  className="w-full min-w-[280px]"
                  classNames={{
                    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
                    month: "space-y-4 w-full",
                    caption: "flex justify-center pt-1 relative items-center",
                    caption_label: "text-sm font-medium",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-accent text-accent hover:bg-accent hover:text-white",
                    nav_button_previous: "absolute left-1",
                    nav_button_next: "absolute right-1",
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex w-full",
                    head_cell: "text-muted-foreground rounded-md w-full font-normal text-[0.8rem] flex-1 text-center",
                    row: "flex w-full mt-2",
                    cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 flex-1",
                    day: "h-8 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-white rounded-md transition-colors",
                    day_range_end: "day-range-end",
                    day_selected: "bg-accent text-white hover:bg-accent hover:text-white focus:bg-accent focus:text-white",
                    day_today: "bg-gray-100 text-gray-900 font-semibold",
                    day_outside: "text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                    day_disabled: "text-muted-foreground opacity-50",
                    day_range_middle: "aria-selected:bg-accent aria-selected:text-white",
                    day_hidden: "invisible",
                  }}
                  modifiers={{
                    hasSession: datesWithSessions,
                  }}
                  modifiersClassNames={{
                    hasSession: "bg-orange-100 text-orange-800 font-semibold border border-orange-300",
                  }}
                />
              </div>
              
              {/* Legend */}
              <div className="mt-4 flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-accent rounded"></div>
                  <span className="text-gray-700">Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
                  <span className="text-gray-700">Has Sessions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-100 rounded"></div>
                  <span className="text-gray-700">Today</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sessions Section */}
          <Card className="border-2 border-[#181A18] bg-white/90 backdrop-blur-sm shadow-xl">
            <CardHeader className="border-b border-[#181A18] bg-[#181A18] p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-2xl font-bold text-[#efeff1] flex items-center">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-accent" />
                Sessions for {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'Selected Date'}
              </CardTitle>
              <CardDescription className="text-gray-400 text-sm sm:text-base">
                {sessionsOnSelectedDate.length} session{sessionsOnSelectedDate.length === 1 ? '' : 's'} scheduled
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {sessionsOnSelectedDate.length > 0 ? (
                <div className="space-y-3 sm:space-y-4 max-h-96 overflow-y-auto">
                  {sessionsOnSelectedDate.map((session) => (
                    <Card
                      key={session.id}
                      className="border-2 border-accent/20 bg-white hover:border-accent/50 transition-all duration-300 hover:shadow-md cursor-pointer"
                      onClick={() => setSelectedSession(session)}
                    >
                      <CardContent className="p-3 sm:p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-accent" />
                            <span className="font-semibold text-black text-sm sm:text-base">
                              {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                            </span>
                          </div>
                          <Badge className={`${getStatusBadgeColor(session.status)} border text-xs px-2 py-1 w-fit`}>
                            {session.status}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-xs sm:text-sm">
                          <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-accent flex-shrink-0" />
                            <span className="text-gray-700">{session.branches.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-accent flex-shrink-0" />
                            <span className="text-gray-700">{session.package_type || 'N/A'}</span>
                          </div>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleManageAttendance(session.id);
                          }}
                          className="w-full bg-accent hover:bg-accent/90 text-white font-medium transition-all duration-300 text-sm"
                          size="sm"
                        >
                          Manage Attendance
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="py-8 sm:py-12 text-center">
                  <CalendarDays className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                    No sessions scheduled
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600">
                    {selectedDate ? `No training sessions on ${format(selectedDate, 'MMM dd, yyyy')}` : 'Select a date to view sessions'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Session Details Modal */}
        <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl border-2 border-foreground bg-gradient-to-br from-[#faf0e8]/30 to-white shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground flex items-center">
                <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-accent" />
                Session Details
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-sm sm:text-base">
                {selectedSession ? format(parseISO(selectedSession.date), 'EEEE, MMMM dd, yyyy') : ''}
              </DialogDescription>
            </DialogHeader>
            {selectedSession && (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Time</p>
                      <p className="font-semibold text-black text-sm sm:text-base">
                        {formatTime12Hour(selectedSession.start_time)} - {formatTime12Hour(selectedSession.end_time)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Branch</p>
                      <p className="font-semibold text-black text-sm sm:text-base">{selectedSession.branches.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium text-gray-600">Package Type</p>
                      <p className="font-semibold text-black text-sm sm:text-base">{selectedSession.package_type || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge className={`${getStatusBadgeColor(selectedSession.status)} border font-medium px-2 sm:px-3 py-1 text-xs sm:text-sm w-fit`}>
                      {selectedSession.status.charAt(0).toUpperCase() + selectedSession.status.slice(1)}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedSession(null)}
                    className="order-2 sm:order-1"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      handleManageAttendance(selectedSession.id);
                      setSelectedSession(null);
                    }}
                    className="bg-accent hover:bg-accent/90 text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg order-1 sm:order-2"
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
