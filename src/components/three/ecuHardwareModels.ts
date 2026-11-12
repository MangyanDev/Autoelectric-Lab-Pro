import * as THREE from 'three';
import { BenchTextureBundle } from './proceduralTextures';

export interface PickTargetMeta {
  kind: 'pin' | 'component' | 'mosfet';
  pinId?: string;
  componentId?: string;
  label: string;
  subtitle: string;
}

export interface PinAnchorVisual {
  pinId: string;
  worldAnchor: THREE.Vector3;
  ringMat: THREE.MeshStandardMaterial;
  pinTipMesh?: THREE.Mesh;
  colliderMesh: THREE.Mesh;
}

export interface MosfetVisual {
  pinId: string;
  bodyMat: THREE.MeshStandardMaterial;
  tabMat: THREE.MeshStandardMaterial;
}

export interface DisposableRegistry {
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  trackGeo: <T extends THREE.BufferGeometry>(geo: T) => T;
  trackMat: <T extends THREE.Material>(mat: T) => T;
  disposeAll: () => void;
}

export function createDisposableRegistry(): DisposableRegistry {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  return {
    geometries,
    materials,
    trackGeo<T extends THREE.BufferGeometry>(geo: T): T {
      geometries.push(geo);
      return geo;
    },
    trackMat<T extends THREE.Material>(mat: T): T {
      materials.push(mat);
      return mat;
    },
    disposeAll() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}

export interface EcuBenchRig {
  root: THREE.Group;
  ecuLidGroup: THREE.Group;
  ecuBoltsInstanced: THREE.InstancedMesh;
  tpsButterflyPivot: THREE.Group;
  injectorPintle: THREE.Mesh;
  injectorSprayCone: THREE.Mesh;
  injectorSprayMat: THREE.MeshBasicMaterial;
  injectorPulseMat: THREE.MeshStandardMaterial;
  relayArmaturePivot: THREE.Group;
  relayCoilGlowMat: THREE.MeshStandardMaterial;
  ectThermalRingMat: THREE.MeshStandardMaterial;
  canStatusLedMat: THREE.MeshStandardMaterial;
  crankWheelGroup: THREE.Group;
  redProbeGroup: THREE.Group;
  blackProbeGroup: THREE.Group;
  pinAnchors: Map<string, PinAnchorVisual>;
  mosfets: MosfetVisual[];
  pickables: THREE.Object3D[];
}

function createRoundedRectShape(width: number, depth: number, radius: number): THREE.Shape {
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.min(radius, hw * 0.4, hd * 0.4);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  return shape;
}

function createToothedWheelShape(outerR: number, innerR: number, teeth: number, missingToothIdx: number): THREE.Shape {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.25;
    const a2 = a0 + step * 0.52;
    const a3 = a0 + step * 0.78;
    const rTooth = i === missingToothIdx ? innerR : outerR;

    const p0x = Math.cos(a0) * innerR;
    const p0y = Math.sin(a0) * innerR;
    if (i === 0) shape.moveTo(p0x, p0y);
    else shape.lineTo(p0x, p0y);

    shape.lineTo(Math.cos(a1) * rTooth, Math.sin(a1) * rTooth);
    shape.lineTo(Math.cos(a2) * rTooth, Math.sin(a2) * rTooth);
    shape.lineTo(Math.cos(a3) * innerR, Math.sin(a3) * innerR);
  }
  shape.closePath();

  const bore = new THREE.Path();
  bore.absarc(0, 0, innerR * 0.34, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  return shape;
}

function addContactShadow(
  parent: THREE.Group,
  w: number,
  d: number,
  textures: BenchTextureBundle,
  reg: DisposableRegistry,
  y = 0.008
): void {
  const geo = reg.trackGeo(new THREE.PlaneGeometry(w, d));
  const mat = reg.trackMat(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadowMap,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    })
  );
  const shadow = new THREE.Mesh(geo, mat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = y;
  parent.add(shadow);
}

