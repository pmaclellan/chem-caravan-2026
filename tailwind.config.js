/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'pip-bg':        '#0a0f0a',
        'pip-bg-light':  '#0f1a0f',
        'pip-green':     '#39ff14',
        'pip-green-dim': '#2a7a1a',
        'pip-green-mid': '#4cff4c',
        'pip-amber':     '#ffaa00',
        'pip-red':       '#ff3333',
        'pip-border':    '#1f4a1f',
        'pip-border-dim':'#0f2a0f',
      },
      fontFamily: {
        'mono': ['"Share Tech Mono"', 'Courier New', 'monospace'],
        'display': ['"VT323"', '"Share Tech Mono"', 'monospace'],
      },
      animation: {
        'scanline': 'scanline 8s linear infinite',
        'blink':    'blink 1s step-end infinite',
      },
      keyframes: {
        scanline: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
