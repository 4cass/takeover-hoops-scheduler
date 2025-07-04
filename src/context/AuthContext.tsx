
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";

type AuthContextType = {
  user: User | null;
  role: 'admin' | 'coach' | null;
  coachData: any | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  role: null, 
  coachData: null,
  loading: true,
  logout: async () => {},
});

// Helper function to validate role
const isValidRole = (role: string): role is 'admin' | 'coach' => {
  return role === 'admin' || role === 'coach';
};

// Clean up auth state utility
const cleanupAuthState = () => {
  // Remove all Supabase auth keys from localStorage
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  // Remove from sessionStorage if in use
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      sessionStorage.removeItem(key);
    }
  });
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'coach' | null>(null);
  const [coachData, setCoachData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    try {
      console.log("Starting logout process...");
      
      // Clean up auth state first
      cleanupAuthState();
      
      // Clear local state
      setUser(null);
      setRole(null);
      setCoachData(null);
      
      // Attempt global sign out with error handling
      try {
        const { error } = await supabase.auth.signOut({ scope: 'global' });
        if (error) {
          console.log("Logout error (continuing anyway):", error.message);
        }
      } catch (signOutError) {
        console.log("Sign out attempt failed (continuing anyway):", signOutError);
      }
      
      toast.success("Logged out successfully");
      
      // Force page reload for clean state
      window.location.href = "/";
    } catch (error: any) {
      console.error("Logout process error:", error);
      // Even if there's an error, still redirect to clean state
      cleanupAuthState();
      setUser(null);
      setRole(null);
      setCoachData(null);
      toast.success("Logged out");
      window.location.href = "/";
    }
  };

  const fetchUserRole = async (currentUser: User) => {
    try {
      console.log("Fetching role for user:", currentUser.email, "User ID:", currentUser.id);
      
      // First, try to find the user in coaches table by email
      const { data: coachRecord, error: coachError } = await supabase
        .from("coaches")
        .select("*")
        .eq("email", currentUser.email)
        .maybeSingle();

      console.log("Coach record found:", coachRecord);
      console.log("Coach query error:", coachError);

      if (coachError) {
        console.error("Error fetching coach record:", coachError);
        toast.error("Failed to fetch user profile: " + coachError.message);
        setRole(null);
        setCoachData(null);
        return;
      }

      if (coachRecord) {
        console.log("Found coach record:", coachRecord);
        console.log("Coach role from DB:", coachRecord.role);
        
        // Update auth_id if it's missing
        if (!coachRecord.auth_id) {
          console.log("Updating auth_id for coach...");
          const { error: updateError } = await supabase
            .from("coaches")
            .update({ auth_id: currentUser.id })
            .eq("id", coachRecord.id);
          
          if (updateError) {
            console.error("Error updating auth_id:", updateError);
          } else {
            console.log("Successfully updated auth_id");
            coachRecord.auth_id = currentUser.id;
          }
        }

        const dbRole = coachRecord.role;
        console.log("Processing role:", dbRole, "Type:", typeof dbRole);
        
        if (dbRole && isValidRole(dbRole)) {
          console.log("Setting role to:", dbRole);
          setRole(dbRole);
          setCoachData(coachRecord);
          toast.success(`Welcome back! Logged in as ${dbRole}`);
        } else {
          console.log("Invalid or missing role in database:", dbRole);
          // Check if this specific email should be admin
          if (currentUser.email === 'chaewonniya@gmail.com') {
            console.log("Detected admin email, setting role to admin and updating DB");
            setRole('admin');
            setCoachData({ ...coachRecord, role: 'admin' });
            
            // Update the database with admin role
            const { error: updateRoleError } = await supabase
              .from("coaches")
              .update({ role: 'admin' })
              .eq("id", coachRecord.id);
            
            if (updateRoleError) {
              console.error("Error updating role to admin:", updateRoleError);
            } else {
              console.log("Successfully updated role to admin");
            }
            
            toast.success("Welcome back, Admin!");
          } else {
            console.log("Setting default role to 'coach'");
            setRole('coach');
            setCoachData({ ...coachRecord, role: 'coach' });
            
            // Update the database with the default role
            const { error: updateRoleError } = await supabase
              .from("coaches")
              .update({ role: 'coach' })
              .eq("id", coachRecord.id);
            
            if (updateRoleError) {
              console.error("Error updating role to default:", updateRoleError);
            }
          }
        }
      } else {
        console.log("No coach record found for user");
        
        // Check if this is the admin email that needs a record created
        if (currentUser.email === 'chaewonniya@gmail.com') {
          console.log("Creating admin coach record");
          const { data: newCoachRecord, error: createError } = await supabase
            .from("coaches")
            .insert({
              name: currentUser.email.split('@')[0],
              email: currentUser.email,
              role: 'admin',
              auth_id: currentUser.id
            })
            .select()
            .single();
          
          if (createError) {
            console.error("Error creating admin coach record:", createError);
            toast.error("Failed to create admin profile: " + createError.message);
            setRole(null);
            setCoachData(null);
          } else {
            console.log("Successfully created admin coach record:", newCoachRecord);
            setRole('admin');
            setCoachData(newCoachRecord);
            toast.success("Admin profile created successfully!");
          }
        } else {
          toast.error("No coach profile found. Please contact administrator.");
          setRole(null);
          setCoachData(null);
        }
      }
    } catch (error) {
      console.error("Exception while fetching role:", error);
      toast.error("An error occurred while loading user profile");
      setRole(null);
      setCoachData(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check current session
    const fetchSession = async () => {
      try {
        console.log("Fetching current session...");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Error fetching session:", sessionError.message);
          if (mounted) {
            setUser(null);
            setRole(null);
            setCoachData(null);
            setLoading(false);
          }
          return;
        }

        if (session?.user && mounted) {
          console.log("Found existing session for user:", session.user.email);
          setUser(session.user);
          await fetchUserRole(session.user);
        } else {
          console.log("No existing session found");
          if (mounted) {
            setUser(null);
            setRole(null);
            setCoachData(null);
          }
        }

        if (mounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error in fetchSession:", error);
        if (mounted) {
          setUser(null);
          setRole(null);
          setCoachData(null);
          setLoading(false);
        }
      }
    };

    fetchSession();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.email);
      
      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        // Use setTimeout to prevent potential deadlocks
        setTimeout(() => {
          if (mounted) {
            fetchUserRole(session.user);
          }
        }, 100);
      } else {
        setUser(null);
        setRole(null);
        setCoachData(null);
      }
      
      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, coachData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
