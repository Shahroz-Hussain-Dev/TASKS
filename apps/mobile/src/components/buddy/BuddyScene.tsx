/**
 * Buddy in three.js — a procedural toy-like character. This file is the lazy
 * chunk that pulls in three / @react-three/fiber / drei, so the main bundle
 * stays small. All motion happens in a single useFrame driven by `state`.
 *
 * Performance notes (Android WebView): the canvas renders on demand at a
 * capped frame rate (30 fps for the small launcher, 60 for the hero), DPR is
 * clamped to 1.5, the ground shadow is a gradient sprite instead of a
 * re-rendered ContactShadows pass, and lights are kept to three.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, Group, MathUtils, Mesh, MeshStandardMaterial, PointLight, Shape } from "three";
import { BUDDY_COLORS as C, type BuddyState } from "./types";
import { prefersReducedMotion } from "./webgl";

const { damp, clamp } = MathUtils;
const TAU = Math.PI * 2;

/* Smooth bump 0 → 1 → 0 over [0, 1]. */
const bump = (p: number) => (p <= 0 || p >= 1 ? 0 : Math.sin(p * Math.PI));
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

interface Anim {
  t: number;
  prev: BuddyState | null;
  enteredAt: number;
  nextBlink: number;
  blinkStart: number;
  nextTilt: number;
  tiltDir: number;
}

