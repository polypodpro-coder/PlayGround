import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ScreenHeader({ title, subtitle, onBack, right }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 bg-navy px-4 py-4 text-white">
      <button
        type="button"
        onClick={onBack ?? (() => navigate(-1))}
        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10"
        aria-label="Go back"
      >
        <ChevronLeft size={20} />
      </button>
      <div className="flex-1">
        <h1 className="text-base font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-white/60">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
