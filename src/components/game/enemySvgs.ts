// Inline SVG content strings (48×48 viewBox) per enemy type id.
// Render via: <svg viewBox="0 0 48 48" dangerouslySetInnerHTML={{ __html: ENEMY_SVGS[typeId] }} />
// All shapes use fill="currentColor" so parent controls color via CSS.

const RAIDER = `
  <circle cx="24" cy="10" r="6" fill="currentColor"/>
  <polygon points="12,22 17,18 13,14" fill="currentColor"/>
  <polygon points="36,22 31,18 35,14" fill="currentColor"/>
  <rect x="17" y="18" width="14" height="16" rx="2" fill="currentColor"/>
  <rect x="9" y="20" width="8" height="4" rx="1" fill="currentColor"/>
  <rect x="5" y="16" width="4" height="10" rx="1" fill="currentColor"/>
  <rect x="17" y="34" width="5" height="11" rx="1" fill="currentColor"/>
  <rect x="26" y="34" width="5" height="11" rx="1" fill="currentColor"/>
`

const SUPER_MUTANT = `
  <circle cx="24" cy="9" r="8" fill="currentColor"/>
  <rect x="11" y="17" width="26" height="19" rx="3" fill="currentColor"/>
  <rect x="6" y="14" width="7" height="20" rx="3" fill="currentColor"/>
  <rect x="3" y="8" width="10" height="8" rx="2" fill="currentColor"/>
  <rect x="11" y="36" width="9" height="11" rx="2" fill="currentColor"/>
  <rect x="28" y="36" width="9" height="11" rx="2" fill="currentColor"/>
`

const GREAT_KHAN = `
  <circle cx="24" cy="11" r="6" fill="currentColor"/>
  <rect x="22" y="2" width="4" height="9" rx="2" fill="currentColor"/>
  <rect x="16" y="17" width="16" height="16" rx="2" fill="currentColor"/>
  <rect x="8" y="18" width="8" height="12" rx="2" fill="currentColor"/>
  <rect x="16" y="33" width="6" height="13" rx="1" fill="currentColor"/>
  <rect x="26" y="33" width="6" height="13" rx="1" fill="currentColor"/>
`

const LEGIONNAIRE = `
  <rect x="16" y="3" width="16" height="14" rx="4" fill="currentColor"/>
  <rect x="21" y="1" width="6" height="6" rx="1" fill="currentColor"/>
  <rect x="12" y="9" width="4" height="8" rx="1" fill="currentColor"/>
  <rect x="32" y="9" width="4" height="8" rx="1" fill="currentColor"/>
  <rect x="14" y="17" width="20" height="14" rx="2" fill="currentColor"/>
  <rect x="14" y="31" width="4" height="8" rx="1" fill="currentColor"/>
  <rect x="20" y="31" width="4" height="8" rx="1" fill="currentColor"/>
  <rect x="26" y="31" width="4" height="8" rx="1" fill="currentColor"/>
  <rect x="35" y="17" width="4" height="18" rx="1" fill="currentColor"/>
`

const DEATHCLAW = `
  <ellipse cx="27" cy="30" rx="14" ry="10" fill="currentColor"/>
  <ellipse cx="40" cy="22" rx="7" ry="5" fill="currentColor"/>
  <rect x="36" y="13" width="3" height="11" rx="1" fill="currentColor" transform="rotate(-20 37 18)"/>
  <rect x="42" y="13" width="3" height="11" rx="1" fill="currentColor" transform="rotate(15 44 18)"/>
  <rect x="13" y="37" width="5" height="10" rx="2" fill="currentColor" transform="rotate(-10 15 42)"/>
  <rect x="31" y="38" width="5" height="10" rx="2" fill="currentColor"/>
  <path d="M13 28 C8 30 5 35 8 40" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
`

const FIEND = `
  <circle cx="23" cy="10" r="6" fill="currentColor"/>
  <path d="M17 8 C14 4 18 2 20 6" fill="currentColor"/>
  <path d="M27 7 C29 3 32 5 29 9" fill="currentColor"/>
  <path d="M19 16 L14 34 L20 34 L23 24 L26 34 L32 34 L29 16 Z" fill="currentColor"/>
  <rect x="14" y="34" width="6" height="13" rx="1" fill="currentColor"/>
  <rect x="22" y="34" width="6" height="13" rx="1" fill="currentColor"/>
`

