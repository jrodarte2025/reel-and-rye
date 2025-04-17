/Users/jimrodarte/Documents/GitHub/Personal-Projects/reels-and-rye/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',              // toggle via class
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bourbon:   '#3E2C1C',     // primary
        leather:   '#D2B48C',     // primary (dark)
        brass:     '#BFA670',     // accent
        porcelain: '#FAF9F7',     // light background
        charcoal:  '#121212',     // dark background
        surface:   { light:'#FFFFFF', dark:'#1E1E1E' },
        text: {
          primary:   { light:'#111111', dark:'#F2F2F2' },
          secondary: { light:'#5C5C5C', dark:'#B0B0B0' },
          link:      { light:'#7F5B3F', dark:'#EBC18E' },
        },
        state: {
          error:   { light:'#B00020', dark:'#CF6679' },
          success: { light:'#2E7D32', dark:'#81C784' },
        },
      },
      fontFamily: {
        sans: ['"SF Pro Display"', 'ui-sans-serif', 'system-ui'],
        serif: ['Georgia', 'Cambria', 'serif'],
      },
    },
  },
  plugins: [],
}