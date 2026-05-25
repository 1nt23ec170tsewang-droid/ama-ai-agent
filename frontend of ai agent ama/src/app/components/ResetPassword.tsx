import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Lock, Eye, EyeOff, Check, X, ShieldCheck } from "lucide-react";

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | ""; message: string }>({
    type: "",
    message: "",
  });

  // Password criteria checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const passwordsMatch = password === confirmPassword && password !== "";
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecialChar;
  const isSubmitDisabled = !isPasswordValid || !passwordsMatch || loading || !token || !email;

  useEffect(() => {
    if (!token || !email) {
      setStatus({
        type: "error",
        message: "Invalid reset request: Missing token or email parameters.",
      });
    }
  }, [token, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const res = await resetPassword(password, token, email);
      if (res.success) {
        setStatus({
          type: "success",
          message: "Password reset completed successfully! Redirecting to login...",
        });
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      } else {
        setStatus({
          type: "error",
          message: res.error || "Failed to reset password. The link may have expired or already been used.",
        });
      }
    } catch {
      setStatus({
        type: "error",
        message: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030014] text-white flex items-center justify-center font-sans relative overflow-hidden px-4">
      {/* Premium Background Gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/25 via-slate-900 to-[#030014] z-0"></div>
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl z-0"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl z-0"></div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 z-10 shadow-2xl transition-all duration-300 hover:border-white/15">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400 mb-4 shadow-lg shadow-indigo-500/10">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
            Reset Password
          </h2>
          <p className="text-slate-400 text-sm mt-1 text-center">
            Complete your security credential update.
          </p>
        </div>

        {status.message && (
          <div
            className={`p-4 rounded-xl mb-6 text-sm flex items-start space-x-2 border transition-all duration-300 ${
              status.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/25 text-rose-300"
            }`}
          >
            <span className="mt-0.5 font-bold">{status.type === "success" ? "✓" : "⚠"}</span>
            <div>{status.message}</div>
          </div>
        )}

        {token && email && status.type !== "success" && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/25 transition-all text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 tracking-wide uppercase">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/25 transition-all text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Real-time Validation Criteria */}
            <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-2 text-xs">
              <p className="font-semibold text-slate-300 mb-1">Password Strength Checklist:</p>
              
              <div className="flex items-center space-x-2">
                {hasMinLength ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span className={hasMinLength ? "text-emerald-300/90" : "text-slate-400"}>
                  Minimum 8 characters long
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {hasUppercase ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span className={hasUppercase ? "text-emerald-300/90" : "text-slate-400"}>
                  At least one uppercase letter (A-Z)
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {hasNumber ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span className={hasNumber ? "text-emerald-300/90" : "text-slate-400"}>
                  At least one number (0-9)
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {hasSpecialChar ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span className={hasSpecialChar ? "text-emerald-300/90" : "text-slate-400"}>
                  At least one special character (!@#$%^&*)
                </span>
              </div>

              <div className="flex items-center space-x-2 pt-1 border-t border-white/5">
                {passwordsMatch ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span className={passwordsMatch ? "text-emerald-300/90" : "text-slate-400"}>
                  Passwords match
                </span>
              </div>
            </div>

            {/* Reset Button */}
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`w-full py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg ${
                isSubmitDisabled
                  ? "bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer hover:shadow-indigo-500/20 active:scale-[0.98]"
              }`}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
              ) : (
                "Update Password"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
