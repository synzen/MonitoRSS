/* eslint-disable no-bitwise */
export default function combineRgbToInt(r: number, g: number, b: number) {
  return (r << 16) + (g << 8) + b;
}
