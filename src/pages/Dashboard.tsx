
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardStats } from '@/components/DashboardStats';
import BranchesManager from '@/components/BranchesManager';
import CoachesManager from '@/components/CoachesManager';
import SessionsManager from '@/components/SessionsManager';
import AttendanceManager from '@/components/AttendanceManager';
import StudentsManager from '@/components/StudentsManager';
import { CalendarManager } from '@/components/CalendarManager';
import { CoachCalendarManager } from '@/components/CoachCalendarManager';
import { CoachAttendanceManager } from '@/components/CoachAttendanceManager';
import ProtectedRoute from '@/components/ProtectedRoute';

const Dashboard = () => {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="p-6">
            <Routes>
              <Route path="/" element={<DashboardStats />} />
              <Route path="/branches" element={<BranchesManager />} />
              <Route path="/coaches" element={<CoachesManager />} />
              <Route path="/sessions" element={<SessionsManager />} />
              <Route path="/attendance" element={<AttendanceManager />} />
              <Route path="/students" element={<StudentsManager />} />
              <Route path="/calendar" element={<CalendarManager />} />
              <Route path="/coach-calendar" element={<CoachCalendarManager />} />
              <Route path="/coach-attendance" element={<CoachAttendanceManager />} />
              <Route path="/coach-attendance/:sessionId" element={<CoachAttendanceManager />} />
            </Routes>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  );
};

export default Dashboard;
