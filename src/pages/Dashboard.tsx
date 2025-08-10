import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useLocation, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { DashboardStats } from "@/components/DashboardStats";
import { CalendarManager } from "@/components/CalendarManager";
import { CoachCalendarManager } from "@/components/CoachCalendarManager";
import { SessionsManager } from "@/components/SessionsManager";
import { AttendanceManager } from "@/components/AttendanceManager";
import { CoachAttendanceManager } from "@/components/CoachAttendanceManager";
import { StudentsManager } from "@/components/StudentsManager";
import { CoachesManager } from "@/components/CoachesManager";
import { BranchesManager } from "@/components/BranchesManager";
import { PackagesManager } from "@/components/PackagesManager";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  console.log("Dashboard - User:", user?.email, "Role:", role, "Loading:", loading, "Path:", location.pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm w-full responsive-padding">
          <div className="responsive-subheading font-bold text-primary mb-2">Loading Dashboard...</div>
          <div className="responsive-body text-muted-foreground">Please wait while we verify your access.</div>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log("No user found, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  if (!role) {
    console.log("No role found for authenticated user, showing error message");
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md w-full responsive-padding">
          <div className="responsive-subheading font-bold text-destructive mb-2">Access Error</div>
          <div className="responsive-body text-muted-foreground mb-4">
            Your account doesn't have the proper permissions to access this dashboard.
          </div>
          <div className="responsive-small text-muted-foreground mb-4">
            Please contact your administrator to resolve this issue.
          </div>
          <button 
            onClick={() => window.location.href = "/login"}
            className="responsive-button bg-accent text-accent-foreground rounded hover:bg-secondary transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const path = location.pathname;
  const activeTab = 
    path.includes("/dashboard/calendar") ? "calendar" :
    path.includes("/dashboard/sessions") ? "sessions" :
    path.includes("/dashboard/attendance") ? "attendance" :
    path.includes("/dashboard/students") ? "students" :
    path.includes("/dashboard/coaches") ? "coaches" :
    path.includes("/dashboard/branches") ? "branches" :
    path.includes("/dashboard/packages") ? "packages" :
    "overview";

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background flex w-full">
        <AppSidebar activeTab={activeTab} onTabChange={(tab) => navigate(`/dashboard/${tab === "overview" ? "" : tab}`)} />
        <SidebarInset className="flex-1 min-w-0">
          <header className="sticky top-0 z-50 bg-card flex h-12 sm:h-16 shrink-0 items-center gap-2 px-3 sm:px-4 border-b">
            <SidebarTrigger className="text-foreground hover:text-accent hover:bg-muted" />
            <div className="flex-1" />
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/settings")} 
              className="text-foreground hover:text-accent hover:bg-muted"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </header>
          <main className="flex-1 responsive-padding bg-background overflow-x-hidden">
            <Routes>
              <Route path="/" element={<DashboardStats />} />
              
              <Route 
                path="calendar" 
                element={role === 'coach' ? <CoachCalendarManager /> : <CalendarManager />} 
              />
              
              <Route 
                path="attendance" 
                element={role === 'coach' ? <CoachAttendanceManager /> : <AttendanceManager />} 
              />
              <Route 
                path="attendance/:sessionId" 
                element={role === 'coach' ? <CoachAttendanceManager /> : <AttendanceManager />} 
              />
              
              <Route 
                path="sessions" 
                element={<SessionsManager />} // Render for both admin and coach
              />
              <Route 
                path="students" 
                element={<StudentsManager />} // Render for both admin and coach
              />
              
              {role === 'admin' && (
                <>
                  <Route path="coaches" element={<CoachesManager />} />
                  <Route path="branches" element={<BranchesManager />} />
                  <Route path="packages" element={<PackagesManager />} />
                </>
              )}
              
              {role === 'coach' && (
                <>
                  <Route path="coaches" element={<Navigate to="/dashboard" replace />} />
                  <Route path="branches" element={<Navigate to="/dashboard" replace />} />
                  <Route path="packages" element={<Navigate to="/dashboard" replace />} />
                </>
              )}
            </Routes>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}