function Character({ stateRef, calm }: { stateRef: { current: BuddyState }; calm: boolean }) {
  const root = useRef<Group>(null);
  const cap = useRef<Group>(null);
  const antenna = useRef<Group>(null);
  const pin = useRef<Group>(null);
  const pinMat = useRef<MeshStandardMaterial>(null);
  const pinLight = useRef<PointLight>(null);
  const eyeL = useRef<Group>(null);
  const eyeR = useRef<Group>(null);
  const pupils = useRef<Group>(null);
  const smile = useRef<Mesh>(null);
  const bars = useRef<(Mesh | null)[]>([]);
  const halo = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const body = useRef<Mesh>(null);

  const anim = useRef<Anim>({ t: 0, prev: null, enteredAt: 0, nextBlink: 1.6, blinkStart: -1, nextTilt: 4, tiltDir: 1 });

  // Cap peak: a ring segment with a little thickness, extruded from a 2D shape.
  const peakShape = useMemo(() => {
    const s = new Shape();
    const inner = 0.6;
    const outer = 1.08;
    const a0 = Math.PI * 0.22;
    const a1 = Math.PI * 0.78;
    s.absarc(0, 0, outer, a0, a1, false);
    s.absarc(0, 0, inner, a1, a0, true);
    s.closePath();
    return s;
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const a = anim.current;
    const s = stateRef.current;
    a.t += dt;
    const t = a.t;
    if (s !== a.prev) {
      a.prev = s;
      a.enteredAt = t;
    }
    const since = t - a.enteredAt;
    const amp = calm ? 0.35 : 1;

    // Pose targets.
    let rotX = 0;
    let rotY = 0;
    let rotZ = 0;
    let posY = 0;
    let posZ = 0;
    let squash = 1;
    let pinGlow = 0.45;
    let pinScale = 1;
    let capZ = 0;
    let antennaX = 0;
    let haloScale = 0;
    let armLRot = -0.85;
    let armRRot = 0.85;
    let pupilX = 0;
    let pupilY = 0;
    let eyeScaleY = 1;
    let eyeScaleX = 1;
    let mouthOpen = false;
    let smileScale = 1;
    let frown = false;
    let direct = false; // write posY directly (fast bounces)

    switch (s) {
      case "idle": {
        posY = Math.sin(t * 1.7) * 0.035 * amp;
        rotZ = Math.sin(t * 0.6) * 0.03 * amp;
        if (t > a.nextTilt) {
          const p = (t - a.nextTilt) / 1.4;
          if (p >= 1) {
            a.nextTilt = t + 4 + Math.random() * 4;
            a.tiltDir = Math.random() > 0.5 ? 1 : -1;
          } else rotZ += bump(p) * 0.16 * a.tiltDir * amp;
        }
        armLRot -= Math.sin(t * 1.7) * 0.08 * amp;
        armRRot += Math.sin(t * 1.7) * 0.08 * amp;
        break;
      }
      case "listening": {
        rotX = 0.2;
        posZ = 0.22;
        posY = Math.sin(t * 2.4) * 0.02 * amp;
        const pulse = (Math.sin(t * 6.5) + 1) / 2;
        pinGlow = 1.0 + pulse * 1.5;
        pinScale = 1 + pulse * 0.22;
        capZ = Math.sin(t * 11) * 0.06 * amp;
        eyeScaleX = 1.08;
        eyeScaleY = 1.12;
        armLRot = -0.6;
        armRRot = 0.6;
        break;
      }
      case "thinking": {
        rotX = -0.16;
        rotY = Math.sin(t * 0.9) * 0.14 * amp;
        pupilX = 0.035;
        pupilY = 0.05;
        haloScale = 1;
        armLRot = -0.5;
        armRRot = 2.0; // hand up to the chin
        smileScale = 0.7;
        break;
      }
      case "speaking": {
        direct = true;
        posY = Math.abs(Math.sin(t * 8.5)) * 0.055 * amp;
        rotZ = Math.sin(t * 4.2) * 0.035 * amp;
        mouthOpen = true;
        armLRot = -0.75 - Math.sin(t * 8.5) * 0.14 * amp;
        armRRot = 0.75 + Math.sin(t * 8.5 + 1) * 0.14 * amp;
        break;
      }
      case "happy": {
        direct = true;
        const p = clamp(since / 1.05, 0, 1);
        if (p < 1) {
          posY = bump(p) * 0.42 * (calm ? 0.5 : 1);
          rotY = easeInOut(p) * TAU;
          squash = p < 0.12 ? 1 - bump(p / 0.12) * 0.12 : 1 + bump(p) * 0.06;
        } else {
          posY = Math.abs(Math.sin((since - 1.05) * 5)) * 0.045 * amp;
          rotY = 0;
        }
        armLRot = -2.4;
        armRRot = 2.4;
        eyeScaleY = 0.78;
        smileScale = 1.45;
        pinGlow = 1.4;
        break;
      }
      case "sad": {
        rotX = 0.3;
        posY = -0.09;
        squash = 0.965;
        antennaX = 0.6;
        capZ = 0.1;
        armLRot = -0.3;
        armRRot = 0.3;
        eyeScaleY = 0.62;
        pupilY = -0.035;
        frown = true;
        smileScale = 0.85;
        pinGlow = 0.1;
        break;
      }
    }

    // Blink (any state except sad, which already squints).
    let blink = 1;
    if (s !== "sad") {
      if (a.blinkStart < 0 && t > a.nextBlink) a.blinkStart = t;
      if (a.blinkStart >= 0) {
        const p = (t - a.blinkStart) / 0.17;
        if (p >= 1) {
          a.blinkStart = -1;
          a.nextBlink = t + 3 + Math.random() * 2.2;
        } else blink = 1 - bump(p) * 0.92;
      }
    }

    const g = root.current;
    if (g) {
      const k = 9;
      g.rotation.x = damp(g.rotation.x, rotX, k, dt);
      g.rotation.z = damp(g.rotation.z, rotZ, k, dt);
      g.rotation.y = s === "happy" ? rotY : damp(g.rotation.y, rotY, k, dt);
      g.position.y = direct ? posY : damp(g.position.y, posY, k, dt);
      g.position.z = damp(g.position.z, posZ, k, dt);
      const sy = damp(g.scale.y, squash, 18, dt);
      const sxz = damp(g.scale.x, 1 / Math.sqrt(squash), 18, dt);
      g.scale.set(sxz, sy, sxz);
    }
    if (cap.current) cap.current.rotation.z = damp(cap.current.rotation.z, capZ, 14, dt);
    if (antenna.current) antenna.current.rotation.x = damp(antenna.current.rotation.x, antennaX, 7, dt);
    if (pin.current) {
      const sc = damp(pin.current.scale.x, pinScale, 14, dt);
      pin.current.scale.setScalar(sc);
    }
    if (pinMat.current) pinMat.current.emissiveIntensity = damp(pinMat.current.emissiveIntensity, pinGlow, 10, dt);
    if (pinLight.current) pinLight.current.intensity = damp(pinLight.current.intensity, Math.max(0, pinGlow - 0.5) * 1.6, 10, dt);
    for (const eye of [eyeL.current, eyeR.current]) {
      if (!eye) continue;
      eye.scale.x = damp(eye.scale.x, eyeScaleX, 14, dt);
      eye.scale.y = damp(eye.scale.y, eyeScaleY, 14, dt) * blink;
    }
    if (pupils.current) {
      pupils.current.position.x = damp(pupils.current.position.x, pupilX, 10, dt);
      pupils.current.position.y = damp(pupils.current.position.y, pupilY, 10, dt);
    }
    if (smile.current) {
      smile.current.visible = !mouthOpen;
      const sc = damp(smile.current.scale.x, smileScale, 12, dt);
      const sy = damp(smile.current.scale.y, frown ? -sc : sc, 10, dt);
      smile.current.scale.set(sc, sy, sc);
      smile.current.position.y = damp(smile.current.position.y, frown ? -0.36 : -0.2, 10, dt);
    }
    bars.current.forEach((bar, i) => {
      if (!bar) return;
      bar.visible = mouthOpen;
      if (mouthOpen) bar.scale.y = 0.5 + Math.abs(Math.sin(t * 13 + i * 1.3) * Math.sin(t * 5.1 + i)) * 2.2;
    });
    if (halo.current) {
      const sc = damp(halo.current.scale.x, haloScale, 8, dt);
      halo.current.scale.setScalar(sc);
      halo.current.visible = sc > 0.02;
      halo.current.rotation.y = t * 2.2;
      halo.current.children.forEach((dot, i) => {
        dot.position.y = Math.sin(t * 3 + i * 2.1) * 0.08;
      });
    }
    if (armL.current) armL.current.rotation.z = damp(armL.current.rotation.z, armLRot, 8, dt);
    if (armR.current) armR.current.rotation.z = damp(armR.current.rotation.z, armRRot, 8, dt);
  });

  const bodyMat = { color: C.body, roughness: 0.62, metalness: 0 } as const;

  return (
    <group ref={root}>
      {/* Body */}
      <mesh ref={body} scale={[1, 1.05, 0.95]} castShadow>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* Feet */}
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[x, -0.97, 0.22]} scale={[1, 0.5, 1.15]}>
          <sphereGeometry args={[0.22, 24, 16]} />
          <meshStandardMaterial color={C.teal} roughness={0.7} />
        </mesh>
      ))}

      {/* Arms */}
      <group ref={armL} position={[-0.86, -0.02, 0.12]} rotation={[0, 0, -0.85]}>
        <mesh position={[0, -0.24, 0]}>
          <capsuleGeometry args={[0.15, 0.28, 8, 16]} />
          <meshStandardMaterial {...bodyMat} />
        </mesh>
      </group>
      <group ref={armR} position={[0.86, -0.02, 0.12]} rotation={[0, 0, 0.85]}>
        <mesh position={[0, -0.24, 0]}>
          <capsuleGeometry args={[0.15, 0.28, 8, 16]} />
          <meshStandardMaterial {...bodyMat} />
        </mesh>
      </group>

      {/* Face */}
      <group ref={pupils}>
        <group ref={eyeL} position={[-0.34, 0.17, 0.86]}>
          <mesh scale={[1, 1.22, 0.55]}>
            <sphereGeometry args={[0.165, 32, 24]} />
            <meshStandardMaterial color={C.ink} roughness={0.35} />
          </mesh>
          <mesh position={[0.055, 0.075, 0.1]}>
            <sphereGeometry args={[0.055, 16, 12]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </mesh>
          <mesh position={[-0.05, -0.08, 0.095]}>
            <sphereGeometry args={[0.026, 12, 10]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </mesh>
        </group>
        <group ref={eyeR} position={[0.34, 0.17, 0.86]}>
          <mesh scale={[1, 1.22, 0.55]}>
            <sphereGeometry args={[0.165, 32, 24]} />
            <meshStandardMaterial color={C.ink} roughness={0.35} />
          </mesh>
          <mesh position={[0.055, 0.075, 0.1]}>
            <sphereGeometry args={[0.055, 16, 12]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </mesh>
          <mesh position={[-0.05, -0.08, 0.095]}>
            <sphereGeometry args={[0.026, 12, 10]} />
            <meshStandardMaterial color="#ffffff" roughness={0.2} />
          </mesh>
        </group>
      </group>
      {[-0.58, 0.58].map((x) => (
        <mesh key={x} position={[x, -0.12, 0.74]} scale={[1, 0.72, 0.35]}>
          <sphereGeometry args={[0.13, 24, 16]} />
          <meshStandardMaterial color={C.coralSoft} roughness={1} transparent opacity={0.85} />
        </mesh>
      ))}
      {/* Mouth: smile arc + speaking bars */}
      <mesh ref={smile} position={[0, -0.2, 0.9]} rotation={[0, 0, Math.PI * 1.5 - Math.PI * 0.38]}>
        <torusGeometry args={[0.15, 0.034, 10, 28, Math.PI * 0.76]} />
        <meshStandardMaterial color={C.ink} roughness={0.5} />
      </mesh>
      {[-0.13, 0, 0.13].map((x, i) => (
        <mesh
          key={x}
          ref={(m) => {
            bars.current[i] = m;
          }}
          position={[x, -0.3, 0.92]}
          visible={false}
        >
          <capsuleGeometry args={[0.04, 0.08, 6, 12]} />
          <meshStandardMaterial color={C.ink} roughness={0.5} />
        </mesh>
      ))}

      {/* Cap with peak, button, antenna and pin */}
      <group ref={cap} position={[0, 0.66, -0.03]} rotation={[-0.1, 0, 0]}>
        <mesh scale={[1, 0.78, 1]}>
          <sphereGeometry args={[0.74, 40, 20, 0, TAU, 0, Math.PI / 2]} />
          <meshStandardMaterial color={C.teal} roughness={0.7} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.735, 0.04, 12, 48]} />
          <meshStandardMaterial color={C.tealDark} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.0, 0.02]} rotation={[Math.PI / 2 + 0.3, 0, 0]}>
          <extrudeGeometry args={[peakShape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 24 }]} />
          <meshStandardMaterial color={C.tealDark} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.57, 0]}>
          <sphereGeometry args={[0.075, 16, 12]} />
          <meshStandardMaterial color={C.sun} roughness={0.6} />
        </mesh>
        <group ref={antenna} position={[0, 0.6, 0]}>
          <mesh position={[0, 0.24, 0]}>
            <cylinderGeometry args={[0.024, 0.03, 0.48, 10]} />
            <meshStandardMaterial color={C.ink} roughness={0.6} />
          </mesh>
          <group ref={pin} position={[0, 0.66, 0]}>
            <mesh position={[0, -0.14, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.115, 0.22, 24]} />
              <meshStandardMaterial ref={pinMat} color={C.coral} emissive={C.coral} emissiveIntensity={0.45} roughness={0.45} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.145, 28, 20]} />
              <meshStandardMaterial color={C.coral} emissive={C.coral} emissiveIntensity={0.45} roughness={0.45} />
            </mesh>
            <mesh position={[0, 0.0, 0.11]}>
              <sphereGeometry args={[0.052, 16, 12]} />
              <meshStandardMaterial color="#ffffff" roughness={0.3} />
            </mesh>
            <pointLight ref={pinLight} color={C.coral} intensity={0} distance={2.2} decay={2} />
          </group>
        </group>
      </group>

      {/* Thinking halo */}
      <group ref={halo} position={[0, 1.42, 0]} scale={0} visible={false}>
        {[C.sun, C.lavender, C.sky].map((col, i) => (
          <mesh key={col} position={[Math.cos((i / 3) * TAU) * 0.78, 0, Math.sin((i / 3) * TAU) * 0.78]}>
            <sphereGeometry args={[0.075, 16, 12]} />
            <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.35} roughness={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** A soft radial-gradient disc under Buddy — reads as a contact shadow for ~0 GPU cost. */
function GroundShadow({ opacity }: { opacity: number }) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, "rgba(90,59,30,0.55)");
    g.addColorStop(0.55, "rgba(90,59,30,0.22)");
    g.addColorStop(1, "rgba(90,59,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }, []);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    <mesh position={[0, -1.12, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.6, 1.6, 1]} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** Drives a `frameloop="demand"` canvas at a fixed cadence so small Buddies don't burn 60 fps. */
function FrameLimiter({ fps, active }: { fps: number; active: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!active) return;
    const interval = 1000 / fps;
    let last = 0;
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last >= interval - 1) {
        last = now;
        invalidate();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fps, active, invalidate]);
  return null;
}

export default function BuddyScene({ state, size }: { state: BuddyState; size: number }) {
  const compact = size <= 80;
  const stateRef = useRef<BuddyState>(state);
  stateRef.current = state;
  const [visible, setVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const calm = useMemo(() => prefersReducedMotion(), []);

  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <Canvas
      dpr={[1, 1.5]}
      flat
      frameloop="demand"
      gl={{ alpha: true, antialias: !compact, powerPreference: "low-power", premultipliedAlpha: true, stencil: false, depth: true }}
      camera={{ position: [0, compact ? 0.5 : 0.42, compact ? 5.2 : 6.1], fov: 33, near: 0.1, far: 40 }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor(0x000000, 0);
        camera.lookAt(0, compact ? 0.42 : 0.32, 0);
      }}
      style={{ width: "100%", height: "100%", background: "transparent", touchAction: "pan-y" }}
      aria-label="Buddy, the Raahi assistant"
      role="img"
    >
      <FrameLimiter fps={compact ? 30 : calm ? 30 : 60} active={visible} />
      <ambientLight intensity={1.25} color="#fff6ea" />
      <hemisphereLight args={["#ffffff", "#ffd7c2", 1.1]} />
      <directionalLight position={[3.2, 5, 5.5]} intensity={2.4} color="#fff9f0" />
      <Character stateRef={stateRef} calm={calm} />
      <GroundShadow opacity={compact ? 0.5 : 0.7} />
    </Canvas>
  );
}
