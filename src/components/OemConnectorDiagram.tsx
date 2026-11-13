import React, { useMemo, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { BenchPinoutInfo, EcuBrandProfile } from './ecuPinoutData';
import { MultimeterState } from '../types/ecu';

interface OemConnectorDiagramProps {
  brand: EcuBrandProfile;
  activePinDetail: BenchPinoutInfo;
  selectedPlugFilter: string;
  showOverlayMarkers: boolean;
  multimeter: MultimeterState;
  nodeVoltages: Record<string, number>;
  onSelectPin: (pin: BenchPinoutInfo) => void;
}

interface CavityRect {
  key: string; // e.g. "PLUG_A-1" or "ALL-88"
  plugId: string;
  pinNumber: number;
  pinCode?: string;
  displayText: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isPowerBlade?: boolean;
}

interface ShroudRect {
  plugId: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  notchTop?: boolean;
  notchBottom?: boolean;
}

interface ConnectorLayout {
  width: number;
  height: number;
  shrouds: ShroudRect[];
  cavities: CavityRect[];
  orientationBadgeX: number;
  orientationBadgeY: number;
}

function makeGridCavities(
  plugId: string,
  startX: number,
  startY: number,
  rows: number[][],
  cellW: number,
  cellH: number,
  gapX: number,
  gapY: number,
  codePrefix = ''
): CavityRect[] {
  const out: CavityRect[] = [];
  rows.forEach((rowPins, rIdx) => {
    rowPins.forEach((pinNum, cIdx) => {
      const displayText = codePrefix ? `${codePrefix}${pinNum}` : `${pinNum}`;
      out.push({
        key: `${plugId}-${pinNum}`,
        plugId,
        pinNumber: pinNum,
        pinCode: codePrefix ? `${codePrefix}${pinNum}` : undefined,
        displayText,
        x: startX + cIdx * (cellW + gapX),
        y: startY + rIdx * (cellH + gapY),
        w: cellW,
        h: cellH,
      });
    });
  });
  return out;
}

function rangeAsc(from: number, to: number): number[] {
  const arr: number[] = [];
  for (let i = from; i <= to; i++) arr.push(i);
  return arr;
}

function rangeDesc(from: number, to: number): number[] {
  const arr: number[] = [];
  for (let i = from; i >= to; i--) arr.push(i);
  return arr;
}

/**
 * Generates exact OEM-geometry connector blocks and numbered cavities for each ECU architecture.
 */
function buildConnectorLayout(brandId: string): ConnectorLayout {
  // 1. Standard Bosch / Hitachi / Transtron 121-Pin Dual-Chamber (81P + 40P)
  // Exact match to OEM Nissan QG16DE / Bosch ME7.5 / Isuzu Transtron housing
  if (
    brandId === 'nissan-hitachi-mec11' ||
    brandId === 'bosch-me75' ||
    brandId === 'isuzu-transtron-4jj1'
  ) {
    const plugA =
      brandId === 'bosch-me75'
        ? 'PLUG_A_81PIN'
        : brandId === 'isuzu-transtron-4jj1'
        ? 'BLOCK_81P'
        : 'PLUG_A_81P';
    const plugB =
      brandId === 'bosch-me75'
        ? 'PLUG_B_40PIN'
        : brandId === 'isuzu-transtron-4jj1'
        ? 'BLOCK_40P'
        : 'PLUG_B_40P';

    const cavities: CavityRect[] = [];
    const shAx = 60;
    const shAy = 174;
    // Left 5 power blades in 81P chamber: [4,5] / [3] / [1,2]
    const bW = 24;
    const bH = 22;
    const bx = shAx + 14;
    const by = shAy + 16;
    cavities.push(
      { key: `${plugA}-4`, plugId: plugA, pinNumber: 4, displayText: '4', x: bx, y: by, w: bW, h: bH, isPowerBlade: true },
      { key: `${plugA}-5`, plugId: plugA, pinNumber: 5, displayText: '5', x: bx + bW + 8, y: by, w: bW, h: bH, isPowerBlade: true },
      { key: `${plugA}-3`, plugId: plugA, pinNumber: 3, displayText: '3', x: bx + (bW + 8) * 0.5, y: by + bH + 10, w: bW, h: bH, isPowerBlade: true },
      { key: `${plugA}-1`, plugId: plugA, pinNumber: 1, displayText: '1', x: bx, y: by + (bH + 10) * 2, w: bW, h: bH, isPowerBlade: true },
      { key: `${plugA}-2`, plugId: plugA, pinNumber: 2, displayText: '2', x: bx + bW + 8, y: by + (bH + 10) * 2, w: bW, h: bH, isPowerBlade: true }
    );

    // Right 4x19 micro-grid (6..81, right-to-left per row!)
    const gxA = bx + bW * 2 + 22;
    const gyA = shAy + 15;
    const mW = 19;
    const mH = 19;
    const gap = 2;
    // Slight divider between row pair 2 & 3 just like Image #2
    const rows81Top = [rangeDesc(24, 6), rangeDesc(43, 25)];
    const rows81Bot = [rangeDesc(62, 44), rangeDesc(81, 63)];
    cavities.push(...makeGridCavities(plugA, gxA, gyA, rows81Top, mW, mH, gap, gap));
    cavities.push(...makeGridCavities(plugA, gxA, gyA + (mH + gap) * 2 + 6, rows81Bot, mW, mH, gap, gap));

    const shAw = gxA + 19 * (mW + gap) + 12 - shAx;
    const shAh = 118;

    // 40-Pin Chamber (82..121)
    const shBx = shAx + shAw + 24;
    const shBy = shAy;
    const gxB = shBx + 14;
    const rows40Top = [rangeAsc(106, 113), rangeAsc(98, 105)];
    const rows40Bot = [rangeAsc(90, 97), rangeAsc(82, 89)];
    cavities.push(...makeGridCavities(plugB, gxB, gyA, rows40Top, mW, mH, gap, gap));
    cavities.push(...makeGridCavities(plugB, gxB, gyA + (mH + gap) * 2 + 6, rows40Bot, mW, mH, gap, gap));

    // Right 8 power blades in 40P chamber: [119,120,121] / [117,118] / [114,115,116]
    const rxB = gxB + 8 * (mW + gap) + 12;
    cavities.push(
      { key: `${plugB}-119`, plugId: plugB, pinNumber: 119, displayText: '119', x: rxB, y: by, w: bW, h: bH, isPowerBlade: true },
      { key: `${plugB}-120`, plugId: plugB, pinNumber: 120, displayText: '120', x: rxB + bW + 5, y: by, w: bW, h: bH, isPowerBlade: true },
      { key: `${plugB}-121`, plugId: plugB, pinNumber: 121, displayText: '121', x: rxB + (bW + 5) * 2, y: by, w: bW, h: bH, isPowerBlade: true },
      { key: `${plugB}-117`, plugId: plugB, pinNumber: 117, displayText: '117', x: rxB + (bW + 5) * 0.5, y: by + bH + 10, w: bW, h: bH, isPowerBlade: true },
      { key: `${plugB}-118`, plugId: plugB, pinNumber: 118, displayText: '118', x: rxB + (bW + 5) * 1.5, y: by + bH + 10, w: bW, h: bH, isPowerBlade: true },
      { key: `${plugB}-114`, plugId: plugB, pinNumber: 114, displayText: '114', x: rxB, y: by + (bH + 10) * 2, w: bW, h: bH, isPowerBlade: true },
      { key: `${plugB}-115`, plugId: plugB, pinNumber: 115, displayText: '115', x: rxB + bW + 5, y: by + (bH + 10) * 2, w: bW, h: bH, isPowerBlade: true },
      { key: `${plugB}-116`, plugId: plugB, pinNumber: 116, displayText: '116', x: rxB + (bW + 5) * 2, y: by + (bH + 10) * 2, w: bW, h: bH, isPowerBlade: true }
    );

    const shBw = rxB + bW * 3 + 22 - shBx;

    return {
      width: shBx + shBw + 95,
      height: 470,
      shrouds: [
        { plugId: plugA, title: 'CHAMBER A (81-PIN · PINS 1–81)', x: shAx, y: shAy, w: shAw, h: shAh, notchTop: true, notchBottom: true },
        { plugId: plugB, title: 'CHAMBER B (40-PIN · PINS 82–121)', x: shBx, y: shBy, w: shBw, h: shAh, notchTop: true, notchBottom: true },
      ],
      cavities,
      orientationBadgeX: shBx + shBw + 24,
      orientationBadgeY: shAy + 32,
    };
  }

  // 2. Toyota Denso Quad-Plug E4(A 34P) + E5(B 35P) + E6(C 35P) + E7(D 24P)
  if (brandId === 'toyota-denso-175822') {
    const shY = 174;
    const shH = 114;
    const cW = 20;
    const cH = 24;
    const g = 2.5;
    const cavities: CavityRect[] = [];

    // Plug A: 34P (11 + 12 + 11)
    const ax = 36;
    const aRows = [rangeAsc(1, 11), rangeAsc(12, 23), rangeAsc(24, 34)];
    cavities.push(...makeGridCavities('PLUG_A', ax + 12, shY + 18, aRows, cW, cH, g, 5));
    const aw = 12 * (cW + g) + 22;

    // Plug B: 35P (12 + 12 + 11)
    const bx = ax + aw + 18;
    const bRows = [rangeAsc(1, 12), rangeAsc(13, 24), rangeAsc(25, 35)];
    cavities.push(...makeGridCavities('PLUG_B', bx + 12, shY + 18, bRows, cW, cH, g, 5));
    const bw = 12 * (cW + g) + 22;

    // Plug C: 35P (12 + 12 + 11)
    const cx = bx + bw + 18;
    const cRows = [rangeAsc(1, 12), rangeAsc(13, 24), rangeAsc(25, 35)];
    cavities.push(...makeGridCavities('PLUG_C', cx + 12, shY + 18, cRows, cW, cH, g, 5));
    const cw = 12 * (cW + g) + 22;

    // Plug D: 24P (8 + 8 + 8)
    const dx = cx + cw + 18;
    const dRows = [rangeAsc(1, 8), rangeAsc(9, 16), rangeAsc(17, 24)];
    cavities.push(...makeGridCavities('PLUG_D', dx + 12, shY + 18, dRows, cW, cH, g, 5));
    const dw = 8 * (cW + g) + 22;

    return {
      width: dx + dw + 76,
      height: 470,
      shrouds: [
        { plugId: 'PLUG_A', title: 'E4 / PLUG A (34P)', x: ax, y: shY, w: aw, h: shH, notchTop: true },
        { plugId: 'PLUG_B', title: 'E5 / PLUG B (35P)', x: bx, y: shY, w: bw, h: shH, notchTop: true },
        { plugId: 'PLUG_C', title: 'E6 / PLUG C (35P)', x: cx, y: shY, w: cw, h: shH, notchTop: true },
        { plugId: 'PLUG_D', title: 'E7 / PLUG D (24P)', x: dx, y: shY, w: dw, h: shH, notchTop: true },
      ],
      cavities,
      orientationBadgeX: dx + dw + 14,
      orientationBadgeY: shY + 32,
    };
  }

  // 3. Hyundai & Kia Bosch EDC16C39 (154-Pin: Conn K 94P + Conn A 60P)
  if (brandId === 'hyundai-kia-edc16c39') {
    const shY = 174;
    const shH = 118;
    const cavities: CavityRect[] = [];

    // Conn K (94P): 6 heavy power blades (K01..K06) + 4x22 micro-grid (K07..K94)
    const kx = 42;
    const bW = 24;
    const bH = 26;
    cavities.push(
      { key: 'CONN_K_94P-5', plugId: 'CONN_K_94P', pinNumber: 5, pinCode: 'K05', displayText: 'K5', x: kx + 12, y: shY + 15, w: bW, h: bH, isPowerBlade: true },
      { key: 'CONN_K_94P-6', plugId: 'CONN_K_94P', pinNumber: 6, pinCode: 'K06', displayText: 'K6', x: kx + 12 + bW + 4, y: shY + 15, w: bW, h: bH, isPowerBlade: true },
      { key: 'CONN_K_94P-3', plugId: 'CONN_K_94P', pinNumber: 3, pinCode: 'K03', displayText: 'K3', x: kx + 12, y: shY + 46, w: bW, h: bH, isPowerBlade: true },
      { key: 'CONN_K_94P-4', plugId: 'CONN_K_94P', pinNumber: 4, pinCode: 'K04', displayText: 'K4', x: kx + 12 + bW + 4, y: shY + 46, w: bW, h: bH, isPowerBlade: true },
      { key: 'CONN_K_94P-1', plugId: 'CONN_K_94P', pinNumber: 1, pinCode: 'K01', displayText: 'K1', x: kx + 12, y: shY + 77, w: bW, h: bH, isPowerBlade: true },
      { key: 'CONN_K_94P-2', plugId: 'CONN_K_94P', pinNumber: 2, pinCode: 'K02', displayText: 'K2', x: kx + 12 + bW + 4, y: shY + 77, w: bW, h: bH, isPowerBlade: true }
    );

    const mW = 19;
    const mH = 20;
    const g = 2;
    const kRows = [
      rangeAsc(7, 28),
      rangeAsc(29, 50),
      rangeAsc(51, 72),
      rangeAsc(73, 94),
    ];
    const kgx = kx + 12 + bW * 2 + 14;
    cavities.push(...makeGridCavities('CONN_K_94P', kgx, shY + 16, kRows, mW, mH, g, 3));
    const kw = kgx + 22 * (mW + g) + 12 - kx;

    // Conn A (60P): 4x15 micro-grid (A01..A60)
    const ax = kx + kw + 22;
    const aRows = [
      rangeAsc(1, 15),
      rangeAsc(16, 30),
      rangeAsc(31, 45),
      rangeAsc(46, 60),
    ];
    cavities.push(...makeGridCavities('CONN_A_60P', ax + 12, shY + 16, aRows, mW, mH, g, 3));
    const aw = 15 * (mW + g) + 22;

    return {
      width: ax + aw + 80,
      height: 470,
      shrouds: [
        { plugId: 'CONN_K_94P', title: 'CONNECTOR K (94-PIN VEHICLE)', x: kx, y: shY, w: kw, h: shH, notchTop: true, notchBottom: true },
        { plugId: 'CONN_A_60P', title: 'CONNECTOR A (60-PIN ENGINE)', x: ax, y: shY, w: aw, h: shH, notchTop: true, notchBottom: true },
      ],
      cavities,
      orientationBadgeX: ax + aw + 16,
      orientationBadgeY: shY + 32,
    };
  }

  // 4. Magneti Marelli IAW 5NF (128-Pin Dual Chamber: Conn A 64P + Conn B 64P)
  if (brandId === 'magneti-marelli-iaw-5nf') {
    const shY = 174;
    const shH = 114;
    const mW = 21;
    const mH = 20;
    const g = 2.5;
    const cavities: CavityRect[] = [];

    const ax = 48;
    const rows = [
      rangeAsc(1, 16),
      rangeAsc(17, 32),
      rangeAsc(33, 48),
      rangeAsc(49, 64),
    ];
    cavities.push(...makeGridCavities('CONN_A_64P', ax + 14, shY + 15, rows, mW, mH, g, 3));
    const aw = 16 * (mW + g) + 26;

    const bx = ax + aw + 28;
    cavities.push(...makeGridCavities('CONN_B_64P', bx + 14, shY + 15, rows, mW, mH, g, 3));
    const bw = aw;

    return {
      width: bx + bw + 84,
      height: 470,
      shrouds: [
        { plugId: 'CONN_A_64P', title: 'CONNECTOR A (64-PIN VEHICLE)', x: ax, y: shY, w: aw, h: shH, notchTop: true, notchBottom: true },
        { plugId: 'CONN_B_64P', title: 'CONNECTOR B (64-PIN ENGINE)', x: bx, y: shY, w: bw, h: shH, notchTop: true, notchBottom: true },
      ],
      cavities,
      orientationBadgeX: bx + bw + 18,
      orientationBadgeY: shY + 32,
    };
  }

  // 5. Ford FoMoCo SID208 / SID209 (154-Pin Triple Chamber: 50P + 54P + 50P)
  if (brandId === 'ford-fomoco-sid208') {
    const shY = 174;
    const shH = 114;
    const mW = 20;
    const mH = 20;
    const g = 2;
    const cavities: CavityRect[] = [];

    const ax = 36;
    const aRows = [rangeAsc(1, 13), rangeAsc(14, 26), rangeAsc(27, 38), rangeAsc(39, 50)];
    cavities.push(...makeGridCavities('PLUG_A_50P', ax + 12, shY + 15, aRows, mW, mH, g, 3));
    const aw = 13 * (mW + g) + 22;

    const bx = ax + aw + 20;
    const bRows = [rangeAsc(1, 14), rangeAsc(15, 28), rangeAsc(29, 41), rangeAsc(42, 54)];
    cavities.push(...makeGridCavities('PLUG_B_54P', bx + 12, shY + 15, bRows, mW, mH, g, 3));
    const bw = 14 * (mW + g) + 22;

    const cx = bx + bw + 20;
    cavities.push(...makeGridCavities('PLUG_C_50P', cx + 12, shY + 15, aRows, mW, mH, g, 3));
    const cw = aw;

    return {
      width: cx + cw + 78,
      height: 470,
      shrouds: [
        { plugId: 'PLUG_A_50P', title: 'PLUG A (50-PIN POWER)', x: ax, y: shY, w: aw, h: shH, notchTop: true },
        { plugId: 'PLUG_B_54P', title: 'PLUG B (54-PIN CAN/FEPS)', x: bx, y: shY, w: bw, h: shH, notchTop: true },
        { plugId: 'PLUG_C_50P', title: 'PLUG C (50-PIN INJECTORS)', x: cx, y: shY, w: cw, h: shH, notchTop: true },
      ],
      cavities,
      orientationBadgeX: cx + cw + 14,
      orientationBadgeY: shY + 32,
    };
  }

  // 6. Honda Keihin PGM-FI (3-Plug: A 31P + B 24P + C 22P)
  if (brandId === 'honda-keihin-pgmfi') {
    const shY = 174;
    const shH = 110;
    const cW = 24;
    const cH = 24;
    const g = 3;
    const cavities: CavityRect[] = [];

    const ax = 68;
    const aRows = [rangeAsc(1, 11), rangeAsc(12, 21), rangeAsc(22, 31)];
    cavities.push(...makeGridCavities('PLUG_A', ax + 14, shY + 16, aRows, cW, cH, g, 5));
    const aw = 11 * (cW + g) + 26;

    const bx = ax + aw + 26;
    const bRows = [rangeAsc(1, 8), rangeAsc(9, 16), rangeAsc(17, 24)];
    cavities.push(...makeGridCavities('PLUG_B', bx + 14, shY + 16, bRows, cW, cH, g, 5));
    const bw = 8 * (cW + g) + 26;

    const cx = bx + bw + 26;
    const cRows = [rangeAsc(1, 8), rangeAsc(9, 15), rangeAsc(16, 22)];
    cavities.push(...makeGridCavities('PLUG_C', cx + 14, shY + 16, cRows, cW, cH, g, 5));
    const cw = 8 * (cW + g) + 26;

    return {
      width: cx + cw + 88,
      height: 470,
      shrouds: [
        { plugId: 'PLUG_A', title: 'PLUG A (31-PIN)', x: ax, y: shY, w: aw, h: shH, notchTop: true },
        { plugId: 'PLUG_B', title: 'PLUG B (24-PIN)', x: bx, y: shY, w: bw, h: shH, notchTop: true },
        { plugId: 'PLUG_C', title: 'PLUG C (22-PIN)', x: cx, y: shY, w: cw, h: shH, notchTop: true },
      ],
      cavities,
      orientationBadgeX: cx + cw + 20,
      orientationBadgeY: shY + 32,
    };
  }

  // 7. Mitsubishi Melco E6T (128-Pin 4-Plug Sequential: 1–35, 36–66, 67–94, 95–128)
  if (brandId === 'mitsubishi-melco-e6t') {
    const shY = 174;
    const shH = 110;
    const cW = 20;
    const cH = 24;
    const g = 2.5;
    const cavities: CavityRect[] = [];

    const b1x = 38;
    cavities.push(
      ...makeGridCavities('ALL', b1x + 12, shY + 16, [rangeAsc(1, 12), rangeAsc(13, 24), rangeAsc(25, 35)], cW, cH, g, 5)
    );
    const b1w = 12 * (cW + g) + 22;

    const b2x = b1x + b1w + 18;
    cavities.push(
      ...makeGridCavities('ALL', b2x + 12, shY + 16, [rangeAsc(36, 46), rangeAsc(47, 56), rangeAsc(57, 66)], cW, cH, g, 5)
    );
    const b2w = 11 * (cW + g) + 22;

    const b3x = b2x + b2w + 18;
    cavities.push(
      ...makeGridCavities('ALL', b3x + 12, shY + 16, [rangeAsc(67, 76), rangeAsc(77, 85), rangeAsc(86, 94)], cW, cH, g, 5)
    );
    const b3w = 10 * (cW + g) + 22;

    const b4x = b3x + b3w + 18;
    cavities.push(
      ...makeGridCavities('ALL', b4x + 12, shY + 16, [rangeAsc(95, 106), rangeAsc(107, 117), rangeAsc(118, 128)], cW, cH, g, 5)
    );
    const b4w = 12 * (cW + g) + 22;

    return {
      width: b4x + b4w + 76,
      height: 470,
      shrouds: [
        { plugId: 'ALL', title: 'BAY 1 (1–35)', x: b1x, y: shY, w: b1w, h: shH, notchTop: true },
        { plugId: 'ALL', title: 'BAY 2 (36–66)', x: b2x, y: shY, w: b2w, h: shH, notchTop: true },
        { plugId: 'ALL', title: 'BAY 3 (67–94)', x: b3x, y: shY, w: b3w, h: shH, notchTop: true },
        { plugId: 'ALL', title: 'BAY 4 (95–128)', x: b4x, y: shY, w: b4w, h: shH, notchTop: true },
      ],
      cavities,
      orientationBadgeX: b4x + b4w + 14,
      orientationBadgeY: shY + 32,
    };
  }

  // 8. Mitsubishi Denso Diesel (2-Plug 35P + 35P)
  if (brandId === 'mitsubishi-denso-diesel') {
    const shY = 174;
    const shH = 110;
    const cW = 26;
    const cH = 24;
    const g = 3;
    const cavities: CavityRect[] = [];

    const ax = 80;
    const rows = [rangeAsc(1, 12), rangeAsc(13, 24), rangeAsc(25, 35)];
    cavities.push(...makeGridCavities('PLUG_A', ax + 16, shY + 16, rows, cW, cH, g, 5));
    const aw = 12 * (cW + g) + 30;

    const bx = ax + aw + 36;
    cavities.push(...makeGridCavities('PLUG_B', bx + 16, shY + 16, rows, cW, cH, g, 5));
    const bw = aw;

    return {
      width: bx + bw + 95,
      height: 470,
      shrouds: [
        { plugId: 'PLUG_A', title: 'PLUG A (POWER & CAN · 35P)', x: ax, y: shY, w: aw, h: shH, notchTop: true },
        { plugId: 'PLUG_B', title: 'PLUG B (SENSORS · 35P)', x: bx, y: shY, w: bw, h: shH, notchTop: true },
      ],
      cavities,
      orientationBadgeX: bx + bw + 22,
      orientationBadgeY: shY + 32,
    };
  }

  // 9. Delphi MT20U / MT22U / MT80 (80-Pin Dual Chamber: Plug A 40P + Plug B 40P)
  const shY = 174;
  const shH = 114;
  const cW = 28;
  const cH = 20;
  const g = 3;
  const cavities: CavityRect[] = [];

  const ax = 84;
  const aRows = [rangeAsc(1, 10), rangeAsc(11, 20), rangeAsc(21, 30), rangeAsc(31, 40)];
  cavities.push(...makeGridCavities('PLUG_A_40P', ax + 16, shY + 15, aRows, cW, cH, g, 3));
  const aw = 10 * (cW + g) + 30;

  const bx = ax + aw + 38;
  const bRows = [rangeAsc(41, 50), rangeAsc(51, 60), rangeAsc(61, 70), rangeAsc(71, 80)];
  cavities.push(...makeGridCavities('PLUG_B_40P', bx + 16, shY + 15, bRows, cW, cH, g, 3));
  const bw = aw;

  return {
    width: bx + bw + 95,
    height: 470,
    shrouds: [
      { plugId: 'PLUG_A_40P', title: 'PLUG A (40-PIN POWER / CAN)', x: ax, y: shY, w: aw, h: shH, notchTop: true },
      { plugId: 'PLUG_B_40P', title: 'PLUG B (40-PIN SENSORS / INJ)', x: bx, y: shY, w: bw, h: shH, notchTop: true },
    ],
    cavities,
    orientationBadgeX: bx + bw + 22,
    orientationBadgeY: shY + 32,
  };
}

function abbreviateWireColor(wireColor: string): string {
  const match = wireColor.match(/\(([^)]+)\)/);
  if (match && match[1].length <= 6) return match[1];
  return wireColor
    .split('/')[0]
    .trim()
    .slice(0, 4)
    .toUpperCase();
}

