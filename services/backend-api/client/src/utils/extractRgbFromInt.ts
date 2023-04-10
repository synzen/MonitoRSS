/* eslint-disable no-bitwise */
export default function extractRGBFromInt(i: number) {
  return {
    r: (i >> 16) & 0xff,
    g: (i >> 8) & 0xff,
    b: i & 0xff,
  };
}