export function buildEcuBenchRig(
  textures: BenchTextureBundle,
  reg: DisposableRegistry,
  isSoftwareGl: boolean
): EcuBenchRig {
  const root = new THREE.Group();
  const pinAnchors = new Map<string, PinAnchorVisual>();
  const mosfets: MosfetVisual[] = [];
  const pickables: THREE.Object3D[] = [];

  // Shared PBR materials with distinct roughness/metalness contrast
  const castAluminumMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.36,
      roughnessMap: textures.brushedMetalRoughnessMap,
    })
  );
  const darkAnodizedMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.75,
      roughness: 0.28,
    })
  );
  const nylonPolymerMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x171c26,
      metalness: 0.06,
      roughness: 0.76,
    })
  );
  const darkRubberMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.02,
      roughness: 0.9,
    })
  );
  const brassMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9a441,
      metalness: 0.92,
      roughness: 0.22,
    })
  );
  const goldPinMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.95,
      roughness: 0.16,
    })
  );
  const siliconeSealMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      metalness: 0.04,
      roughness: 0.62,
    })
  );
  const blueAnodizedMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.82,
      roughness: 0.24,
    })
  );
  const copperCoilMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb45309,
      metalness: 0.88,
      roughness: 0.28,
    })
  );
  const invisiblePickMat = reg.trackMat(
    new THREE.MeshBasicMaterial({ visible: false })
  );

  // Helper to create an interactive terminal pin socket with glowing status collar & Layer-1 collider
  const addTerminalSocket = (
    parent: THREE.Group,
    localPos: THREE.Vector3,
    pinId: string,
    label: string,
    subtitle: string,
    pinRadius = 0.045,
    pinHeight = 0.18,
    orientation: 'up' | 'forward' = 'up'
  ): PinAnchorVisual => {
    const holder = new THREE.Group();
    holder.position.copy(localPos);
    if (orientation === 'forward') {
      holder.rotation.x = Math.PI / 2;
    }

    const pinGeo = reg.trackGeo(new THREE.CylinderGeometry(pinRadius, pinRadius, pinHeight, 12));
    const pinMesh = new THREE.Mesh(pinGeo, goldPinMat);
    pinMesh.position.y = pinHeight * 0.5;
    pinMesh.castShadow = !isSoftwareGl;
    holder.add(pinMesh);

    const ringGeo = reg.trackGeo(new THREE.TorusGeometry(pinRadius * 1.65, 0.022, 10, 20));
    const ringMat = reg.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0891b2,
        emissiveIntensity: 0.4,
        roughness: 0.4,
        metalness: 0.3,
      })
    );
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.025;
    holder.add(ring);

    // Invisible simplified Layer-1 collider sphere/cylinder for fast picking
    const colGeo = reg.trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 0.28, 8));
    const col = new THREE.Mesh(colGeo, invisiblePickMat);
    col.position.y = 0.12;
    col.layers.set(1);
    col.userData.pickMeta = {
      kind: 'pin',
      pinId,
      label,
      subtitle,
    } satisfies PickTargetMeta;
    holder.add(col);
    pickables.push(col);

    parent.add(holder);

    parent.updateMatrixWorld(true);
    const worldAnchor = new THREE.Vector3(0, pinHeight, 0);
    holder.localToWorld(worldAnchor);

    const anchor: PinAnchorVisual = {
      pinId,
      worldAnchor,
      ringMat,
      pinTipMesh: pinMesh,
      colliderMesh: col,
    };
    pinAnchors.set(pinId, anchor);
    return anchor;
  };

  // =========================================================================
  // 1. ESD WORKBENCH SURFACE + CHASSIS GROUND STUD (y = 0 grounded)
  // =========================================================================
  const benchBaseGeo = reg.trackGeo(new THREE.BoxGeometry(15.5, 0.24, 10.5));
  const benchBaseMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x161f30,
      metalness: 0.25,
      roughness: 0.72,
    })
  );
  const benchSlab = new THREE.Mesh(benchBaseGeo, benchBaseMat);
  benchSlab.position.set(0, -0.14, 0);
  benchSlab.receiveShadow = !isSoftwareGl;
  root.add(benchSlab);

  const esdMatGeo = reg.trackGeo(new THREE.PlaneGeometry(14.6, 9.6));
  const esdMatMaterial = reg.trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.benchMatMap,
      roughness: 0.85,
      metalness: 0.05,
    })
  );
  const esdMat = new THREE.Mesh(esdMatGeo, esdMatMaterial);
  esdMat.rotation.x = -Math.PI / 2;
  esdMat.position.set(0, 0.002, 0);
  esdMat.receiveShadow = !isSoftwareGl;
  root.add(esdMat);

  // Chassis Ground Brass Stud (bottom-left of bench mat)
  const gndStudGroup = new THREE.Group();
  gndStudGroup.position.set(-5.6, 0, 3.2);
  addContactShadow(gndStudGroup, 0.7, 0.7, textures, reg);
  const studBase = new THREE.Mesh(
    reg.trackGeo(new THREE.CylinderGeometry(0.22, 0.26, 0.08, 16)),
    darkAnodizedMat
  );
  studBase.position.y = 0.04;
  gndStudGroup.add(studBase);
  addTerminalSocket(
    gndStudGroup,
    new THREE.Vector3(0, 0.08, 0),
    'chassis-gnd',
    'Chassis GND (KL31)',
    'ESD Bench Ground Reference Stud',
    0.075,
    0.26,
    'up'
  );
  root.add(gndStudGroup);

  // =========================================================================
  // 2. COMPOSITE EXPLODABLE ECU ASSEMBLY + INTERNAL PCB + 16-PIN CONNECTOR
  // =========================================================================
  const ecuGroup = new THREE.Group();
  ecuGroup.position.set(-3.1, 0, -0.4);
  addContactShadow(ecuGroup, 4.9, 3.9, textures, reg);

  // 2a. 4 Rubber anti-vibration mounting feet (InstancedMesh? 4 corners)
  const footGeo = reg.trackGeo(new THREE.CylinderGeometry(0.16, 0.19, 0.08, 14));
  [
    [-1.95, -1.4],
    [1.95, -1.4],
    [-1.95, 1.4],
    [1.95, 1.4],
  ].forEach(([fx, fz]) => {
    const foot = new THREE.Mesh(footGeo, darkRubberMat);
    foot.position.set(fx, 0.04, fz);
    foot.castShadow = !isSoftwareGl;
    ecuGroup.add(foot);
  });

  // 2b. Cast-aluminum lower tray (ExtrudeGeometry with bevel)
  const trayShape = createRoundedRectShape(4.1, 3.1, 0.22);
  const trayGeo = reg.trackGeo(
    new THREE.ExtrudeGeometry(trayShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    })
  );
  trayGeo.rotateX(Math.PI / 2);
  const ecuTray = new THREE.Mesh(trayGeo, darkAnodizedMat);
  ecuTray.position.y = 0.36;
  ecuTray.castShadow = !isSoftwareGl;
  ecuTray.receiveShadow = !isSoftwareGl;
  ecuGroup.add(ecuTray);

  // 2c. Multi-layer FR4 PCB inside tray
  const pcbGeo = reg.trackGeo(new THREE.BoxGeometry(3.75, 0.07, 2.7));
  const pcbMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.pcbAlbedoMap,
      roughness: 0.42,
      metalness: 0.18,
    })
  );
  const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
  pcbMesh.position.set(0, 0.42, 0);
  pcbMesh.receiveShadow = !isSoftwareGl;
  ecuGroup.add(pcbMesh);

  // Primary QFP-64 MCU package + crystal can + 3 LatheGeometry electrolytic capacitors
  const mcuBody = new THREE.Mesh(
    reg.trackGeo(new THREE.BoxGeometry(0.74, 0.11, 0.74)),
    nylonPolymerMat
  );
  mcuBody.position.set(-0.35, 0.51, -0.15);
  mcuBody.castShadow = !isSoftwareGl;
  ecuGroup.add(mcuBody);

  const crystalCan = new THREE.Mesh(
    reg.trackGeo(new THREE.BoxGeometry(0.28, 0.08, 0.14)),
    castAluminumMat
  );
  crystalCan.position.set(-0.98, 0.49, 0.22);
  ecuGroup.add(crystalCan);

  // LatheGeometry bulk electrolytic capacitor
  const capPoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.16, 0),
    new THREE.Vector2(0.16, 0.36),
    new THREE.Vector2(0.13, 0.4),
    new THREE.Vector2(0, 0.4),
  ];
  const capGeo = reg.trackGeo(new THREE.LatheGeometry(capPoints, 18));
  [-1.35, -1.0, -0.65].forEach((cx, idx) => {
    const cap = new THREE.Mesh(capGeo, idx === 0 ? blueAnodizedMat : darkAnodizedMat);
    cap.position.set(cx, 0.455, -0.85);
    cap.castShadow = !isSoftwareGl;
    ecuGroup.add(cap);
  });

  // Instanced SMD resistors/vias across PCB (>24 items -> InstancedMesh)
  const smdGeo = reg.trackGeo(new THREE.BoxGeometry(0.08, 0.03, 0.05));
  const smdCount = 28;
  const smdInst = new THREE.InstancedMesh(smdGeo, brassMat, smdCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < smdCount; i++) {
    const row = Math.floor(i / 7);
    const col = i % 7;
    dummy.position.set(-1.3 + col * 0.26, 0.47, 0.58 + row * 0.16);
    dummy.rotation.set(0, (i % 2) * (Math.PI / 2), 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    smdInst.setMatrixAt(i, dummy.matrix);
  }
  smdInst.instanceMatrix.needsUpdate = true;
  smdInst.computeBoundingSphere();
  ecuGroup.add(smdInst);

  // 4 Low-Side MOSFET Driver ICs mapped to INJ_1 (#10), IGN_1 (#11), MRELAY (#12), FP_RELAY (#16)
  const mosfetPins: { pinId: string; label: string; zPos: number }[] = [
    { pinId: 'ecu-pin-10', label: 'Q1: INJ_1 Low-Side MOSFET', zPos: -0.78 },
    { pinId: 'ecu-pin-11', label: 'Q2: IGN_1 Driver Stage', zPos: -0.28 },
    { pinId: 'ecu-pin-12', label: 'Q3: MRELAY Pull-Down', zPos: 0.22 },
    { pinId: 'ecu-pin-16', label: 'Q4: FP_RELAY Driver', zPos: 0.72 },
  ];
  const mosfetBodyGeo = reg.trackGeo(new THREE.BoxGeometry(0.3, 0.12, 0.28));
  const mosfetTabGeo = reg.trackGeo(new THREE.BoxGeometry(0.14, 0.05, 0.28));
  const mosfetPickGeo = reg.trackGeo(new THREE.BoxGeometry(0.45, 0.24, 0.36));

  mosfetPins.forEach((mSpec) => {
    const bodyMat = reg.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.65,
        metalness: 0.15,
      })
    );
    const tabMat = reg.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.25,
        metalness: 0.9,
      })
    );

    const mBody = new THREE.Mesh(mosfetBodyGeo, bodyMat);
    mBody.position.set(0.68, 0.51, mSpec.zPos);
    mBody.castShadow = !isSoftwareGl;
    ecuGroup.add(mBody);

    const mTab = new THREE.Mesh(mosfetTabGeo, tabMat);
    mTab.position.set(0.86, 0.48, mSpec.zPos);
    ecuGroup.add(mTab);

    const mPick = new THREE.Mesh(mosfetPickGeo, invisiblePickMat);
    mPick.position.set(0.74, 0.52, mSpec.zPos);
    mPick.layers.set(1);
    mPick.userData.pickMeta = {
      kind: 'mosfet',
      pinId: mSpec.pinId,
      label: mSpec.label,
      subtitle: 'Click to inspect associated ECU output stage',
    } satisfies PickTargetMeta;
    ecuGroup.add(mPick);
    pickables.push(mPick);

    mosfets.push({ pinId: mSpec.pinId, bodyMat, tabMat });
  });

  // 2d. Explodable Ribbed Aluminum Lid + Heatsink Fins + 4 Corner Hex Bolts
  const ecuLidGroup = new THREE.Group();
  const lidShape = createRoundedRectShape(4.14, 3.14, 0.22);
  const lidGeo = reg.trackGeo(
    new THREE.ExtrudeGeometry(lidShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    })
  );
  lidGeo.rotateX(Math.PI / 2);
  const lidPlate = new THREE.Mesh(lidGeo, castAluminumMat);
  lidPlate.position.y = 0.88;
  lidPlate.castShadow = !isSoftwareGl;
  lidPlate.receiveShadow = !isSoftwareGl;
  ecuLidGroup.add(lidPlate);

  // Cooling heatsink ribs along ECU lid top
  const finGeo = reg.trackGeo(new THREE.BoxGeometry(2.6, 0.11, 0.09));
  for (let i = 0; i < 7; i++) {
    const fin = new THREE.Mesh(finGeo, castAluminumMat);
    fin.position.set(-0.2, 0.96, -0.96 + i * 0.32);
    fin.castShadow = !isSoftwareGl;
    ecuLidGroup.add(fin);
  }

  // ECU top spec nameplate badge
  const plateGeo = reg.trackGeo(new THREE.BoxGeometry(1.15, 0.03, 1.55));
  const plateMesh = new THREE.Mesh(plateGeo, darkAnodizedMat);
  plateMesh.position.set(-0.2, 0.96, 0);
  ecuLidGroup.add(plateMesh);

  // 4 Corner Hex Bolts (InstancedMesh)
  const boltGeo = reg.trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 6));
  const ecuBoltsInstanced = new THREE.InstancedMesh(boltGeo, brassMat, 4);
  [
    [-1.8, -1.25],
    [1.8, -1.25],
    [-1.8, 1.25],
    [1.8, 1.25],
  ].forEach(([bx, bz], idx) => {
    dummy.position.set(bx, 0.95, bz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    ecuBoltsInstanced.setMatrixAt(idx, dummy.matrix);
  });
  ecuBoltsInstanced.instanceMatrix.needsUpdate = true;
  ecuBoltsInstanced.computeBoundingSphere();
  ecuLidGroup.add(ecuBoltsInstanced);
  ecuGroup.add(ecuLidGroup);

  // 2e. Keyed 16-Pin Automotive Connector Header on Right Edge of ECU (+X side)
  const connGroup = new THREE.Group();
  connGroup.position.set(2.1, 0.42, 0);

  const shroudOuter = new THREE.Mesh(
    reg.trackGeo(new THREE.BoxGeometry(0.55, 0.56, 2.35)),
    nylonPolymerMat
  );
  shroudOuter.position.set(0.18, 0.12, 0);
  shroudOuter.castShadow = !isSoftwareGl;
  connGroup.add(shroudOuter);

  // Red silicone weather-pack perimeter seal
  const sealMesh = new THREE.Mesh(
    reg.trackGeo(new THREE.BoxGeometry(0.14, 0.52, 2.26)),
    siliconeSealMat
  );
  sealMesh.position.set(0.38, 0.12, 0);
  connGroup.add(sealMesh);

  // Connector Pin Legend Strip on Top of Shroud
  const legendStrip = new THREE.Mesh(
    reg.trackGeo(new THREE.PlaneGeometry(2.15, 0.44)),
    reg.trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.connectorLegendMap,
        roughness: 0.45,
        metalness: 0.1,
      })
    )
  );
  legendStrip.rotation.x = -Math.PI / 2;
  legendStrip.rotation.z = -Math.PI / 2;
  legendStrip.position.set(0.18, 0.405, 0);
  connGroup.add(legendStrip);

  ecuGroup.add(connGroup);
  root.add(ecuGroup);

  // Add all 16 ECU Pins (2 columns × 8 rows protruding +X from connector shroud)
  const ecuPinLabels = [
    ['ecu-pin-1', 'KL31', 'Power Ground 1'],
    ['ecu-pin-2', 'KL31_2', 'Power Ground 2'],
    ['ecu-pin-3', 'KL30', 'Battery Constant +12V'],
    ['ecu-pin-4', 'KL15', 'Ignition Switch +12V'],
    ['ecu-pin-5', 'VREF_5V', 'Sensor 5V Reference'],
    ['ecu-pin-6', 'SGND', 'Sensor Clean Ground'],
    ['ecu-pin-7', 'TPS_SIG', 'Throttle Position Signal'],
    ['ecu-pin-8', 'MAP_SIG', 'Manifold Pressure Signal'],
    ['ecu-pin-9', 'ECT_SIG', 'Coolant Temp Signal'],
    ['ecu-pin-10', 'INJ_1', 'Injector 1 Low-Side Sink'],
    ['ecu-pin-11', 'IGN_1', 'Ignition Coil 1 Trigger'],
    ['ecu-pin-12', 'MRELAY', 'Main Relay Pull-Down'],
    ['ecu-pin-13', 'CAN_H', 'High-Speed CAN High'],
    ['ecu-pin-14', 'CAN_L', 'High-Speed CAN Low'],
    ['ecu-pin-15', 'O2_SIG', 'Oxygen Sensor Signal'],
    ['ecu-pin-16', 'FP_RELAY', 'Fuel Pump Relay Driver'],
  ];

  ecuPinLabels.forEach(([pinId, label, subtitle], idx) => {
    const row = idx < 8 ? 0 : 1; // Top row pins 1..8, bottom row pins 9..16
    const col = idx % 8;
    const zOffset = -0.875 + col * 0.25;
    const yOffset = row === 0 ? 0.24 : -0.02;

    // Orient pins pointing along +X
    const pinHolder = new THREE.Group();
    pinHolder.position.set(0.46, yOffset, zOffset);
    pinHolder.rotation.z = -Math.PI / 2;
    connGroup.add(pinHolder);

    addTerminalSocket(
      pinHolder,
      new THREE.Vector3(0, 0, 0),
      pinId,
      `Pin ${idx + 1}: ${label}`,
      subtitle,
      0.036,
      0.24,
      'up'
    );
  });

  // =========================================================================
  // 3. PERIPHERAL SENSORS, ACTUATORS & CRANKSHAFT VR TRIGGER RIG
  // =========================================================================

  // 3a. TPS (Throttle Position Sensor + Rotating Throttle Body)
  const tpsGroup = new THREE.Group();
  tpsGroup.position.set(2.2, 0, -2.85);
  addContactShadow(tpsGroup, 2.0, 1.5, textures, reg);

  const tpsBore = new THREE.Mesh(
    reg.trackGeo(new THREE.CylinderGeometry(0.55, 0.55, 0.72, 24)),
    castAluminumMat
  );
  tpsBore.rotation.z = Math.PI / 2;
  tpsBore.position.set(0.15, 0.55, 0);
  tpsBore.castShadow = !isSoftwareGl;
  tpsGroup.add(tpsBore);

  const tpsHousing = new THREE.Mesh(
    reg.trackGeo(new THREE.BoxGeometry(0.65, 0.78, 0.92)),
    nylonPolymerMat
  );
  tpsHousing.position.set(-0.38, 0.42, 0);
  tpsHousing.castShadow = !isSoftwareGl;
  tpsGroup.add(tpsHousing);

  const tpsButterflyPivot = new THREE.Group();
  tpsButterflyPivot.position.set(0.15, 0.55, 0);
  const butterflyDisc = new THREE.Mesh(
    reg.trackGeo(new THREE.CylinderGeometry(0.44, 0.44, 0.04, 24)),
    brassMat
  );
  tpsButterflyPivot.add(butterflyDisc);
  const throttleShaft = new THREE.Mesh(
    reg.trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 1.15, 12)),
    darkAnodizedMat
  );
  throttleShaft.rotation.z = Math.PI / 2;
  tpsButterflyPivot.add(throttleShaft);
  tpsGroup.add(tpsButterflyPivot);

  addTerminalSocket(tpsGroup, new THREE.Vector3(-0.72, 0.62, -0.25), 'tps-vcc', 'TPS 5V VCC', 'Throttle Sensor Supply', 0.036, 0.16);
  addTerminalSocket(tpsGroup, new THREE.Vector3(-0.72, 0.62, 0.0), 'tps-sig', 'TPS WIPER SIG', 'Analog Throttle Feedback', 0.036, 0.16);
  addTerminalSocket(tpsGroup, new THREE.Vector3(-0.72, 0.62, 0.25), 'tps-gnd', 'TPS GND', 'Throttle Clean Ground', 0.036, 0.16);
  root.add(tpsGroup);

  // 3b. MAP Sensor (Manifold Absolute Pressure)
  const mapGroup = new THREE.Group();
  mapGroup.position.set(2.3, 0, -0.95);
  addContactShadow(mapGroup, 1.5, 1.2, textures, reg);

  const mapBody = new THREE.Mesh(
    reg.trackGeo(new THREE.BoxGeometry(0.88, 0.52, 0.74)),
    nylonPolymerMat
  );
  mapBody.position.set(0, 0.28, 0);
  mapBody.castShadow = !isSoftwareGl;
  mapGroup.add(mapBody);

  const nipplePoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.12, 0),
    new THREE.Vector2(0.08, 0.22),
    new THREE.Vector2(0.13, 0.26),
    new THREE.Vector2(0.07, 0.42),
    new THREE.Vector2(0.05, 0.42),
  ];
  const vacNipple = new THREE.Mesh(reg.trackGeo(new THREE.LatheGeometry(nipplePoints, 16)), brassMat);
  vacNipple.rotation.z = -Math.PI / 2;
  vacNipple.position.set(0.42, 0.28, 0);
  mapGroup.add(vacNipple);

  addTerminalSocket(mapGroup, new THREE.Vector3(-0.46, 0.46, -0.22), 'map-vcc', 'MAP 5V VCC', 'MAP Supply', 0.034, 0.15);
  addTerminalSocket(mapGroup, new THREE.Vector3(-0.46, 0.46, 0.0), 'map-sig', 'MAP SIG', 'Manifold Pressure Output', 0.034, 0.15);
  addTerminalSocket(mapGroup, new THREE.Vector3(-0.46, 0.46, 0.22), 'map-gnd', 'MAP GND', 'MAP Sensor Ground', 0.034, 0.15);
  root.add(mapGroup);

  // 3c. ECT Sensor (Coolant Temp NTC Brass Hex Probe)
  const ectGroup = new THREE.Group();
  ectGroup.position.set(2.25, 0, 0.95);
  addContactShadow(ectGroup, 1.3, 1.1, textures, reg);

  const ectHex = new THREE.Mesh(
    reg.trackGeo(new THREE.CylinderGeometry(0.28, 0.28, 0.24, 6)),
    brassMat
  );
  ectHex.position.set(0, 0.24, 0);
  ectHex.castShadow = !isSoftwareGl;
  ectGroup.add(ectHex);

  const ectProbe = new THREE.Mesh(
    reg.trackGeo(new THREE.CylinderGeometry(0.14, 0.11, 0.48, 16)),
    brassMat
  );
  ectProbe.rotation.z = -Math.PI / 2;
  ectProbe.position.set(0.32, 0.24, 0);
  ectGroup.add(ectProbe);

  const ectCap = new THREE.Mesh(
    reg.trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 16)),
    blueAnodizedMat
  );
  ectCap.position.set(-0.22, 0.26, 0);
  ectCap.rotation.z = Math.PI / 2;
  ectGroup.add(ectCap);

  const ectThermalRingMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.3,
    })
  );
  const ectThermalRing = new THREE.Mesh(
    reg.trackGeo(new THREE.TorusGeometry(0.17, 0.035, 10, 20)),
    ectThermalRingMat
  );
  ectThermalRing.rotation.y = Math.PI / 2;
  ectThermalRing.position.set(0.38, 0.24, 0);
  ectGroup.add(ectThermalRing);

  addTerminalSocket(ectGroup, new THREE.Vector3(-0.38, 0.4, -0.11), 'ect-sig', 'ECT THERMISTOR +', 'NTC Coolant Signal', 0.034, 0.15);
  addTerminalSocket(ectGroup, new THREE.Vector3(-0.38, 0.4, 0.11), 'ect-gnd', 'ECT GND', 'Thermistor Return', 0.034, 0.15);
  root.add(ectGroup);

  // 3d. Cylinder 1 Fuel Injector + Live Pintle & Spray Cone
  const injGroup = new THREE.Group();
  injGroup.position.set(4.85, 0, -2.55);
  addContactShadow(injGroup, 1.4, 1.4, textures, reg);

  const injStand = new THREE.Mesh(
    reg.trackGeo(new THREE.BoxGeometry(0.6, 0.14, 0.72)),
    darkAnodizedMat
  );
  injStand.position.y = 0.07;
  injGroup.add(injStand);

  const injBody = new THREE.Mesh(
    reg.trackGeo(new THREE.CylinderGeometry(0.22, 0.16, 0.85, 20)),
    castAluminumMat
  );
  injBody.position.set(0, 0.76, 0);
  injBody.castShadow = !isSoftwareGl;
  injGroup.add(injBody);

  const injCollar = new THREE.Mesh(
    reg.trackGeo(new THREE.CylinderGeometry(0.25, 0.25, 0.26, 20)),
    blueAnodizedMat
  );
  injCollar.position.set(0, 1.05, 0);
  injGroup.add(injCollar);

  const injectorPulseMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.2,
    })
  );
  const injLedBand = new THREE.Mesh(
    reg.trackGeo(new THREE.TorusGeometry(0.24, 0.025, 8, 22)),
    injectorPulseMat
  );
  injLedBand.rotation.x = Math.PI / 2;
  injLedBand.position.set(0, 0.85, 0);
  injGroup.add(injLedBand);

  const injectorPintle = new THREE.Mesh(
    reg.trackGeo(new THREE.CylinderGeometry(0.05, 0.03, 0.18, 12)),
    brassMat
  );
  injectorPintle.position.set(0, 0.3, 0);
  injGroup.add(injectorPintle);

  const injectorSprayMat = reg.trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    })
  );
  const injectorSprayCone = new THREE.Mesh(
    reg.trackGeo(new THREE.ConeGeometry(0.24, 0.32, 16, 1, true)),
    injectorSprayMat
  );
  injectorSprayCone.position.set(0, 0.16, 0);
  injGroup.add(injectorSprayCone);

  addTerminalSocket(injGroup, new THREE.Vector3(-0.28, 1.18, -0.11), 'inj-vbat', 'INJ +12V VBAT', 'Injector Coil Supply', 0.034, 0.15);
  addTerminalSocket(injGroup, new THREE.Vector3(-0.28, 1.18, 0.11), 'inj-ctrl', 'INJ ECU SINK', 'Low-Side Driver Pin 10', 0.034, 0.15);
  root.add(injGroup);

  // 3e. ISO Main System Relay (Translucent Cover + Visible Copper Coil & Hinged Armature)
  const relayGroup = new THREE.Group();
  relayGroup.position.set(4.85, 0, -0.45);
  addContactShadow(relayGroup, 1.3, 1.3, textures, reg);

  const relaySocket = new THREE.Mesh(
    reg.trackGeo(new THREE.BoxGeometry(0.86, 0.26, 0.86)),
    nylonPolymerMat
  );
  relaySocket.position.y = 0.13;
  relaySocket.castShadow = !isSoftwareGl;
  relayGroup.add(relaySocket);

  const relayCoil = new THREE.Mesh(
    reg.trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.38, 16)),
    copperCoilMat
  );
  relayCoil.position.set(0.08, 0.45, 0);
  relayGroup.add(relayCoil);

  const relayCoilGlowMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.6,
      roughness: 0.35,
    })
  );
  const relayLed = new THREE.Mesh(
    reg.trackGeo(new THREE.SphereGeometry(0.06, 12, 12)),
    relayCoilGlowMat
  );
  relayLed.position.set(-0.24, 0.72, 0.24);
  relayGroup.add(relayLed);

  const relayArmaturePivot = new THREE.Group();
  relayArmaturePivot.position.set(-0.15, 0.68, 0);
  const armatureBar = new THREE.Mesh(
    reg.trackGeo(new THREE.BoxGeometry(0.42, 0.04, 0.24)),
    brassMat
  );
  armatureBar.position.set(0.21, 0, 0);
  relayArmaturePivot.add(armatureBar);
  relayGroup.add(relayArmaturePivot);

  const relayCoverMat = reg.trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: isSoftwareGl ? 0.28 : 0.24,
      roughness: 0.12,
      metalness: 0.05,
      depthWrite: false,
    })
  );
  const relayCover = new THREE.Mesh(
    reg.trackGeo(new THREE.BoxGeometry(0.8, 0.62, 0.8)),
    relayCoverMat
  );
  relayCover.position.y = 0.57;
  relayCover.renderOrder = 2;
  relayGroup.add(relayCover);

  addTerminalSocket(relayGroup, new THREE.Vector3(-0.34, 0.27, -0.26), 'relay-30', 'RELAY PIN 30', '+12V Input', 0.032, 0.15);
  addTerminalSocket(relayGroup, new THREE.Vector3(-0.34, 0.27, -0.09), 'relay-87', 'RELAY PIN 87', 'Switched Load Out', 0.032, 0.15);
  addTerminalSocket(relayGroup, new THREE.Vector3(-0.34, 0.27, 0.09), 'relay-86', 'RELAY PIN 86', 'Coil +12V', 0.032, 0.15);
  addTerminalSocket(relayGroup, new THREE.Vector3(-0.34, 0.27, 0.26), 'relay-85', 'RELAY PIN 85', 'ECU Coil Sink', 0.032, 0.15);
  root.add(relayGroup);

  // 3f. CAN Bus 120-Ohm Terminator Module
  const canGroup = new THREE.Group();
  canGroup.position.set(4.85, 0, 1.75);
  addContactShadow(canGroup, 1.3, 1.1, textures, reg);

  const canBox = new THREE.Mesh(
    reg.trackGeo(new THREE.BoxGeometry(0.84, 0.42, 0.68)),
    darkAnodizedMat
  );
  canBox.position.y = 0.21;
  canBox.castShadow = !isSoftwareGl;
  canGroup.add(canBox);

  const canStatusLedMat = reg.trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.7,
      roughness: 0.3,
    })
  );
  const canLed = new THREE.Mesh(
    reg.trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 14)),
    canStatusLedMat
  );
  canLed.position.set(0.18, 0.43, 0);
  canGroup.add(canLed);

  addTerminalSocket(canGroup, new THREE.Vector3(-0.32, 0.42, -0.14), 'can-term-h', 'CAN-H 120Ω', 'High-Speed CAN High', 0.034, 0.15);
  addTerminalSocket(canGroup, new THREE.Vector3(-0.32, 0.42, 0.14), 'can-term-l', 'CAN-L 120Ω', 'High-Speed CAN Low', 0.034, 0.15);
  root.add(canGroup);

  // 3g. Crankshaft VR 36-1 Trigger Wheel & Inductive Pickup Assembly (Front-Right)
  const crankBase = new THREE.Group();
  crankBase.position.set(2.25, 0, 2.9);
  addContactShadow(crankBase, 1.9, 1.3, textures, reg);

  const crankPedestal = new THREE.Mesh(
    reg.trackGeo(new THREE.BoxGeometry(0.85, 0.28, 0.44)),
    darkAnodizedMat
  );
  crankPedestal.position.y = 0.14;
  crankBase.add(crankPedestal);

  const crankWheelGroup = new THREE.Group();
  crankWheelGroup.position.set(0, 0.85, 0);

  const wheelShape = createToothedWheelShape(0.68, 0.56, 36, 0);
  const wheelGeo = reg.trackGeo(
    new THREE.ExtrudeGeometry(wheelShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 1,
    })
  );
  wheelGeo.center();
  const crankDisc = new THREE.Mesh(wheelGeo, castAluminumMat);
  crankDisc.castShadow = !isSoftwareGl;
  crankWheelGroup.add(crankDisc);

  const hubShaft = new THREE.Mesh(
    reg.trackGeo(new THREE.CylinderGeometry(0.15, 0.15, 0.34, 16)),
    brassMat
  );
  hubShaft.rotation.x = Math.PI / 2;
  crankWheelGroup.add(hubShaft);
  crankBase.add(crankWheelGroup);

  // VR Inductive Pickup Sensor pointing at teeth
  const vrSensorBody = new THREE.Mesh(
    reg.trackGeo(new THREE.CylinderGeometry(0.1, 0.1, 0.46, 14)),
    brassMat
  );
  vrSensorBody.rotation.z = Math.PI / 2;
  vrSensorBody.position.set(0.96, 0.85, 0);
  crankBase.add(vrSensorBody);
  root.add(crankBase);

  // =========================================================================
  // 4. 3D DMM PROBE MARKERS (RED + AND BLACK -)
  // =========================================================================
  const buildProbeMesh = (collarColor: number): THREE.Group => {
    const g = new THREE.Group();
    const tip = new THREE.Mesh(
      reg.trackGeo(new THREE.ConeGeometry(0.032, 0.18, 12)),
      castAluminumMat
    );
    tip.rotation.x = Math.PI;
    tip.position.y = 0.09;
    g.add(tip);

    const sleeve = new THREE.Mesh(
      reg.trackGeo(new THREE.CylinderGeometry(0.065, 0.045, 0.48, 14)),
      reg.trackMat(
        new THREE.MeshStandardMaterial({
          color: collarColor,
          roughness: 0.45,
          metalness: 0.1,
        })
      )
    );
    sleeve.position.y = 0.42;
    g.add(sleeve);
    return g;
  };

  const redProbeGroup = buildProbeMesh(0xef4444);
  const blackProbeGroup = buildProbeMesh(0x334155);
  root.add(redProbeGroup);
  root.add(blackProbeGroup);

  return {
    root,
    ecuLidGroup,
    ecuBoltsInstanced,
    tpsButterflyPivot,
    injectorPintle,
    injectorSprayCone,
    injectorSprayMat,
    injectorPulseMat,
    relayArmaturePivot,
    relayCoilGlowMat,
    ectThermalRingMat,
    canStatusLedMat,
    crankWheelGroup,
    redProbeGroup,
    blackProbeGroup,
    pinAnchors,
    mosfets,
    pickables,
  };
}
