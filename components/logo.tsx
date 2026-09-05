import { useId } from "react";
import {
  LOGO_AREA_POINTS,
  LOGO_AREA_STROKE,
  LOGO_GAP_STROKE,
  LOGO_LINE_POINTS,
  LOGO_VIEW_BOX,
} from "@/lib/logo-geometry";

interface LogoProps {
  className?: string;
  title?: string;
}

/** The RepoStars mark, drawn in `currentColor`. */
export function Logo({ className, title = "RepoStars" }: LogoProps) {
  const maskId = useId();
  return (
    <svg className={className} role="img" viewBox={LOGO_VIEW_BOX}>
      <title>{title}</title>
      <defs>
        <mask id={maskId}>
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
        fill="currentColor"
        mask={`url(#${maskId})`}
        points={LOGO_AREA_POINTS}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={LOGO_AREA_STROKE}
      />
    </svg>
  );
}
