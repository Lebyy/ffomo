import list from "./gallery.json";

export type GalleryPet = { id: string; src: string };

export const GALLERY = list as GalleryPet[];

export function petAt(seed: string) {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return GALLERY[n % GALLERY.length];
}

export function petsAround(seed: string, count: number) {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: count }, (_, i) => GALLERY[(n + i * 17) % GALLERY.length]);
}
