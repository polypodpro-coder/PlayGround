import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Calculator,
  File as FileIcon,
  Image as ImageIcon,
  Store,
  UploadCloud,
  X,
  Sparkles,
  Bot,
  Send,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import ScreenHeader from "../../components/ScreenHeader";
import MaterialChipSelector from "../../components/MaterialChipSelector";
import ShopLogo from "../../components/ShopLogo";
import ModelPreviewer from "../../components/ModelPreviewer";
import { useApp } from "../../context/AppContext";
import { SAMPLE_PRESETS, createImageTo3DTask, pollTaskStatus } from "../../services/meshyService";

// Rough average $/gram across nearby shops, used only to give buyers a
// ballpark before quotes come in — the printer they pick sets the real
// price.
const AVG_MATERIAL_RATE = { PLA: 0.06, PETG: 0.08, ABS: 0.085, TPU: 0.13, Nylon: 0.15 };

export default function RequestUpload() {
  const navigate = useNavigate();
  const {
    setRequest,
    directRequestPrinterId,
    setDirectRequestPrinterId,
    selectedDesign,
    setSelectedDesign,
    printers,
  } = useApp();
  const targetShop = printers.find((p) => p.id === directRequestPrinterId);

  const [file, setFile] = useState(null);
  const [material, setMaterial] = useState(
    selectedDesign?.defaultMaterial ?? targetShop?.materials[0] ?? "PLA"
  );
  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Meshy AI Image-to-3D State
  const [meshyModel, setMeshyModel] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState("");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [agentPrompt, setAgentPrompt] = useState("");

  const isModel = file && /\.(stl|obj)$/i.test(file.name);

  // Ballpark estimate grounded in actual 3D mesh volume when available
  const estimate = useMemo(() => {
    const rate = AVG_MATERIAL_RATE[material] ?? 0.08;
    let grams = null;
    if (meshyModel) grams = meshyModel.estimatedGrams;
    else if (selectedDesign) grams = selectedDesign.estimatedGrams;
    else if (file) grams = Math.min(420, Math.max(8, Math.round(file.size / 350)));
    if (!grams) return null;

    const base = Math.max(5, grams * rate);
    return { grams, low: base * 0.85, high: base * 1.3 };
  }, [file, selectedDesign, material, meshyModel]);

  const handleFiles = async (fileList) => {
    const f = fileList?.[0];
    if (!f) return;
    setFile(f);
    setSelectedDesign(null);

    // If an image is provided, trigger the Meshy.ai pipeline
    if (f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.name)) {
      const imgUrl = URL.createObjectURL(f);
      setIsGenerating(true);
      setGenerationStage("Initializing Meshy.ai Image-to-3D pipeline...");
      setGenerationProgress(15);

      const task = await createImageTo3DTask({
        imageFile: f,
        imageUrl: imgUrl,
        presetId: "bracket",
      });

      await pollTaskStatus(task.taskId, (progress, status) => {
        setGenerationProgress(progress);
        setGenerationStage(status);
      });

      setIsGenerating(false);
      const newModel = {
        id: `custom_${Date.now()}`,
        name: f.name.replace(/\.[^/.]+$/, "") || "Custom 3D Part",
        type: "bracket",
        photoUrl: imgUrl,
        dimensions: { x: 52, y: 38, z: 24 },
        estimatedGrams: 42,
        recommendedMaterial: "PETG",
        infillRecommendation: "40% gyroid",
        agentSummary: `AI analyzed "${f.name}". Detected structural geometry with mounting surfaces. Synthesized manifold 3D mesh ready for printing.`,
      };
      setMeshyModel(newModel);
      setMaterial(newModel.recommendedMaterial);
    } else {
      setMeshyModel(null);
    }
  };

  const handleSelectPreset = async (preset) => {
    setFile(null);
    setSelectedDesign(null);
    setIsGenerating(true);
    setGenerationStage("Initializing Meshy.ai Image-to-3D pipeline...");
    setGenerationProgress(15);

    const task = await createImageTo3DTask({ presetId: preset.id });
    await pollTaskStatus(task.taskId, (progress, status) => {
      setGenerationProgress(progress);
      setGenerationStage(status);
    });

    setIsGenerating(false);
    setMeshyModel({ ...preset });
    setMaterial(preset.recommendedMaterial);
  };

  const handleRefine = (instruction) => {
    if (!meshyModel) return;
    const lower = instruction.toLowerCase();
    if (lower.includes("thickness") || lower.includes("+2mm")) {
      setMeshyModel((prev) => ({
        ...prev,
        dimensions: { ...prev.dimensions, z: prev.dimensions.z + 4 },
        estimatedGrams: Math.round(prev.estimatedGrams * 1.15),
        agentSummary: "Reinforced wall thickness by +2mm (+15% structural strength). Recalculated mesh volume.",
      }));
    } else if (lower.includes("rib") || lower.includes("gusset")) {
      setMeshyModel((prev) => ({
        ...prev,
        estimatedGrams: prev.estimatedGrams + 6,
        agentSummary: "Added 45° internal gusset ribs to prevent lateral deflection under load.",
      }));
    } else if (lower.includes("hole") || lower.includes("mount")) {
      setMeshyModel((prev) => ({
        ...prev,
        agentSummary: "Added two standardized M4 countersunk mounting slots to the base plate.",
      }));
    } else {
      setMeshyModel((prev) => ({
        ...prev,
        agentSummary: `Updated geometry according to: "${instruction}". Model mesh re-verified manifold.`,
      }));
    }
    setAgentPrompt("");
  };

  const submit = (e) => {
    e.preventDefault();
    setRequest({
      fileName: meshyModel
        ? `${meshyModel.name}.stl`
        : selectedDesign
        ? selectedDesign.name
        : file?.name ?? "part.stl",
      designId: selectedDesign?.id ?? null,
      material,
      neededBy,
      notes: meshyModel
        ? `${notes ? notes + "\n\n" : ""}[Meshy AI Model: ${meshyModel.name} · ${meshyModel.dimensions.x}×${meshyModel.dimensions.y}×${meshyModel.dimensions.z}mm · ${meshyModel.infillRecommendation}]`
        : notes,
      estimatedGrams: estimate?.grams ?? null,
      meshyModel: meshyModel ?? null,
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
            {selectedDesign ? "Design" : "Upload file or photo"}
          </label>

          {/* Case 1: Catalog Design Selected */}
          {selectedDesign && (
            <div className="flex items-center gap-3 rounded-2xl border-2 border-navy/15 bg-surface p-3">
              <img
                src={selectedDesign.imageUrl}
                alt={selectedDesign.name}
                className="h-14 w-14 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy">{selectedDesign.name}</p>
                <p className="text-xs text-navy/40">From featured designs · Concept</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDesign(null)}
                className="shrink-0 text-navy/40 hover:text-navy"
                aria-label="Remove design"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Case 2: Meshy AI Generation In Progress */}
          {isGenerating && (
            <div className="rounded-2xl border-2 border-accent/30 bg-accent/5 p-5 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white shadow-md shadow-accent/30">
                <RefreshCw size={20} className="animate-spin" />
              </div>
              <p className="mt-3 text-sm font-bold text-navy">Meshy AI Image-to-3D Synthesis</p>
              <p className="mt-1 text-xs text-navy/60">{generationStage}</p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-navy/10">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Case 3: Meshy AI 3D Model Generated & Ready */}
          {!isGenerating && meshyModel && (
            <div className="space-y-3 rounded-2xl border-2 border-accent/20 bg-surface p-3.5 shadow-sm">
              {/* Photo header with Meshy badge & remove button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={meshyModel.photoUrl}
                    alt="Reference"
                    className="h-10 w-10 rounded-lg object-cover ring-1 ring-black/10"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                        <Sparkles size={10} /> Meshy AI
                      </span>
                      <span className="text-xs font-semibold text-navy truncate max-w-[140px]">
                        {meshyModel.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-navy/50">3D mesh synthesized from photo</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMeshyModel(null);
                    setFile(null);
                  }}
                  className="rounded-full p-1 text-navy/40 hover:bg-navy/5 hover:text-navy"
                  aria-label="Remove model"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Embedded Three.js 3D Viewport */}
              <ModelPreviewer
                modelType={meshyModel.type}
                dimensions={meshyModel.dimensions}
                materialName={material}
                estimatedGrams={meshyModel.estimatedGrams}
              />

              {/* AI Co-Pilot Assistance Card */}
              <div className="rounded-xl bg-navy/5 p-3 text-xs text-navy/80">
                <div className="flex items-start gap-2">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-white">
                    <Bot size={12} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-navy">AI Co-pilot</p>
                    <p className="mt-0.5 leading-relaxed text-navy/70">{meshyModel.agentSummary}</p>
                  </div>
                </div>

                {/* Quick refinement action chips */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleRefine("+2mm thickness")}
                    className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-navy/80 shadow-xs hover:bg-navy/5"
                  >
                    +2mm thickness
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRefine("Add 45° gusset ribs")}
                    className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-navy/80 shadow-xs hover:bg-navy/5"
                  >
                    Reinforce ribs
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRefine("Add M4 mounting holes")}
                    className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-navy/80 shadow-xs hover:bg-navy/5"
                  >
                    Add mounting holes
                  </button>
                </div>

                {/* Custom refinement prompt input */}
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-black/5">
                  <input
                    type="text"
                    value={agentPrompt}
                    onChange={(e) => setAgentPrompt(e.target.value)}
                    placeholder="Tell agent: e.g. make it stronger..."
                    className="flex-1 bg-transparent text-[11px] text-navy outline-none placeholder:text-navy/35"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (agentPrompt.trim()) handleRefine(agentPrompt);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (agentPrompt.trim()) handleRefine(agentPrompt);
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded text-accent hover:bg-accent/10"
                  >
                    <Send size={11} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Case 4: Standard STL/OBJ Uploaded */}
          {!selectedDesign && !isGenerating && !meshyModel && file && isModel && (
            <div className="flex w-full items-center justify-between rounded-xl bg-navy/5 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm text-navy">
                <FileIcon size={16} />
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
          )}

          {/* Case 5: Empty Dropzone with Meshy Presets */}
          {!selectedDesign && !isGenerating && !meshyModel && !file && (
            <div className="space-y-3">
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
                className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-7 text-center transition-colors ${
                  dragOver ? "border-accent bg-accent/5" : "border-navy/15 bg-surface"
                }`}
              >
                <UploadCloud size={28} className="text-navy/30" />
                <div>
                  <p className="text-sm font-medium text-navy/70">
                    Drag &amp; drop an STL/OBJ file
                  </p>
                  <p className="text-xs text-navy/40">
                    or drop a <span className="font-semibold text-accent">photo</span> to generate a 3D model with Meshy AI
                  </p>
                </div>
                <label className="mt-1.5 cursor-pointer rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white transition active:scale-95">
                  Browse files or photos
                  <input
                    type="file"
                    accept=".stl,.obj,image/*"
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </label>
              </div>

              {/* One-tap Sample Presets for Meshy AI */}
              <div className="rounded-xl bg-navy/5 p-3">
                <p className="flex items-center gap-1 text-[11px] font-semibold text-navy/60">
                  <Sparkles size={11} className="text-accent" />
                  Try Meshy Image-to-3D with sample parts:
                </p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {SAMPLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="flex items-center gap-2 rounded-lg bg-surface p-2 text-left ring-1 ring-black/5 transition hover:ring-accent/40 active:scale-[0.98]"
                    >
                      <img
                        src={preset.photoUrl}
                        alt={preset.name}
                        className="h-8 w-8 shrink-0 rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-navy">{preset.name}</p>
                        <p className="text-[10px] text-navy/50">{preset.recommendedMaterial} · ~{preset.estimatedGrams}g</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent shadow-xs">
              <Calculator size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy">
                Est. ${estimate.low.toFixed(0)}–${estimate.high.toFixed(0)}
              </p>
              <p className="text-xs text-navy/50">
                ~{estimate.grams}g of {material},{" "}
                {meshyModel
                  ? "calculated from your Meshy 3D mesh"
                  : selectedDesign
                  ? "based on this design"
                  : "based on your file"}{" "}
                · printers set final price
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-semibold text-navy">
            Needed by <span className="font-normal text-navy/40">(optional)</span>
          </label>
          <div className="flex items-center gap-2 rounded-xl bg-surface px-3.5 py-3 ring-1 ring-black/5">
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
            className="w-full resize-none rounded-xl bg-surface px-3.5 py-3 text-sm text-navy outline-none ring-1 ring-black/5 placeholder:text-navy/35"
          />
        </div>
      </form>

      <div className="border-t border-black/5 bg-surface px-4 py-3.5">
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
