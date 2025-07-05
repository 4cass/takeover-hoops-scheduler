
import { Calendar, Users, MapPin, UserCheck, BookOpen, ClipboardList, Home, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";

const menuItems = [
  { title: "Dashboard", icon: Home, value: "overview", allowedRoles: ['admin', 'coach'] },
  { title: "Calendar", icon: Calendar, value: "calendar", allowedRoles: ['admin', 'coach'] },
  { title: "Sessions", icon: ClipboardList, value: "sessions", allowedRoles: ['admin'] },
  { title: "Attendance", icon: UserCheck, value: "attendance", allowedRoles: ['admin', 'coach'] },
  { title: "Players", icon: Users, value: "students", allowedRoles: ['admin'] },
  { title: "Coaches", icon: BookOpen, value: "coaches", allowedRoles: ['admin'] },
  { title: "Branches", icon: MapPin, value: "branches", allowedRoles: ['admin'] },
];

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const { setOpen, isMobile } = useSidebar();
  const { role, user, logout } = useAuth();

  const handleTabChange = (value: string) => {
    onTabChange(value);
    if (isMobile) {
      setOpen(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter(item => 
    role && item.allowedRoles.includes(role as 'admin' | 'coach')
  );

  if (!role) {
    return null; // Don't render sidebar if no role is determined
  }

  return (
    <Sidebar className="border-r bg-[#181A18]">
      <SidebarHeader className="p-6 border-b bg-[#181A18] border-[#181A18]">
        <div className="flex items-center gap-3">
          <div className="w-30 h-30 bg-[#181A18] rounded-lg flex items-center justify-center">
            <img src="/1.png" alt="Logo" className="h-20 w-20 object-contain" />
          </div>
          <div className="flex bg-[#181A18] flex-col">
            <h2 className="text-xl font-bold tracking-tight text-white">Takeover Basketball</h2>
            <p className="text-sm text-white/80">Management System</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-4 bg-[#181A18]">
        <SidebarGroup>
          <SidebarGroupLabel className="px-6 text-xs font-bold uppercase tracking-wider text-white/60">
            Navigation
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.value} className="mb-2">
                  <SidebarMenuButton
                    onClick={() => handleTabChange(item.value)}
                    isActive={activeTab === item.value}
                    className={`w-full justify-start py-3 px-6 rounded-lg transition-all duration-200 ${
                      activeTab === item.value
                        ? "bg-accent text-white font-medium"
                        : "text-white/70 hover:bg-accent hover:text-white"
                    }`}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    <span className="text-sm">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t bg-[#181A18]">
        <div className="flex flex-col space-y-3">
          {user && (
            <div className="px-2 py-1">
              <p className="text-xs text-white/60 uppercase tracking-wider">Logged in as</p>
              <p className="text-sm text-white font-medium truncate">{user.email}</p>
              <p className="text-xs text-accent capitalize">{role}</p>
            </div>
          )}
          <SidebarMenuButton
            onClick={handleLogout}
            className="w-full justify-start py-2 px-3 rounded-lg transition-all duration-200 text-white/70 hover:bg-red-600 hover:text-white"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span className="text-sm">Logout</span>
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
