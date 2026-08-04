declare module "upng-js" {
  export function decode(buf: ArrayBuffer): { width: number; height: number };
  export function toRGBA8(img: any): ArrayBuffer[];
  const UPNG: { decode: typeof decode; toRGBA8: typeof toRGBA8 };
  export default UPNG;
}
