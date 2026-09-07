import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function RoleToggle() {
  const { role, setRole } = useApp();
  const navigate = useNavigate();

  const switchTo = (next) => {
    setRole(next);
    navigate(next === "owner" ? "/owner" : "/");
  };

  return (
    <div className="flex rounded-full bg-white/10 p-1 text-xs font-semibold">
      <button
        type="button"
        onClick={() => switchTo("buyer")}
        className={`rounded-full px-3 py-1.5 transition-colors ${
          role === "buyer" ? "bg-surface text-navy" : "text-white/70"
        }`}
      >
        Buyer
      </button>
      <button
        type="button"
        onClick={() => switchTo("owner")}
        className={`rounded-full px-3 py-1.5 transition-colors ${
          role === "owner" ? "bg-surface text-navy" : "text-white/70"
        }`}
      >
        Printer owner
      </button>
    </div>
  );
}
