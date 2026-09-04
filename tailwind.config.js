/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{svelte,js,ts}'],
  theme: {
    extend: {
      colors: {
        nyalur: {
          bg: '#0F172A',
          surface: '#1E293B',
          border: '#334155',
          text: '#F1F5F9',
          green: '#39FF14',
          orange: '#FF6B00',
          error: '#FF4444',
          muted: '#94A3B8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    }
  },
  plugins: []
};
