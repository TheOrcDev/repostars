import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { isPostOverlayComponent } from "./time-series-chart-shell";

function SeriesMarkers() {
  return null;
}

SeriesMarkers.displayName = "SeriesMarkers";

describe("isPostOverlayComponent", () => {
  it("keeps series endpoint markers outside the chart clip", () => {
    expect(isPostOverlayComponent(createElement(SeriesMarkers))).toBe(true);
  });
});
