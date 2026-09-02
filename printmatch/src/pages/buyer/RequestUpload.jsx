import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Calculator, File as FileIcon, Image as ImageIcon, Store, UploadCloud, X } from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import MaterialChipSelector from "../../components/MaterialChipSelector";
import ShopLogo from "../../components/ShopLogo";
import { useApp } from "../../context/AppContext";

// Rough average $/gram across nearby shops, used only to give buyers a
// ballpark before quotes come in — the printer they pick sets the real
// price.
const AVG_MATERIAL_RATE = { PLA: 0.06, PETG: 0.08, ABS: 0.085, TPU: 0.13, Nylon: 0.15 };

export default function RequestUpload() {
  const navigate = useNavigate();
  const { setRequest, directRequestPrinterId, setDirectRequestPrinterId, printers } = useApp();
  const targetShop = printers.find((p) => p.id === directRequestPrinterId);

  const [file, setFile] = useState(null);
  const [material, setMaterial] = useState(targetShop?.materials[0] ?? "PLA");
  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const isModel = file && /\.(stl|obj)$/i.test(file.name);

  // A deterministic ballpark from the file's actual size — not a real
  // slicer estimate, but grounded in something real about the upload
  // rather than a random number.
  const estimate = useMemo(() => {
    if (!file) return null;
    const grams = Math.min(420, Math.max(8, Math.round(file.size / 350)));
    const rate = AVG_MATERIAL_RATE[material] ?? 0.08;
    // Floor the base cost (not the low/high bounds separately) so a tiny
    // estimated part can never produce an inverted range like "$4–$1".
    const base = Math.max(5, grams * rate);
    return { grams, low: base * 0.85, high: base * 1.3 };
  }, [file, material]);

  const handleFiles = (fileList) => {
    const f = fileList?.[0];
    if (f) setFile(f);
  };

  const submit = (e) => {
    e.preventDefault();
    setRequest({
      fileName: file?.name ?? "part.stl",
      material,
      neededBy,
      notes,
    });
    navigate("/quotes");
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Request a print" subtitle="Step 1 of 2" onBack={() => navigate("/")} />

      <form onSubmit={submit} className="flex-1 space-y-6 px-4 py-5">
        {targetShop && (
          <div className="flex items-center gap-3 rounded-2xl bg-navy/5 p-3.5">
            <ShopLogo src={targetShop.logoUrl} alt={`${targetShop.name} logo`} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-xs text-navy/50">
                <Store size={11} /> Requesting directly from
              </p>
              <p className="truncate text-sm font-semibold text-navy">{targetShop.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setDirectRequestPrinterId(null)}
              className="shrink-0 text-xs font-semibold text-accent underline underline-offset-2"
            >
              Change
            </button>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-semibold text-navy">
            Upload file or photo
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? "border-accent bg-accent/5" : "border-navy/15 bg-white"
            }`}
          >
            {file ? (
              <div className="flex w-full items-center justify-between rounded-xl bg-navy/5 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-navy">
                  {isModel ? <FileIcon size={16} /> : <ImageIcon size={16} />}
                  <span className="truncate">{file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-navy/40 hover:text-navy"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <UploadCloud size={28} className="text-navy/30" />
                <p className="text-sm font-medium text-navy/70">
                  Drag &amp; drop an STL/OBJ file
                </p>
                <p className="text-xs text-navy/40">or a photo of the part</p>
                <label className="mt-2 cursor-pointer rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white">
                  Browse files
                  <input
                    type="file"
                    accept=".stl,.obj,image/*"
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </label>
              </>
            )}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-navy">
            Material
          </label>
          <MaterialChipSelector
            materials={targetShop?.materials}
            selected={material}
            onChange={setMaterial}
          />
        </div>

        {estimate && (
          <div className="flex items-center gap-3 rounded-2xl bg-navy/5 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-accent">
              <Calculator size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy">
                Est. ${estimate.low.toFixed(0)}–${estimate.high.toFixed(0)}
              </p>
              <p className="text-xs text-navy/50">
                ~{estimate.grams}g of {material}, based on your file · printers set the final price
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-semibold text-navy">
            Needed by <span className="font-normal text-navy/40">(optional)</span>
          </label>
          <div className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 ring-1 ring-black/5">
            <Calendar size={17} className="text-navy/40" />
            <input
              type="date"
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
              className="flex-1 bg-transparent text-sm text-navy outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-navy">
            Notes <span className="font-normal text-navy/40">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Color preference, tolerances, infill, anything the printer should know..."
            className="w-full resize-none rounded-xl bg-white px-3.5 py-3 text-sm text-navy outline-none ring-1 ring-black/5 placeholder:text-navy/35"
          />
        </div>
      </form>

      <div className="border-t border-black/5 bg-white px-4 py-3.5">
        <button
          onClick={submit}
          type="submit"
          className="w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 active:scale-[0.98]"
        >
          Get quotes
        </button>
      </div>
    </div>
  );
}
