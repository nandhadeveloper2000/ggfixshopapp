/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Primary — emerald green
        primary: {
          DEFAULT: '#16A34A',
          light: '#22C55E',
          dark: '#15803D',
          soft: '#DCFCE7',
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
        },
        // Accent — vivid orange
        accent: {
          DEFAULT: '#FF7A00',
          light: '#FF9A3D',
          dark: '#E56A00',
          soft: '#FFEDD5',
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FF7A00',
          600: '#E56A00',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        // Surfaces
        background: '#F6F7F9',
        card: '#FFFFFF',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F1F3F5',
        },
        // Text
        text: {
          DEFAULT: '#0F172A',
          muted: '#64748B',
          subtle: '#94A3B8',
        },
        // Lines
        border: {
          DEFAULT: '#E5E7EB',
          strong: '#D1D5DB',
        },
        // Status
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#EF4444',
        error: '#EF4444',
        info: '#0EA5E9',
      },
      fontFamily: {
        sans: ['System'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '28px',
      },
    },
  },
  plugins: [],
};
