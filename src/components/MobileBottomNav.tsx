import { useState } from "react";
import { Calendar, Users, MapPin, UserCheck, BookOpen, ClipboardList, Home, LogOut, Package, MoreHorizontal, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const menuItems = [
  { title: "Dashboard", icon: Home, value: "overview", allowedRoles: ['admin', 'coach'], priority: 1 },
  { title: "Calendar", icon: Calendar, value: "calendar", allowedRoles: ['admin', 'coach'], priority: 2 },
  { title: "Sessions", icon: ClipboardList, value: "sessions", allowedRoles: ['admin', 'coach'], priority: 3 },
  { title: "Attendance", icon: UserCheck, value: "attendance", allowedRoles: ['admin', 'coach'], priority: 4 },
  { title: "Players", icon: Users, value: "students", allowedRoles: ['admin'], priority: 5 },
  { title: "Coaches", icon: BookOpen, value: "coaches", allowedRoles: ['admin'], priority: 6 },
  { title: "Branches", icon: MapPin, value: "branches", allowedRoles: ['admin'], priority: 7 },
  { title: "Packages", icon: Package, value: "packages", allowedRoles: ['admin'], priority: 8 },
];

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  const { role, user, logout } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const filteredMenuItems = menuItems
    .filter(item => role && item.allowedRoles.includes(role as 'admin' | 'coach'))
    .sort((a, b) => a.priority - b.priority);

  // Show first 4 items in bottom nav, rest in "More" menu
  const mainNavItems = filteredMenuItems.slice(0, 4);
  const moreNavItems = filteredMenuItems.slice(4);
  const hasMoreItems = moreNavItems.length > 0;

  const handleTabChange = (value: string) => {
    onTabChange(value);
    setIsMoreOpen(false);
  };

  const handleLogout = async () => {
    setIsMoreOpen(false);
    await logout();
  };

  if (!role) return null;

  // Check if active tab is in the "more" section
  const isMoreActive = moreNavItems.some(item => item.value === activeTab);

  return (
    <>
      {/* Bottom Navigation Bar - Mobile Only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#242833] border-t border-[#3a4152]">
        <div className="flex items-center justify-around h-16 px-1 safe-area-pb">
          {mainNavItems.map((item) => {
            const isActive = activeTab === item.value;
            return (
              <button
                key={item.value}
                onClick={() => handleTabChange(item.value)}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 px-1 transition-all duration-200 ${
                  isActive ? "text-white" : "text-white/50"
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl transition-all duration-200 ${
                    isActive ? "bg-[#79e58f] scale-110" : ""
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? "text-white" : ""}`} />
                </div>
                <span className={`text-[10px] mt-0.5 font-medium truncate max-w-full ${
                  isActive ? "text-[#79e58f]" : ""
                }`}>
                  {item.title}
                </span>
              </button>
            );
          })}

          {/* More Button */}
          {hasMoreItems && (
            <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
              <SheetTrigger asChild>
                <button
                  className={`flex flex-col items-center justify-center flex-1 h-full py-1 px-1 transition-all duration-200 ${
                    isMoreActive ? "text-white" : "text-white/50"
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-xl transition-all duration-200 ${
                      isMoreActive ? "bg-[#79e58f] scale-110" : ""
                    }`}
                  >
                    <MoreHorizontal className={`w-5 h-5 ${isMoreActive ? "text-white" : ""}`} />
                  </div>
                  <span className={`text-[10px] mt-0.5 font-medium ${
                    isMoreActive ? "text-[#79e58f]" : ""
                  }`}>
                    More
                  </span>
                </button>
              </SheetTrigger>
              
              <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-3xl bg-[#242833] border-t-0 p-0">
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-2" />
                <SheetHeader className="px-4 pb-3 border-b border-white/10">
                  <SheetTitle className="text-white text-left flex items-center justify-between">
                    <span>More Options</span>
                    <button 
                      onClick={() => setIsMoreOpen(false)}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <X className="w-5 h-5 text-white/60" />
                    </button>
                  </SheetTitle>
                </SheetHeader>
                
                <div className="p-4 space-y-2">
                  {/* More Menu Items */}
                  {moreNavItems.map((item) => {
                    const isActive = activeTab === item.value;
                    return (
                      <button
                        key={item.value}
                        onClick={() => handleTabChange(item.value)}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 ${
                          isActive
                            ? "bg-[#79e58f] text-white"
                            : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <div className={`p-2.5 rounded-xl ${isActive ? "bg-white/20" : "bg-white/10"}`}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        <span className="text-base font-medium">{item.title}</span>
                      </button>
                    );
                  })}

                  {/* Divider */}
                  <div className="border-t border-white/10 my-4" />

                  {/* User Info */}
                  {user && (
                    <div className="px-2 py-3 bg-white/5 rounded-2xl">
                      <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Logged in as</p>
                      <p className="text-sm text-white font-medium truncate">{user.email}</p>
                      <p className="text-xs capitalize text-[#79e58f]">{role}</p>
                    </div>
                  )}

                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all duration-200"
                  >
                    <div className="p-2.5 rounded-xl bg-red-500/20">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <span className="text-base font-medium">Logout</span>
                  </button>
                </div>
                
                {/* Safe area padding for devices with home indicator */}
                <div className="h-6" />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </nav>
    </>
  );
}
