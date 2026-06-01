/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Wasteland palette — sandy earth + worn parchment + rusty accents
        'pip-bg':          '#b89a52',   // sandy wasteland ground (body)
        'pip-bg-light':    '#e2cfa0',   // aged parchment (panels)
        'pip-green':       '#2c4a10',   // dark olive — primary text, HP bar high
        'pip-green-dim':   '#6a5828',   // warm earthy brown — secondary/dim text
        'pip-green-mid':   '#4a7018',   // mid olive — mid-positive states
        'pip-amber':       '#c4501a',   // burnt sienna — caps, profit
        'pip-red':         '#8c1c1c',   // blood rust — danger
        'pip-border':      '#8a6020',   // worn earth — main borders
        'pip-border-dim':  '#cdb070',   // sand — row separators, subtle borders
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
