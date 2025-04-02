import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Noise } from 'noisejs';

const noise = new Noise(Math.random());
const TRAIL_LENGTH = 10000;
const MAX_AGE = 10;
const MAX_EMIT = 2000;

const ParticleTrail = ({ emitPerFrame, onClickEmit, targetPos, hueRef }) => {
  const mesh = useRef();
  const smoothedPos = useRef(new THREE.Vector3());
  const { camera, gl, clock, size } = useThree();

  //buffers
  const positions = useMemo(() => new Float32Array(TRAIL_LENGTH * 3), []);
  const velocities = useMemo(() => new Float32Array(TRAIL_LENGTH * 3), []);
  const colors = useMemo(() => new Float32Array(TRAIL_LENGTH * 3), []);
  const birthTimes = useMemo(() => new Float32Array(TRAIL_LENGTH).fill(-Infinity), []);
  const currentIndex = useRef(0);

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

      targetPos.current.copy(pos);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', onClickEmit);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', onClickEmit);
    };
  }, [camera, gl, onClickEmit, targetPos]);

  useFrame(() => {
    if (!mesh.current) return;

    smoothedPos.current.lerp(targetPos.current, 0.05);
    const now = clock.getElapsedTime();
    const scaleFactor = (size.width / window.innerWidth);



    // Color shift hue over time
    const baseHue = (now * 80) % 360;
    hueRef.current = baseHue;
    const baseColor = new THREE.Color(`hsl(${baseHue}, 100%, 80%)`);
    const emitClamped = Math.min(emitPerFrame, MAX_EMIT);

    for (let i = 0; i < emitClamped; i++) {
      const i3 = currentIndex.current * 3;

      const angle = Math.random() * Math.PI * 2;
      // const minRadius = 0.1;
      const maxRadius = 0.3;
      const radius = Math.random() * maxRadius * scaleFactor;
      const offsetX = Math.cos(angle) * radius;
      const offsetY = Math.sin(angle) * radius;

      //positions and velocities
      positions[i3] = smoothedPos.current.x + offsetX;
      positions[i3 + 1] = smoothedPos.current.y + offsetY;
      positions[i3 + 2] = 0

      velocities[i3] = (Math.random() - 0.2) * 0.02;
      velocities[i3 + 1] = (Math.random() - 0.2) * 0.02;
      velocities[i3 + 2] = 0

      colors[i3] = baseColor.r;
      colors[i3 + 1] = baseColor.g;
      colors[i3 + 2] = baseColor.b;

      birthTimes[currentIndex.current] = now;
      currentIndex.current = (currentIndex.current + 1) % TRAIL_LENGTH;


    }

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const i3 = i * 3;

      const nx = positions[i3] * 0.1;
      const ny = positions[i3 + 1] * 0.1;
      const nz = positions[i3 + 2] * 0.1;

      const lifetime = now - birthTimes[i];
      const ageFactor = Math.min(Math.max(lifetime / MAX_AGE, 0), 1);
      const fade = Math.pow(1 - ageFactor, 0.35);

      // Apply subtle perlin force
      velocities[i3] += noise.perlin3(nx, ny, nz) * 0.001;
      velocities[i3 + 1] += noise.perlin3(ny + 100, nz + 100, nx + 100) * 0.001;

      velocities[i3 + 2] += noise.perlin3(nz + 200, nx + 200, ny + 200) * 0.002;

      // push away from origin point
      const origin = smoothedPos.current;
      const particlePos = new THREE.Vector3(
        positions[i3],
        positions[i3 + 1],
        positions[i3 + 2]
      );
      const direction = particlePos.clone().sub(origin).normalize().multiplyScalar(0.003); // tweak scalar strength
      velocities[i3] += direction.x * 0.002 * (1 - ageFactor);
      velocities[i3 + 1] += direction.y * 0.002 * (1 - ageFactor);
      velocities[i3 + 2] += direction.z * 0.002 * (1 - ageFactor);

      // Move particles
      positions[i3] += velocities[i3];
      positions[i3 + 1] += velocities[i3 + 1];
      positions[i3 + 2] += velocities[i3 + 2];

      // Damping
      velocities[i3] *= 0.96;
      velocities[i3 + 1] *= 0.96;
      velocities[i3 + 2] *= 0.96;

      // Fade color
      colors[i3] *= fade;
      colors[i3 + 1] *= fade;
      colors[i3 + 2] *= fade;
    }


    mesh.current.geometry.attributes.position.needsUpdate = true;
    mesh.current.geometry.attributes.color.needsUpdate = true;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={TRAIL_LENGTH} itemSize={3} />
        <bufferAttribute attach="attributes-color" array={colors} count={TRAIL_LENGTH} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        vertexColors
        sizeAttenuation
        transparent
        opacity={1.0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

const CursorRing = ({ targetPos }) => {
  const mesh = useRef();
  useFrame(() => {
    if (mesh.current) {
      mesh.current.position.copy(targetPos.current);
    }
  });

  return (
    <mesh ref={mesh}>
      <circleGeometry args={[0.25, 64]} />
      <meshBasicMaterial color="black" />
    </mesh>
  );
};

export default function App() {
  const [emitRate, setEmitRate] = useState(5);
  const [clicks, setClicks] = useState(0);
  const targetPos = useRef(new THREE.Vector3());
  const hueRef = useRef(0);

  const handleEmitChange = () => {
    setEmitRate((prev) => prev + 5);
    setClicks((prev) => prev + 1);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
        <ambientLight />
        <CursorRing targetPos={targetPos} />
        <ParticleTrail
          emitPerFrame={emitRate}
          targetPos={targetPos}
          onClickEmit={handleEmitChange}
          hueRef={hueRef}
        />
        <EffectComposer multisampling={0}>
          <Bloom
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9}
            intensity={0.5}
            resolutionScale={0.5}
          />
        </EffectComposer>
      </Canvas>

      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        color: 'white',
        backgroundColor: 'rgba(0,0,0,1)',
        fontFamily: 'monospace',
        padding: '8px 12px',
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        Clicks: {clicks}<br />
        Emit/frame: {emitRate}
      </div>
    </div>
  );
}
