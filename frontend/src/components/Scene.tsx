import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const NODE_COUNT = 100;
const MAX_DISTANCE = 2.0;

function NetworkGroup() {
  const groupRef = useRef<THREE.Group>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const pointsRef = useRef<THREE.Points>(null);
  
  // Mobile check for performance
  const isMobile = window.innerWidth < 768;

  // Generate random node positions and velocities
  const { positions, nodesData } = useMemo(() => {
    const pos = new Float32Array(NODE_COUNT * 3);
    const data = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      // Distribute points spherically
      const r = 6 * Math.cbrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      
      data.push({
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01),
        original: new THREE.Vector3(x, y, z)
      });
    }
    return { positions: pos, nodesData: data };
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;

    // Cinematic tracking of the mouse pointer
    if (!isMobile) {
      const targetX = (state.pointer.x * Math.PI) / 10;
      const targetY = (state.pointer.y * Math.PI) / 10;
      
      groupRef.current.rotation.x += (targetY - groupRef.current.rotation.x) * 0.03;
      groupRef.current.rotation.y += (targetX - groupRef.current.rotation.y) * 0.03;
    } else {
      groupRef.current.rotation.y += 0.001;
      groupRef.current.rotation.x += 0.0005;
    }

    if (linesRef.current && pointsRef.current) {
      const currentPos = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        // Drift the nodes
        positions[i*3] += nodesData[i].velocity.x;
        positions[i*3+1] += nodesData[i].velocity.y;
        positions[i*3+2] += nodesData[i].velocity.z;
        
        // Bounce back if they drift too far
        const p = new THREE.Vector3(positions[i*3], positions[i*3+1], positions[i*3+2]);
        if (p.distanceTo(nodesData[i].original) > 1.5) {
          nodesData[i].velocity.negate();
        }
        currentPos.push(p);
      }
      
      // Calculate lines for proximate nodes
      const linePositions = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        for (let j = i + 1; j < NODE_COUNT; j++) {
          if (currentPos[i].distanceTo(currentPos[j]) < MAX_DISTANCE) {
            linePositions.push(
              currentPos[i].x, currentPos[i].y, currentPos[i].z,
              currentPos[j].x, currentPos[j].y, currentPos[j].z
            );
          }
        }
      }
      
      // Update line geometry
      linesRef.current.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      
      // Update point geometry
      const pointsGeo = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
      pointsGeo.copyArray(positions);
      pointsGeo.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial size={0.06} color="#06b6d4" transparent opacity={0.9} sizeAttenuation />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry />
        <lineBasicMaterial color="#4edea3" transparent opacity={0.15} />
      </lineSegments>
    </group>
  );
}

export default function Scene() {
  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 2]} // Support high-dpi screens but cap at 2 for performance
      >
        <fog attach="fog" args={['#080f17', 3, 12]} />
        <NetworkGroup />
      </Canvas>
    </div>
  );
}
