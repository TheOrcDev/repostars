import type { CSSProperties } from "react";

/**
 * Styles for the `ParentSize` measuring div inside a chart container.
 *
 * The default `height: 100%` is resolved by WebKit against the container's
 * aspect-ratio height and ignores its `min-height`, so on iOS Safari the SVG
 * rendered at half height while HTML overlays (the x-axis) pinned to the
 * container bottom. Absolute positioning resolves against the container's
 * real box in every engine. Containers must be `position: relative`.
 */
export const chartParentSizeStyles: CSSProperties = {
  inset: 0,
  position: "absolute",
};
