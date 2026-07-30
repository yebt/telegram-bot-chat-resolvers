import {
  defineConfig,
  presetIcons,
  presetWebFonts,
  presetWind4,
  transformerDirectives,
  transformerVariantGroup,
} from "unocss";

export default defineConfig({
  content: {
    // Astro builds client scripts in a separate pass from the one that emits the
    // CSS, so utilities used only inside a .ts controller never reach the
    // module-graph scanner. Reading them from disk fixes that — but the
    // filesystem scan still runs through the pipeline filter, which ignores
    // plain .ts by default, so both options are required.
    filesystem: ["src/**/*.ts"],
    pipeline: {
      include: [/\.(astro|html|vue|svelte|mdx?|[jt]sx?)($|\?)/],
    },
  },
  presets: [
    presetWind4(),
    presetIcons(),
    presetWebFonts({
      provider: "fontsource",
      fonts: {
        // Blackletter is reserved for the page title alone: it carries the
        // character, but it is unreadable at UI sizes.
        display: "UnifrakturMaguntia",
        body: [{ name: "IBM Plex Serif", weights: [400, 600, 700] }],
        mono: [{ name: "JetBrains Mono", weights: [400, 700] }],
      },
    }),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
});
