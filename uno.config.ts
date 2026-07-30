import { defineConfig, presetIcons, presetWebFonts, presetWind4, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  // ...UnoCSS options
  presets: [
    presetWind4(),
    presetIcons(),
    presetWebFonts({
      provider: "fontsource"
    }),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup()
  ]
})
