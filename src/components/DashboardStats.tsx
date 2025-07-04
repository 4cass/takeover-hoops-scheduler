
import { useAuth } from "@/context/AuthContext";
import { AdminDashboardStats } from "./AdminDashboardStats";
import { CoachDashboardStats } from "./CoachDashboardStats";

export function DashboardStats() {
  const { role } = useAuth();

  if (role === 'coach') {
    return <CoachDashboardStats />;
  }

  return <AdminDashboardStats />;
}
