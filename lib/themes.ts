export interface ChartTheme {
  id: string;
  name: string;
  background: string;
  gridColor: string;
  textColor: string;
  axisColor: string;
  lineColors: string[];
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  areaOpacity: number;
  fontFamily?: string;
}

export const themes: Record<string, ChartTheme> = {
  dark: {
    id: "dark",
    name: "Dark",
    background: "#0a0a0a",
    gridColor: "#1a1a2e",
    textColor: "#888",
    axisColor: "#333",
    lineColors: ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7"],
    tooltipBg: "#111",
    tooltipBorder: "#333",
    tooltipText: "#eee",
    areaOpacity: 0.1,
  },
  light: {
    id: "light",
    name: "Light",
    background: "#ffffff",
    gridColor: "#f0f0f0",
    textColor: "#666",
    axisColor: "#ccc",
    lineColors: ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#9333ea"],
    tooltipBg: "#fff",
    tooltipBorder: "#e5e5e5",
    tooltipText: "#333",
    areaOpacity: 0.08,
  },
  neon: {
    id: "neon",
    name: "Neon",
    background: "#0d0221",
    gridColor: "#1a0a3e",
    textColor: "#7c6f9f",
    axisColor: "#2d1b69",
    lineColors: ["#0ff", "#f0f", "#0f0", "#ff0", "#f60"],
    tooltipBg: "#1a0a3e",
    tooltipBorder: "#0ff",
    tooltipText: "#eee",
    areaOpacity: 0.15,
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    background: "#fafafa",
    gridColor: "transparent",
    textColor: "#999",
    axisColor: "#ddd",
    lineColors: ["#000", "#666", "#999", "#bbb", "#ddd"],
    tooltipBg: "#fff",
    tooltipBorder: "#eee",
    tooltipText: "#000",
    areaOpacity: 0,
  },
  "8bit": {
    id: "8bit",
    name: "8-Bit",
    background: "#1a1c2c",
    gridColor: "#262b44",
    textColor: "#5d6f8e",
    axisColor: "#3e4a68",
    lineColors: ["#ef7d57", "#a7f070", "#ffcd75", "#73eff7", "#b55088"],
    tooltipBg: "#262b44",
    tooltipBorder: "#ef7d57",
    tooltipText: "#f4f4f4",
    areaOpacity: 0.12,
    fontFamily: "'Press Start 2P', monospace",
  },
  sunset: {
    id: "sunset",
    name: "Sunset",
    background: "#1a0a1e",
    gridColor: "#2d1233",
    textColor: "#9b7aad",
    axisColor: "#3d2248",
    lineColors: ["#ff6b6b", "#ffa07a", "#ffd93d", "#ff85a1", "#c77dff"],
    tooltipBg: "#2d1233",
    tooltipBorder: "#ff6b6b",
    tooltipText: "#ffeedd",
    areaOpacity: 0.12,
  },
  ocean: {
    id: "ocean",
    name: "Ocean",
    background: "#0a192f",
    gridColor: "#112240",
    textColor: "#5f8aab",
    axisColor: "#1d3557",
    lineColors: ["#64ffda", "#48bfe3", "#5390d9", "#7400b8", "#56cfe1"],
    tooltipBg: "#112240",
    tooltipBorder: "#64ffda",
    tooltipText: "#ccd6f6",
    areaOpacity: 0.1,
  },
  candy: {
    id: "candy",
    name: "Candy",
    background: "#fdf2f8",
    gridColor: "#fce7f3",
    textColor: "#9d4e8a",
    axisColor: "#f0abfc",
    lineColors: ["#ec4899", "#8b5cf6", "#06b6d4", "#f43f5e", "#a855f7"],
    tooltipBg: "#fdf2f8",
    tooltipBorder: "#ec4899",
    tooltipText: "#581c87",
    areaOpacity: 0.08,
  },
  forest: {
    id: "forest",
    name: "Forest",
    background: "#0b1a0b",
    gridColor: "#132a13",
    textColor: "#5e8a5e",
    axisColor: "#2d5a2d",
    lineColors: ["#4ade80", "#a3e635", "#34d399", "#facc15", "#86efac"],
    tooltipBg: "#132a13",
    tooltipBorder: "#4ade80",
    tooltipText: "#d9f99d",
    areaOpacity: 0.1,
  },
  terminal: {
    id: "terminal",
    name: "Terminal",
    background: "#000000",
    gridColor: "#0a1a0a",
    textColor: "#33ff33",
    axisColor: "#1a3a1a",
    lineColors: ["#33ff33", "#00ff88", "#66ff66", "#00cc44", "#99ff99"],
    tooltipBg: "#0a0a0a",
    tooltipBorder: "#33ff33",
    tooltipText: "#33ff33",
    areaOpacity: 0.08,
    fontFamily: "'Courier New', monospace",
  },
};

export const themeIds = Object.keys(themes);
export const defaultTheme = "dark";
