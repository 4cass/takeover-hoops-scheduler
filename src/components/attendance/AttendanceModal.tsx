
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Clock, Search, Users } from "lucide-react";
import { format } from "date-fns";
import { TimeTrackingButtons } from "../TimeTrackingButtons";
import { toast } from "sonner";

type AttendanceStatus = "present" | "absent" | "pending";
type AttendanceStatusLiteral = "present" | "absent" | "pending";

interface TrainingSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  branch_id: string;
  status: "scheduled" | "completed" | "cancelled";
  package_type: "Camp Training" | "Personal Training" | null;
  branches: { name: string };
  session_participants: Array<{ students: { name: string } }>;
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  marked_at: string | null;
  students: { name: string };
}

interface SessionCoach {
  coach_id: string;
  coaches: { name: string };
}

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSession: string | null;
  selectedSessionDetails: TrainingSession | null;
  sessionCoaches?: SessionCoach[];
  attendanceRecords?: AttendanceRecord[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  onAttendanceChange: (recordId: string, status: AttendanceStatusLiteral) => void;
  userRole?: string;
}

const formatTime12Hour = (timeString: string) => {
  const [hours, minutes] = timeString.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case "scheduled": return "scheduled";
    case "completed": return "completed"; 
    case "cancelled": return "cancelled";
    default: return "default";
  }
};

const getAttendanceIcon = (status: AttendanceStatusLiteral) => {
  switch (status) {
    case "present": return <CheckCircle className="w-4 h-4 text-green-600" />;
    case "absent": return <XCircle className="w-4 h-4 text-red-600" />;
    case "pending": return <Clock className="w-4 h-4 text-amber-600" />;
    default: return <Clock className="w-4 h-4 text-gray-400" />;
  }
};

const getAttendanceBadgeColor = (status: AttendanceStatusLiteral) => {
  switch (status) {
    case "present": return "bg-green-50 text-green-700 border-green-200";
    case "absent": return "bg-red-50 text-red-700 border-red-200";
    case "pending": return "bg-amber-50 text-amber-700 border-amber-200";
    default: return "bg-gray-50 text-gray-700 border-gray-200";
  }
};

