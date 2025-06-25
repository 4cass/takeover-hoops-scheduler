
export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  remaining_sessions: number;
  assigned_branch_id: string;
  created_at: string;
}

export interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string;
  available_days: string[]; // ['monday', 'tuesday', etc.]
  assigned_branch_id: string;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  contact_info: string;
  created_at: string;
}

export interface TrainingSession {
  id: string;
  date: string; // YYYY-MM-DD format
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  branch_id: string;
  coach_id: string;
  player_ids: string[];
  notes?: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  player_id: string;
  status: 'present' | 'absent';
  timestamp: string;
}
