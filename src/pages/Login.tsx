
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Alert confirmation for account creation
    if (isSignUp && !window.confirm("Are you sure you want to create a new account with this email address?")) {
      return;
    }
    
    setLoading(true);

    try {
      if (isSignUp) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          toast.error("Sign up failed: " + signUpError.message);
          setLoading(false);
          return;
        }

        const userId = signUpData.user?.id;
        if (userId) {
          const { error: insertError } = await supabase.from("coaches").insert({
            id: userId,
            name,
            email,
            phone,
            role: 'coach',
            auth_id: userId,
          });

          if (insertError) {
            toast.error("Account created but failed to save profile: " + insertError.message);
          } else {
            toast.success("Account created successfully! Please log in.");
            setIsSignUp(false);
            setName("");
            setPhone("");
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          toast.error("Login failed: " + error.message);
        } else if (data.user) {
          toast.success("Logged in successfully!");
          navigate("/dashboard");
        }
      }
    } catch (error: any) {
      toast.error("An unexpected error occurred: " + error.message);
    }

    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center" style={{ backgroundColor: '#181a18' }}>
      {/* 🔹 Background Overlay */}
      <div className="absolute inset-0" style={{ backgroundColor: '#181a18' }} />

      {/* 🔹 Login Card */}
      <div className="relative z-10 w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg p-2 sm:p-4 md:p-6">
        <Card className="shadow-2xl border-2" style={{ borderColor: '#c2ab75', backgroundColor: '#181a18' }}>
          <CardHeader className="text-center">
            {/* Logo - Responsive size */}
            <div className="flex justify-center mb-1">
              <img
                src="/lovable-uploads/599e456c-7d01-4d0c-a68c-b753300de7de.png"
                alt="Coach Logo"
                className="w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 object-contain"
              />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold" style={{ color: 'white' }}>
              {isSignUp ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <p className="mt-1 text-sm sm:text-base" style={{ color: 'white' }}>
              {isSignUp ? "Join our coaching platform" : "Sign in to your account"}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 md:space-y-6">
              {isSignUp && (
                <>
                  <div>
                    <Label className="font-medium" style={{ color: 'white' }}>Name</Label>
                    <Input
                      type="text"
                      value={name}
                      required
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 border w-full" style={{ backgroundColor: '#181a18', borderColor: '#c2ab75', color: 'white' }}
                    />
                  </div>
                  <div>
                    <Label className="font-medium" style={{ color: 'white' }}>Phone</Label>
                    <Input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 border w-full" style={{ backgroundColor: '#181a18', borderColor: '#c2ab75', color: 'white' }}
                    />
                  </div>
                </>
              )}
              <div>
                <Label className="font-medium" style={{ color: 'white' }}>Email</Label>
                <Input
                  type="email"
                  value={email}
                  required
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 border w-full" style={{ backgroundColor: '#181a18', borderColor: '#c2ab75', color: 'white' }}
                />
              </div>
              <div>
                <Label className="font-medium" style={{ color: 'white' }}>Password</Label>
                <Input
                  type="password"
                  value={password}
                  required
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 border w-full" style={{ backgroundColor: '#181a18', borderColor: '#c2ab75', color: 'white' }}
                />
              </div>
              <Button
                type="submit"
                className="w-full mt-4 sm:mt-6 font-semibold py-2 sm:py-2.5 rounded-lg"
                style={{ backgroundColor: '#c2ab75', color: '#181a18' }}
                disabled={loading}
              >
                {loading
                  ? isSignUp
                    ? "Creating Account..."
                    : "Signing In..."
                  : isSignUp
                  ? "Create Account"
                  : "Sign In"}
              </Button>

              {!isSignUp && (
                <div className="text-center text-xs sm:text-sm mt-3 sm:mt-4">
                  <button
                    type="button"
                    className="hover:underline"
                    style={{ color: 'white' }}
                    onClick={() => navigate("/forgot-password")}
                  >
                    Forgot your password?
                  </button>
                </div>
              )}

              <div className="text-center text-xs sm:text-sm mt-3 sm:mt-4 pt-3 sm:pt-4 border-t" style={{ borderColor: '#c2ab75' }}>
                <button
                  type="button"
                  className="hover:underline"
                  style={{ color: 'white' }}
                  onClick={() => setIsSignUp(!isSignUp)}
                >
                  {isSignUp
                    ? "Already have an account? Sign in"
                    : "Don't have an account? Sign up"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
