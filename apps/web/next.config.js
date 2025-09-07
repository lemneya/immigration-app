/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  i18n: {
    locales: ['en', 'es', 'fr', 'ar'],
    defaultLocale: 'en'
  },
  // Enable SCSS for USWDS
  sassOptions: {
    includePaths: ['./node_modules/@uswds/uswds/packages']
  }
};

module.exports = nextConfig;