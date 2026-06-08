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

export const ENEMY_SVGS: Record<string, string> = {
  raider:       RAIDER,
  super_mutant: SUPER_MUTANT,
  great_khan:   GREAT_KHAN,
  legionnaire:  LEGIONNAIRE,
  deathclaw:    DEATHCLAW,
  fiend:        FIEND,
}

export const ENEMY_FALLBACK_SVG = RAIDER
