/**
 * Deterministic pseudo-random source for the Dudulemon fixture.
 *
 * Every fixture value is drawn from a named stream so that adding a stream
 * later cannot shift the numbers an older stream already produced. Streams are
 * seeded with `sha256(rootSeed + "::" + streamName)`, and the generator is
 * xoshiro128**, which is small, well distributed, and identical on every
 * platform because it uses only 32-bit integer operations.
 */

import { createHash } from "node:crypto";

export type RandomStream = Readonly<{
  /** Uniform float in `[0, 1)`. */
  next: () => number;
  /** Uniform integer in `[minInclusive, maxInclusive]`. */
  int: (minInclusive: number, maxInclusive: number) => number;
  /** Uniform float in `[minInclusive, maxExclusive)`. */
  float: (minInclusive: number, maxExclusive: number) => number;
  /** True with the given probability in `[0, 1]`. */
  chance: (probability: number) => boolean;
  /** One element of a non-empty list. */
  pick: <T>(values: readonly T[]) => T;
}>;

function seedWords(rootSeed: string, streamName: string): [number, number, number, number] {
  const digest = createHash("sha256").update(`${rootSeed}::${streamName}`, "utf8").digest();
  const words: [number, number, number, number] = [
    digest.readUInt32BE(0),
    digest.readUInt32BE(4),
    digest.readUInt32BE(8),
    digest.readUInt32BE(12),
  ];
  if (words[0] === 0 && words[1] === 0 && words[2] === 0 && words[3] === 0) {
    // xoshiro requires a non-zero state. A sha256 digest of all zero bytes is
    // not reachable in practice, but an all-zero state would silently freeze.
    return [0x9e37_79b9, 0, 0, 0];
  }
  return words;
}

function rotateLeft(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

/**
 * Creates one named stream. `rootSeed` pins the whole fixture, `streamName`
 * isolates this stream from every other one.
 */
export function createRandomStream(rootSeed: string, streamName: string): RandomStream {
  const state = seedWords(rootSeed, streamName);

  function nextUint32(): number {
    const result = Math.imul(rotateLeft(Math.imul(state[1], 5) >>> 0, 7), 9) >>> 0;
    const shifted = (state[1] << 9) >>> 0;
    state[2] = (state[2] ^ state[0]) >>> 0;
    state[3] = (state[3] ^ state[1]) >>> 0;
    state[1] = (state[1] ^ state[2]) >>> 0;
    state[0] = (state[0] ^ state[3]) >>> 0;
    state[2] = (state[2] ^ shifted) >>> 0;
    state[3] = rotateLeft(state[3], 11);
    return result;
  }

  function next(): number {
    return nextUint32() / 0x1_0000_0000;
  }

  function int(minInclusive: number, maxInclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
      throw new Error(
        `random int bounds must be integers, received ${minInclusive}..${maxInclusive}`,
      );
    }
    if (maxInclusive < minInclusive) {
      throw new Error(`random int bounds are inverted: ${minInclusive}..${maxInclusive}`);
    }
    return minInclusive + Math.floor(next() * (maxInclusive - minInclusive + 1));
  }

  function float(minInclusive: number, maxExclusive: number): number {
    if (maxExclusive <= minInclusive) {
      throw new Error(`random float bounds are inverted: ${minInclusive}..${maxExclusive}`);
    }
    return minInclusive + next() * (maxExclusive - minInclusive);
  }

  function chance(probability: number): boolean {
    if (probability < 0 || probability > 1) {
      throw new Error(`probability must be within [0, 1], received ${probability}`);
    }
    return next() < probability;
  }

  function pick<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new Error("cannot pick from an empty list");
    }
    return values[int(0, values.length - 1)]!;
  }

  return Object.freeze({ next, int, float, chance, pick });
}

/** Stable UUID v5 (SHA-1, RFC 4122) so fixture identifiers never drift. */
export function deterministicUuid(namespaceUuid: string, name: string): string {
  const namespaceBytes = Buffer.from(namespaceUuid.replaceAll("-", ""), "hex");
  if (namespaceBytes.length !== 16) {
    throw new Error(`namespace must be a UUID, received "${namespaceUuid}"`);
  }
  const digest = createHash("sha1")
    .update(Buffer.concat([namespaceBytes, Buffer.from(name, "utf8")]))
    .digest();
  const bytes = Uint8Array.prototype.slice.call(digest, 0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
