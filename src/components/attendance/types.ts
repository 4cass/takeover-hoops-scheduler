
export interface TrainingSession {
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

export type AttendanceStatus = "present" | "absent" | "pending";
export type SessionStatus = "scheduled" | "completed" | "cancelled" | "all";
