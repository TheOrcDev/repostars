import { formatStars } from "@/components/charts/star-history-data";
import {
  LOGO_AREA_POINTS,
  LOGO_AREA_STROKE,
  LOGO_GAP_STROKE,
  LOGO_LINE_POINTS,
  LOGO_VIEW_BOX,
} from "@/lib/logo-geometry";
import {
  isLoadedRepo,
  type OgChart,
  type OgRepo,
  type OgSeries,
  placeEndLabels,
} from "@/lib/og/load-og-repos";
import type { OgFontSet } from "@/lib/og/og-fonts";
import type { ChartTheme } from "@/lib/themes";

/**
 * The OG card is rendered by Satori, which supports a subset of CSS: every
 * element with more than one child must be `display: flex`, text cannot live
 * inside inline SVG (resvg has no fonts), and CSS filters are unavailable.
 * Layout is therefore computed in absolute pixels below.
 */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const FRAME_PADDING = 48;
const CONTENT_WIDTH = OG_WIDTH - FRAME_PADDING * 2;
const HEADER_HEIGHT = 32;
const TITLE_GAP = 26;
const TITLE_HEIGHT = 108;
const CHART_GAP = 22;
const FOOTER_HEIGHT = 22;
const FOOTER_GAP = 14;
const CHART_HEIGHT =
  OG_HEIGHT -
  FRAME_PADDING * 2 -
  HEADER_HEIGHT -
  TITLE_GAP -
  TITLE_HEIGHT -
  CHART_GAP -
  FOOTER_GAP -
  FOOTER_HEIGHT;
const Y_AXIS_WIDTH = 64;
const END_LABEL_WIDTH = 92;
const PLOT_TOP = 14;
const X_AXIS_HEIGHT = 30;
const PLOT_WIDTH = CONTENT_WIDTH - Y_AXIS_WIDTH - END_LABEL_WIDTH;
const PLOT_HEIGHT = CHART_HEIGHT - PLOT_TOP - X_AXIS_HEIGHT;
const END_LABEL_MIN_GAP = 30;
const X_LABEL_WIDTH = 200;
const LINE_WIDTH = 3.5;
const GLOW_WIDTH = 14;
const PIXEL_MARKER = 12;
const MAX_LEGEND_CHIPS = 5;

export interface OgCardProps {
  chart: OgChart | null;
  fonts: OgFontSet;
  repos: OgRepo[];
  theme: ChartTheme;
}

interface ThemeTreatment {
  glow: boolean;
  gridDash: string | undefined;
  pixel: boolean;
  star: string;
  titlePrefix: string;
}

function treatmentFor(theme: ChartTheme): ThemeTreatment {
  const pixel = theme.id === "8bit";
  return {
    glow: ["neon", "synthwave", "terminal", "aurora"].includes(theme.id),
    gridDash: theme.id === "terminal" ? "2 6" : "4 6",
    pixel,
    star: pixel ? "*" : "★",
    titlePrefix: theme.id === "terminal" ? "> " : "",
  };
}

function LogoMark({ color, size }: { color: string; size: number }) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      style={{ flexShrink: 0 }}
      viewBox={LOGO_VIEW_BOX}
      width={size}
    >
      <defs>
        <mask id="logo-gap">
          <rect fill="#fff" height="64" width="64" />
          <polyline
            fill="none"
            points={LOGO_LINE_POINTS}
            stroke="#000"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={LOGO_GAP_STROKE}
          />
        </mask>
      </defs>
      <polygon
        fill={color}
        mask="url(#logo-gap)"
        points={LOGO_AREA_POINTS}
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={LOGO_AREA_STROKE}
      />
    </svg>
  );
}

function StarIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      style={{ flexShrink: 0 }}
      viewBox="0 0 24 24"
      width={size}
    >
      <path
        d="M12 2.4l2.95 6.3 6.9.85-5.1 4.7 1.35 6.85L12 17.7l-6.1 3.4 1.35-6.85-5.1-4.7 6.9-.85z"
        fill={color}
      />
    </svg>
  );
}

function Stars({
  color,
  size,
  treatment,
}: {
  color: string;
  size: number;
  treatment: ThemeTreatment;
}) {
  if (treatment.pixel) {
    return <div style={{ color, display: "flex" }}>{treatment.star}</div>;
  }
  return <StarIcon color={color} size={size} />;
}

function formatExact(value: number) {
  return value.toLocaleString("en-US");
}

function formatAxisDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function scaleY(value: number, maxValue: number) {
  return PLOT_HEIGHT - (value / Math.max(1, maxValue)) * PLOT_HEIGHT;
}

