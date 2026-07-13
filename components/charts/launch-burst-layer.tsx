"use client";

import { useId, useMemo } from "react";
import { useChartStable, useYScale } from "./chart-context";

const HOUR_MS = 60 * 60 * 1000;
const MAX_SPARKS = 90;
const MAX_POINTS_FOR_LAUNCH_LAYER = 900;
const MAX_LAUNCH_RANGE_DAYS = 21;

interface LaunchBurstLayerProps {
  color: string;
  enabled?: boolean;
  seriesKey: string;
}

interface LaunchPoint {
  stars: number;
  time: number;
  x: number;
  y: number;
}

interface Spark extends LaunchPoint {
  intensity: number;
}

function buildPath(points: LaunchPoint[]) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function pickMilestones(total: number) {
  return [10, 25, 50, 100, 150, 200, 250, 300, 350, 500, 750].filter(
    (value) => value <= total
  );
}

function pointForMilestone(points: LaunchPoint[], milestone: number) {
  return points.find((point) => point.stars >= milestone);
}

function shouldShowLayer(points: LaunchPoint[]) {
  const first = points[0];
  const last = points.at(-1);
  if (!(first && last)) {
    return false;
  }

  const rangeDays = (last.time - first.time) / (24 * HOUR_MS);
  const gain = last.stars - first.stars;
  return (
    points.length >= 25 &&
    points.length <= MAX_POINTS_FOR_LAUNCH_LAYER &&
    rangeDays <= MAX_LAUNCH_RANGE_DAYS &&
    gain >= 25
  );
}

export function LaunchBurstLayer({
  color,
  enabled = true,
  seriesKey,
}: LaunchBurstLayerProps) {
  const { data, innerHeight, xAccessor, xScale } = useChartStable();
  const yScale = useYScale();
  const uniqueId = useId();
  const beamGradientId = `launch-beam-${seriesKey}-${uniqueId}`;
  const glowFilterId = `launch-glow-${seriesKey}-${uniqueId}`;

  const points = useMemo<LaunchPoint[]>(
    () =>
      data.flatMap((datum) => {
        const rawValue = datum[seriesKey];
        if (typeof rawValue !== "number") {
          return [];
        }

        const date = xAccessor(datum);
        const time = date.getTime();
        const x = xScale(date);
        const y = yScale(rawValue);

        if (!(Number.isFinite(time) && x != null && y != null)) {
          return [];
        }

        return [
          {
            stars: rawValue,
            time,
            x,
            y,
          },
        ];
      }),
    [data, seriesKey, xAccessor, xScale, yScale]
  );

  const launchData = useMemo(() => {
    if (!(enabled && shouldShowLayer(points))) {
      return null;
    }

    const events = points.slice(1).flatMap((point, index) => {
      const previous = points[index];
      if (!previous || point.stars <= previous.stars) {
        return [];
      }

      const hours = Math.max((point.time - previous.time) / HOUR_MS, 0.08);
      return [
        {
          ...point,
          velocity: (point.stars - previous.stars) / hours,
        },
      ];
    });

    if (events.length === 0) {
      return null;
    }

    const maxVelocity = Math.max(...events.map((event) => event.velocity));
    const sampleEvery = Math.max(1, Math.ceil(events.length / MAX_SPARKS));
    const sparks: Spark[] = events
      .filter(
        (event, index) =>
          index % sampleEvery === 0 || event.velocity >= maxVelocity * 0.45
      )
      .slice(-MAX_SPARKS)
      .map((event) => ({
        ...event,
        intensity: Math.max(0.18, Math.min(1, event.velocity / maxVelocity)),
      }));

    const total = points.at(-1)?.stars ?? 0;
    const milestones = pickMilestones(total)
      .map((milestone) => ({
        milestone,
        point: pointForMilestone(points, milestone),
      }))
      .filter(
        (item): item is { milestone: number; point: LaunchPoint } =>
          item.point != null
      );

    const path = buildPath(points);

    return { milestones, path, sparks };
  }, [enabled, points]);

  if (!launchData) {
    return null;
  }

  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id={beamGradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="62%" stopColor={color} stopOpacity="0.14" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter
          colorInterpolationFilters="sRGB"
          height="180%"
          id={glowFilterId}
          width="180%"
          x="-40%"
          y="-40%"
        >
          <feGaussianBlur result="blur" stdDeviation="3" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        d={launchData.path}
        fill="none"
        filter={`url(#${glowFilterId})`}
        opacity="0.2"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="12"
      />
      <path
        d={launchData.path}
        fill="none"
        opacity="0.5"
        stroke={color}
        strokeDasharray="1 12"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />

      <g opacity="0.95">
        {launchData.sparks.map((spark) => {
          const length = 22 + spark.intensity * 68;
          const x1 = Math.max(0, spark.x - 3 - spark.intensity * 12);
          const x2 = Math.max(0, spark.x - 12 - spark.intensity * 42);
          const y1 = Math.min(innerHeight, spark.y + 5);
          const y2 = Math.min(innerHeight, y1 + length);

          return (
            <line
              key={`${spark.time}-${spark.stars}`}
              opacity={0.22 + spark.intensity * 0.5}
              stroke={`url(#${beamGradientId})`}
              strokeLinecap="round"
              strokeWidth={1 + spark.intensity * 1.8}
              x1={x1}
              x2={x2}
              y1={y1}
              y2={y2}
            />
          );
        })}
      </g>

      <g filter={`url(#${glowFilterId})`}>
        {launchData.milestones.map(({ milestone, point }) => {
          const radius = milestone >= 100 ? 8 : 6;
          return (
            <g key={milestone} transform={`translate(${point.x}, ${point.y})`}>
              <circle fill={color} opacity="0.1" r={radius + 8} />
              <circle
                fill="var(--chart-background)"
                opacity="0.92"
                r={radius}
                stroke={color}
                strokeWidth="1.5"
              />
              <text
                dominantBaseline="middle"
                fill={color}
                fontSize="9"
                fontWeight="700"
                textAnchor="middle"
                y={0.5}
              >
                {milestone}
              </text>
            </g>
          );
        })}
      </g>
    </g>
  );
}

LaunchBurstLayer.displayName = "LaunchBurstLayer";
