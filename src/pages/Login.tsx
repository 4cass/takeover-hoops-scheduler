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
    <div className="relative min-h-screen flex items-center justify-center bg-gray-400">
      {/* 🔹 Background Overlay */}
      <div className="absolute inset-0 bg-gray-400 z-0" />

      {/* 🔹 Login Card */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md p-4">
        <Card className="shadow-xl border-2 border-gray-600 bg-black/90 backdrop-blur-md">
          <CardHeader className="text-center">
            {/* Logo - Made Much Bigger */}
            <div className="flex justify-center mb-6">
              <img
                src="/lovable-uploads/599e456c-7d01-4d0c-a68c-b753300de7de.png"
                alt="Coach Logo"
                className="w-40 h-40 object-contain"
              />
            </div>
            <CardTitle className="text-white text-lg font-semibold">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <p className="text-gray-300 mt-2 text-sm">
              {isSignUp ? "Join our coaching platform" : "Sign in to your account"}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <div>
                    <Label className="text-white">Name</Label>
                    <Input
                      type="text"
                      value={name}
                      required
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Phone</Label>
                    <Input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                    />
                  </div>
                </>
              )}
              <div>
                <Label className="text-white">Email</Label>
                <Input
                  type="email"
                  value={email}
                  required
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                />
              </div>
              <div>
                <Label className="text-white">Password</Label>
                <Input
                  type="password"
                  value={password}
                  required
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-white hover:bg-gray-100 text-black mt-6 font-semibold"
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
                <div className="text-center text-sm mt-4">
                  <button
                    type="button"
                    className="text-gray-300 hover:text-white hover:underline"
                    onClick={() => navigate("/forgot-password")}
                  >
                    Forgot your password?
                  </button>
                </div>
              )}

              <div className="text-center text-sm mt-4 pt-4 border-t border-gray-600">
                <button
                  type="button"
                  className="text-gray-300 hover:text-white hover:underline"
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
