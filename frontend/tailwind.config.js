export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Material Design 3 defaults to Roboto for body, Product Sans for display
        sans: ['Roboto', 'sans-serif'],
        display: ['"Product Sans"', 'Roboto', 'sans-serif'],
      },
      colors: {
        // MD3 Tonal Palette generated from ISU Forest Green
        primary: {
          50: '#E8F5E9',  // surface-tint
          100: '#C8E6C9', // primary-container
          200: '#A5D6A7', 
          300: '#81C784',
          400: '#66BB6A',
          500: '#4CAF50', // primary active
          600: '#43A047',
          700: '#388E3C', // primary base (brand green)
          800: '#2E7D32', // on-primary-container
          900: '#1B5E20', // ultra rich green
          950: '#0A3311',
        },
        // MD3 Tonal Palette generated from ISU Gold/Yellow
        secondary: {
          50: '#FFFDE7',
          100: '#FFF9C4', // secondary-container
          200: '#FFF59D',
          300: '#FFF176',
          400: '#FFEE58',
          500: '#FFEB3B', // secondary active
          600: '#FDD835', // secondary base (brand gold)
          700: '#FBC02D',
          800: '#F9A825', // on-secondary-container
          900: '#F57F17',
          950: '#8F4A0A',
        },
        // MD3 Surfaces
        surface: {
          light: '#F8F9FA',
          container: '#ECEFF1',
          variant: '#DEE2E6',
        },
        surfaceDark: {
          base: '#1E1E1E',
          container: '#2C2C2C',
          variant: '#424242',
        }
      },
      boxShadow: {
        // Material Design 3 Elevation Levels
        'm3-1': '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
        'm3-2': '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)',
        'm3-3': '0px 1px 3px 0px rgba(0, 0, 0, 0.3), 0px 4px 8px 3px rgba(0, 0, 0, 0.15)',
        'm3-4': '0px 2px 3px 0px rgba(0, 0, 0, 0.3), 0px 6px 10px 4px rgba(0, 0, 0, 0.15)',
        'm3-5': '0px 4px 4px 0px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15)',
      },
      transitionTimingFunction: {
        // Material 3 Motion Curves
        'm3-standard': 'cubic-bezier(0.2, 0.0, 0, 1.0)',
        'm3-emphasized': 'cubic-bezier(0.2, 0.0, 0, 1.0)',
        'm3-decelerate': 'cubic-bezier(0.05, 0.7, 0.1, 1.0)',
        'm3-accelerate': 'cubic-bezier(0.3, 0.0, 0.8, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s cubic-bezier(0.05, 0.7, 0.1, 1.0) forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.2, 0.0, 0, 1.0) forwards',
        'shimmer': 'shimmer 1.5s infinite linear',
        'ripple': 'ripple 0.6s linear',
        'pulse': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '0.4' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.65' },
        }
      },
    },
  },
  plugins: [],
}
