import { useEffect, useRef, useState } from "react";
import { Box, Download, RotateCcw, Pause, Play, ZoomIn, ZoomOut, AlertCircle } from "lucide-react";

import { MAX_STL_BYTES, validateSTLBuffer, validateSTLGeometry } from "../lib/stlValidation";
import { normalizeSTLToMillimeters, isCurrentModelInfo } from "../lib/stlUnits";
export { MAX_STL_BYTES };

function sampleGeometry(THREE, type, dims) {
  const x = Math.max(1, Number(dims.x) || 60), y = Math.max(1, Number(dims.y) || 60), z = Math.max(1, Number(dims.z) || 60);
  if (type === "tile") {
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      if (i === 0) shape.moveTo(Math.cos(a) * x / 2, Math.sin(a) * y / 2);
      else shape.lineTo(Math.cos(a) * x / 2, Math.sin(a) * y / 2);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: z, bevelEnabled: false });
  }
  if (type === "planter") {
    const points = [new THREE.Vector2(0, 0), new THREE.Vector2(x / 2, 0), new THREE.Vector2(x / 2, z), new THREE.Vector2(Math.max(1, x / 2 - 3), z), new THREE.Vector2(Math.max(1, x / 2 - 3), 3), new THREE.Vector2(0, 3)];
    return new THREE.LatheGeometry(points, 12);
  }
  if (type === "organizer" || type === "enclosure") {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(x, 0); shape.lineTo(x, y); shape.lineTo(0, y); shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(3, 3); hole.lineTo(3, y - 3); hole.lineTo(x - 3, y - 3); hole.lineTo(x - 3, 3); hole.closePath();
    shape.holes.push(hole);
    return new THREE.ExtrudeGeometry(shape, { depth: z, bevelEnabled: false });
  }
  return new THREE.BoxGeometry(x, y, z);
}

