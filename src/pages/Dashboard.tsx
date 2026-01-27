import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
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
import StudentPaymentPage from "./StudentPaymentPage";
import StudentViewPage from "./StudentViewPage";
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
    (path.includes("/dashboard/students") && !path.includes("/payments") && !path.includes("/view")) ? "students" :
    path.includes("/dashboard/coaches") ? "coaches" :
    path.includes("/dashboard/branches") ? "branches" :
    path.includes("/dashboard/packages") ? "packages" :
    "overview";

  const handleTabChange = (tab: string) => {
    navigate(`/dashboard/${tab === "overview" ? "" : tab}`);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background flex w-full">
        {/* Sidebar - Hidden on mobile */}
        <div className="hidden md:block">
          <AppSidebar activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
        
        <SidebarInset className="flex-1 min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-[#242833] flex h-14 sm:h-16 shrink-0 items-center gap-2 px-3 sm:px-4 border-b border-[#3a4152]">
            {/* Sidebar trigger - only on tablet and up */}
            <SidebarTrigger className="hidden md:flex text-white hover:text-[#79e58f] hover:bg-white/10" />
            
            {/* Logo for mobile */}
            <div className="flex md:hidden items-center gap-2">
              <img 
                src="/lovable-uploads/dcb5b3e4-1037-41ed-bf85-c78cee85066e.png" 
                alt="Logo" 
                className="w-8 h-8 object-contain"
              />
              <span className="text-white font-bold text-sm">Takeover</span>
            </div>
            
            <div className="flex-1" />
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/settings")} 
              className="text-white hover:text-[#79e58f] hover:bg-white/10"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </header>
          
          {/* Main Content */}
          <main className="flex-1 bg-background overflow-x-hidden">
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
                element={<SessionsManager />}
              />
              <Route 
                path="students" 
                element={<StudentsManager />}
              />
              <Route 
                path="students/:studentId/payments" 
                element={<StudentPaymentPage />}
              />
              <Route 
                path="students/:studentId/view" 
                element={<StudentViewPage />}
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
        
        {/* Mobile Bottom Navigation */}
        <MobileBottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
    </SidebarProvider>
  );
}
