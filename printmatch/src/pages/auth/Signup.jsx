import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Gift, Lock, Mail, User } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { REFERRAL_BONUS } from "../../data/mockData";

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("buyer");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Fill in your name, email, and password to continue.");
      return;
    }
    signup({ name: name.trim(), email: email.trim(), role, referralCode: referralCode.trim() });
    navigate(role === "owner" ? "/owner" : "/");
  };

  return (
    <div className="flex flex-1 flex-col justify-center bg-navy px-6 py-10 text-white">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
          <Box size={28} />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold">Create your account</h1>
          <p className="text-sm text-white/60">Join Poly POD in seconds</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-white/50">I am a...</p>
          <div className="flex gap-2">
            {[
              { id: "buyer", label: "Buyer" },
              { id: "owner", label: "Printer owner" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRole(opt.id)}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                  role === opt.id
                    ? "border-accent bg-accent text-white"
                    : "border-white/15 text-white/70"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3">
          <User size={17} className="text-white/50" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          />
        </div>
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
        <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3">
          <Gift size={17} className="text-white/50" />
          <input
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            placeholder="Referral code (optional)"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          />
        </div>
        {referralCode.trim() && (
          <p className="text-xs text-accent">
            You'll get ${REFERRAL_BONUS} in Poly POD credit on signup.
          </p>
        )}
        {error && <p className="text-xs text-red-300">{error}</p>}

        <button
          type="submit"
          className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 active:scale-[0.98]"
        >
          Create account
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-white/50">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="font-semibold text-accent underline underline-offset-2"
        >
          Log in
        </button>
      </p>
    </div>
  );
}
