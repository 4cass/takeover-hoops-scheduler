
import React, { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <DashboardStats />;
      case 'branches':
        return <BranchesManager />;
      case 'coaches':
        return <CoachesManager />;
      case 'sessions':
        return <SessionsManager />;
      case 'attendance':
        return <AttendanceManager />;
      case 'students':
        return <StudentsManager />;
      case 'calendar':
        return <CalendarManager />;
      case 'coach-calendar':
        return <CoachCalendarManager />;
      case 'coach-attendance':
        return <CoachAttendanceManager />;
      default:
        return <DashboardStats />;
    }
  };

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <SidebarInset>
          <div className="p-6">
            {renderContent()}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  );
};

export default Dashboard;
