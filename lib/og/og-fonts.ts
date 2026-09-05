import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Satori renders nothing without font data, so the OG route ships its own
 * TTFs (see app/api/og/fonts). Files are read once per process.
 */
const FONT_DIR = join(process.cwd(), "app", "api", "og", "fonts");

interface FontFile {
  family: string;
  file: string;
  weight: 400 | 500 | 700;
}

const HEADING_FONT: FontFile = {
  family: "Montserrat",
  file: "Montserrat-Bold.ttf",
  weight: 700,
};
const BODY_FONT: FontFile = {
  family: "Roboto",
  file: "Roboto-Regular.ttf",
  weight: 400,
};
const MONO_FONT: FontFile = {
  family: "JetBrains Mono",
  file: "JetBrainsMono-Medium.ttf",
  weight: 500,
};
const PIXEL_FONT: FontFile = {
  family: "Press Start 2P",
  file: "PressStart2P-Regular.ttf",
  weight: 400,
};

export interface OgFont {
  data: ArrayBuffer;
  name: string;
  style: "normal";
  weight: 400 | 500 | 700;
}

export interface OgFontSet {
  body: string;
  fonts: OgFont[];
  heading: string;
  headingWeight: 400 | 500 | 700;
}

const fontCache = new Map<string, Promise<ArrayBuffer>>();

function readFont(file: string) {
  let pending = fontCache.get(file);
  if (!pending) {
    pending = readFile(join(FONT_DIR, file)).then((buffer) =>
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      )
    );
    fontCache.set(file, pending);
  }
  return pending;
}

async function toOgFont(font: FontFile): Promise<OgFont> {
  return {
    data: await readFont(font.file),
    name: font.family,
    style: "normal",
    weight: font.weight,
  };
}

function fontFilesFor(themeId: string): {
  body: FontFile;
  heading: FontFile;
} {
  if (themeId === "8bit") {
    return { body: PIXEL_FONT, heading: PIXEL_FONT };
  }
  if (themeId === "terminal") {
    return { body: MONO_FONT, heading: MONO_FONT };
  }
  return { body: BODY_FONT, heading: HEADING_FONT };
}

export async function loadOgFonts(themeId: string): Promise<OgFontSet> {
  const { body, heading } = fontFilesFor(themeId);
  const files = body === heading ? [heading] : [heading, body];
  const fonts = await Promise.all(files.map(toOgFont));
  return {
    body: body.family,
    fonts,
    heading: heading.family,
    headingWeight: heading.weight,
  };
}
