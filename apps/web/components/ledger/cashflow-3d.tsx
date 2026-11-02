"use client";

import {
  ArrowsClockwise,
  CheckCircle,
  Coins,
  CursorClick,
  HandPointing,
  LockKey,
  ShieldCheck,
  TrendUp,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

type EnvelopeKey = "all" | "needs" | "emergency" | "spending";

interface EnvelopeInfo {
  key: EnvelopeKey;
  label: string;
  allocation: string;
  amount: string;
  detail: string;
  status: string;
  colorHex: number;
  badgeClass: string;
}

const ENVELOPES: Record<EnvelopeKey, EnvelopeInfo> = {
  all: {
    key: "all",
    label: "Semua Pos Kas",
    allocation: "100%",
    amount: "Rp 18.420.000",
    detail: "Seluruh dana terikat pada pos tujuan tanpa saldo mengambang.",
    status: "Buku Kas Seimbang",
    colorHex: 0x10b981,
    badgeClass: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
  },
  needs: {
    key: "needs",
    label: "Kebutuhan Pokok",
    allocation: "52%",
    amount: "Rp 9.578.000",
    detail: "Alokasi belanja dapur, tagihan listrik, dan kewajiban bulanan tetap.",
    status: "Terkunci Aman",
    colorHex: 0xf59e0b,
    badgeClass: "text-amber-500 border-amber-500/30 bg-amber-500/10",
  },
  emergency: {
    key: "emergency",
    label: "Dana Darurat",
    allocation: "28%",
    amount: "Rp 5.157.000",
    detail: "Pos cadangan darurat di rekening terpisah, pantang disentuh untuk belanja harian.",
    status: "100% Tercapai",
    colorHex: 0x06b6d4,
    badgeClass: "text-cyan-500 border-cyan-500/30 bg-cyan-500/10",
  },
  spending: {
    key: "spending",
    label: "Bebas Belanja",
    allocation: "20%",
    amount: "Rp 3.685.000",
    detail: "Batas aman pengeluaran diskresioner harian rata rata Rp 245.000 per hari.",
    status: "Batas Aman Aktif",
    colorHex: 0x10b981,
    badgeClass: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
  },
};

/**
 * Safely checks if WebGL or WebGL2 context is available without crashing.
 */
function isWebGLSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function Cashflow3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);

  const [activeEnvelope, setActiveEnvelope] = useState<EnvelopeKey>("all");
  const [isInteracting, setIsInteracting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [webglAvailable, setWebglAvailable] = useState(true);

  // Mutable refs to bridge React state to the Three.js animation loop without re-running effects
  const activeKeyRef = useRef<EnvelopeKey>("all");
  activeKeyRef.current = activeEnvelope;

  useEffect(() => {
    const container = containerRef.current;
    const canvasMount = canvasMountRef.current;
    if (!container || !canvasMount) return;

    if (!isWebGLSupported()) {
      setWebglAvailable(false);
      return;
    }

    // Check prefers reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 3.2, 9.8);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "default",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0);

      // Append dynamically created canvas element to avoid React Strict Mode context reuse issues
      const domCanvas = renderer.domElement;
      domCanvas.className =
        "absolute inset-0 size-full cursor-grab active:cursor-grabbing touch-none select-none";
      domCanvas.setAttribute("aria-label", "Kanvas visualisasi 3D arus kas dan alokasi amplop");
      canvasMount.replaceChildren(domCanvas);
    } catch (e) {
      console.warn("WebGL initialization failed, falling back to vector view:", e);
      setWebglAvailable(false);
      return;
    }

    const canvas = renderer.domElement;

    // 2. Lighting setup
    const isDark = document.documentElement.classList.contains("dark");

    const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 0.9 : 1.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, isDark ? 2.8 : 3.2);
    dirLight1.position.set(5, 8, 6);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x10b981, isDark ? 2.0 : 1.2);
    dirLight2.position.set(-6, -4, -4);
    scene.add(dirLight2);

    const centerPointLight = new THREE.PointLight(0x10b981, isDark ? 3.0 : 2.0, 10);
    centerPointLight.position.set(0, 0, 0);
    scene.add(centerPointLight);

    // 3. Central Vault Core (Precision Integer Token)
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // Main coin cylinder
    const coinGeo = new THREE.CylinderGeometry(1.65, 1.65, 0.26, 64);
    const coinMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x1c1e22 : 0x2e3239,
      metalness: 0.92,
      roughness: 0.22,
      emissive: 0x064e3b,
      emissiveIntensity: isDark ? 0.28 : 0.15,
    });
    const coinMesh = new THREE.Mesh(coinGeo, coinMat);
    coinMesh.rotation.x = Math.PI / 2;
    coreGroup.add(coinMesh);

    // Outer coin rim bevel
    const rimGeo = new THREE.TorusGeometry(1.68, 0.08, 16, 64);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x10b981,
      emissiveIntensity: 0.45,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    coreGroup.add(rimMesh);

    // Inner bevel groove
    const innerGrooveGeo = new THREE.TorusGeometry(1.35, 0.03, 16, 64);
    const innerGrooveMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x34d399 : 0x059669,
      metalness: 0.9,
      roughness: 0.3,
    });
    const innerGrooveMesh = new THREE.Mesh(innerGrooveGeo, innerGrooveMat);
    coreGroup.add(innerGrooveMesh);

    // Central geometric facet: faceted integer octahedron
    const octaGeo = new THREE.OctahedronGeometry(0.72, 0);
    const octaMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      metalness: 0.88,
      roughness: 0.18,
      emissive: 0x059669,
      emissiveIntensity: 0.5,
      flatShading: true,
    });
    const octaMesh = new THREE.Mesh(octaGeo, octaMat);
    coreGroup.add(octaMesh);

    // 4. Concentric Envelope Orbit Rings
    // Ring 1: Kebutuhan Pokok (Radius 2.7)
    const ring1Geo = new THREE.TorusGeometry(2.7, 0.024, 16, 100);
    const ring1Mat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.85,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 2.3;
    ring1.rotation.y = 0.2;
    scene.add(ring1);

    // Ring 2: Dana Darurat (Radius 3.7)
    const ring2Geo = new THREE.TorusGeometry(3.7, 0.026, 16, 120);
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.85,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = Math.PI / 2.6;
    ring2.rotation.y = -0.35;
    scene.add(ring2);

    // Ring 3: Bebas Belanja (Radius 4.7)
    const ring3Geo = new THREE.TorusGeometry(4.7, 0.03, 16, 140);
    const ring3Mat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      metalness: 0.9,
      roughness: 0.15,
      emissive: 0x10b981,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.9,
    });
    const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
    ring3.rotation.x = Math.PI / 2.15;
    ring3.rotation.y = 0.45;
    scene.add(ring3);

    // 5. Orbiting Transaction Particles / Currency Nodes
    interface Orbiter {
      mesh: THREE.Mesh;
      ring: THREE.Mesh;
      radius: number;
      speed: number;
      angle: number;
      envelope: EnvelopeKey;
    }

    const orbiters: Orbiter[] = [];
    const orbiterGeo = new THREE.SphereGeometry(0.09, 16, 16);

    const createOrbiter = (
      radius: number,
      ring: THREE.Mesh,
      envelope: EnvelopeKey,
      count: number,
      color: number,
    ) => {
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.75,
        metalness: 0.9,
        roughness: 0.1,
      });

      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(orbiterGeo, mat);
        scene.add(mesh);
        orbiters.push({
          mesh,
          ring,
          radius,
          speed: (0.45 + Math.random() * 0.3) * (i % 2 === 0 ? 1 : -1),
          angle: (i / count) * Math.PI * 2 + Math.random() * 0.5,
          envelope,
        });
      }
    };

    createOrbiter(2.7, ring1, "needs", 4, 0xf59e0b);
    createOrbiter(3.7, ring2, "emergency", 5, 0x06b6d4);
    createOrbiter(4.7, ring3, "spending", 6, 0x10b981);

    // 6. Ambient Constellation Nodes (Integer Precision Grid)
    const bgNodeGeo = new THREE.BufferGeometry();
    const bgNodeCount = 75;
    const posArray = new Float32Array(bgNodeCount * 3);

    for (let i = 0; i < bgNodeCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 16;
      posArray[i + 1] = (Math.random() - 0.5) * 10;
      posArray[i + 2] = (Math.random() - 0.5) * 8 - 2;
    }

    bgNodeGeo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
    const bgNodeMat = new THREE.PointsMaterial({
      size: 0.05,
      color: isDark ? 0x6ee7b7 : 0x059669,
      transparent: true,
      opacity: isDark ? 0.45 : 0.25,
    });
    const bgParticles = new THREE.Points(bgNodeGeo, bgNodeMat);
    scene.add(bgParticles);

    // 7. Interactive Mouse / Touch Orbit Controls
    let pointerDown = false;
    let prevPointerX = 0;
    let prevPointerY = 0;
    let targetRotY = 0.35;
    let targetRotX = 0.25;
    let currentRotY = 0.35;
    let currentRotX = 0.25;

    let mouseNormX = 0;
    let mouseNormY = 0;

    const onPointerDown = (e: PointerEvent) => {
      pointerDown = true;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;
      setIsInteracting(true);
      canvas.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseNormX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNormY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      if (pointerDown) {
        const deltaX = e.clientX - prevPointerX;
        const deltaY = e.clientY - prevPointerY;
        prevPointerX = e.clientX;
        prevPointerY = e.clientY;

        targetRotY += deltaX * 0.008;
        targetRotX += deltaY * 0.008;
        targetRotX = Math.max(-0.8, Math.min(0.8, targetRotX));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      pointerDown = false;
      setIsInteracting(false);
      try {
        canvas.releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    };

    const onPointerEnter = () => setIsHovered(true);
    const onPointerLeave = () => {
      setIsHovered(false);
      pointerDown = false;
      setIsInteracting(false);
      mouseNormX = 0;
      mouseNormY = 0;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerenter", onPointerEnter);
    canvas.addEventListener("pointerleave", onPointerLeave);

    // 8. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        if (newWidth > 0 && newHeight > 0) {
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        }
      }
    });
    resizeObserver.observe(container);

    // 9. Animation loop using THREE.Timer (per Three.js r186 guidelines)
    const timer = new THREE.Timer();
    timer.connect(document);

    const animate = () => {
      timer.update();
      const delta = Math.min(timer.getDelta(), 0.1);
      const elapsed = timer.getElapsed();

      // Smooth damp rotation
      const dampFactor = pointerDown ? 0.2 : 0.06;
      currentRotX += (targetRotX - currentRotX) * dampFactor;
      currentRotY += (targetRotY - currentRotY) * dampFactor;

      // Idle auto-orbit when not dragging
      if (!pointerDown && !prefersReducedMotion) {
        targetRotY += 0.25 * delta;
      }

      // Parallax mouse tilt
      const parallaxX = mouseNormX * 0.15;
      const parallaxY = mouseNormY * 0.12;

      coreGroup.rotation.x = currentRotX + parallaxY;
      coreGroup.rotation.y = currentRotY + parallaxX;

      // Facet spin inside coin
      octaMesh.rotation.y = elapsed * 0.6;
      octaMesh.rotation.z = Math.sin(elapsed * 0.8) * 0.3;

      // Animate rings and orbiters
      const active = activeKeyRef.current;

      // Ring 1 highlight & pulse
      const r1Active = active === "all" || active === "needs";
      ring1Mat.opacity = THREE.MathUtils.lerp(ring1Mat.opacity, r1Active ? 0.95 : 0.25, 0.08);
      ring1Mat.emissiveIntensity = THREE.MathUtils.lerp(
        ring1Mat.emissiveIntensity,
        active === "needs" ? 0.75 : r1Active ? 0.3 : 0.08,
        0.08,
      );

      // Ring 2 highlight & pulse
      const r2Active = active === "all" || active === "emergency";
      ring2Mat.opacity = THREE.MathUtils.lerp(ring2Mat.opacity, r2Active ? 0.95 : 0.25, 0.08);
      ring2Mat.emissiveIntensity = THREE.MathUtils.lerp(
        ring2Mat.emissiveIntensity,
        active === "emergency" ? 0.8 : r2Active ? 0.35 : 0.08,
        0.08,
      );

      // Ring 3 highlight & pulse
      const r3Active = active === "all" || active === "spending";
      ring3Mat.opacity = THREE.MathUtils.lerp(ring3Mat.opacity, r3Active ? 0.95 : 0.25, 0.08);
      ring3Mat.emissiveIntensity = THREE.MathUtils.lerp(
        ring3Mat.emissiveIntensity,
        active === "spending" ? 0.85 : r3Active ? 0.4 : 0.08,
        0.08,
      );

      // Wobble rings gently
      if (!prefersReducedMotion) {
        ring1.rotation.z = elapsed * 0.05;
        ring2.rotation.z = -elapsed * 0.04;
        ring3.rotation.z = elapsed * 0.03;
      }

      // Update particle positions along their respective rings
      const v = new THREE.Vector3();
      for (const orbiter of orbiters) {
        const ringIsActive = active === "all" || active === orbiter.envelope;
        const currentSpeed = (ringIsActive ? 1.0 : 0.3) * orbiter.speed;

        orbiter.angle += currentSpeed * delta;

        // Position in ring local space (ring plane: xy)
        v.set(
          Math.cos(orbiter.angle) * orbiter.radius,
          Math.sin(orbiter.angle) * orbiter.radius,
          0,
        );

        // Transform to world space using the ring's matrix
        v.applyMatrix4(orbiter.ring.matrixWorld);
        orbiter.mesh.position.copy(v);

        // Scale orbiter based on active envelope
        const targetScale = ringIsActive ? 1.25 : 0.6;
        orbiter.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
      }

      // Drift background constellation
      if (!prefersReducedMotion) {
        bgParticles.rotation.y = elapsed * 0.02;
      }

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animate);

    // 10. Cleanup
    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      timer.dispose();

      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerenter", onPointerEnter);
      canvas.removeEventListener("pointerleave", onPointerLeave);

      // Dispose all geometry and materials
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh || (child as THREE.Points).isPoints) {
          const m = child as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          if (m.material) {
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            for (const mat of mats) mat.dispose();
          }
        }
      });

      // Detach canvas from DOM
      if (canvasMount.contains(canvas)) {
        canvasMount.removeChild(canvas);
      }

      renderer.dispose();
    };
  }, []);

  const currentInfo = ENVELOPES[activeEnvelope];

  return (
    <div
      ref={containerRef}
      className="relative flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card/75 shadow-sm backdrop-blur-md"
    >
      {/* Visualizer Header Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/40 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <Coins className="size-4" weight="fill" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground sm:text-base">
                Simulasi Arus Kas Tiga Dimensi
              </h2>
              <span className="hidden items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
                <ShieldCheck className="size-3 text-primary" weight="fill" />
                Integer Presisi
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Putar dan pilih cincin alokasi untuk memeriksa integritas buku kas secara interaktif.
            </p>
          </div>
        </div>

        {/* Interaction badge indicator */}
        <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              isInteracting
                ? "border-primary/40 bg-primary/10 text-primary"
                : isHovered
                  ? "border-border bg-background text-foreground"
                  : "border-border/60 bg-muted/30 text-muted-foreground",
            )}
          >
            <HandPointing className="size-3.5" />
            {isInteracting ? "Memutar Perspektif" : "Tarik untuk Memutar"}
          </span>
        </div>
      </div>

      {/* Main 3D Canvas Area */}
      <div className="relative h-[340px] w-full sm:h-[400px] lg:h-[460px]">
        {/* Dynamic Canvas Mount Point */}
        <div ref={canvasMountRef} className="absolute inset-0 size-full overflow-hidden" />

        {/* Graceful Vector Fallback if WebGL is disabled or context is unavailable */}
        {!webglAvailable && (
          <div className="absolute inset-0 flex size-full items-center justify-center p-6">
            <svg
              className="size-72 sm:size-80"
              viewBox="0 0 400 400"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Diagram alokasi amplop dan arus kas"
            >
              {/* Outer Ring: Spending */}
              <circle
                cx="200"
                cy="200"
                r="160"
                stroke="currentColor"
                className={cn(
                  "transition-all duration-300",
                  activeEnvelope === "all" || activeEnvelope === "spending"
                    ? "text-emerald-500 opacity-90 stroke-[3px]"
                    : "text-muted-foreground/30 opacity-40 stroke-[1.5px]",
                )}
                strokeDasharray="6 6"
              />
              {/* Middle Ring: Emergency */}
              <circle
                cx="200"
                cy="200"
                r="115"
                stroke="currentColor"
                className={cn(
                  "transition-all duration-300",
                  activeEnvelope === "all" || activeEnvelope === "emergency"
                    ? "text-cyan-500 opacity-90 stroke-[3px]"
                    : "text-muted-foreground/30 opacity-40 stroke-[1.5px]",
                )}
                strokeDasharray="4 4"
              />
              {/* Inner Ring: Needs */}
              <circle
                cx="200"
                cy="200"
                r="70"
                stroke="currentColor"
                className={cn(
                  "transition-all duration-300",
                  activeEnvelope === "all" || activeEnvelope === "needs"
                    ? "text-amber-500 opacity-90 stroke-[3px]"
                    : "text-muted-foreground/30 opacity-40 stroke-[1.5px]",
                )}
              />
              {/* Center Vault Core Token */}
              <circle
                cx="200"
                cy="200"
                r="36"
                className="fill-card stroke-primary stroke-2 shadow-lg"
              />
              <circle
                cx="200"
                cy="200"
                r="26"
                className="fill-primary/20 stroke-primary/40 stroke-1"
              />
              <polygon points="200,186 212,200 200,214 188,200" className="fill-primary" />
            </svg>
          </div>
        )}

        {/* Floating Telemetry HUD Card (Desktop overlay, bottom left) */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 max-w-xs sm:bottom-6 sm:left-6">
          <div className="pointer-events-auto rounded-xl border border-border/80 bg-background/90 p-3.5 shadow-md backdrop-blur-md transition-all duration-300">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Pos Terpilih
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold",
                  currentInfo.badgeClass,
                )}
              >
                <CheckCircle className="size-3" weight="fill" />
                {currentInfo.status}
              </span>
            </div>

            <div className="mt-1.5 flex items-baseline justify-between gap-3">
              <p className="font-heading text-base font-semibold text-foreground">
                {currentInfo.label}
              </p>
              <span className="font-mono text-sm font-bold text-primary">{currentInfo.amount}</span>
            </div>

            <p className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty">
              {currentInfo.detail}
            </p>

            <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              <span>Alokasi Pemasukan:</span>
              <span className="font-mono font-medium text-foreground">
                {currentInfo.allocation}
              </span>
            </div>
          </div>
        </div>

        {/* Floating Control Legend (Top right overlay) */}
        <div className="pointer-events-none absolute top-4 right-4 z-10 hidden sm:block">
          <div className="rounded-lg border border-border/60 bg-background/80 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground shadow-xs backdrop-blur-sm">
            <span className="inline-flex items-center gap-1.5">
              <CursorClick className="size-3 text-primary" />
              Geser kanvas 360° · Ketuk pos untuk isolasi
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Envelope Switcher Bar */}
      <div className="border-t border-border bg-muted/20 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-muted-foreground">Isolasi Cincin Alokasi:</p>

          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={() => setActiveEnvelope("all")}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-300",
                activeEnvelope === "all"
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <ArrowsClockwise className="size-3.5" />
              Semua Pos
            </button>

            <button
              type="button"
              onClick={() => setActiveEnvelope("needs")}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-300",
                activeEnvelope === "needs"
                  ? "border-amber-500 bg-amber-500 text-amber-950 font-semibold shadow-xs dark:text-amber-100 dark:bg-amber-600"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <LockKey className="size-3.5" />
              Kebutuhan Pokok
            </button>

            <button
              type="button"
              onClick={() => setActiveEnvelope("emergency")}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-300",
                activeEnvelope === "emergency"
                  ? "border-cyan-500 bg-cyan-500 text-cyan-950 font-semibold shadow-xs dark:text-cyan-100 dark:bg-cyan-600"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <ShieldCheck className="size-3.5" />
              Dana Darurat
            </button>

            <button
              type="button"
              onClick={() => setActiveEnvelope("spending")}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-300",
                activeEnvelope === "spending"
                  ? "border-emerald-500 bg-emerald-500 text-emerald-950 font-semibold shadow-xs dark:text-emerald-100 dark:bg-emerald-600"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <TrendUp className="size-3.5" />
              Bebas Belanja
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
