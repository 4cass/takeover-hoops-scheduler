
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { SessionTimeDetails } from "../SessionTimeDetails";

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

interface SessionDetailsModalProps {
  session: TrainingSession | null;
  isOpen: boolean;
  onClose: () => void;
  onManageAttendance: (sessionId: string) => void;
}

const formatTime12Hour = (timeString: string) => {
  const [hours, minutes] = timeString.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString + 'T00:00:00');
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case "scheduled": return "scheduled";
    case "completed": return "completed"; 
    case "cancelled": return "cancelled";
    default: return "default";
  }
};

export function SessionDetailsModal({ session, isOpen, onClose, onManageAttendance }: SessionDetailsModalProps) {
  if (!session) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg lg:max-w-2xl border-2 border-foreground bg-gradient-to-br from-[#faf0e8]/30 to-white shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground flex items-center">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 mr-2 sm:mr-3 text-accent" style={{ color: '#BEA877' }} />
            Session Details
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-sm sm:text-base">
            {formatDate(session.date)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="flex items-center space-x-3">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Time</p>
                <p className="font-semibold text-black text-sm sm:text-base">
                  {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Branch</p>
                <p className="font-semibold text-black text-sm sm:text-base">{session.branches.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Package Type</p>
                <p className="font-semibold text-black text-sm sm:text-base">{session.package_type || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Players</p>
                <p className="font-semibold text-black text-sm sm:text-base">{session.session_participants?.length || 0}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant={getStatusVariant(session.status)} className="font-medium px-2 sm:px-3 py-1 text-xs sm:text-sm">
                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
              </Badge>
            </div>
          </div>

          <div className="border-t pt-4">
            <SessionTimeDetails sessionId={session.id} />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => onManageAttendance(session.id)}
              className="bg-accent hover:bg-accent/90 text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg text-sm sm:text-base px-4 sm:px-6"
              style={{ backgroundColor: '#BEA877' }}
            >
              Manage Attendance
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
