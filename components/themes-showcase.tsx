import { SectionHeading } from "@/components/section-heading";
import { ThemeSwatchButton } from "@/components/theme-swatch-button";
import { themeIds, themes } from "@/lib/themes";

export function ThemesShowcase() {
  return (
    <section className="border-t bg-muted/30 py-20 sm:py-28" id="themes">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeading
          description={`${themeIds.length} themes, one click away. Tap any swatch to load a live demo in that style.`}
          eyebrow="Themes"
          title="A look for every README"
        />

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Object.values(themes).map((theme) => (
            <ThemeSwatchButton key={theme.id} theme={theme} />
          ))}
        </div>
      </div>
    </section>
  );
}