const FERAL_GHOUL = `
  <ellipse cx="24" cy="9" rx="7" ry="8" fill="currentColor"/>
  <path d="M18 17 L13 40 L19 40 L22 27 L26 27 L29 40 L35 40 L30 17 Z" fill="currentColor"/>
  <ellipse cx="29" cy="19" rx="5" ry="4" fill="currentColor"/>
  <rect x="4" y="15" width="11" height="4" rx="2" fill="currentColor"/>
  <rect x="33" y="15" width="11" height="4" rx="2" fill="currentColor"/>
  <path d="M4 17 L0 13 M4 17 L1 18 M4 17 L2 21" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M44 17 L48 13 M44 17 L47 18 M44 17 L46 21" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
`

const RADSCORPION = `
  <ellipse cx="22" cy="33" rx="13" ry="9" fill="currentColor"/>
  <ellipse cx="19" cy="21" rx="8" ry="6" fill="currentColor"/>
  <path d="M11 19 L3 13 L4 18 L11 23 Z" fill="currentColor"/>
  <path d="M11 23 L3 27 L4 31 L11 27 Z" fill="currentColor"/>
  <path d="M27 19 L33 12 L35 17 L27 23 Z" fill="currentColor"/>
  <path d="M27 23 L34 27 L33 31 L27 27 Z" fill="currentColor"/>
  <rect x="10" y="29" width="5" height="3" rx="1" fill="currentColor" transform="rotate(-20 12 30)"/>
  <rect x="20" y="31" width="5" height="3" rx="1" fill="currentColor" transform="rotate(-5 22 32)"/>
  <rect x="28" y="29" width="5" height="3" rx="1" fill="currentColor" transform="rotate(20 30 30)"/>
  <path d="M32 30 C38 26 44 18 42 9 C40 3 35 1 32 5" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
  <polygon points="32,5 28,1 36,1" fill="currentColor"/>
`

const YAO_GUAI = `
  <circle cx="24" cy="16" r="11" fill="currentColor"/>
  <circle cx="15" cy="8" r="5" fill="currentColor"/>
  <circle cx="33" cy="8" r="5" fill="currentColor"/>
  <ellipse cx="24" cy="34" rx="14" ry="12" fill="currentColor"/>
  <rect x="8" y="28" width="8" height="14" rx="4" fill="currentColor"/>
  <rect x="32" y="28" width="8" height="14" rx="4" fill="currentColor"/>
  <path d="M8 42 L5 47 M10 43 L8 48 M14 43 L13 48" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M38 42 L41 47 M36 43 L38 48 M32 43 L33 48" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
`

// Powder Ganger: standing human, dominant arm raised with lit dynamite stick overhead
const POWDER_GANGER = `
  <circle cx="24" cy="9" r="6" fill="currentColor"/>
  <rect x="17" y="15" width="14" height="16" rx="2" fill="currentColor"/>
  <rect x="31" y="13" width="4" height="12" rx="2" fill="currentColor"/>
  <rect x="13" y="18" width="4" height="10" rx="2" fill="currentColor"/>
  <rect x="35" y="5" width="3" height="8" rx="1" fill="currentColor"/>
  <circle cx="36" cy="4" r="2" fill="currentColor"/>
  <path d="M34 3 C32 1 33 0 35 1" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <rect x="17" y="31" width="5" height="14" rx="1" fill="currentColor"/>
  <rect x="26" y="31" width="5" height="14" rx="1" fill="currentColor"/>
`

// Cazador: flying venomous insect — segmented body, two wing pairs, legs, curved stinger
const CAZADOR = `
  <ellipse cx="24" cy="26" rx="6" ry="10" fill="currentColor"/>
  <ellipse cx="24" cy="13" rx="4" ry="5" fill="currentColor"/>
  <path d="M18 22 C10 14 6 8 10 4" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M18 26 C9 26 4 22 6 18" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M30 22 C38 14 42 8 38 4" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M30 26 C39 26 44 22 42 18" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M20 34 L17 40 M24 35 L24 42 M28 34 L31 40" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M24 36 C26 40 30 44 28 48" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
  <polygon points="26,47 22,47 24,51" fill="currentColor"/>
`

export const ENEMY_SVGS: Record<string, string> = {
  raider:        RAIDER,
  feral_ghoul:   FERAL_GHOUL,
  radscorpion:   RADSCORPION,
  yao_guai:      YAO_GUAI,
  super_mutant:  SUPER_MUTANT,
  great_khan:    GREAT_KHAN,
  legionnaire:   LEGIONNAIRE,
  deathclaw:     DEATHCLAW,
  fiend:         FIEND,
  powder_ganger: POWDER_GANGER,
  cazador:       CAZADOR,
}

export const ENEMY_FALLBACK_SVG = RAIDER
