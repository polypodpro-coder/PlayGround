import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Lock, Mail } from "lucide-react";
import { useApp } from "../../context/AppContext";

export default function Login() {
  const navigate = useNavigate();
  const { login, quickLogin } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter an email and password to continue.");
      return;
    }
    login(email.trim());
    navigate("/");
  };

  const handleQuickLogin = (role) => {
    quickLogin(role);
    navigate(role === "owner" ? "/owner" : "/");
  };

  return (
    <div className="flex flex-1 flex-col justify-center bg-navy px-6 py-10 text-white">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
          <Box size={28} />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold">PrintMatch</h1>
          <p className="text-sm text-white/60">Local 3D printing, on demand</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3">
          <Mail size={17} className="text-white/50" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          />
        </div>
        <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3">
          <Lock size={17} className="text-white/50" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          />
        </div>
        {error && <p className="text-xs text-red-300">{error}</p>}

        <button
          type="submit"
          className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 active:scale-[0.98]"
        >
          Log in
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-white/50">
        No account?{" "}
        <button
          type="button"
          onClick={() => navigate("/signup")}
          className="font-semibold text-accent underline underline-offset-2"
        >
          Sign up
        </button>
      </p>

      <div className="mt-8 border-t border-white/10 pt-5">
        <p className="mb-2.5 text-center text-[11px] uppercase tracking-wide text-white/35">
          Demo shortcuts
        </p>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => handleQuickLogin("buyer")}
            className="flex-1 rounded-xl border border-white/15 py-2.5 text-xs font-semibold text-white/80 active:scale-95"
          >
            Continue as buyer
          </button>
          <button
            type="button"
            onClick={() => handleQuickLogin("owner")}
            className="flex-1 rounded-xl border border-white/15 py-2.5 text-xs font-semibold text-white/80 active:scale-95"
          >
            Continue as printer owner
          </button>
        </div>
      </div>
    </div>
  );
}
