import type { MaterialValues } from './types';

export type TensorMode = 'default' | 'custom';
export type Matrix3 = [[number, number, number], [number, number, number], [number, number, number]];

export const MU0 = 4 * Math.PI * 1e-7;
export const DEG = Math.PI / 180;

export const ND_MODE_KEY = 'NdMode';
export const NA_MODE_KEY = 'NaMode';

const AXES = ['xx', 'xy', 'xz', 'yx', 'yy', 'yz', 'zx', 'zy', 'zz'] as const;
export type TensorAxisKey = (typeof AXES)[number];

export const TENSOR_AXES = AXES;

export function tensorKey(prefix: 'Nd' | 'Na', axis: TensorAxisKey): string {
  return `${prefix}_${axis}`;
}

export function zeroTensor(): Matrix3 {
  return [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
}

export function thinFilmDemagTensor(): Matrix3 {
  return [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 1],
  ];
}

export function sphereDemagTensor(): Matrix3 {
  return [
    [1 / 3, 0, 0],
    [0, 1 / 3, 0],
    [0, 0, 1 / 3],
  ];
}

export function singleLayerTensorDefaults(): Record<string, number | string | null> {
  return {
    [ND_MODE_KEY]: 'default',
    [NA_MODE_KEY]: 'default',
    ...tensorEntries('Nd', thinFilmDemagTensor()),
    ...tensorEntries('Na', zeroTensor()),
  };
}

export function tensorEntries(prefix: 'Nd' | 'Na', matrix: Matrix3): Record<string, number> {
  return {
    [tensorKey(prefix, 'xx')]: matrix[0][0],
    [tensorKey(prefix, 'xy')]: matrix[0][1],
    [tensorKey(prefix, 'xz')]: matrix[0][2],
    [tensorKey(prefix, 'yx')]: matrix[1][0],
    [tensorKey(prefix, 'yy')]: matrix[1][1],
    [tensorKey(prefix, 'yz')]: matrix[1][2],
    [tensorKey(prefix, 'zx')]: matrix[2][0],
    [tensorKey(prefix, 'zy')]: matrix[2][1],
    [tensorKey(prefix, 'zz')]: matrix[2][2],
  };
}

export function matrixFromValues(
  values: Record<string, number | string | null>,
  prefix: 'Nd' | 'Na',
  fallback: Matrix3,
): Matrix3 {
  const at = (axis: TensorAxisKey, row: number, col: number): number => {
    const raw = values[tensorKey(prefix, axis)];
    const value = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(value) ? value : fallback[row][col];
  };
  return [
    [at('xx', 0, 0), at('xy', 0, 1), at('xz', 0, 2)],
    [at('yx', 1, 0), at('yy', 1, 1), at('yz', 1, 2)],
    [at('zx', 2, 0), at('zy', 2, 1), at('zz', 2, 2)],
  ];
}

export function sphrToCart(thetaRad: number, phiRad: number): [number, number, number] {
  const sinTheta = Math.sin(thetaRad);
  return [sinTheta * Math.cos(phiRad), sinTheta * Math.sin(phiRad), Math.cos(thetaRad)];
}

export function uniaxialAnisotropyTensor(
  material: MaterialValues,
  kuJm3: number,
  thetaRad: number,
  phiRad: number,
): Matrix3 {
  const u = sphrToCart(thetaRad, phiRad);
  const scale = (-2 * kuJm3) / (MU0 * material.Ms ** 2);
  return outerScaled(u, u, scale);
}

export function addMatrices(a: Matrix3, b: Matrix3): Matrix3 {
  return [
    [a[0][0] + b[0][0], a[0][1] + b[0][1], a[0][2] + b[0][2]],
    [a[1][0] + b[1][0], a[1][1] + b[1][1], a[1][2] + b[1][2]],
    [a[2][0] + b[2][0], a[2][1] + b[2][1], a[2][2] + b[2][2]],
  ];
}

export function formatMatrix(matrix: Matrix3): string {
  return matrix.map((row) => `[${row.map((v) => Number(v.toPrecision(5))).join(', ')}]`).join(' ');
}

function outerScaled(a: [number, number, number], b: [number, number, number], scale: number): Matrix3 {
  return [
    [scale * a[0] * b[0], scale * a[0] * b[1], scale * a[0] * b[2]],
    [scale * a[1] * b[0], scale * a[1] * b[1], scale * a[1] * b[2]],
    [scale * a[2] * b[0], scale * a[2] * b[1], scale * a[2] * b[2]],
  ];
}
