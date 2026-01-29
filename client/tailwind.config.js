/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          50:  'rgb(var(--accent-50) / <alpha-value>)',
          100: 'rgb(var(--accent-100) / <alpha-value>)',
          200: 'rgb(var(--accent-200) / <alpha-value>)',
          300: 'rgb(var(--accent-300) / <alpha-value>)',
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
          600: 'rgb(var(--accent-600) / <alpha-value>)',
          700: 'rgb(var(--accent-700) / <alpha-value>)',
          800: 'rgb(var(--accent-800) / <alpha-value>)',
          900: 'rgb(var(--accent-900) / <alpha-value>)',
          950: 'rgb(var(--accent-950) / <alpha-value>)',
        },
      },
      typography: {
        invert: {
          css: {
            '--tw-prose-body': '#d1d5db',
            '--tw-prose-headings': '#f3f4f6',
            '--tw-prose-links': 'rgb(var(--accent-500))',
            '--tw-prose-bold': '#f3f4f6',
            '--tw-prose-code': '#e5e7eb',
            '--tw-prose-pre-bg': '#0d1117',
            '--tw-prose-pre-code': '#d1d5db',
            '--tw-prose-counters': '#9ca3af',
            '--tw-prose-bullets': '#6b7280',
            '--tw-prose-hr': '#374151',
            '--tw-prose-quotes': '#d1d5db',
            '--tw-prose-quote-borders': '#4b5563',
            '--tw-prose-th-borders': '#4b5563',
            '--tw-prose-td-borders': '#374151',
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
