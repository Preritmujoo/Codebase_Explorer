/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        panel: '#111119',
        border: '#23232f',
        muted: '#9aa0b2',
        accent: '#7c5cff',
        accent2: '#22d3ee'
      }
    }
  },
  plugins: []
}
