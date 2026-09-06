import { describe, expect, it } from "vitest";
import { exportFilename } from "@/lib/og/export-filename";

describe("exportFilename", () => {
  it("joins repositories in order with slashes replaced", () => {
    expect(exportFilename(["47ng/nuqs", "vercel/next.js"])).toBe(
      "repostars-47ng-nuqs_vercel-next.js.png"
    );
  });

  it("strips characters that are unsafe in filenames", () => {
    expect(exportFilename(['acme/wid"get?'])).toBe("repostars-acme-widget.png");
  });

  it("falls back to a generic stem", () => {
    expect(exportFilename([])).toBe("repostars-chart.png");
  });
});
