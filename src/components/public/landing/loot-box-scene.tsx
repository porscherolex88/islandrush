"use client";

import { Float, RoundedBox, Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Group, Mesh, MeshStandardMaterial, PointLight } from "three";
import { DoubleSide, MathUtils } from "three";

const WOOD = "#6b4226";
const WOOD_DARK = "#4a2c18";
const GOLD = "#e8b23a";
const COIN_COUNT = 18;

type Coin = { x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number; life: number };

function makeCoins(): Coin[] {
  return Array.from({ length: COIN_COUNT }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, life: 0 }));
}

function Gold({ emissive = 0.08 }: { emissive?: number }) {
  return <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.28} emissive={GOLD} emissiveIntensity={emissive} />;
}

/** Procedural treasure chest: opens on tap, spills coins, follows the pointer. */
function Chest({ burstKey }: { burstKey: number }) {
  const root = useRef<Group>(null);
  const lid = useRef<Group>(null);
  const glow = useRef<PointLight>(null);
  const inner = useRef<MeshStandardMaterial>(null);
  const coinRefs = useRef<(Mesh | null)[]>([]);
  const coins = useMemo(() => makeCoins(), []);
  const openUntil = useRef(0);
  const openness = useRef(0);

  useEffect(() => {
    if (burstKey === 0) return;
    openUntil.current = performance.now() + 2600;
    for (const c of coins) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.random() * 1.4;
      Object.assign(c, {
        x: (Math.random() - 0.5) * 0.5,
        y: 0.55,
        z: (Math.random() - 0.5) * 0.3,
        vx: Math.cos(a) * r,
        vy: 3.2 + Math.random() * 2.2,
        vz: Math.sin(a) * r * 0.6,
        spin: (Math.random() - 0.5) * 18,
        life: 2.4,
      });
    }
  }, [burstKey, coins]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const t = state.clock.elapsedTime;
    const g = root.current;
    if (g) {
      g.rotation.y = MathUtils.damp(g.rotation.y, -0.55 + state.pointer.x * 0.5, 4, dt);
      g.rotation.x = MathUtils.damp(g.rotation.x, 0.12 - state.pointer.y * 0.18, 4, dt);
    }

    const target = performance.now() < openUntil.current ? 1 : 0.06 + Math.max(0, Math.sin(t * 0.9)) * 0.08;
    openness.current = MathUtils.damp(openness.current, target, target > 0.5 ? 9 : 3, dt);
    if (lid.current) lid.current.rotation.x = -openness.current * 1.75;
    if (glow.current) glow.current.intensity = 1 + openness.current * 22;
    if (inner.current) inner.current.emissiveIntensity = 0.6 + openness.current * 3;

    coins.forEach((c, i) => {
      const m = coinRefs.current[i];
      if (!m) return;
      if (c.life <= 0) {
        m.visible = false;
        return;
      }
      c.life -= dt;
      c.vy -= 9.8 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      if (c.y < -0.62) {
        c.y = -0.62;
        c.vy *= -0.35;
        c.vx *= 0.7;
        c.vz *= 0.7;
      }
      m.visible = true;
      m.position.set(c.x, c.y, c.z);
      m.rotation.x += c.spin * dt;
      m.rotation.z += c.spin * 0.5 * dt;
      m.scale.setScalar(Math.min(1, c.life * 2));
    });
  });

  return (
    <group ref={root} position={[0, -0.15, 0]}>
      <RoundedBox args={[2, 1.2, 1.3]} radius={0.06} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color={WOOD} roughness={0.75} />
      </RoundedBox>
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.14, 1.24, 1.34]} />
          <Gold />
        </mesh>
      ))}
      <mesh position={[0, -0.56, 0]}>
        <boxGeometry args={[2.04, 0.1, 1.34]} />
        <Gold />
      </mesh>
      <mesh position={[0, 0.1, 0.67]}>
        <boxGeometry args={[0.34, 0.42, 0.06]} />
        <Gold emissive={0.25} />
      </mesh>
      <mesh position={[0, 0.06, 0.705]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 16]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>

      <mesh position={[0, 0.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.86, 1.16]} />
        <meshStandardMaterial ref={inner} color="#ffd56b" emissive="#ffb21f" emissiveIntensity={0.6} />
      </mesh>
      <pointLight ref={glow} position={[0, 1, 0.1]} color="#ffbf3c" intensity={1} distance={6} decay={1.6} />

      <group ref={lid} position={[0, 0.6, -0.65]}>
        <group position={[0, 0, 0.65]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.65, 0.65, 2, 32, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={WOOD} roughness={0.7} side={DoubleSide} />
          </mesh>
          {[-0.62, 0.62].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.68, 0.68, 0.14, 32, 1, false, 0, Math.PI]} />
              <Gold />
            </mesh>
          ))}
          <mesh position={[0, 0.02, 0.67]}>
            <boxGeometry args={[0.3, 0.2, 0.06]} />
            <Gold emissive={0.25} />
          </mesh>
        </group>
      </group>

      {coins.map((_, i) => (
        <mesh
          key={i}
          visible={false}
          ref={(m) => {
            coinRefs.current[i] = m;
          }}
        >
          <cylinderGeometry args={[0.13, 0.13, 0.035, 24]} />
          <Gold emissive={0.35} />
        </mesh>
      ))}
    </group>
  );
}

export default function LootBoxScene({ burstKey, active, onReady }: { burstKey: number; active: boolean; onReady: () => void }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.8, 7.4], fov: 34 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      frameloop={active ? "always" : "never"}
      onCreated={({ camera }) => {
        camera.lookAt(0, 0.1, 0);
        onReady();
      }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} color="#fff4dc" />
      <directionalLight position={[-4, 2, -2]} intensity={0.9} color="#5fd4e0" />
      <Float speed={1.6} rotationIntensity={0.15} floatIntensity={0.5} floatingRange={[-0.08, 0.08]}>
        <Chest burstKey={burstKey} />
      </Float>
      <Sparkles count={40} scale={[4.5, 3, 3]} size={3} speed={0.4} color="#ffd36b" opacity={0.8} />
    </Canvas>
  );
}
