import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

const TRAIL_LENGTH = 50000;          // Size of circular buffer
const EMIT_PER_FRAME = 1000;         // Number of particles emitted each frame
const MAX_AGE = 10.5;                // Lifetime in seconds

const ParticleTrail = () => {
  const mesh = useRef();
  const [targetPos, setTargetPos] = useState(new THREE.Vector3());
  const smoothedPos = useRef(new THREE.Vector3());
  const { camera, gl, clock } = useThree();

  // Buffers
  const positions = useMemo(() => new Float32Array(TRAIL_LENGTH * 3), []);
  const velocities = useMemo(() => new Float32Array(TRAIL_LENGTH * 3), []);
  const colors = useMemo(() => new Float32Array(TRAIL_LENGTH * 3), []);
  const birthTimes = useMemo(() => new Float32Array(TRAIL_LENGTH).fill(-Infinity), []);
  const currentIndex = useRef(0);

  // Track mouse position in world space
  useEffect(() => {
    const handleMouseMove = (e) => {
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const mouseVec = new THREE.Vector3(x, y, 0.5);
      mouseVec.unproject(camera);
      const dir = mouseVec.sub(camera.position).normalize();
      const distance = -camera.position.z / dir.z;
      const pos = camera.position.clone().add(dir.multiplyScalar(distance));

      setTargetPos(pos);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [camera, gl]);

  // Animate
  useFrame(() => {
    if (!mesh.current) return;

    smoothedPos.current.lerp(targetPos, 0.1);
    const now = clock.getElapsedTime();

    // Use global hue that shifts over time
    const baseHue = (now * 20) % 360;
    const color = new THREE.Color(`hsl(${baseHue}, 100%, 80%)`);

    for (let i = 0; i < EMIT_PER_FRAME; i++) {
      const i3 = currentIndex.current * 3;
      const jitter = () => (Math.random() - 0.5) * 0.2;

      // Position and velocity
      positions[i3] = smoothedPos.current.x + jitter();
      positions[i3 + 1] = smoothedPos.current.y + jitter();
      positions[i3 + 2] = 0;

      velocities[i3] = jitter() * 0.05;
      velocities[i3 + 1] = jitter() * 0.05;
      velocities[i3 + 2] = 0;

      // Assign same color to this entire frame’s batch
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      birthTimes[currentIndex.current] = now;
      currentIndex.current = (currentIndex.current + 1) % TRAIL_LENGTH;
    }

    // Update all particles
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const i3 = i * 3;
      const age = now - birthTimes[i];
      const t = Math.min(Math.max(age / MAX_AGE, 0), 1);
      const fade = 1.0 - t * t;

      // Move and fade
      positions[i3] += velocities[i3];
      positions[i3 + 1] += velocities[i3 + 1];
      velocities[i3] *= 0.96;
      velocities[i3 + 1] *= 0.96;

      colors[i3] *= fade;
      colors[i3 + 1] *= fade;
      colors[i3 + 2] *= fade;
    }

    // Update geometry
    const geo = mesh.current.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={TRAIL_LENGTH} itemSize={3} />
        <bufferAttribute attach="attributes-color" array={colors} count={TRAIL_LENGTH} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        vertexColors
        sizeAttenuation
        transparent
        opacity={1.0}
        depthWrite={false}
      />
    </points>
  );
};

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
        <ambientLight />
        <ParticleTrail />
        <EffectComposer>
          <Bloom luminanceThreshold={0.1} luminanceSmoothing={0.9} intensity={1.25} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
