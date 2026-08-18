"use client";

import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const EARTH_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EARTH_FRAGMENT_SHADER = `
  precision highp float;

  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;

  float ellipse(vec2 point, vec2 center, vec2 radius) {
    vec2 scaled = (point - center) / radius;
    float distanceToEdge = dot(scaled, scaled);
    return 1.0 - smoothstep(0.62, 1.0, distanceToEdge);
  }

  float landMass(vec2 point) {
    float shape = 0.0;

    // North America and Greenland
    shape = max(shape, ellipse(point, vec2(0.19, 0.29), vec2(0.09, 0.16)));
    shape = max(shape, ellipse(point, vec2(0.25, 0.39), vec2(0.08, 0.09)));
    shape = max(shape, ellipse(point, vec2(0.14, 0.22), vec2(0.055, 0.075)));
    shape = max(shape, ellipse(point, vec2(0.31, 0.12), vec2(0.035, 0.075)));

    // South America
    shape = max(shape, ellipse(point, vec2(0.31, 0.59), vec2(0.065, 0.12)));
    shape = max(shape, ellipse(point, vec2(0.34, 0.72), vec2(0.035, 0.10)));

    // Europe and Asia
    shape = max(shape, ellipse(point, vec2(0.53, 0.29), vec2(0.12, 0.09)));
    shape = max(shape, ellipse(point, vec2(0.67, 0.29), vec2(0.19, 0.105)));
    shape = max(shape, ellipse(point, vec2(0.79, 0.27), vec2(0.09, 0.08)));
    shape = max(shape, ellipse(point, vec2(0.72, 0.40), vec2(0.11, 0.075)));
    shape = max(shape, ellipse(point, vec2(0.83, 0.44), vec2(0.06, 0.055)));

    // Africa and the Arabian peninsula
    shape = max(shape, ellipse(point, vec2(0.51, 0.52), vec2(0.08, 0.14)));
    shape = max(shape, ellipse(point, vec2(0.54, 0.66), vec2(0.05, 0.10)));
    shape = max(shape, ellipse(point, vec2(0.60, 0.43), vec2(0.07, 0.05)));

    // India, Southeast Asia and Australia
    shape = max(shape, ellipse(point, vec2(0.67, 0.49), vec2(0.04, 0.08)));
    shape = max(shape, ellipse(point, vec2(0.73, 0.57), vec2(0.065, 0.055)));
    shape = max(shape, ellipse(point, vec2(0.79, 0.70), vec2(0.11, 0.065)));
    shape = max(shape, ellipse(point, vec2(0.87, 0.64), vec2(0.035, 0.025)));

    // Antarctica
    shape = max(shape, ellipse(point, vec2(0.50, 0.96), vec2(0.44, 0.07)));

    return smoothstep(0.3, 0.68, shape);
  }

  float organicVariation(vec2 point) {
    return (
      sin(point.x * 88.0 + point.y * 29.0) +
      sin(point.y * 126.0 - point.x * 17.0) +
      sin((point.x + point.y) * 210.0)
    ) / 3.0;
  }

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDirection = normalize(vec3(-0.55, 0.32, 1.0));
    float sunlight = max(dot(normal, lightDirection), 0.0);
    float day = smoothstep(0.02, 0.65, sunlight);

    vec3 deepOcean = vec3(0.004, 0.018, 0.065);
    vec3 brightOcean = vec3(0.018, 0.16, 0.43);
    vec3 ocean = mix(deepOcean, brightOcean, day);

    float land = landMass(vUv);
    float coastline = organicVariation(vUv) * 0.025;
    land = smoothstep(0.2, 0.72, land + coastline);

    vec3 forest = vec3(0.045, 0.22, 0.10);
    vec3 highland = vec3(0.37, 0.46, 0.17);
    vec3 landColor = mix(forest, highland, smoothstep(0.18, 0.82, sunlight));
    vec3 color = mix(ocean, landColor, land);

    float cloudBands = smoothstep(
      0.76,
      0.98,
      sin((vUv.x + uTime * 0.004) * 42.0 + sin(vUv.y * 15.0) * 2.0) * 0.5 + 0.5
    );
    float cloudMask = cloudBands * 0.055 * smoothstep(0.08, 0.8, vUv.y) * (1.0 - smoothstep(0.88, 1.0, vUv.y));
    color = mix(color, vec3(0.7, 0.85, 1.0), cloudMask * day);

    float rim = pow(1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
    color += vec3(0.02, 0.16, 0.46) * rim * 0.28;
    color *= mix(0.18, 1.0, day);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function Earth() {
  const earthGroup = useRef<THREE.Group>(null);
  const earthMaterial = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state, delta) => {
    if (earthGroup.current) {
      earthGroup.current.rotation.y += delta * 0.12;
    }

    if (earthMaterial.current) {
      earthMaterial.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group ref={earthGroup} rotation={[0.08, -0.45, 0]}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[1.72, 96, 96]} />
        <shaderMaterial
          ref={earthMaterial}
          fragmentShader={EARTH_FRAGMENT_SHADER}
          vertexShader={EARTH_VERTEX_SHADER}
          uniforms={uniforms}
        />
      </mesh>

      <mesh scale={1.045}>
        <sphereGeometry args={[1.72, 64, 64]} />
        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          color="#4b9dff"
          depthWrite={false}
          side={THREE.BackSide}
          transparent
          opacity={0.16}
        />
      </mesh>

      <mesh scale={1.012}>
        <sphereGeometry args={[1.72, 64, 64]} />
        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          color="#77c7ff"
          depthWrite={false}
          side={THREE.BackSide}
          transparent
          opacity={0.08}
        />
      </mesh>
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight color="#d6e6ff" intensity={3.2} position={[-4, 3, 5]} />
      <pointLight color="#174ea6" intensity={1.2} position={[4, -2, -4]} />
      <Stars count={1800} depth={45} factor={2.1} fade radius={80} saturation={0} speed={0.25} />
      <Earth />
      <OrbitControls
        enablePan={false}
        maxDistance={7}
        minDistance={3.35}
        rotateSpeed={0.55}
        zoomSpeed={0.65}
      />
    </>
  );
}

export default function EarthCanvas() {
  return (
    <Canvas
      camera={{ fov: 40, position: [0, 0, 5.3] }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
    >
      <Scene />
    </Canvas>
  );
}
