import type { StarDataPoint } from "@/lib/github";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const TEXTURE_POINT_BUDGET = 640;
// Segments this short get sub-day buckets so launch days keep their cliff.
const HOURLY_SEGMENT_MAX_SPAN_MS = 3 * DAY_MS;
const MIN_TEXTURED_BUCKETS = 2;
// Star arrivals crest in the afternoon UTC (EU evening / US morning).
const CIRCADIAN_PEAK_UTC_HOUR = 15;
const CIRCADIAN_DEPTH = 0.6;
// Sunday-first multipliers — weekends are consistently quieter on GitHub.
const WEEKDAY_FACTORS = [0.8, 1.08, 1.12, 1.1, 1.05, 0.99, 0.86] as const;
const NOISE_SPREAD = 0.9;
const BURST_CHANCE = 0.05;
const BURST_MIN_MULTIPLIER = 3;
const BURST_MAX_MULTIPLIER = 8;
const BURST_DECAY = 0.45;
const BURST_FLOOR = 1.15;

const FNV_OFFSET_BASIS = 0x81_1c_9d_c5;
const FNV_PRIME = 0x01_00_01_93;
const UINT32_RANGE = 4_294_967_296;

// biome-ignore-start lint/suspicious/noBitwiseOperators: FNV-1a and mulberry32 are defined in terms of 32-bit bitwise arithmetic.
function hashSeed(input: string) {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * mulberry32 — a tiny deterministic PRNG. Star-arrival texture must render
 * identically on server, client, and export, so Math.random() is off-limits.
 */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
}
// biome-ignore-end lint/suspicious/noBitwiseOperators: end of seeded-PRNG helpers.

interface Segment {
  endDate: string;
  endMs: number;
  endStars: number;
  seedKey: string;
  startMs: number;
  startStars: number;
}

function toSegments(name: string, anchors: StarDataPoint[]): Segment[] {
  const segments: Segment[] = [];
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const start = anchors[index];
    const end = anchors[index + 1];
    const startMs = new Date(start.date).getTime();
    const endMs = new Date(end.date).getTime();
    if (!(Number.isFinite(startMs) && Number.isFinite(endMs))) {
      return [];
    }
    if (endMs <= startMs) {
      continue;
    }
    segments.push({
      endDate: end.date,
      endMs,
      // A provider glitch could hand us a dip; clamp instead of inventing loss.
      endStars: Math.max(start.stars, end.stars),
      seedKey: `${name}|${start.date}|${start.stars}|${end.stars}`,
      startMs,
      startStars: start.stars,
    });
  }
  return segments;
}

function desiredBucketCount(segment: Segment) {
  const spanMs = segment.endMs - segment.startMs;
  const bucketMs = spanMs <= HOURLY_SEGMENT_MAX_SPAN_MS ? HOUR_MS : DAY_MS;
  return Math.max(MIN_TEXTURED_BUCKETS, Math.round(spanMs / bucketMs));
}

/**
 * Split the point budget across segments proportionally to how many buckets
 * each wants, never dropping a growing segment to zero.
 */
function allocateBuckets(segments: Segment[], budget: number) {
  const desired = segments.map(desiredBucketCount);
  const totalDesired = desired.reduce((sum, count) => sum + count, 0);
  if (totalDesired <= budget) {
    return desired;
  }
  const scale = budget / totalDesired;
  return desired.map((count) =>
    Math.max(MIN_TEXTURED_BUCKETS, Math.floor(count * scale))
  );
}

function circadianFactor(ms: number, bucketMs: number) {
  if (bucketMs >= DAY_MS) {
    return 1;
  }
  const hourOfDay =
    new Date(ms).getUTCHours() + new Date(ms).getUTCMinutes() / 60;
  const phase = ((hourOfDay - CIRCADIAN_PEAK_UTC_HOUR) / 24) * 2 * Math.PI;
  return 1 + CIRCADIAN_DEPTH * Math.cos(phase);
}

function weekdayFactor(ms: number) {
  return WEEKDAY_FACTORS[new Date(ms).getUTCDay()];
}