export function AttendanceModal({
  isOpen,
  onClose,
  selectedSession,
  selectedSessionDetails,
  sessionCoaches,
  attendanceRecords,
  searchTerm,
  setSearchTerm,
  onAttendanceChange,
  userRole
}: AttendanceModalProps) {
  const filteredAttendanceRecords = attendanceRecords?.filter((record) =>
    record.students.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const presentCount = filteredAttendanceRecords.filter((r) => r.status === "present").length;
  const absentCount = filteredAttendanceRecords.filter((r) => r.status === "absent").length;
  const pendingCount = filteredAttendanceRecords.filter((r) => r.status === "pending").length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] border-2 border-[#181A18] bg-white shadow-lg p-3 sm:p-4 lg:p-6">
        <div className="flex-1 overflow-y-auto">
          <DialogHeader className="pb-4 border-b border-gray-200 space-y-2 sm:space-y-3">
            <DialogTitle className="text-base sm:text-lg lg:text-xl font-bold text-[#181A18] flex items-center flex-wrap gap-2">
              <span>Manage Attendance</span>
              {selectedSessionDetails && (
                <span className="text-xs sm:text-sm font-normal text-gray-500">
                  - {format(new Date(selectedSessionDetails.date + 'T00:00:00'), 'EEE, MMM dd, yyyy')} at {formatTime12Hour(selectedSessionDetails.start_time)}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-left text-xs sm:text-sm">
              Update attendance for players in this training session
            </DialogDescription>

            <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3 text-xs sm:text-sm lg:text-base">
              <div className="flex flex-row gap-4 sm:gap-6">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="font-medium text-gray-600">Coaches:</span>
                  <span className="text-black truncate">
                    {sessionCoaches?.map(c => c.coaches.name).join(', ') || 'N/A'}
                  </span>
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="font-medium text-gray-600">Branch:</span>
                  <span className="text-black truncate">{selectedSessionDetails?.branches?.name || 'N/A'}</span>
                </div>
              </div>
              <div className="flex flex-row gap-4 sm:gap-6">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="font-medium text-gray-600">Package:</span>
                  <span className="text-black truncate">{selectedSessionDetails?.package_type || 'N/A'}</span>
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="font-medium text-gray-600">Status:</span>
                  <Badge variant={getStatusVariant(selectedSessionDetails?.status || '')} className="text-xs sm:text-sm">
                    {selectedSessionDetails?.status ? selectedSessionDetails.status.charAt(0).toUpperCase() + selectedSessionDetails.status.slice(1) : 'N/A'}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-row gap-4 sm:gap-6">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="font-medium text-gray-600">Players:</span>
                  <span className="text-black truncate">{selectedSessionDetails?.session_participants?.length || 0}</span>
                </div>
              </div>
            </div>
          </DialogHeader>

          {selectedSession && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 lg:p-6 bg-gray-50 rounded-lg">
              <h3 className="text-sm sm:text-base font-semibold text-[#181A18] mb-3">Time Tracking</h3>
              <TimeTrackingButtons sessionId={selectedSession} isAdmin={userRole === 'admin'} />
            </div>
          )}

          <div className="mb-4 sm:mb-6 p-3 sm:p-4 lg:p-6">
            <div className="flex items-center mb-3">
              <Search className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 mr-2" />
              <h3 className="text-sm sm:text-base font-semibold text-[#181A18]">Search Players</h3>
            </div>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by player name..."
                className="pl-8 sm:pl-10 pr-4 py-2 w-full border-2 border-accent/40 rounded-lg text-xs sm:text-sm focus:border-accent focus:ring-1 focus:ring-accent bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ borderColor: '#BEA877' }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 p-3 sm:p-4 lg:p-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
              <span className="text-gray-700">Present: <strong>{presentCount}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
              <span className="text-gray-700">Absent: <strong>{absentCount}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600" />
              <span className="text-gray-700">Pending: <strong>{pendingCount}</strong></span>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 lg:p-6">
            {filteredAttendanceRecords.map((record) => (
              <div 
                key={record.id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200 gap-2 sm:gap-3"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-xs sm:text-sm flex-shrink-0" style={{ backgroundColor: '#BEA877' }}>
                    {record.students.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-black text-xs sm:text-sm lg:text-base block truncate">{record.students.name}</span>
                    <div className="flex items-center space-x-2 mt-1">
                      {getAttendanceIcon(record.status)}
                      <Badge className={`${getAttendanceBadgeColor(record.status)} text-xs sm:text-sm capitalize`}>
                        {record.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-row items-center space-x-2 justify-end sm:justify-start">
                  <Select
                    value={record.status}
                    onValueChange={(value: AttendanceStatusLiteral) => onAttendanceChange(record.id, value)}
                  >
                    <SelectTrigger className="w-24 sm:w-28 lg:w-32 h-7 sm:h-8 lg:h-9 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600" />
                          <span className="text-xs sm:text-sm">Pending</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="present">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                          <span className="text-xs sm:text-sm">Present</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="absent">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />
                          <span className="text-xs sm:text-sm">Absent</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
          
          {filteredAttendanceRecords.length === 0 && (
            <div className="py-8 sm:py-12 text-center p-3 sm:p-4 lg:p-6">
              <Users className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                {searchTerm ? 'No players found' : 'No attendance records'}
              </h3>
              <p className="text-sm sm:text-base text-gray-600">
                {searchTerm 
                  ? 'Try adjusting your search terms.' 
                  : 'No attendance records found for this session.'
                }
              </p>
            </div>
          )}

          <div className="border-t border-gray-200 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 flex flex-row justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-2 border-gray-300 text-gray-700 hover:bg-gray-100 min-w-fit w-auto px-2 sm:px-3 text-xs sm:text-sm"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                toast.success("Attendance saved successfully!");
                onClose();
              }}
              className="bg-accent hover:bg-accent/90 text-white min-w-fit w-auto px-2 sm:px-3 text-xs sm:text-sm"
              style={{ backgroundColor: '#BEA877' }}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