export default function ModelPreviewer({ file = null, sourceUnits = "mm", modelType = "planter", dimensions = { x: 60, y: 60, z: 70 }, materialName = "PLA", title = "Local model viewer", onModelInfo, onSTLReady }) {
  const containerRef = useRef(null), canvasRef = useRef(null), runtimeRef = useRef(null);
  const callbacks = useRef({ onModelInfo, onSTLReady });
  const [status, setStatus] = useState("loading"), [error, setError] = useState(""), [info, setInfo] = useState(null);
  const [wireframe, setWireframe] = useState(false), [rotating, setRotating] = useState(false), [downloadError, setDownloadError] = useState("");
  const x = dimensions?.x, y = dimensions?.y, z = dimensions?.z;
  const effectiveSourceUnits = file ? sourceUnits : "mm";
  const infoIsCurrent = isCurrentModelInfo(info, { file, sourceUnits: effectiveSourceUnits, modelType });
  useEffect(() => { callbacks.current = { onModelInfo, onSTLReady }; }, [onModelInfo, onSTLReady]);
  useEffect(() => {
    let active = true, frame = null, resize = null, renderer = null, controls = null;
    let sourceGeometry = null, original = null, displayed = null, surface = null, grid = null;
    // eslint-disable-next-line react/set-state-in-effect -- Reset state when replacing external WebGL and file resources.
    setStatus("loading"); setError(""); setInfo(null); setDownloadError("");
    callbacks.current.onModelInfo?.(null);
    async function initialize() {
      try {
        const [THREE, { STLLoader }, { STLExporter }, { OrbitControls }] = await Promise.all([
          import("three"), import("three/addons/loaders/STLLoader.js"), import("three/addons/exporters/STLExporter.js"), import("three/addons/controls/OrbitControls.js"),
        ]);
        let buffer;
        if (file) {
          if (!/\.stl$/i.test(file.name) || file.size > MAX_STL_BYTES) throw new Error("Choose an STL file no larger than 10 MB.");
          buffer = await file.arrayBuffer();
        }
        if (!active) return;
        const expectedCount = buffer ? validateSTLBuffer(buffer) : null;
        sourceGeometry = buffer ? new STLLoader().parse(buffer) : sampleGeometry(THREE, modelType, { x, y, z });
        validateSTLGeometry(sourceGeometry, expectedCount);
        original = normalizeSTLToMillimeters(sourceGeometry, effectiveSourceUnits);
        const positions = original.getAttribute("position");
        const size = original.boundingBox.getSize(new THREE.Vector3()), longest = Math.max(size.x, size.y, size.z);
        if (!longest) throw new Error("The STL has no measurable geometry.");
        const modelInfo = { dimensions: { x: size.x, y: size.y, z: size.z }, units: "mm", sourceUnits: effectiveSourceUnits, sourceFile: file, modelType: file ? null : modelType, triangles: original.index ? original.index.count / 3 : positions.count / 3, isSample: !file };
        setInfo(modelInfo); callbacks.current.onModelInfo?.(modelInfo);
        const exportBlob = () => new Blob([new STLExporter().parse(new THREE.Mesh(original), { binary: true })], { type: "application/octet-stream" });
        runtimeRef.current = { exportBlob, modelInfo, mesh: null, controls: null, camera: null };
        callbacks.current.onSTLReady?.(exportBlob());
        const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
        camera.position.set(6, 4.2, 6);
        renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        scene.add(new THREE.HemisphereLight(0xffffff, 0x536781, 2.4));
        const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(4, 8, 5); scene.add(key);
        displayed = original.clone(); displayed.center();
        surface = new THREE.MeshStandardMaterial({ color: 0xf47c40, roughness: 0.48, metalness: 0.05 });
        const mesh = new THREE.Mesh(displayed, surface); mesh.scale.setScalar(3.7 / longest); scene.add(mesh);
        grid = new THREE.GridHelper(7, 14, 0x4e6880, 0x263e53); grid.position.y = -(size.y * 3.7 / longest) / 2 - 0.025; scene.add(grid);
        controls = new OrbitControls(camera, canvasRef.current); controls.enableDamping = true; controls.enablePan = false;
        controls.minDistance = 3; controls.maxDistance = 16; controls.autoRotateSpeed = 1.1;
        runtimeRef.current = { exportBlob, modelInfo, mesh, controls, camera };
        resize = new ResizeObserver(() => { const width = containerRef.current?.clientWidth || 640; renderer.setSize(width, 340, false); camera.aspect = width / 340; camera.updateProjectionMatrix(); });
        resize.observe(containerRef.current);
        function animate() { if (!active) return; frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
        animate(); setStatus("ready");
      } catch (err) { if (active) { setError(err.message || "This model could not be displayed."); setStatus("error"); } }
    }
    initialize();
    return () => {
      active = false; if (frame) cancelAnimationFrame(frame); resize?.disconnect(); controls?.dispose(); renderer?.dispose();
      sourceGeometry?.dispose(); original?.dispose(); displayed?.dispose(); surface?.dispose(); grid?.geometry.dispose();
      if (Array.isArray(grid?.material)) grid.material.forEach((m) => m.dispose()); else grid?.material.dispose();
      runtimeRef.current = null;
    };
  }, [file, modelType, x, y, z, effectiveSourceUnits]);
  useEffect(() => { if (runtimeRef.current?.mesh) runtimeRef.current.mesh.material.wireframe = wireframe; }, [wireframe, status]);
  useEffect(() => { if (runtimeRef.current?.controls) runtimeRef.current.controls.autoRotate = rotating; }, [rotating, status]);
  function download() {
    try {
      if (!isCurrentModelInfo(runtimeRef.current?.modelInfo, { file, sourceUnits: effectiveSourceUnits, modelType })) return;
      const blob = runtimeRef.current?.exportBlob(); if (!blob) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = file ? `${file.name.replace(/\.stl$/i, "")}-normalized-mm.stl` : `polypod-sample-${modelType}-mm.stl`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setDownloadError("The STL could not be exported. Try loading the model again."); }
  }
  function zoom(multiplier) { const runtime = runtimeRef.current; if (runtime?.camera) { runtime.camera.position.multiplyScalar(multiplier); runtime.controls.update(); } }
  return <div className="overflow-hidden rounded-2xl border border-navy/15" ref={containerRef}>
    <div className="relative bg-[#132c3e] text-white" style={{ minHeight: 340 }}>
      <canvas ref={canvasRef} aria-label={`${title}. Drag to rotate; use the zoom controls below.`} className="block w-full touch-none" style={{ height: 340 }} />
      <div className="pointer-events-none absolute left-5 top-4"><p className="text-xs font-semibold uppercase tracking-[.15em] text-white/60">{file ? "Your STL · on this device" : "Procedural sample · on this device"}</p><p className="mt-1 text-lg font-semibold">{title}</p></div>
      {(status === "loading" || (info && !infoIsCurrent)) && <div role="status" className="absolute inset-0 flex items-center justify-center bg-[#132c3e] text-white/80">Preparing the local viewer…</div>}
      {status === "error" && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#132c3e] p-8 text-center"><AlertCircle size={30} /><p className="max-w-md">{error}</p>{info && <p className="text-sm text-white/65">Model data loaded. 3D rendering may be unavailable on this device; STL export is still available.</p>}</div>}
      {infoIsCurrent && <div className="absolute bottom-4 left-5 right-5 flex flex-wrap justify-between gap-2 text-xs text-white/70"><span>{Object.values(info.dimensions).map((value) => +value.toPrecision(6)).join(" × ")} mm · {materialName}</span><span>{info.triangles.toLocaleString()} triangles</span></div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3">
      <div className="flex flex-wrap gap-1">
        <button type="button" aria-label="Toggle wireframe" aria-pressed={wireframe} disabled={status !== "ready"} className={`chip ${wireframe ? "chip-active" : ""}`} onClick={() => setWireframe(!wireframe)}><Box size={18} /></button>
        <button type="button" aria-label={rotating ? "Pause rotation" : "Rotate model"} aria-pressed={rotating} disabled={status !== "ready"} className="chip" onClick={() => setRotating(!rotating)}>{rotating ? <Pause size={18} /> : <Play size={18} />}</button>
        <button type="button" aria-label="Zoom in" disabled={status !== "ready"} className="chip" onClick={() => zoom(0.8)}><ZoomIn size={18} /></button>
        <button type="button" aria-label="Zoom out" disabled={status !== "ready"} className="chip" onClick={() => zoom(1.2)}><ZoomOut size={18} /></button>
        <button type="button" aria-label="Reset view" disabled={status !== "ready"} className="chip" onClick={() => runtimeRef.current?.controls?.reset()}><RotateCcw size={18} /></button>
      </div>
      <button type="button" className="button-secondary" onClick={download} disabled={!infoIsCurrent}><Download size={16} /> Export STL (mm)</button>
    </div>
    <p className="border-t border-navy/10 bg-white px-4 py-3 text-xs leading-relaxed text-navy/65">{file ? `Source coordinates are interpreted as ${effectiveSourceUnits}. Physical dimensions and exported coordinates are normalized to mm. STL does not store unit metadata; choose mm when reopening this export.` : "Procedural samples and exported coordinates use millimeters (mm)."} A visual preview does not validate printability, strength, or fit. This viewer parses the model on this device.</p>
    {downloadError && <p role="alert" className="p-3 text-sm text-red-700">{downloadError}</p>}
  </div>;
}



