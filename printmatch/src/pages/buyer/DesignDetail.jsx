import { useNavigate, useParams } from "react-router-dom";
import { Info, Scale, Sparkles, Tag, User } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import { featuredDesigns } from "../../data/mockData";
import { useApp } from "../../context/AppContext";

export default function DesignDetail() {
  const { designId } = useParams();
  const navigate = useNavigate();
  const { setSelectedDesign } = useApp();

  const design = featuredDesigns.find((d) => d.id === designId);

  if (!design) {
    return (
      <div className="flex flex-1 flex-col">
        <ScreenHeader title="Design not found" onBack={() => navigate("/")} />
      </div>
    );
  }

  const handlePrintThis = () => {
    setSelectedDesign(design);
    navigate("/request");
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title={design.name} subtitle={design.category} />

      <div className="flex-1 space-y-5 px-4 py-5">
        <div className="flex items-start gap-2 rounded-2xl bg-navy/5 p-3.5">
          <Info size={15} className="mt-0.5 shrink-0 text-navy/40" />
          <p className="text-xs leading-relaxed text-navy/50">
            Concept preview — a placeholder for browsing a future design-catalog partnership. This
            listing and image aren't from a real platform.
          </p>
        </div>

        <img
          src={design.imageUrl}
          alt={design.name}
          className="w-full rounded-2xl shadow-sm ring-1 ring-black/5"
        />

        <p className="text-sm leading-relaxed text-navy/70">{design.description}</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface p-3.5 shadow-sm ring-1 ring-black/5">
            <p className="flex items-center gap-1 text-xs text-navy/50">
              <User size={12} /> Designer
            </p>
            <p className="mt-0.5 text-sm font-semibold text-navy">{design.designer}</p>
          </div>
          <div className="rounded-2xl bg-surface p-3.5 shadow-sm ring-1 ring-black/5">
            <p className="flex items-center gap-1 text-xs text-navy/50">
              <Tag size={12} /> License
            </p>
            <p className="mt-0.5 text-sm font-semibold text-navy">{design.license}</p>
          </div>
          <div className="rounded-2xl bg-surface p-3.5 shadow-sm ring-1 ring-black/5">
            <p className="flex items-center gap-1 text-xs text-navy/50">
              <Sparkles size={12} /> Suggested material
            </p>
            <p className="mt-0.5 text-sm font-semibold text-accent">{design.defaultMaterial}</p>
          </div>
          <div className="rounded-2xl bg-surface p-3.5 shadow-sm ring-1 ring-black/5">
            <p className="flex items-center gap-1 text-xs text-navy/50">
              <Scale size={12} /> Est. weight
            </p>
            <p className="mt-0.5 text-sm font-semibold text-navy">{design.estimatedGrams}g</p>
          </div>
        </div>
      </div>

      <div className="border-t border-black/5 bg-surface px-4 py-3.5">
        <button
          type="button"
          onClick={handlePrintThis}
          className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 active:scale-[0.98]"
        >
          Print this design
        </button>
      </div>
    </div>
  );
}
