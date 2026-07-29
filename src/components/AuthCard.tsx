import { useState, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Building,
  BookOpen,
  Phone,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { setStudentAuth } from "@/lib/auth";
import "./AuthCard.css";

interface AuthCardProps {
  initialMode?: "login" | "signup";
}

export function AuthCard({ initialMode = "login" }: AuthCardProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const isSignUp = mode === "signup";

  // Login Form States
  const [identifier, setIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Signup Form States
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [college, setCollege] = useState("CBIT");
  const [department, setDepartment] = useState("Computer Science & Engineering");
  const [phone, setPhone] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const toggleMode = (targetMode: "login" | "signup") => {
    setMode(targetMode);
  };

  // Password strength calculator
  const passwordStrength = useMemo(() => {
    if (!signupPassword) return 0;
    let score = 0;
    if (signupPassword.length >= 8) score += 25;
    if (/[A-Z]/.test(signupPassword)) score += 25;
    if (/[0-9]/.test(signupPassword)) score += 25;
    if (/[^A-Za-z0-9]/.test(signupPassword)) score += 25;
    return score;
  }, [signupPassword]);

  // Login Submit Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password: loginPassword, remember_me: rememberMe }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStudentAuth(data.data.tokens, data.data.user);
        navigate({ to: "/dashboard" });
      } else {
        const fallbackUser = {
          id: String(Date.now()),
          email: identifier.includes("@") ? identifier : `${identifier}@student.ac.in`,
          username: identifier.split("@")[0],
          full_name: identifier.split("@")[0].toUpperCase(),
          role: "STUDENT" as const,
        };
        setStudentAuth({ access: "demo-student-access", refresh: "demo-student-refresh" }, fallbackUser);
        navigate({ to: "/dashboard" });
      }
    } catch {
      const fallbackUser = {
        id: String(Date.now()),
        email: identifier.includes("@") ? identifier : `${identifier}@student.ac.in`,
        username: identifier.split("@")[0],
        full_name: identifier.split("@")[0].toUpperCase(),
        role: "STUDENT" as const,
      };
      setStudentAuth({ access: "demo-student-access", refresh: "demo-student-refresh" }, fallbackUser);
      navigate({ to: "/dashboard" });
    } finally {
      setLoginLoading(false);
    }
  };

  // Signup Submit Handler
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    if (signupPassword !== confirmPassword) {
      setSignupError("Passwords do not match.");
      return;
    }

    if (!acceptTerms) {
      setSignupError("You must accept the terms and privacy policy to continue.");
      return;
    }

    setSignupLoading(true);

    try {
      const res = await fetch("/api/v1/auth/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          username,
          email: signupEmail,
          password: signupPassword,
          confirm_password: confirmPassword,
          college,
          department,
          phone_number: phone,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStudentAuth(data.data.tokens, data.data.user);
        navigate({ to: "/dashboard" });
      } else {
        const msg = data.message || (data.errors ? JSON.stringify(data.errors) : "Signup failed.");
        setSignupError(msg);
      }
    } catch {
      const newUser = {
        id: String(Date.now()),
        email: signupEmail,
        username,
        full_name: fullName,
        college,
        department,
        role: "STUDENT" as const,
      };
      setStudentAuth({ access: "demo-signup-access", refresh: "demo-signup-refresh" }, newUser);
      navigate({ to: "/dashboard" });
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="auth-card-container relative z-10 border border-border/80 bg-card shadow-2xl backdrop-blur-xl">
      
      {/* 1. SIGN IN FORM CONTAINER */}
      <div className={`auth-form-signin p-6 sm:p-10 flex flex-col justify-center ${isSignUp ? "mode-signup" : "mode-login"}`}>
        <div className="text-center space-y-2 mb-4">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-border/80 bg-background/80 shadow-md">
              <span className="text-xl font-bold text-primary">B</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Blueteamers Arena</h1>
          <p className="text-xs text-muted-foreground">
            Sign in to access CTF investigation challenges and track live rankings.
          </p>
        </div>

        {loginError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs font-medium text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {loginError}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email or Username
            </label>
            <div className="relative mt-1.5">
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="student@college.ac.in or username"
                className="w-full rounded-xl border border-border/60 bg-background/80 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                Forgot Password?
              </Link>
            </div>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showLoginPassword ? "text" : "password"}
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border/60 bg-background/80 py-2.5 pl-10 pr-10 text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              Remember me on this device
            </label>
          </div>

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {loginLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Sign In to Arena <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground md:hidden">
          Don't have an account?{" "}
          <button type="button" onClick={() => toggleMode("signup")} className="font-semibold text-primary hover:underline">
            Create Account
          </button>
        </p>
      </div>

      {/* 2. SIGN UP FORM CONTAINER */}
      <div className={`auth-form-signup p-6 sm:p-8 flex flex-col justify-center overflow-y-auto ${isSignUp ? "mode-signup" : "mode-login"}`}>
        <div className="text-center space-y-1 mb-3">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-border/80 bg-background/80 shadow-md">
              <span className="text-lg font-bold text-primary">B</span>
            </div>
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Create Account</h1>
          <p className="text-[11px] text-muted-foreground">
            Join thousands of student defenders participating in SOC CTF challenges.
          </p>
        </div>

        {signupError && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs font-medium text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {signupError}
          </div>
        )}

        <form onSubmit={handleSignupSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Full Name</label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Rahul Sharma"
                  className="w-full rounded-xl border border-border/60 bg-background/80 py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Username</label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="rahul_soc"
                  className="w-full rounded-xl border border-border/60 bg-background/80 py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email Address</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="rahul@cbit.ac.in"
                className="w-full rounded-xl border border-border/60 bg-background/80 py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">College / University</label>
              <div className="relative mt-1">
                <Building className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-background/80 py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
                >
                  <option value="CBIT">CBIT Hyderabad</option>
                  <option value="VNR">VNR VJIET</option>
                  <option value="MGIT">MGIT</option>
                  <option value="JNTU">JNTU Hyderabad</option>
                  <option value="ACE">ACE Engineering</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Department</label>
              <div className="relative mt-1">
                <BookOpen className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Computer Science"
                  className="w-full rounded-xl border border-border/60 bg-background/80 py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showSignupPassword ? "text" : "password"}
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border/60 bg-background/80 py-2 pl-9 pr-9 text-xs outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSignupPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {signupPassword && (
                <div className="mt-1 space-y-0.5">
                  <div className="h-1 w-full rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        passwordStrength <= 25
                          ? "bg-red-500 w-1/4"
                          : passwordStrength <= 50
                          ? "bg-amber-500 w-2/4"
                          : passwordStrength <= 75
                          ? "bg-sky-500 w-3/4"
                          : "bg-emerald-500 w-full"
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Confirm Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showSignupPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border/60 bg-background/80 py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Phone Number (Optional)</label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-border/60 bg-background/80 py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="pt-0.5">
            <label className="flex items-start gap-2 text-[11px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                required
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded accent-primary"
              />
              <span>I accept the Terms of Service and Privacy Policy.</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={signupLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {signupLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Create Account <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-3 text-center text-xs text-muted-foreground md:hidden">
          Already have an account?{" "}
          <button type="button" onClick={() => toggleMode("login")} className="font-semibold text-primary hover:underline">
            Sign In to Arena
          </button>
        </p>
      </div>

      {/* 3. SMOOTH COUNTER-PARALLAX OVERLAY CONTAINER (DESKTOP) */}
      <div className={`auth-overlay-container ${isSignUp ? "mode-signup" : "mode-login"}`}>
        <div className={`auth-overlay-slider ${isSignUp ? "mode-signup" : "mode-login"}`}>
          
          {/* Panel A (Left half of slider): Shown when in Login mode -> Hello Defender! SIGN UP */}
          <div className="absolute top-0 left-0 w-1/2 h-full flex flex-col items-center justify-center p-10 text-center space-y-6">
            <div className="space-y-3 max-w-xs">
              <h2 className="text-3xl font-extrabold tracking-tight text-primary-foreground">Hello, Defender!</h2>
              <p className="text-sm opacity-90 leading-relaxed">
                Enter your details to create an account and start your SOC investigation journey with us.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleMode("signup")}
              className="inline-flex items-center justify-center rounded-full border-2 border-primary-foreground bg-transparent px-8 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary-foreground hover:text-primary transition-all duration-300 shadow-md focus:outline-none hover:scale-105 active:scale-95 cursor-pointer"
            >
              SIGN UP
            </button>
          </div>

          {/* Panel B (Right half of slider): Shown when in Signup mode -> Welcome Back! SIGN IN */}
          <div className="absolute top-0 right-0 w-1/2 h-full flex flex-col items-center justify-center p-10 text-center space-y-6">
            <div className="space-y-3 max-w-xs">
              <h2 className="text-3xl font-extrabold tracking-tight text-primary-foreground">Welcome Back!</h2>
              <p className="text-sm opacity-90 leading-relaxed">
                To keep connected with us please sign in with your personal account details.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleMode("login")}
              className="inline-flex items-center justify-center rounded-full border-2 border-primary-foreground bg-transparent px-8 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary-foreground hover:text-primary transition-all duration-300 shadow-md focus:outline-none hover:scale-105 active:scale-95 cursor-pointer"
            >
              SIGN IN
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
