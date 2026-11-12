import * as THREE from 'three';

export interface BenchTextureBundle {
  benchMatMap: THREE.CanvasTexture;
  pcbAlbedoMap: THREE.CanvasTexture;
  brushedMetalRoughnessMap: THREE.CanvasTexture;
  connectorLegendMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable for procedural textures');
  }
  return [canvas, ctx];
}

function createBenchMatTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(1024, 1024);

  // Dark obsidian ESD silicone mat base
  ctx.fillStyle = '#0c1322';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle matte speckle grain
  for (let i = 0; i < 4500; i++) {
    const x = (i * 73) % 1024;
    const y = (i * 137 + Math.floor(i / 14) * 19) % 1024;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Minor grid lines
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)';
  ctx.lineWidth = 1;
  const step = 32;
  for (let p = 0; p <= 1024; p += step) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(1024, p);
    ctx.stroke();
  }

  // Major 128px calibration grid
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
  ctx.lineWidth = 1.5;
  for (let p = 0; p <= 1024; p += 128) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 1024);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(1024, p);
    ctx.stroke();
  }

  // Border framing & ESD bench markings
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 984, 984);

  ctx.fillStyle = 'rgba(148, 163, 184, 0.48)';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('AUTOELECTRIC LAB PRO // ESD BENCH SURFACE (10mm GRID)', 40, 56);
  ctx.fillText('GND STUD KL31 (-)', 40, 986);
  ctx.fillText('ISOLATED 12V/5V HARNESS ZONE', 640, 986);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createPcbTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(1024, 512);

  // FR4 deep teal-emerald solder mask
  ctx.fillStyle = '#0a4a3c';
  ctx.fillRect(0, 0, 1024, 512);

  // Copper pour ground plane regions (slightly brighter teal under solder mask)
  ctx.fillStyle = '#0d5b49';
  ctx.fillRect(28, 28, 968, 456);

  // Silkscreen outer boundary
  ctx.strokeStyle = '#d1fae5';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, 988, 476);

  // Copper routing bus traces
  ctx.strokeStyle = '#188f70';
  ctx.lineWidth = 5;
  for (let i = 0; i < 16; i++) {
    const y = 52 + i * 26;
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(240 + (i % 4) * 32, y);
    ctx.lineTo(310 + (i % 3) * 28, y + (i < 8 ? 16 : -16));
    ctx.lineTo(680, y + (i < 8 ? 16 : -16));
    ctx.stroke();
  }

  // Gold ENIG pads & ground vias
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 22; col++) {
      const x = 48 + col * 43;
      const y = 44 + row * 38;
      if ((row + col) % 3 === 0) {
        ctx.fillStyle = '#d4af37';
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#052e25';
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Silkscreen functional zone markings
  ctx.fillStyle = '#ecfdf5';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('BOSCH-STYLE BENCH ECU REV 4.2', 42, 48);
  ctx.font = 'bold 15px monospace';
  ctx.fillStyle = '#fde68a';
  ctx.fillText('U1: 32-BIT MCU', 385, 130);
  ctx.fillText('REG: 5V VREF', 180, 390);
  ctx.fillText('LOW-SIDE MOSFET DRIVERS (Q1-Q4)', 620, 74);
  ctx.fillText('J1 16-PIN HEADER ->', 760, 466);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createBrushedMetalRoughnessTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y++) {
    const tone = 98 + Math.floor(Math.sin(y * 0.45) * 20 + ((y * 37) % 34));
    ctx.fillStyle = `rgb(${tone},${tone},${tone})`;
    ctx.fillRect(0, y, 512, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  // Data map stays in linear NoColorSpace
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createConnectorLegendTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(1024, 256);
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, 1024, 256);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 1012, 244);

  const topPins = ['1 KL31', '2 KL31', '3 KL30', '4 KL15', '5 VREF', '6 SGND', '7 TPS', '8 MAP'];
  const botPins = ['9 ECT', '10 INJ1', '11 IGN1', '12 MRLY', '13 CANH', '14 CANL', '15 O2', '16 FPR'];

  ctx.font = 'bold 21px monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i < 8; i++) {
    const x = 64 + i * 128;
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(topPins[i], x, 88);
    ctx.fillStyle = '#67e8f9';
    ctx.fillText(botPins[i], x, 194);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.72)');
  grad.addColorStop(0.5, 'rgba(2, 6, 23, 0.34)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createBenchTextures(maxAnisotropy: number): BenchTextureBundle {
  const benchMatMap = createBenchMatTexture(maxAnisotropy);
  const pcbAlbedoMap = createPcbTexture(maxAnisotropy);
  const brushedMetalRoughnessMap = createBrushedMetalRoughnessTexture(maxAnisotropy);
  const connectorLegendMap = createConnectorLegendTexture(maxAnisotropy);
  const contactShadowMap = createContactShadowTexture();

  return {
    benchMatMap,
    pcbAlbedoMap,
    brushedMetalRoughnessMap,
    connectorLegendMap,
    contactShadowMap,
    dispose: () => {
      benchMatMap.dispose();
      pcbAlbedoMap.dispose();
      brushedMetalRoughnessMap.dispose();
      connectorLegendMap.dispose();
      contactShadowMap.dispose();
    },
  };
}