function scaleX(index: number, count: number) {
  return (index / Math.max(1, count - 1)) * PLOT_WIDTH;
}

function linePoints(series: OgSeries, maxValue: number) {
  return series.values
    .map(
      (value, index) =>
        `${scaleX(index, series.values.length).toFixed(1)},${scaleY(value, maxValue).toFixed(1)}`
    )
    .join(" ");
}

/** Stepped path for the pixel theme: horizontal then vertical per sample. */
function steppedPath(series: OgSeries, maxValue: number) {
  const count = series.values.length;
  let path = "";
  for (const [index, value] of series.values.entries()) {
    const x = scaleX(index, count).toFixed(1);
    const y = scaleY(value, maxValue).toFixed(1);
    if (index === 0) {
      path += `M${x},${y}`;
    } else {
      path += ` H${x} V${y}`;
    }
  }
  return path;
}

function areaPoints(series: OgSeries, maxValue: number) {
  return `0,${PLOT_HEIGHT} ${linePoints(series, maxValue)} ${PLOT_WIDTH},${PLOT_HEIGHT}`;
}

function endPoint(series: OgSeries, maxValue: number) {
  return {
    x: PLOT_WIDTH,
    y: scaleY(series.values.at(-1) ?? 0, maxValue),
  };
}

function Header({ fonts, theme }: Pick<OgCardProps, "fonts" | "theme">) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        height: HEADER_HEIGHT,
        justifyContent: "space-between",
        width: CONTENT_WIDTH,
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
        <LogoMark color={theme.tooltipText} size={28} />
        <div
          style={{
            color: theme.tooltipText,
            fontFamily: fonts.heading,
            fontSize: 22,
            fontWeight: fonts.headingWeight,
            letterSpacing: -0.3,
          }}
        >
          RepoStars
        </div>
      </div>
      <div
        style={{
          alignItems: "center",
          border: `1px solid ${theme.gridColor}`,
          borderRadius: 999,
          color: theme.textColor,
          display: "flex",
          fontSize: 17,
          gap: 8,
          padding: "5px 14px",
        }}
      >
        <div
          style={{
            background: theme.lineColors[0],
            borderRadius: 999,
            height: 10,
            width: 10,
          }}
        />
        <div style={{ display: "flex" }}>{theme.name}</div>
      </div>
    </div>
  );
}