function formatCalloutLabel(pin: BenchPinoutInfo): string {
  const shortLabel = pin.label.replace(/_[AB]\d+$/, '');
  return `${pin.pinCode || pin.pinNumber} ${shortLabel} (${abbreviateWireColor(pin.wireColor)})`;
}

const CATEGORY_FILL: Record<BenchPinoutInfo['category'], string> = {
  power: '#fee2e2',
  ground: '#e2e8f0',
  communication: '#d1fae5',
  sensor_in: '#dcfce7',
  actuator_out: '#dbeafe',
  boot: '#ede9fe',
};

const CATEGORY_STROKE: Record<BenchPinoutInfo['category'], string> = {
  power: '#dc2626',
  ground: '#475569',
  communication: '#059669',
  sensor_in: '#16a34a',
  actuator_out: '#2563eb',
  boot: '#7c3aed',
};

export const OemConnectorDiagram: React.FC<OemConnectorDiagramProps> = ({
  brand,
  activePinDetail,
  selectedPlugFilter,
  showOverlayMarkers,
  multimeter,
  nodeVoltages,
  onSelectPin,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [hoveredCavity, setHoveredCavity] = useState<{
    cavity: CavityRect;
    pin?: BenchPinoutInfo;
  } | null>(null);

  const layout = useMemo(() => buildConnectorLayout(brand.id), [brand.id]);

  // Index brand.pinouts by cavity key ("plugId-pinNumber") for O(1) lookup
  const pinMap = useMemo(() => {
    const map = new Map<string, BenchPinoutInfo>();
    for (const p of brand.pinouts) {
      map.set(`${p.plug}-${p.pinNumber}`, p);
    }
    return map;
  }, [brand.pinouts]);

  // Build top & bottom OEM wire callout stems (matching Image #2 style)
  const callouts = useMemo(() => {
    const mappedCavities = layout.cavities
      .map((cav) => ({
        cav,
        pin: pinMap.get(cav.key),
      }))
      .filter((entry): entry is { cav: CavityRect; pin: BenchPinoutInfo } => Boolean(entry.pin));

    const midY = 231;
    const topItems = mappedCavities
      .filter((e) => e.cav.y + e.cav.h / 2 <= midY)
      .sort((a, b) => a.cav.x - b.cav.x);
    const botItems = mappedCavities
      .filter((e) => e.cav.y + e.cav.h / 2 > midY)
      .sort((a, b) => a.cav.x - b.cav.x);

    const spreadLabels = (items: typeof mappedCavities, minX: number, maxX: number) => {
      if (items.length === 0) return [];
      const usableW = Math.max(120, maxX - minX);
      const step = items.length > 1 ? usableW / (items.length - 1) : 0;
      return items.map((item, i) => ({
        ...item,
        labelX: items.length === 1 ? (minX + maxX) / 2 : minX + i * step,
      }));
    };

    return {
      top: spreadLabels(topItems, 58, layout.width - 90),
      bottom: spreadLabels(botItems, 58, layout.width - 90),
    };
  }, [layout, pinMap]);

  const hoveredVoltage = useMemo(() => {
    if (!hoveredCavity?.pin) return null;
    const p = hoveredCavity.pin;
    return p.associatedSimPinId && nodeVoltages[p.associatedSimPinId] !== undefined
      ? nodeVoltages[p.associatedSimPinId]
      : p.nominalVoltage;
  }, [hoveredCavity, nodeVoltages]);

  return (
    <div className="relative min-h-[250px] sm:min-h-[300px] h-72 sm:h-80 lg:h-auto lg:flex-1 bg-[#e5e7eb] rounded-lg overflow-hidden border border-slate-700 flex flex-col shrink-0">
      {/* Top Toolbar strip */}
      <div className="flex items-center justify-between px-2 sm:px-2.5 py-1 bg-slate-900/95 border-b border-slate-700 text-[10px] text-slate-300 shrink-0 gap-1.5">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 font-bold text-cyan-300 whitespace-nowrap shrink-0 text-[9.5px] sm:text-[10px]">
            OEM HARNESS CAD
          </span>
          <span className="truncate text-slate-400">
            {hoveredCavity ? (
              hoveredCavity.pin ? (
                <>
                  <strong className="text-amber-300">
                    {hoveredCavity.pin.pinCode || `#${hoveredCavity.pin.pinNumber}`}{' '}
                    {hoveredCavity.pin.label}
                  </strong>{' '}
                  · {hoveredCavity.pin.signalName} ({hoveredCavity.pin.wireColor}) ·{' '}
                  <strong className="text-emerald-300">
                    {hoveredVoltage !== null ? `${hoveredVoltage.toFixed(2)}V` : ''}
                  </strong>
                </>
              ) : (
                <span>
                  Cavity <strong>{hoveredCavity.cavity.displayText}</strong> ({hoveredCavity.cavity.plugId})
                </span>
              )
            ) : (
              'Tap or click any numbered cavity or wire callout to inspect pinout'
            )}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setZoom((z) => Math.max(0.85, Number((z - 0.25).toFixed(2))))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <span className="px-1 font-bold tabular-nums text-[10px] text-cyan-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2.25, Number((z + 0.25).toFixed(2))))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
          {zoom !== 1 && (
            <button
              onClick={() => setZoom(1)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Technical Diagram Canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-start sm:justify-center p-1">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          style={{
            width: `${zoom * 100}%`,
            minWidth: `${Math.round(540 * zoom)}px`,
            height: zoom === 1 ? '100%' : 'auto',
            minHeight: '100%',
          }}
          className="select-none"
        >
          {/* Technical Drawing Outer Plate */}
          <rect
            x="4"
            y="4"
            width={layout.width - 8}
            height={layout.height - 8}
            rx="4"
            fill="#eceef1"
            stroke="#334155"
            strokeWidth="1.5"
          />

          {/* Top Callout Wire Leaders */}
          {callouts.top.map(({ cav, pin, labelX }) => {
            const isSelected =
              activePinDetail.pinNumber === pin.pinNumber && activePinDetail.plug === pin.plug;
            const cx = cav.x + cav.w / 2;
            const cy = cav.y;
            const stemColor = isSelected ? '#0284c7' : '#334155';

            return (
              <g
                key={`top-call-${cav.key}`}
                onClick={() => onSelectPin(pin)}
                onMouseEnter={() => setHoveredCavity({ cavity: cav, pin })}
                onMouseLeave={() => setHoveredCavity(null)}
                className="cursor-pointer"
              >
                <polyline
                  points={`${cx},${cy} ${cx},${cy - 14} ${labelX},148 ${labelX},132`}
                  fill="none"
                  stroke={stemColor}
                  strokeWidth={isSelected ? 1.8 : 0.9}
                />
                <circle cx={cx} cy={cy} r={2} fill={stemColor} />
                <text
                  x={labelX}
                  y={128}
                  transform={`rotate(-90 ${labelX} 128)`}
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill={isSelected ? '#0369a1' : '#0f172a'}
                  textAnchor="start"
                >
                  {formatCalloutLabel(pin)}
                </text>
              </g>
            );
          })}

          {/* Bottom Callout Wire Leaders */}
          {callouts.bottom.map(({ cav, pin, labelX }) => {
            const isSelected =
              activePinDetail.pinNumber === pin.pinNumber && activePinDetail.plug === pin.plug;
            const cx = cav.x + cav.w / 2;
            const cy = cav.y + cav.h;
            const stemColor = isSelected ? '#0284c7' : '#334155';

            return (
              <g
                key={`bot-call-${cav.key}`}
                onClick={() => onSelectPin(pin)}
                onMouseEnter={() => setHoveredCavity({ cavity: cav, pin })}
                onMouseLeave={() => setHoveredCavity(null)}
                className="cursor-pointer"
              >
                <polyline
                  points={`${cx},${cy} ${cx},${cy + 14} ${labelX},324 ${labelX},340`}
                  fill="none"
                  stroke={stemColor}
                  strokeWidth={isSelected ? 1.8 : 0.9}
                />
                <circle cx={cx} cy={cy} r={2} fill={stemColor} />
                <text
                  x={labelX}
                  y={344}
                  transform={`rotate(-90 ${labelX} 344)`}
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill={isSelected ? '#0369a1' : '#0f172a'}
                  textAnchor="end"
                >
                  {formatCalloutLabel(pin)}
                </text>
              </g>
            );
          })}

          {/* Connector Double-Walled Housings & Alignment Lugs */}
          {layout.shrouds.map((sh, idx) => {
            const dimmed = selectedPlugFilter !== 'ALL' && selectedPlugFilter !== sh.plugId;
            return (
              <g key={`${sh.plugId}-${idx}`} opacity={dimmed ? 0.38 : 1}>
                {/* Alignment Key Lugs */}
                {sh.notchTop && (
                  <>
                    <rect
                      x={sh.x + sh.w * 0.25 - 12}
                      y={sh.y - 7}
                      width="24"
                      height="8"
                      rx="1.5"
                      fill="#f8fafc"
                      stroke="#1e293b"
                      strokeWidth="1.5"
                    />
                    <rect
                      x={sh.x + sh.w * 0.75 - 12}
                      y={sh.y - 7}
                      width="24"
                      height="8"
                      rx="1.5"
                      fill="#f8fafc"
                      stroke="#1e293b"
                      strokeWidth="1.5"
                    />
                  </>
                )}
                {sh.notchBottom && (
                  <>
                    <rect
                      x={sh.x + sh.w * 0.25 - 12}
                      y={sh.y + sh.h - 1}
                      width="24"
                      height="8"
                      rx="1.5"
                      fill="#f8fafc"
                      stroke="#1e293b"
                      strokeWidth="1.5"
                    />
                    <rect
                      x={sh.x + sh.w * 0.75 - 12}
                      y={sh.y + sh.h - 1}
                      width="24"
                      height="8"
                      rx="1.5"
                      fill="#f8fafc"
                      stroke="#1e293b"
                      strokeWidth="1.5"
                    />
                  </>
                )}
                {/* Outer shroud */}
                <rect
                  x={sh.x}
                  y={sh.y}
                  width={sh.w}
                  height={sh.h}
                  rx="8"
                  fill="#f8fafc"
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                {/* Inner shroud wall */}
                <rect
                  x={sh.x + 5}
                  y={sh.y + 5}
                  width={sh.w - 10}
                  height={sh.h - 10}
                  rx="5"
                  fill="#f1f5f9"
                  stroke="#334155"
                  strokeWidth="1.2"
                />
                {/* Chamber label inside top margin */}
                <text
                  x={sh.x + sh.w / 2}
                  y={sh.y + sh.h + 18}
                  fontSize="7.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  fill="#475569"
                  textAnchor="middle"
                >
                  {sh.title}
                </text>
              </g>
            );
          })}

          {/* Individual Pin Cavities */}
          {layout.cavities.map((cav) => {
            const pin = pinMap.get(cav.key);
            const isMapped = Boolean(pin);
            const dimmed =
              selectedPlugFilter !== 'ALL' && selectedPlugFilter !== cav.plugId;

            const isSelected =
              Boolean(pin) &&
              activePinDetail.pinNumber === pin!.pinNumber &&
              activePinDetail.plug === pin!.plug;

            const isRedProbe =
              Boolean(pin?.associatedSimPinId) &&
              multimeter.redProbe.attachedToPinId === pin!.associatedSimPinId;
            const isBlackProbe =
              Boolean(pin?.associatedSimPinId) &&
              multimeter.blackProbe.attachedToPinId === pin!.associatedSimPinId;

            let fill = '#ffffff';
            let stroke = '#334155';
            let strokeWidth = 0.9;
            let textColor = '#334155';

            if (isMapped && pin && showOverlayMarkers) {
              fill = CATEGORY_FILL[pin.category];
              stroke = CATEGORY_STROKE[pin.category];
              strokeWidth = 1.3;
              textColor = '#0f172a';
            }
            if (isSelected) {
              fill = '#06b6d4';
              stroke = '#0f172a';
              strokeWidth = 2;
              textColor = '#ffffff';
            }

            return (
              <g
                key={cav.key}
                opacity={dimmed ? 0.35 : 1}
                onClick={() => {
                  if (pin) onSelectPin(pin);
                }}
                onMouseEnter={() => setHoveredCavity({ cavity: cav, pin })}
                onMouseLeave={() => setHoveredCavity(null)}
                className={isMapped ? 'cursor-pointer' : 'cursor-default'}
              >
                <rect
                  x={cav.x}
                  y={cav.y}
                  width={cav.w}
                  height={cav.h}
                  rx="1.5"
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />
                <text
                  x={cav.x + cav.w / 2}
                  y={cav.y + cav.h / 2 + 2.6}
                  fontSize={cav.isPowerBlade ? '8' : cav.displayText.length >= 3 ? '6.6' : '7.4'}
                  fontFamily="monospace"
                  fontWeight={isMapped || isSelected ? 'bold' : 'normal'}
                  fill={textColor}
                  textAnchor="middle"
                >
                  {cav.displayText}
                </text>

                {/* Probe Attachment Markers directly on the Cavity */}
                {isRedProbe && (
                  <circle
                    cx={cav.x + cav.w - 2.5}
                    cy={cav.y + 2.5}
                    r="3.2"
                    fill="#e11d48"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                )}
                {isBlackProbe && (
                  <circle
                    cx={cav.x + 2.5}
                    cy={cav.y + 2.5}
                    r="3.2"
                    fill="#0f172a"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                )}
              </g>
            );
          })}

          {/* H.S. (Harness Side) OEM Symbol Box like Image #2 */}
          <g transform={`translate(${layout.orientationBadgeX}, ${layout.orientationBadgeY})`}>
            <rect x="0" y="0" width="48" height="48" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
            <polygon points="0,48 48,0 48,48" fill="#0f172a" />
            <rect x="6" y="6" width="20" height="12" fill="none" stroke="#0f172a" strokeWidth="1.2" />
            <line x1="10" y1="18" x2="10" y2="23" stroke="#0f172a" strokeWidth="1.2" />
            <line x1="16" y1="18" x2="16" y2="23" stroke="#0f172a" strokeWidth="1.2" />
            <line x1="22" y1="18" x2="22" y2="23" stroke="#0f172a" strokeWidth="1.2" />
            <text
              x="33"
              y="39"
              fontSize="11"
              fontFamily="monospace"
              fontWeight="bold"
              fill="#ffffff"
              textAnchor="middle"
            >
              H.S.
            </text>
          </g>
        </svg>
      </div>

      {/* Bottom Color Key Legend */}
      <div className="px-2.5 py-1 bg-slate-950/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[9.5px] text-slate-300 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#fee2e2] border border-[#dc2626] inline-block" />
            Power
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#e2e8f0] border border-[#475569] inline-block" />
            Ground
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#d1fae5] border border-[#059669] inline-block" />
            CAN / K-Line
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#dcfce7] border border-[#16a34a] inline-block" />
            Sensor
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#dbeafe] border border-[#2563eb] inline-block" />
            Actuator
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#06b6d4] border border-white inline-block" />
            Selected
          </span>
        </div>
        <span className="text-slate-400">H.S. = Harness Side (Terminal View)</span>
      </div>
    </div>
  );
};
