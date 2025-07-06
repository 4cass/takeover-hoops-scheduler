
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import { TimeTrackingButtons } from "../TimeTrackingButtons";

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

interface SessionCardProps {
  session: TrainingSession;
  selectedSession: string | null;
  onSessionClick: (session: TrainingSession) => void;
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

export function SessionCard({ session, selectedSession, onSessionClick, userRole }: SessionCardProps) {
  return (
    <Card
      key={session.id}
      className={`cursor-pointer border-2 transition-all duration-300 hover:scale-105 hover:shadow-lg ${
        selectedSession === session.id
          ? "border-accent bg-accent/10 shadow-lg scale-105"
          : "border-accent/20 bg-white hover:border-accent/50"
      }`}
      onClick={() => onSessionClick(session)}
      style={{ borderColor: '#BEA877' }}
    >
      <CardContent className="p-3 sm:p-4 lg:p-5 space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-accent" style={{ color: '#BEA877' }} />
            <span className="font-semibold text-black text-xs sm:text-sm">
              {format(new Date(session.date + 'T00:00:00'), 'MMM dd, yyyy')}
            </span>
          </div>
          <Badge variant={getStatusVariant(session.status)} className="text-xs font-medium">
            {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
          </Badge>
        </div>
        <div className="space-y-2 text-xs sm:text-sm">
          <div className="flex items-center space-x-2">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
            <span className="text-gray-700 font-medium">
              {formatTime12Hour(session.start_time)} - {formatTime12Hour(session.end_time)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
            <span className="text-gray-700 truncate">{session.branches.name}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="w-3 h-3 sm:w-4 sm:h-4 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
            <span className="text-gray-700 truncate">{session.package_type || 'N/A'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="w-3 h-3 sm:w-4 sm:h-4 text-accent flex-shrink-0" style={{ color: '#BEA877' }} />
            <span className="text-gray-700 truncate">Players: {session.session_participants?.length || 0}</span>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200">
            <TimeTrackingButtons sessionId={session.id} isAdmin={userRole === 'admin'} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