function SingleTitle({
  fonts,
  series,
  repo,
  theme,
  treatment,
}: {
  fonts: OgFontSet;
  repo: Extract<OgRepo, { status: "ok" }>;
  series: OgSeries | undefined;
  theme: ChartTheme;
  treatment: ThemeTreatment;
}) {
  const accent = series?.color ?? theme.lineColors[0];
  const gain = series?.gain ?? 0;
  const description = repo.description || repo.language || "GitHub repository";
  const nameSize = treatment.pixel ? 38 : 58;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: TITLE_HEIGHT,
        justifyContent: "flex-end",
        width: CONTENT_WIDTH,
      }}
    >
      <div
        style={{
          alignItems: "baseline",
          display: "flex",
          justifyContent: "space-between",
          width: CONTENT_WIDTH,
        }}
      >
        <div
          style={{
            color: theme.tooltipText,
            fontFamily: fonts.heading,
            fontSize: nameSize,
            fontWeight: fonts.headingWeight,
            letterSpacing: treatment.pixel ? 0 : -1.5,
            lineHeight: 1.1,
            maxWidth: 780,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {`${treatment.titlePrefix}${repo.fullName}`}
        </div>
        <div
          style={{
            alignItems: "center",
            color: accent,
            display: "flex",
            fontFamily: fonts.heading,
            fontSize: treatment.pixel ? 30 : 50,
            fontWeight: fonts.headingWeight,
            gap: 12,
            letterSpacing: treatment.pixel ? 0 : -1,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          <Stars
            color={accent}
            size={treatment.pixel ? 30 : 44}
            treatment={treatment}
          />
          <div style={{ display: "flex" }}>{formatExact(repo.stars)}</div>
        </div>
      </div>
      <div
        style={{
          alignItems: "center",
          color: theme.textColor,
          display: "flex",
          fontSize: treatment.pixel ? 14 : 22,
          justifyContent: "space-between",
          marginTop: 10,
          width: CONTENT_WIDTH,
        }}
      >
        <div
          style={{
            maxWidth: 800,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {description}
        </div>
        {gain > 0 && (
          <div
            style={{
              color: accent,
              display: "flex",
              gap: 6,
              opacity: 0.9,
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ display: "flex" }}>{`+${formatExact(gain)}`}</div>
            <div style={{ display: "flex", color: theme.textColor }}>
              last 90 days
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MultiTitle({
  fonts,
  repos,
  series,
  theme,
  treatment,
}: {
  fonts: OgFontSet;
  repos: OgRepo[];
  series: OgSeries[];
  theme: ChartTheme;
  treatment: ThemeTreatment;
}) {
  const loaded = repos.filter(isLoadedRepo);
  const title =
    loaded.length === 2
      ? `${loaded[0].fullName} vs ${loaded[1].fullName}`
      : `${loaded.length} repositories compared`;
  const seriesByName = new Map(series.map((entry) => [entry.name, entry]));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: TITLE_HEIGHT,
        justifyContent: "flex-end",
        width: CONTENT_WIDTH,
      }}
    >
      <div
        style={{
          color: theme.tooltipText,
          fontFamily: fonts.heading,
          fontSize: treatment.pixel ? 28 : 44,
          fontWeight: fonts.headingWeight,
          letterSpacing: treatment.pixel ? 0 : -1,
          lineHeight: 1.1,
          maxWidth: CONTENT_WIDTH,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {`${treatment.titlePrefix}${title}`}
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 14,
          width: CONTENT_WIDTH,
        }}
      >
        {repos.slice(0, MAX_LEGEND_CHIPS).map((repo) => (
          <LegendChip
            entry={
              isLoadedRepo(repo) ? seriesByName.get(repo.fullName) : undefined
            }
            key={repo.requestedName}
            label={isLoadedRepo(repo) ? repo.fullName : repo.requestedName}
            theme={theme}
            treatment={treatment}
          />
        ))}
      </div>
    </div>
  );
}

function LegendChip({
  entry,
  label,
  theme,
  treatment,
}: {
  entry: OgSeries | undefined;
  label: string;
  theme: ChartTheme;
  treatment: ThemeTreatment;
}) {
  const color = entry?.color ?? theme.textColor;
  return (
    <div
      style={{
        alignItems: "center",
        border: `1px solid ${theme.gridColor}`,
        borderRadius: treatment.pixel ? 0 : 999,
        color: theme.tooltipText,
        display: "flex",
        fontSize: treatment.pixel ? 12 : 19,
        gap: 8,
        maxWidth: 360,
        opacity: entry ? 1 : 0.55,
        padding: "6px 14px",
      }}
    >
      <div
        style={{
          background: color,
          borderRadius: treatment.pixel ? 0 : 999,
          flexShrink: 0,
          height: 10,
          width: 10,
        }}
      />
      <div
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div
        style={{
          alignItems: "center",
          color,
          display: "flex",
          flexShrink: 0,
          gap: 5,
          whiteSpace: "nowrap",
        }}
      >
        {entry ? (
          <Stars
            color={entry.color}
            size={treatment.pixel ? 12 : 16}
            treatment={treatment}
          />
        ) : null}
        <div style={{ display: "flex" }}>
          {entry ? formatStars(entry.stars) : "unavailable"}
        </div>
      </div>
    </div>
  );
}

function ChartSvg({
  chart,
  theme,
  treatment,
}: {
  chart: OgChart;
  theme: ChartTheme;
  treatment: ThemeTreatment;
}) {
  const { maxValue, series } = chart;
  const gridYs = [0, PLOT_HEIGHT / 2, PLOT_HEIGHT];
  const showArea = theme.areaOpacity > 0 && !treatment.pixel;

  return (
    <svg
      aria-hidden="true"
      height={PLOT_HEIGHT + 20}
      viewBox={`0 -10 ${PLOT_WIDTH + 20} ${PLOT_HEIGHT + 20}`}
      width={PLOT_WIDTH + 20}
    >
      <defs>
        {showArea &&
          series.map((entry, index) => (
            <linearGradient
              id={`area-${index}`}
              key={entry.name}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={entry.color}
                stopOpacity={Math.min(0.45, theme.areaOpacity * 3)}
              />
              <stop offset="100%" stopColor={entry.color} stopOpacity="0" />
            </linearGradient>
          ))}
      </defs>
      {gridYs.map((y) => (
        <line
          key={y}
          stroke={y === PLOT_HEIGHT ? theme.axisColor : theme.gridColor}
          strokeDasharray={y === PLOT_HEIGHT ? undefined : treatment.gridDash}
          strokeWidth={treatment.pixel ? 2 : 1}
          x1="0"
          x2={PLOT_WIDTH}
          y1={y}
          y2={y}
        />
      ))}
      {showArea &&
        series.map((entry, index) => (
          <polygon
            fill={`url(#area-${index})`}
            key={`${entry.name}-area`}
            points={areaPoints(entry, maxValue)}
          />
        ))}
      {treatment.glow &&
        series.map((entry) => (
          <polyline
            fill="none"
            key={`${entry.name}-glow`}
            opacity="0.22"
            points={linePoints(entry, maxValue)}
            stroke={entry.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={GLOW_WIDTH}
          />
        ))}
      {series.map((entry) =>
        treatment.pixel ? (
          <path
            d={steppedPath(entry, maxValue)}
            fill="none"
            key={`${entry.name}-line`}
            shapeRendering="crispEdges"
            stroke={entry.color}
            strokeWidth={4}
          />
        ) : (
          <polyline
            fill="none"
            key={`${entry.name}-line`}
            points={linePoints(entry, maxValue)}
            stroke={entry.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={LINE_WIDTH}
          />
        )
      )}
      {series.map((entry) => {
        const end = endPoint(entry, maxValue);
        return treatment.pixel ? (
          <rect
            fill={entry.color}
            height={PIXEL_MARKER}
            key={`${entry.name}-end`}
            shapeRendering="crispEdges"
            stroke={theme.background}
            strokeWidth={2}
            width={PIXEL_MARKER}
            x={end.x - PIXEL_MARKER / 2}
            y={end.y - PIXEL_MARKER / 2}
          />
        ) : (
          <circle
            cx={end.x}
            cy={end.y}
            fill={entry.color}
            key={`${entry.name}-end`}
            r={6.5}
            stroke={theme.background}
            strokeWidth={3}
          />
        );
      })}
    </svg>
  );
}

function Chart({
  chart,
  fonts,
  theme,
  treatment,
}: {
  chart: OgChart;
  fonts: OgFontSet;
  theme: ChartTheme;
  treatment: ThemeTreatment;
}) {
  const { dates, maxValue, series } = chart;
  const labelSize = treatment.pixel ? 11 : 16;
  const yTicks = [maxValue, maxValue / 2, 0].map((value, index) => ({
    label: formatStars(Math.round(value)),
    y: PLOT_TOP + (index * PLOT_HEIGHT) / 2,
  }));
  const xTicks = [
    { align: "flex-start", label: formatAxisDate(dates[0]), left: 0 },
    {
      align: "center",
      label: formatAxisDate(dates[Math.floor(dates.length / 2)]),
      left: PLOT_WIDTH / 2 - X_LABEL_WIDTH / 2,
    },
    { align: "flex-end", label: "Today", left: PLOT_WIDTH - X_LABEL_WIDTH },
  ] as const;
  const endYs = series.map(
    (entry) => PLOT_TOP + scaleY(entry.values.at(-1) ?? 0, maxValue)
  );
  const placed = placeEndLabels(endYs, END_LABEL_MIN_GAP);

  return (
    <div
      style={{
        display: "flex",
        height: CHART_HEIGHT,
        position: "relative",
        width: CONTENT_WIDTH,
      }}
    >
      {yTicks.map((tick) => (
        <div
          key={`y-${tick.y}`}
          style={{
            color: theme.textColor,
            display: "flex",
            fontSize: labelSize,
            justifyContent: "flex-end",
            left: 0,
            position: "absolute",
            top: tick.y - labelSize * 0.7,
            width: Y_AXIS_WIDTH - 14,
          }}
        >
          {tick.label}
        </div>
      ))}
      <div
        style={{
          display: "flex",
          left: Y_AXIS_WIDTH - 10,
          position: "absolute",
          top: PLOT_TOP - 10,
        }}
      >
        <ChartSvg chart={chart} theme={theme} treatment={treatment} />
      </div>
      {xTicks.map((tick) => (
        <div
          key={`x-${tick.label}`}
          style={{
            color: theme.textColor,
            display: "flex",
            fontSize: labelSize,
            justifyContent: tick.align,
            left: Y_AXIS_WIDTH + tick.left,
            position: "absolute",
            top: PLOT_TOP + PLOT_HEIGHT + 12,
            width: X_LABEL_WIDTH,
          }}
        >
          {tick.label}
        </div>
      ))}
      {series.map((entry, index) => {
        const y = placed[index];
        if (y === null) {
          return null;
        }
        return (
          <div
            key={`end-${entry.name}`}
            style={{
              color: entry.color,
              display: "flex",
              fontFamily: fonts.heading,
              fontSize: treatment.pixel ? 13 : 20,
              fontWeight: fonts.headingWeight,
              left: Y_AXIS_WIDTH + PLOT_WIDTH + 14,
              position: "absolute",
              top: y - (treatment.pixel ? 8 : 13),
              whiteSpace: "nowrap",
            }}
          >
            {formatStars(entry.stars)}
          </div>
        );
      })}
    </div>
  );
}

function EmptyChart({
  message,
  theme,
}: {
  message: string;
  theme: ChartTheme;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        border: `1px dashed ${theme.gridColor}`,
        borderRadius: 16,
        color: theme.textColor,
        display: "flex",
        fontSize: 22,
        height: CHART_HEIGHT,
        justifyContent: "center",
        width: CONTENT_WIDTH,
      }}
    >
      {message}
    </div>
  );
}

function Footer({
  estimated,
  theme,
  treatment,
}: {
  estimated: boolean;
  theme: ChartTheme;
  treatment: ThemeTreatment;
}) {
  return (
    <div
      style={{
        alignItems: "center",
        color: theme.textColor,
        display: "flex",
        fontSize: treatment.pixel ? 11 : 16,
        height: FOOTER_HEIGHT,
        justifyContent: "space-between",
        width: CONTENT_WIDTH,
      }}
    >
      <div style={{ display: "flex" }}>repostars.dev</div>
      <div style={{ display: "flex" }}>
        {estimated
          ? "Estimated history · current total exact"
          : "Exact star history from GitHub"}
      </div>
    </div>
  );
}

export function OgCard({ chart, fonts, repos, theme }: OgCardProps) {
  const treatment = treatmentFor(theme);
  const loaded = repos.filter(isLoadedRepo);
  const single = loaded.length === 1 && repos.length === 1 ? loaded[0] : null;
  const accent = theme.lineColors[0];
  const backgroundGlow =
    theme.areaOpacity > 0 && !treatment.pixel
      ? `radial-gradient(circle at 88% 12%, ${accent}26 0%, ${accent}00 46%), ${theme.background}`
      : theme.background;
  const estimated = loaded.some((repo) => repo.estimated);

  let title: React.ReactNode;
  if (single) {
    title = (
      <SingleTitle
        fonts={fonts}
        repo={single}
        series={chart?.series[0]}
        theme={theme}
        treatment={treatment}
      />
    );
  } else {
    title = (
      <MultiTitle
        fonts={fonts}
        repos={repos}
        series={chart?.series ?? []}
        theme={theme}
        treatment={treatment}
      />
    );
  }

  return (
    <div
      style={{
        background: backgroundGlow,
        color: theme.tooltipText,
        display: "flex",
        flexDirection: "column",
        fontFamily: fonts.body,
        height: OG_HEIGHT,
        padding: FRAME_PADDING,
        width: OG_WIDTH,
      }}
    >
      <Header fonts={fonts} theme={theme} />
      <div style={{ display: "flex", height: TITLE_GAP }} />
      {title}
      <div style={{ display: "flex", height: CHART_GAP }} />
      {chart ? (
        <Chart
          chart={chart}
          fonts={fonts}
          theme={theme}
          treatment={treatment}
        />
      ) : (
        <EmptyChart
          message={
            loaded.length === 0
              ? "Star history could not be loaded right now"
              : "No stars yet"
          }
          theme={theme}
        />
      )}
      <div style={{ display: "flex", height: FOOTER_GAP }} />
      <Footer estimated={estimated} theme={theme} treatment={treatment} />
    </div>
  );
}

/**
 * Shown when no repositories were requested, or when rendering the data card
 * itself threw. Keeps the brand and the requested names so the share is still
 * identifiable.
 */
export function OgFallbackCard({
  fonts,
  names,
  theme,
}: {
  fonts: OgFontSet;
  names: string[];
  theme: ChartTheme;
}) {
  return (
    <div
      style={{
        background: theme.background,
        color: theme.tooltipText,
        display: "flex",
        flexDirection: "column",
        fontFamily: fonts.body,
        height: OG_HEIGHT,
        justifyContent: "space-between",
        padding: FRAME_PADDING,
        width: OG_WIDTH,
      }}
    >
      <Header fonts={fonts} theme={theme} />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            fontFamily: fonts.heading,
            fontSize: 64,
            fontWeight: fonts.headingWeight,
            letterSpacing: -1.5,
            lineHeight: 1.05,
          }}
        >
          GitHub star history, compared.
        </div>
        <div
          style={{
            color: theme.textColor,
            fontSize: 26,
            maxWidth: CONTENT_WIDTH,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {names.length > 0
            ? names.join("  ·  ")
            : "Track, compare, and share themeable star charts."}
        </div>
      </div>
      <div
        style={{
          color: theme.textColor,
          display: "flex",
          fontSize: 16,
        }}
      >
        repostars.dev
      </div>
    </div>
  );
}
