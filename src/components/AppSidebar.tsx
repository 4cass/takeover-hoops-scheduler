import { Calendar, Users, MapPin, UserCheck, BookOpen, ClipboardList, Home, LogOut, Package } from "lucide-react";
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
  { title: "Sessions", icon: ClipboardList, value: "sessions", allowedRoles: ['admin', 'coach'] }, // Updated to include 'coach'
  { title: "Attendance", icon: UserCheck, value: "attendance", allowedRoles: ['admin', 'coach'] },
  { title: "Players", icon: Users, value: "students", allowedRoles: ['admin'] },
  { title: "Coaches", icon: BookOpen, value: "coaches", allowedRoles: ['admin'] },
  { title: "Branches", icon: MapPin, value: "branches", allowedRoles: ['admin'] },
  { title: "Packages", icon: Package, value: "packages", allowedRoles: ['admin'] },
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

  const filteredMenuItems = menuItems.filter(item => 
    role && item.allowedRoles.includes(role as 'admin' | 'coach')
  );

  if (!role) {
    return null;
  }

  return (
    <Sidebar className="border-r bg-[#242833]">
      <SidebarHeader className="p-3 sm:p-4 md:p-6 border-b bg-[#242833] border-[#242833]">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 flex items-center justify-center flex-shrink-0">
            <img 
              src="/lovable-uploads/dcb5b3e4-1037-41ed-bf85-c78cee85066e.png" 
              alt="Takeover Basketball Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-sm sm:text-base md:text-xl font-bold tracking-tight text-white truncate">Takeover Basketball</h2>
            <p className="text-xs sm:text-sm text-white/80 truncate">Management System</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2 sm:pt-4 bg-[#242833]">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 sm:px-6 text-xs font-bold uppercase tracking-wider text-white/60">
            Navigation
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.value} className="mb-1 sm:mb-2">
                  <SidebarMenuButton
                    onClick={() => handleTabChange(item.value)}
                    isActive={activeTab === item.value}
                    className={`w-full justify-start py-2 sm:py-3 px-4 sm:px-6 rounded-lg transition-all duration-200 ${
                      activeTab === item.value
                        ? "text-white font-medium"
                        : "text-white/70"
                    }`}
                    style={activeTab === item.value 
                      ? { backgroundColor: '#79e58f' }
                      : {} 
                    }
                    onMouseEnter={(e) => {
                      if (activeTab !== item.value) {
                        e.currentTarget.style.backgroundColor = '#79e58f';
                        e.currentTarget.style.color = 'white';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeTab !== item.value) {
                        e.currentTarget.style.backgroundColor = '';
                        e.currentTarget.style.color = '';
                      }
                    }}
                  >
                    <item.icon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" />
                    <span className="text-xs sm:text-sm">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 sm:p-4 border-t bg-[#242833]">
        <div className="flex flex-col space-y-2 sm:space-y-3">
          {user && (
            <div className="px-2 py-1">
              <p className="text-xs text-white/60 uppercase tracking-wider">Logged in as</p>
              <p className="text-xs sm:text-sm text-white font-medium truncate">{user.email}</p>
              <p className="text-xs capitalize" style={{ color: '#79e58f' }}>{role}</p>
            </div>
          )}
          <SidebarMenuButton
            onClick={handleLogout}
            className="w-full justify-start py-2 px-3 rounded-lg transition-all duration-200 text-white/70 hover:bg-red-600 hover:text-white"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span className="text-xs sm:text-sm">Logout</span>
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}