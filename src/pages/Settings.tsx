
import { ChangePassword } from "@/components/ChangePassword";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, User, Shield, LogOut, Mail, Hash, Settings as SettingsIcon, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { UserMenu } from "@/components/UserMenu";
import { useState } from "react";

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    navigate("/dashboard");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-slate-100">
        <AppSidebar activeTab={activeTab} onTabChange={handleTabChange} />
        
        <SidebarInset className="flex-1">
          {/* Header */}
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 bg-white border-b border-slate-200">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <div className="h-6 w-px bg-slate-200" />
              <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
            </div>
            <div className="ml-auto px-4">
              <UserMenu />
            </div>
          </header>

          {/* Main Content */}
          <div className="flex-1 p-6">
            <div className="max-w-6xl mx-auto">
              {/* Page Header */}
              <div className="mb-8">
               
                
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                    <SettingsIcon className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Account Settings</h1>
                    <p className="text-slate-600 text-lg">Manage your account, security, and preferences</p>
                  </div>
                </div>
              </div>

              {/* Content Grid */}
              <div className="grid gap-8 lg:grid-cols-12">
                {/* Primary Content */}
                <div className="lg:col-span-8 space-y-8">
                  {/* Account Overview */}
                  <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-6">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-900">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <User className="h-6 w-6 text-green-600" />
                          </div>
                          Account Information
                        </CardTitle>
                        <div className="px-3 py-1 bg-green-100 border border-green-200 rounded-full">
                          <span className="text-green-700 text-sm font-medium">Active</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-6">
                        <div className="group">
                          <div className="flex items-center justify-between p-6 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all duration-200">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-blue-100 rounded-lg">
                                <Mail className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-slate-600 font-medium mb-1">Email Address</p>
                                <p className="text-slate-900 text-lg font-semibold">{user?.email}</p>
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                          </div>
                        </div>
                        
                        <div className="group">
                          <div className="flex items-center justify-between p-6 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all duration-200">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-purple-100 rounded-lg">
                                <Hash className="h-5 w-5 text-purple-600" />
                              </div>
                              <div>
                                <p className="text-slate-600 font-medium mb-1">User ID</p>
                                <p className="text-slate-900 text-lg font-mono">{user?.id}</p>
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Security Section */}
                  <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-6">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-900">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Shield className="h-6 w-6 text-orange-600" />
                        </div>
                        Security & Privacy
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
                        <ChangePassword />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Quick Actions */}
                  <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <LogOut className="h-5 w-5 text-red-600" />
                        </div>
                        Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button 
                        variant="destructive" 
                        onClick={logout}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 border-0 font-semibold py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                      >
                        <LogOut className="h-5 w-5 mr-3" />
                        Sign Out
                      </Button>
                      
                      <div className="pt-4 border-t border-slate-200">
                        <p className="text-slate-500 text-sm text-center">
                          Need help? <span className="text-blue-600 cursor-pointer hover:underline">Contact Support</span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Account Status */}
                  <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 shadow-sm">
                    <CardContent className="p-6">
                      <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full shadow-lg">
                          <User className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 mb-2">Account Status</h3>
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-green-600 font-medium">All Systems Operational</span>
                          </div>
                          <p className="text-slate-600 text-sm">Your account is secure and fully verified</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Stats Overview */}
                  <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Account Overview</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Last Login</span>
                          <span className="text-slate-900 font-medium">Today</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Account Created</span>
                          <span className="text-slate-900 font-medium">2024</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Security Level</span>
                          <span className="text-green-600 font-medium">High</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
