import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // CarMatch design system tokens
        'bg-base':    '#0f0f0f',
        'bg-card':    '#161616',
        'bg-muted':   '#1f1f1f',
        'border-app': '#2a2a2a',
        'text-app':   '#f0f0f0',
        'text-muted': '#6b7280',
        'accent-emerald': '#10b981',
        'accent-red':     '#ef4444',
        'accent-yellow':  '#f59e0b',
        'accent-blue':    '#3b82f6',
        'text-new':       '#94a3b8',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
      },
    },
  },
  plugins: [],
}

export default config
