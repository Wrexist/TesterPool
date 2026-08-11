/**
 * Perceptual hashing for screenshot proofs.
 *
 * The cheapest fraud in this product is one screenshot, uploaded by five
 * accounts. A cryptographic hash catches only byte-identical copies, which a
 * re-save or a crop defeats. A difference hash survives both: it shrinks the
 * image to 9x8 greyscale and records whether each pixel is brighter than the
 * one to its right, so it describes the shape of the picture rather than its
 * bytes.
 *
 * Two proofs with the same dHash are the same screenshot. That is never proof
 * of fraud on its own — two testers can legitimately photograph the same
 * store page — which is why a match escalates to a human instead of
 * rejecting.
 */

import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

export type HashResult = {
  hash: string;
  /** 'dhash' is the real thing. 'sha256' means the image would not decode and
   *  we fell back to exact-bytes matching, which is weaker; the caller should
   *  say so in the verdict rather than imply full coverage. */
  method: 'dhash' | 'sha256';
  note?: string;
};

const W = 9;
const H = 8;

export async function perceptualHash(bytes: Uint8Array): Promise<HashResult> {
  try {
    const image = await Image.decode(bytes);
    const small = image.resize(W, H);
    const bmp = small.bitmap; // RGBA, row-major

    const grey = new Float64Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const o = i * 4;
      // Rec. 601 luma: screenshots are mostly text on flat colour, and this
      // weighting keeps light text on dark chrome distinguishable.
      grey[i] = (bmp[o] * 299 + bmp[o + 1] * 587 + bmp[o + 2] * 114) / 1000;
    }

    let bits = '';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W - 1; x++) {
        bits += grey[y * W + x] > grey[y * W + x + 1] ? '1' : '0';
      }
    }

    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return { hash: `dhash:${hex}`, method: 'dhash' };
  } catch (e) {
    const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    return {
      hash: `sha256:${hex}`,
      method: 'sha256',
      note: `image could not be decoded (${String(e).slice(0, 120)}); fell back to an exact-bytes hash, which only catches unmodified re-uploads`,
    };
  }
}

/** Hamming distance between two dHashes, for near-duplicate reporting. */
export function distance(a: string, b: string): number | null {
  if (!a.startsWith('dhash:') || !b.startsWith('dhash:')) return null;
  const x = a.slice(6), y = b.slice(6);
  if (x.length !== y.length) return null;
  let d = 0;
  for (let i = 0; i < x.length; i++) {
    let v = parseInt(x[i], 16) ^ parseInt(y[i], 16);
    while (v) { d += v & 1; v >>= 1; }
  }
  return d;
}
