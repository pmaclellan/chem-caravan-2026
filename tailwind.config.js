/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./admin/index.html",
    "./admin/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // CSS variable references — values set per [data-mode] in index.css
        'pip-bg':          'var(--pip-bg)',
        'pip-bg-light':    'var(--pip-bg-light)',
        'pip-green':       'var(--pip-green)',
        'pip-green-dim':   'var(--pip-green-dim)',
        'pip-green-mid':   'var(--pip-green-mid)',
        'pip-amber':       'var(--pip-amber)',
        'pip-red':         'var(--pip-red)',
        'pip-border':      'var(--pip-border)',
        'pip-border-dim':  'var(--pip-border-dim)',
        'pip-blue':        'var(--pip-blue)',
        'pip-purple':      'var(--pip-purple)',
      },
      fontFamily: {
        'mono':    ['"Courier Prime"', 'Courier New', 'monospace'],
        'display': ['"Special Elite"', '"Courier Prime"', 'serif'],
      },
      animation: {
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
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
