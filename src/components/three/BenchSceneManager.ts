import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BenchComponent,
  DiagnosticTroubleCode,
  EcuPin,
  InjectedFault,
  MultimeterState,
  PowerSupplyState,
  WireConnection,
} from '../../types/ecu';
import { createBenchTextures, BenchTextureBundle } from './proceduralTextures';
import {
  buildEcuBenchRig,
  createDisposableRegistry,
  DisposableRegistry,
  EcuBenchRig,
  PickTargetMeta,
} from './ecuHardwareModels';

export type CameraPresetKey = 'OVERVIEW' | 'ECU_EXPLODED' | 'CONNECTOR_16PIN' | 'HARNESS_ACTUATORS';
export type BenchOverlayMode = 'VOLTAGE' | 'THERMAL' | 'WIRE_ID';

export interface BenchTelemetrySnapshot {
  pins: EcuPin[];
  wires: WireConnection[];
  components: BenchComponent[];
  faults: InjectedFault[];
  activeDTCs: DiagnosticTroubleCode[];
  nodeVoltages: Record<string, number>;
  wireCurrentsMa: Record<string, number>;
  multimeter: MultimeterState;
  powerSupply: PowerSupplyState;
  selectedPinId: string | null;
  simulationSpeed: number;
  overlayMode: BenchOverlayMode;
  explodeAmount: number; // 0..1
}

export interface SceneCallbacks {
  onHoverTarget: (meta: PickTargetMeta | null) => void;
  onSelectTarget: (meta: PickTargetMeta | null) => void;
  onContextLostChange: (lost: boolean) => void;
  onExplodeTargetSync?: (explode: number) => void;
}

interface WireTubeVisual {
  wireId: string;
  sourcePinId: string;
  targetPinId: string;
  isCut: boolean;
  baseColor: THREE.Color;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  geometry: THREE.BufferGeometry;
}

// Pre-allocated scratch math helpers (Zero-GC render loop)
const _color = new THREE.Color();
const _pointerNdc = new THREE.Vector2();

