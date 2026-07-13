// Shared 5-stop sequential color scale — t=0 (low) → t=1 (high). Originally built for chem
// price positioning (see priceColor.ts) and validated as a strong UX win there; reused for any
// other "magnitude" encoding (e.g. the admin tool's settlement visit-intensity heatmap) so the
// same blue→teal→neutral→amber→red vocabulary means the same thing everywhere in the app.
//
//   t < 0.15: cool slate blue   — low
//   t < 0.38: muted teal
//   t < 0.62: earthy neutral    — mid, no signal
//   t < 0.85: warm amber
//   t >= 0.85: deep glowing red — high

export interface IntensityStyle {
  color: string
  textShadow?: string
}

export function intensityColor(t: number): IntensityStyle {
  if (t < 0.15) return { color: '#4a8fc0', textShadow: '0 0 7px rgba(74,143,192,0.50)' }
  if (t < 0.38) return { color: '#4ea080' }
  if (t < 0.62) return { color: '#8a7040' }
  if (t < 0.85) return { color: '#a03c10' }
  return       { color: '#cc4c18', textShadow: '0 0 8px rgba(204,76,24,0.45)' }
}
