import { useEffect, useRef, useState } from "react";
import { Box, Download, Maximize2, RotateCcw, RefreshCw } from "lucide-react";
import { exportGeometryToBinarySTL } from "../services/meshyService";

/**
 * Robust Three.js loader: loads local module if bundled, or loads from CDN
 */
async function loadThree() {
  if (window.__THREE__) return window.__THREE__;
  try {
    const mod = await import("three");
    window.__THREE__ = mod;
    return mod;
  } catch (e) {
    const cdnMod = await import("https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js");
    window.__THREE__ = cdnMod;
    return cdnMod;
  }
}

export default function ModelPreviewer({
  modelType = "bracket",
  dimensions = { x: 52, y: 38, z: 24 },
  materialName = "PETG",
  estimatedGrams = 42,
  onSTLReady,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const meshRef = useRef(null);
  const rendererRef = useRef(null);
  const animFrameRef = useRef(null);

  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Geometry generator based on part type
  const createPartGeometry = (THREE, type, dims) => {
    const sx = dims.x / 20;
    const sy = dims.y / 20;
    const sz = dims.z / 20;

    if (type === "knob") {
      // Cylindrical fluted knob
      const geom = new THREE.CylinderGeometry(sx * 0.9, sx * 0.95, sy * 0.8, 24);
      return geom;
    }

    if (type === "clip") {
      // Compliant U-clip
      const shape = new THREE.Shape();
      shape.moveTo(-sx, -sy);
      shape.lineTo(sx, -sy);
      shape.lineTo(sx, sy);
      shape.lineTo(sx * 0.6, sy);
      shape.lineTo(sx * 0.6, -sy * 0.5);
      shape.lineTo(-sx * 0.6, -sy * 0.5);
      shape.lineTo(-sx * 0.6, sy);
      shape.lineTo(-sx, sy);
      shape.closePath();

      const extrudeSettings = {
        steps: 1,
        depth: sz,
        bevelEnabled: true,
        bevelThickness: 0.15,
        bevelSize: 0.15,
        bevelSegments: 2,
      };
      const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geom.center();
      return geom;
    }

    if (type === "enclosure") {
      // Chamfered box enclosure
      const geom = new THREE.BoxGeometry(sx * 1.6, sy * 1.1, sz * 0.8, 4, 4, 4);
      return geom;
    }

    // Default: Structural Angle Bracket with gusset
    const shape = new THREE.Shape();
    const t = 0.45; // wall thickness
    shape.moveTo(0, 0);
    shape.lineTo(sx * 1.2, 0);
    shape.lineTo(sx * 1.2, t);
    shape.lineTo(t, t);
    shape.lineTo(t, sy * 1.2);
    shape.lineTo(0, sy * 1.2);
    shape.closePath();

    const extrudeSettings = {
      steps: 1,
      depth: sz * 1.1,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.1,
      bevelSegments: 3,
    };
    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.center();
    return geom;
  };

  useEffect(() => {
    let active = true;
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let camera, scene, renderer, mesh, grid;

    async function init() {
      if (!containerRef.current || !canvasRef.current) return;
      const THREE = await loadThree();
      if (!active) return;

      const width = containerRef.current.clientWidth || 360;
      const height = 230;

      scene = new THREE.Scene();
      sceneRef.current = scene;

      camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
      camera.position.set(4.2, 3.5, 4.5);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        alpha: true,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      rendererRef.current = renderer;

      // Studio lighting setup
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
      scene.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
      keyLight.position.set(5, 8, 4);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x90b0e0, 0.6);
      fillLight.position.set(-5, 2, -3);
      scene.add(fillLight);

      // Print bed build plate grid
      grid = new THREE.GridHelper(6, 12, 0x3d5a80, 0x1f334a);
      grid.position.y = -1.2;
      scene.add(grid);

      // 3D printable filament material (Polished orange/copper tint matching Poly POD accent)
      const material = new THREE.MeshStandardMaterial({
        color: 0xe8752d,
        roughness: 0.35,
        metalness: 0.15,
        wireframe,
      });

      const geometry = createPartGeometry(THREE, modelType, dimensions);
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0;
      mesh.castShadow = true;
      scene.add(mesh);
      meshRef.current = mesh;

      // Generate binary STL Blob for export / quote attachment
      if (onSTLReady) {
        try {
          const blob = exportGeometryToBinarySTL(geometry);
          onSTLReady(blob);
        } catch (e) {
          console.warn("Could not generate STL binary:", e);
        }
      }

      setIsLoading(false);

      // Touch & mouse orbit interaction
      const canvas = canvasRef.current;

      const onMouseDown = (e) => {
        isDragging = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        previousMousePosition = { x: clientX, y: clientY };
      };

      const onMouseMove = (e) => {
        if (!isDragging || !mesh) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - previousMousePosition.x;
        const deltaY = clientY - previousMousePosition.y;

        mesh.rotation.y += deltaX * 0.012;
        mesh.rotation.x += deltaY * 0.012;

        previousMousePosition = { x: clientX, y: clientY };
      };

      const onMouseUp = () => {
        isDragging = false;
      };

      canvas.addEventListener("mousedown", onMouseDown);
      canvas.addEventListener("touchstart", onMouseDown, { passive: true });
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("touchmove", onMouseMove, { passive: true });
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchend", onMouseUp);

      // Render loop
      const animate = () => {
        animFrameRef.current = requestAnimationFrame(animate);
        if (mesh && autoRotate && !isDragging) {
          mesh.rotation.y += 0.008;
        }
        renderer.render(scene, camera);
      };
      animate();

      return () => {
        canvas.removeEventListener("mousedown", onMouseDown);
        canvas.removeEventListener("touchstart", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("touchmove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("touchend", onMouseUp);
      };
    }

    init();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [modelType]);

  // Update wireframe mode without rebuilding scene
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.material.wireframe = wireframe;
    }
  }, [wireframe]);

  const handleDownloadSTL = () => {
    if (!meshRef.current) return;
    const blob = exportGeometryToBinarySTL(meshRef.current.geometry);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${modelType}-part.stl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleResetView = () => {
    if (meshRef.current) {
      meshRef.current.rotation.set(0, 0, 0);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl border border-navy/15 bg-gradient-to-b from-[#111f33] to-[#0c1828] text-white shadow-inner"
    >
      {/* 3D Canvas */}
      <canvas
        ref={canvasRef}
        className="block h-[230px] w-full cursor-grab touch-none active:cursor-grabbing"
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-navy/80 text-xs text-white/70">
          <RefreshCw size={18} className="animate-spin text-accent" />
          <span className="ml-2">Rendering 3D mesh...</span>
        </div>
      )}

      {/* Floating Viewport HUD Controls */}
      <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setWireframe((v) => !v)}
          title="Toggle Wireframe"
          className={`flex h-7 w-7 items-center justify-center rounded-lg backdrop-blur transition-colors ${
            wireframe ? "bg-accent text-white" : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}
        >
          <Box size={14} />
        </button>

        <button
          type="button"
          onClick={() => setAutoRotate((v) => !v)}
          title="Toggle 360° Auto-Rotate"
          className={`flex h-7 w-7 items-center justify-center rounded-lg backdrop-blur transition-colors ${
            autoRotate ? "bg-accent text-white" : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}
        >
          <RotateCcw size={14} />
        </button>

        <button
          type="button"
          onClick={handleResetView}
          title="Reset Orientation"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/70 backdrop-blur hover:bg-white/20"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* Bottom Info Badges */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <span>
            {dimensions.x} × {dimensions.y} × {dimensions.z} mm
          </span>
          <span className="text-white/40">·</span>
          <span className="text-accent-light">~{estimatedGrams}g {materialName}</span>
        </div>

        <button
          type="button"
          onClick={handleDownloadSTL}
          title="Export Binary STL"
          className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white shadow backdrop-blur transition hover:bg-white/25 active:scale-95"
        >
          <Download size={11} />
          <span>STL</span>
        </button>
      </div>
    </div>
  );
}
