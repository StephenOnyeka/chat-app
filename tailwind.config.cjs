module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
    screens: {
      'xs': {'max': '639px'},
      'sm': {'max': '767px'},
      'md': {'max': '1023px'},
      'lg': {'max': '1279px'},
      'xl': {'max': '1535px'},
      '2xl': {'max': '9999px'},
    },
  },
  plugins: [],
}; 