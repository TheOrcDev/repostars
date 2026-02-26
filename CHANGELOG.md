# Changelog

All notable changes to RepoStars are listed here in plain language.

## 2026-02-25

### Better charts for real-world repos
- Fixed the issue where very large repositories could end with weird flat/straight tails.
- Improved curve generation after GitHub’s 40k stargazer API limit so growth looks more natural.
- Refreshed cache versioning so users see updated chart behavior faster.

### Better exports
- Fixed exported images on smaller widths so long repo names no longer break onto a second line.
- Repo names now stay on one line and truncate cleanly with `...`.

### Better OG preview image
- Improved Open Graph chart readability:
  - Star scale moved to the left side where users expect it.
  - Better spacing between subtitle and chart card.

### Better app UX
- Added a custom 404 page with quick actions back to homepage/demo.
- Replaced quick text links in empty state with clearer buttons.
- In Minimal theme, first repo line now uses black for better visual style.

### Stability and code quality
- Fixed build error caused by zod/react-hook-form type mismatch.
- Standardized linting/formatting with Ultracite + Biome.
- Cleaned up type/lint issues to keep builds reliable.

---

If you want technical commit-by-commit details, check Git history. This changelog is intentionally non-technical.