const CAMERA_PRESETS: Record<
  CameraPresetKey,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  OVERVIEW: { pos: [0.3, 7.2, 8.6], target: [0.6, 0.35, -0.2] },
  ECU_EXPLODED: { pos: [-4.1, 3.8, 3.4], target: [-3.1, 0.85, -0.4] },
  CONNECTOR_16PIN: { pos: [0.6, 2.2, 2.1], target: [-0.65, 0.55, -0.4] },
  HARNESS_ACTUATORS: { pos: [6.4, 4.4, 5.2], target: [3.1, 0.45, -0.4] },
};

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class BenchSceneManager {
  private container: HTMLElement;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private envTexture: THREE.Texture;
  private textures: BenchTextureBundle;
  private registry: DisposableRegistry;
  private rig: EcuBenchRig;
  private callbacks: SceneCallbacks;

  private wireGroup: THREE.Group;
  private wireVisuals: WireTubeVisual[] = [];
  private lastWireSignature = '';

  private telemetry: BenchTelemetrySnapshot;
  private raycaster = new THREE.Raycaster();
  private lastHoverCheckAt = 0;
  private pointerDownPos = { x: 0, y: 0 };

  // Smooth exponential damping state
  private currentExplode = 0;
  private targetExplode = 0;
  private cameraAnimating = false;
  private targetCamPos = new THREE.Vector3(...CAMERA_PRESETS.OVERVIEW.pos);
  private targetLookAt = new THREE.Vector3(...CAMERA_PRESETS.OVERVIEW.target);
  private crankSpeedRadPerSec = 0;

  // Frame loop state
  private disposed = false;
  private frameId = 0;
  private renderBusy = false;
  private renderDirty = false;
  private lastFrameTs = performance.now();
  private elapsedSim = 0;

  private resizeObserver: ResizeObserver | null = null;
  private boundHandlers: {
    onPointerMove: (e: PointerEvent) => void;
    onPointerDown: (e: PointerEvent) => void;
    onPointerUp: (e: PointerEvent) => void;
    onVisibilityChange: () => void;
    onContextLost: (e: Event) => void;
    onContextRestored: () => void;
  };

  constructor(
    container: HTMLElement,
    initialTelemetry: BenchTelemetrySnapshot,
    callbacks: SceneCallbacks
  ) {
    this.container = container;
    this.telemetry = initialTelemetry;
    this.targetExplode = initialTelemetry.explodeAmount;
    this.currentExplode = initialTelemetry.explodeAmount;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.registry = createDisposableRegistry();

    const width = Math.max(320, container.clientWidth || 960);
    const height = Math.max(240, container.clientHeight || 600);

    // 1. Modern ACESFilmic Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 2. Scene + Horizon Fog + Procedural Studio Environment (RoomEnvironment)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090f1d);
    this.scene.fog = new THREE.FogExp2(0x090f1d, 0.022);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    this.scene.environment = this.envTexture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // 3. Camera & Damped OrbitControls
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
    this.camera.position.set(...CAMERA_PRESETS.OVERVIEW.pos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(...CAMERA_PRESETS.OVERVIEW.target);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3.2;
    this.controls.maxDistance = 18.5;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06;
    this.controls.update();

    this.controls.addEventListener('start', () => {
      // Cancel scripted camera fly-to immediately if user grabs orbit controls
      this.cameraAnimating = false;
    });
    this.controls.addEventListener('change', () => {
      this.requestRender();
    });

    // 4. Warm Key / Cool Fill / Rim Studio Lighting Rig
    const hemiFill = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.72);
    this.scene.add(hemiFill);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.85);
    keyLight.position.set(5.5, 9.5, 5.2);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 26;
      const d = 8.5;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(-7.5, 4.2, -6.5);
    this.scene.add(rimLight);

    // 5. Procedural Textures & Composite Automotive Bench Hardware
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createBenchTextures(maxAniso);
    this.rig = buildEcuBenchRig(this.textures, this.registry, this.isSoftwareGl);
    this.scene.add(this.rig.root);

    // 6. Wire Loom Group & Layer-1 Raycaster
    this.wireGroup = new THREE.Group();
    this.scene.add(this.wireGroup);
    this.raycaster.layers.set(1);

    this.syncWiresGeometry(initialTelemetry.wires);
    this.applyTelemetryVisuals(0);

    // Pre-warm shaders on hardware GPU
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 7. DOM, ResizeObserver & WebGL Context Recovery Listeners
    this.boundHandlers = {
      onPointerMove: (e) => this.handlePointerMove(e),
      onPointerDown: (e) => {
        this.pointerDownPos.x = e.clientX;
        this.pointerDownPos.y = e.clientY;
      },
      onPointerUp: (e) => this.handlePointerUp(e),
      onVisibilityChange: () => {
        if (!document.hidden) {
          this.lastFrameTs = performance.now();
          this.requestRender();
        }
      },
      onContextLost: (e) => {
        e.preventDefault();
        this.callbacks.onContextLostChange(true);
      },
      onContextRestored: () => {
        this.callbacks.onContextLostChange(false);
        this.requestRender();
      },
    };

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', this.boundHandlers.onPointerMove);
    canvas.addEventListener('pointerdown', this.boundHandlers.onPointerDown);
    canvas.addEventListener('pointerup', this.boundHandlers.onPointerUp);
    canvas.addEventListener('webglcontextlost', this.boundHandlers.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.boundHandlers.onContextRestored);
    document.addEventListener('visibilitychange', this.boundHandlers.onVisibilityChange);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const w = Math.max(320, Math.floor(entry.contentRect.width));
        const h = Math.max(240, Math.floor(entry.contentRect.height));
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
        this.requestRender();
      });
      this.resizeObserver.observe(container);
    }

    this.requestRender();
  }

  public updateTelemetry(next: BenchTelemetrySnapshot): void {
    this.telemetry = next;
    this.targetExplode = THREE.MathUtils.clamp(next.explodeAmount, 0, 1);

    const wireSig = next.wires
      .map((w) => `${w.id}:${w.sourcePinId}->${w.targetPinId}:${w.isCut ? 1 : 0}:${w.color}`)
      .join('|');
    if (wireSig !== this.lastWireSignature) {
      this.syncWiresGeometry(next.wires);
      this.lastWireSignature = wireSig;
    }

    this.applyTelemetryVisuals(0);
    this.requestRender();
  }

  public flyToPreset(preset: CameraPresetKey): void {
    const spec = CAMERA_PRESETS[preset];
    this.targetCamPos.set(...spec.pos);
    this.targetLookAt.set(...spec.target);
    this.cameraAnimating = true;

    if (preset === 'ECU_EXPLODED' && this.targetExplode < 0.75) {
      this.targetExplode = 0.85;
      this.callbacks.onExplodeTargetSync?.(0.85);
    } else if (preset === 'OVERVIEW' && this.targetExplode > 0.2) {
      this.targetExplode = 0;
      this.callbacks.onExplodeTargetSync?.(0);
    }

    this.requestRender();
  }

  private syncWiresGeometry(wires: WireConnection[]): void {
    // Clean old wire geometries & materials
    for (const wv of this.wireVisuals) {
      this.wireGroup.remove(wv.mesh);
      wv.geometry.dispose();
      wv.material.dispose();
    }
    this.wireVisuals = [];

    for (let i = 0; i < wires.length; i++) {
      const wire = wires[i];
      const srcAnchor = this.rig.pinAnchors.get(wire.sourcePinId);
      const dstAnchor = this.rig.pinAnchors.get(wire.targetPinId);
      if (!srcAnchor || !dstAnchor) continue;

      const p0 = srcAnchor.worldAnchor.clone();
      const p3 = dstAnchor.worldAnchor.clone();

      // Arch neatly across the ESD mat with staggered vertical separation to avoid interpenetration
      const archHeight = 0.34 + (i % 5) * 0.08;
      const midA = p0.clone().lerp(p3, 0.35);
      midA.y = Math.max(p0.y, p3.y) + archHeight;
      midA.z += (i % 2 === 0 ? 1 : -1) * 0.08;

      const midB = p0.clone().lerp(p3, 0.68);
      midB.y = Math.max(p0.y, p3.y) + archHeight * 0.85;

      const curve = new THREE.CatmullRomCurve3([p0, midA, midB, p3]);
      const geo = new THREE.TubeGeometry(curve, 24, wire.isCut ? 0.018 : 0.028, 7, false);
      const baseColor = new THREE.Color(wire.color || '#38bdf8');
      const mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.55,
        metalness: 0.08,
        transparent: wire.isCut,
        opacity: wire.isCut ? 0.32 : 1.0,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = !this.isSoftwareGl && !wire.isCut;
      this.wireGroup.add(mesh);

      this.wireVisuals.push({
        wireId: wire.id,
        sourcePinId: wire.sourcePinId,
        targetPinId: wire.targetPinId,
        isCut: wire.isCut,
        baseColor,
        mesh,
        material: mat,
        geometry: geo,
      });
    }
  }

  private getVoltageColor(v: number, out: THREE.Color): THREE.Color {
    if (v >= 10.0) return out.setHex(0xf97316); // +12V B+ warm orange-amber
    if (v >= 3.8) return out.setHex(0x22d3ee); // 5V logic cyan
    if (v >= 0.35) return out.setHex(0x34d399); // Active sensor signal emerald
    return out.setHex(0x475569); // Ground / 0V cool slate
  }

  private applyTelemetryVisuals(dt: number): void {
    const {
      nodeVoltages,
      faults,
      components,
      powerSupply,
      multimeter,
      selectedPinId,
      overlayMode,
      simulationSpeed,
    } = this.telemetry;

    const faultByPin = new Map<string, InjectedFault>();
    for (const f of faults) {
      faultByPin.set(f.pinId, f);
    }

    const isPowerActive = powerSupply.isOutputEnabled;

    // 1. Update Pin Terminal Collars (Voltage / Fault / Selection highlights)
    this.rig.pinAnchors.forEach((anchor, pinId) => {
      const fault = faultByPin.get(pinId);
      const voltage = nodeVoltages[pinId] ?? 0;
      const isSelected = selectedPinId === pinId;

      if (isSelected) {
        anchor.ringMat.color.setHex(0xfbbf24);
        anchor.ringMat.emissive.setHex(0xf59e0b);
        anchor.ringMat.emissiveIntensity = 1.45;
      } else if (fault && fault.faultType !== 'NONE') {
        const isShort =
          fault.faultType === 'SHORT_TO_GND' || fault.faultType === 'SHORT_TO_VBAT';
        anchor.ringMat.color.setHex(isShort ? 0xf43f5e : 0xf59e0b);
        anchor.ringMat.emissive.setHex(isShort ? 0xe11d48 : 0xd97706);
        anchor.ringMat.emissiveIntensity = isShort ? 1.35 : 0.95;
      } else if (overlayMode === 'THERMAL') {
        anchor.ringMat.color.setHex(0x334155);
        anchor.ringMat.emissive.setHex(0x0f172a);
        anchor.ringMat.emissiveIntensity = 0.25;
      } else {
        this.getVoltageColor(voltage, _color);
        anchor.ringMat.color.copy(_color);
        anchor.ringMat.emissive.copy(_color);
        anchor.ringMat.emissiveIntensity = isPowerActive && voltage > 0.35 ? 0.85 : 0.25;
      }
    });

    // 2. Update Internal PCB MOSFET Driver Thermal Glow
    for (const mosfet of this.rig.mosfets) {
      const fault = faultByPin.get(mosfet.pinId);
      const v = nodeVoltages[mosfet.pinId] ?? 0;
      const isShortFault =
        fault?.faultType === 'SHORT_TO_VBAT' || fault?.faultType === 'SHORT_TO_GND';
      const isResFault =
        fault && fault.faultType !== 'NONE' && !isShortFault;

      if (isShortFault) {
        mosfet.bodyMat.emissive.setHex(0xdc2626);
        mosfet.bodyMat.emissiveIntensity = 1.4;
        mosfet.tabMat.emissive.setHex(0xf97316);
        mosfet.tabMat.emissiveIntensity = 1.1;
      } else if (isResFault) {
        mosfet.bodyMat.emissive.setHex(0xd97706);
        mosfet.bodyMat.emissiveIntensity = 0.75;
        mosfet.tabMat.emissive.setHex(0x000000);
        mosfet.tabMat.emissiveIntensity = 0;
      } else if (overlayMode === 'THERMAL' && isPowerActive && v > 0.5) {
        mosfet.bodyMat.emissive.setHex(0x0891b2);
        mosfet.bodyMat.emissiveIntensity = 0.35;
        mosfet.tabMat.emissive.setHex(0x000000);
        mosfet.tabMat.emissiveIntensity = 0;
      } else {
        mosfet.bodyMat.emissive.setHex(0x000000);
        mosfet.bodyMat.emissiveIntensity = 0;
        mosfet.tabMat.emissive.setHex(0x000000);
        mosfet.tabMat.emissiveIntensity = 0;
      }
    }

    // 3. Update Dynamic Wire Loom Colors (Voltage Map vs Fault Thermal vs OEM Wire ID)
    for (const wv of this.wireVisuals) {
      const fault = faultByPin.get(wv.sourcePinId) || faultByPin.get(wv.targetPinId);
      const srcV = nodeVoltages[wv.sourcePinId] ?? 0;
      const dstV = nodeVoltages[wv.targetPinId] ?? 0;
      const wireV = Math.max(srcV, dstV);

      if (wv.isCut) {
        wv.material.color.setHex(0x475569);
        wv.material.emissive.setHex(0x000000);
        wv.material.emissiveIntensity = 0;
        continue;
      }

      if (overlayMode === 'WIRE_ID') {
        wv.material.color.copy(wv.baseColor);
        wv.material.emissive.setHex(0x000000);
        wv.material.emissiveIntensity = 0;
      } else if (overlayMode === 'THERMAL') {
        if (fault && fault.faultType !== 'NONE') {
          const isShort =
            fault.faultType === 'SHORT_TO_GND' || fault.faultType === 'SHORT_TO_VBAT';
          wv.material.color.setHex(isShort ? 0xef4444 : 0xf59e0b);
          wv.material.emissive.setHex(isShort ? 0xdc2626 : 0xb45309);
          wv.material.emissiveIntensity = 0.9;
        } else {
          wv.material.color.setHex(0x1e293b);
          wv.material.emissive.setHex(0x000000);
          wv.material.emissiveIntensity = 0;
        }
      } else {
        // VOLTAGE MAP mode
        this.getVoltageColor(wireV, _color);
        wv.material.color.copy(_color);
        if (fault && fault.faultType !== 'NONE') {
          wv.material.emissive.setHex(0xe11d48);
          wv.material.emissiveIntensity = 0.45;
        } else {
          wv.material.emissive.copy(_color);
          wv.material.emissiveIntensity = isPowerActive && wireV > 0.35 ? 0.32 : 0.05;
        }
      }
    }

    // 4. Sync DMM Red (+) and Black (-) 3D Probes
    const placeProbe = (probeGroup: THREE.Group, pinId: string | null, fallbackX: number) => {
      const anchor = pinId ? this.rig.pinAnchors.get(pinId) : undefined;
      if (anchor) {
        probeGroup.visible = true;
        probeGroup.position.copy(anchor.worldAnchor);
        probeGroup.position.y += 0.02;
        probeGroup.rotation.set(0.18, 0, -0.18);
      } else {
        probeGroup.visible = true;
        probeGroup.position.set(fallbackX, 0.06, 3.85);
        probeGroup.rotation.set(Math.PI / 2, 0, 0.25);
      }
    };
    placeProbe(this.rig.redProbeGroup, multimeter.redProbe.attachedToPinId, -3.5);
    placeProbe(this.rig.blackProbeGroup, multimeter.blackProbe.attachedToPinId, -4.1);

    // 5. Peripheral Component Kinematics (TPS Butterfly, ECT Temp, Relay Latch, Injector Pulse, Crank Wheel)
    const tps = components.find((c) => c.id === 'comp-tps');
    const throttlePct = Number(tps?.state?.throttleAnglePercent ?? 20);
    const targetButterAngle = THREE.MathUtils.clamp(throttlePct / 100, 0, 1) * (Math.PI * 0.46);
    if (dt > 0) {
      this.rig.tpsButterflyPivot.rotation.z = THREE.MathUtils.damp(
        this.rig.tpsButterflyPivot.rotation.z,
        targetButterAngle,
        10,
        dt
      );
    } else {
      this.rig.tpsButterflyPivot.rotation.z = targetButterAngle;
    }

    const ect = components.find((c) => c.id === 'comp-ect');
    const tempC = Number(ect?.state?.tempCelsius ?? 85);
    const tempNorm = THREE.MathUtils.clamp((tempC - 10) / 110, 0, 1);
    // Clean color interpolation: cold cyan-blue -> warm amber -> hot crimson
    if (tempNorm < 0.55) {
      this.rig.ectThermalRingMat.color.setHex(0x38bdf8).lerp(
        _color.setHex(0xf59e0b),
        tempNorm / 0.55
      );
    } else {
      this.rig.ectThermalRingMat.color.setHex(0xf59e0b).lerp(
        _color.setHex(0xef4444),
        (tempNorm - 0.55) / 0.45
      );
    }
    this.rig.ectThermalRingMat.emissive.copy(this.rig.ectThermalRingMat.color);

    const relay = components.find((c) => c.id === 'comp-relay');
    const isRelayLatched = Boolean(relay?.state?.isLatched) && isPowerActive;
    this.rig.relayArmaturePivot.rotation.z = isRelayLatched ? -0.14 : 0.08;
    this.rig.relayCoilGlowMat.color.setHex(isRelayLatched ? 0x22c55e : 0x475569);
    this.rig.relayCoilGlowMat.emissive.setHex(isRelayLatched ? 0x16a34a : 0x000000);
    this.rig.relayCoilGlowMat.emissiveIntensity = isRelayLatched ? 0.9 : 0;

    // CAN terminator LED
    const hasCanFault = faultByPin.has('ecu-pin-13') || faultByPin.has('ecu-pin-14');
    this.rig.canStatusLedMat.color.setHex(
      !isPowerActive ? 0x334155 : hasCanFault ? 0xef4444 : 0x22d3ee
    );
    this.rig.canStatusLedMat.emissive.setHex(
      !isPowerActive ? 0x000000 : hasCanFault ? 0xdc2626 : 0x06b6d4
    );
    this.rig.canStatusLedMat.emissiveIntensity = isPowerActive ? 0.95 : 0;

    // Injector firing pulse + Crankshaft VR 36-1 rotation
    const hasInjectorFault =
      faultByPin.has('ecu-pin-10') ||
      this.telemetry.wires.some((w) => w.targetPinId === 'inj-ctrl' && w.isCut);
    const injActive = isPowerActive && !hasInjectorFault;

    if (dt > 0) {
      const targetSpeed = isPowerActive ? 3.2 * simulationSpeed : 0;
      this.crankSpeedRadPerSec = THREE.MathUtils.damp(
        this.crankSpeedRadPerSec,
        targetSpeed,
        4.5,
        dt
      );
      this.rig.crankWheelGroup.rotation.z -= this.crankSpeedRadPerSec * dt;
      this.elapsedSim += dt * simulationSpeed;
    }

    if (injActive) {
      const cycle = (this.elapsedSim * 2.4) % 1;
      const firing = cycle < 0.28;
      this.rig.injectorPintle.position.y = firing ? 0.27 : 0.3;
      this.rig.injectorSprayMat.opacity = firing ? 0.52 * (1 - cycle / 0.28) : 0;
      this.rig.injectorPulseMat.emissive.setHex(firing ? 0x38bdf8 : 0x0369a1);
      this.rig.injectorPulseMat.emissiveIntensity = firing ? 1.4 : 0.35;
    } else {
      this.rig.injectorPintle.position.y = 0.3;
      this.rig.injectorSprayMat.opacity = 0;
      this.rig.injectorPulseMat.emissive.setHex(hasInjectorFault ? 0xef4444 : 0x000000);
      this.rig.injectorPulseMat.emissiveIntensity = hasInjectorFault ? 0.75 : 0;
    }
  }

  private updateKinematics(dt: number): boolean {
    let needsMoreFrames = false;

    // Smooth ECU Explode Housing transition
    const explodeDelta = Math.abs(this.targetExplode - this.currentExplode);
    if (explodeDelta > 0.001) {
      this.currentExplode = THREE.MathUtils.damp(this.currentExplode, this.targetExplode, 8.5, dt);
      needsMoreFrames = true;
    } else {
      this.currentExplode = this.targetExplode;
    }
    this.rig.ecuLidGroup.position.y = this.currentExplode * 1.45;
    this.rig.ecuBoltsInstanced.position.y = this.currentExplode * 0.55;

    // Smooth camera preset fly-to transition
    if (this.cameraAnimating) {
      const alpha = 1 - Math.exp(-7.5 * dt);
      this.camera.position.lerp(this.targetCamPos, alpha);
      this.controls.target.lerp(this.targetLookAt, alpha);

      if (
        this.camera.position.distanceToSquared(this.targetCamPos) < 0.002 &&
        this.controls.target.distanceToSquared(this.targetLookAt) < 0.002
      ) {
        this.camera.position.copy(this.targetCamPos);
        this.controls.target.copy(this.targetLookAt);
        this.cameraAnimating = false;
      } else {
        needsMoreFrames = true;
      }
    }

    // Active continuous motion while Bench Power is ON (Crank VR wheel + Injector spray pulse)
    if (this.telemetry.powerSupply.isOutputEnabled || this.crankSpeedRadPerSec > 0.02) {
      needsMoreFrames = true;
    }

    // Smooth TPS butterfly damping if still moving
    const tps = this.telemetry.components.find((c) => c.id === 'comp-tps');
    const targetButterAngle =
      THREE.MathUtils.clamp(Number(tps?.state?.throttleAnglePercent ?? 20) / 100, 0, 1) *
      (Math.PI * 0.46);
    if (Math.abs(this.rig.tpsButterflyPivot.rotation.z - targetButterAngle) > 0.002) {
      needsMoreFrames = true;
    }

    this.applyTelemetryVisuals(dt);
    return needsMoreFrames;
  }

  private raycastAtEvent(event: PointerEvent): PickTargetMeta | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    _pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(_pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.rig.pickables, false);
    if (hits.length > 0) {
      return (hits[0].object.userData.pickMeta as PickTargetMeta) || null;
    }
    return null;
  }

  private handlePointerMove(event: PointerEvent): void {
    const now = performance.now();
    if (now - this.lastHoverCheckAt < 50) return; // Throttle to 20Hz
    this.lastHoverCheckAt = now;

    const hit = this.raycastAtEvent(event);
    this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    this.callbacks.onHoverTarget(hit);
  }

  private handlePointerUp(event: PointerEvent): void {
    const dx = event.clientX - this.pointerDownPos.x;
    const dy = event.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > 25) return; // Ignore orbit drags > 5px

    const hit = this.raycastAtEvent(event);
    this.callbacks.onSelectTarget(hit);
  }

  private scheduleAfterDraw(cb: () => void): void {
    try {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (this.disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (state === gl.UNSIGNALED) {
            this.frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            this.frameId = window.setTimeout(cb, 80);
          }
        };
        this.frameId = window.setTimeout(poll, 5);
        return;
      }
    } catch {
      // Fallback if fenceSync unavailable
    }
    this.frameId = window.setTimeout(cb, 80);
  }

  public requestRender(): void {
    if (this.disposed || (typeof document !== 'undefined' && document.hidden)) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;

    this.frameId = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.renderDirty = false;

      const now = performance.now();
      const rawDt = (now - this.lastFrameTs) / 1000;
      this.lastFrameTs = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.1);

      const controlsSettling = this.controls.update();
      const simActive = this.updateKinematics(dt);
      this.renderer.render(this.scene, this.camera);

      const done = () => {
        this.renderBusy = false;
        if (!this.disposed && (this.renderDirty || simActive || controlsSettling)) {
          this.requestRender();
        }
      };

      if (this.isSoftwareGl) {
        this.scheduleAfterDraw(done);
      } else {
        done();
      }
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointermove', this.boundHandlers.onPointerMove);
    canvas.removeEventListener('pointerdown', this.boundHandlers.onPointerDown);
    canvas.removeEventListener('pointerup', this.boundHandlers.onPointerUp);
    canvas.removeEventListener('webglcontextlost', this.boundHandlers.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.boundHandlers.onContextRestored);
    document.removeEventListener('visibilitychange', this.boundHandlers.onVisibilityChange);

    this.controls.dispose();

    for (const wv of this.wireVisuals) {
      wv.geometry.dispose();
      wv.material.dispose();
    }
    this.wireVisuals = [];

    this.registry.disposeAll();
    this.textures.dispose();
    this.envTexture.dispose();
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