/**
 * Relative arrival weights for a segment's buckets: day/week cycles times
 * multiplicative noise, with occasional bursts that decay over the following
 * buckets — the shape of a repo getting picked up by HN or a viral post.
 */
function bucketWeights(
  segment: Segment,
  bucketCount: number,
  random: () => number
) {
  const spanMs = segment.endMs - segment.startMs;
  const bucketMs = spanMs / bucketCount;
  const weights: number[] = [];
  let burstBoost = 1;

  for (let index = 0; index < bucketCount; index += 1) {
    const midMs = segment.startMs + bucketMs * (index + 0.5);
    if (burstBoost > BURST_FLOOR) {
      burstBoost = 1 + (burstBoost - 1) * BURST_DECAY;
    } else if (random() < BURST_CHANCE) {
      burstBoost =
        BURST_MIN_MULTIPLIER +
        random() * (BURST_MAX_MULTIPLIER - BURST_MIN_MULTIPLIER);
    } else {
      burstBoost = 1;
    }
    const noise = Math.exp(NOISE_SPREAD * (random() * 2 - 1));
    weights.push(
      circadianFactor(midMs, bucketMs) *
        weekdayFactor(midMs) *
        noise *
        burstBoost
    );
  }
  return weights;
}

/** Integer allocations that sum exactly to `gain` (largest-remainder). */
function allocateGain(weights: number[], gain: number) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (!(totalWeight > 0) || gain <= 0) {
    return weights.map(() => 0);
  }

  const exact = weights.map((weight) => (weight / totalWeight) * gain);
  const floored = exact.map((value) => Math.floor(value));
  let remainder = gain - floored.reduce((sum, value) => sum + value, 0);

  const byRemainder = exact
    .map((value, index) => ({ fraction: value - Math.floor(value), index }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const entry of byRemainder) {
    if (remainder <= 0) {
      break;
    }
    floored[entry.index] += 1;
    remainder -= 1;
  }
  return floored;
}

/**
 * Expand sparse estimated anchors into a realistic star-arrival series.
 *
 * Every input anchor is reproduced exactly and each segment's allocations sum
 * to precisely the observed anchor-to-anchor gain — the texture redistributes
 * when known stars arrived within a segment, never how many. Output is
 * monotone, integer, and deterministic: the PRNG is seeded per segment from
 * the anchor data itself, so historical segments keep their shape as new data
 * appends and server, client, and export all render the same curve.
 */
export function texturizeEstimatedHistory(
  name: string,
  anchors: StarDataPoint[],
  budget: number = TEXTURE_POINT_BUDGET
): StarDataPoint[] {
  // Dense series already carry their own shape, and each segment needs room
  // for at least MIN_TEXTURED_BUCKETS points to stay inside the budget.
  if (anchors.length < 2 || anchors.length * 2 >= budget) {
    return anchors;
  }

  const segments = toSegments(name, anchors);
  const firstAnchor = anchors[0];
  if (segments.length === 0) {
    return anchors;
  }

  const bucketCounts = allocateBuckets(
    segments,
    Math.max(MIN_TEXTURED_BUCKETS, budget - anchors.length)
  );
  const points: StarDataPoint[] = [
    { date: firstAnchor.date, stars: firstAnchor.stars },
  ];

  for (const [index, segment] of segments.entries()) {
    const bucketCount = bucketCounts[index];
    const gain = segment.endStars - segment.startStars;
    const random = createRandom(hashSeed(segment.seedKey));
    const allocations = allocateGain(
      bucketWeights(segment, bucketCount, random),
      gain
    );
    const stepMs = (segment.endMs - segment.startMs) / bucketCount;

    let stars = segment.startStars;
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      stars += allocations[bucket];
      const isLast = bucket === bucketCount - 1;
      points.push({
        date: isLast
          ? segment.endDate
          : new Date(segment.startMs + stepMs * (bucket + 1)).toISOString(),
        stars,
      });
    }
  }

  return points;
}
