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
  warcraft: {
    id: "warcraft",
    name: "Warcraft",
    background: "#1a1208",
    gridColor: "#2a1f0e",
    textColor: "#8b7355",
    axisColor: "#4a3928",
    lineColors: ["#ffd100", "#c41e3a", "#00ff96", "#ff7d0a", "#69ccf0"],
    tooltipBg: "#2a1f0e",
    tooltipBorder: "#ffd100",
    tooltipText: "#ffd100",
    areaOpacity: 0.1,
  },
};

export const themeIds = Object.keys(themes);
export const defaultTheme = "dark";
