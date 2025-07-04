
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail, Lock } from "lucide-react";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  useEffect(() => {
    // Check for hash parameters (Supabase uses hash fragments)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const error = hashParams.get('error');
    const errorDescription = hashParams.get('error_description');

    console.log('Hash params:', { accessToken, refreshToken, error, errorDescription });

    if (error) {
      if (error === 'access_denied' && errorDescription?.includes('expired')) {
        toast.error("Password reset link has expired. Please request a new one.");
      } else {
        toast.error(`Error: ${errorDescription || error}`);
      }
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (accessToken && refreshToken) {
      // Set the session with the tokens from the email link
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(({ data, error }) => {
        if (error) {
          console.error('Error setting session:', error);
          toast.error("Invalid or expired reset link. Please request a new one.");
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (data.session) {
          console.log('Session set successfully');
          setIsResettingPassword(true);
          toast.success("Ready to reset your password!");
          // Clean up the URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      });
    }
  }, []);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/forgot-password`,
      });

      if (error) {
        toast.error("Error: " + error.message);
      } else {
        toast.success("Password reset email sent! Check your inbox.");
        setEmail("");
      }
    } catch (error: any) {
      toast.error("An unexpected error occurred: " + error.message);
    }

    setLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast.error("Error updating password: " + error.message);
      } else {
        toast.success("Password updated successfully!");
        // Sign out to ensure clean state, then redirect to login
        await supabase.auth.signOut();
        navigate("/login");
      }
    } catch (error: any) {
      toast.error("An unexpected error occurred: " + error.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background responsive-padding">
      <Card className="w-full max-w-sm sm:max-w-md shadow-lg border-2 border-border bg-card">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg">
              {isResettingPassword ? (
                <Lock className="h-8 w-8 text-white" />
              ) : (
                <Mail className="h-8 w-8 text-white" />
              )}
            </div>
          </div>
          <CardTitle className="responsive-subheading text-primary">
            {isResettingPassword ? "Reset Your Password" : "Forgot Password"}
          </CardTitle>
          <p className="responsive-small text-muted-foreground mt-2">
            {isResettingPassword 
              ? "Enter your new password below" 
              : "Enter your email address and we'll send you a reset link"
            }
          </p>
        </CardHeader>
        <CardContent className="responsive-padding">
          {isResettingPassword ? (
            <form onSubmit={handlePasswordReset} className="responsive-spacing">
              <div>
                <Label className="block responsive-small font-medium text-foreground mb-1">
                  New Password
                </Label>
                <Input
                  type="password"
                  value={newPassword}
                  required
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full"
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <Label className="block responsive-small font-medium text-foreground mb-1">
                  Confirm New Password
                </Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  required
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full"
                  placeholder="Confirm new password"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-accent hover:bg-secondary text-accent-foreground responsive-button"
                disabled={loading}
              >
                {loading ? "Updating Password..." : "Update Password"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="responsive-spacing">
              <div>
                <Label className="block responsive-small font-medium text-foreground mb-1">
                  Email Address
                </Label>
                <Input
                  type="email"
                  value={email}
                  required
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                  placeholder="Enter your email address"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-accent hover:bg-secondary text-accent-foreground responsive-button"
                disabled={loading}
              >
                {loading ? "Sending Reset Link..." : "Send Reset Link"}
              </Button>
            </form>
          )}

          <div className="flex items-center justify-center mt-6 pt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => navigate("/login")}
              className="flex items-center gap-2 text-secondary hover:text-accent hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
