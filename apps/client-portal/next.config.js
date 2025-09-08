/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  i18n: {
    locales: ['en', 'es', 'fr', 'ar'],
    defaultLocale: 'en',
    localeDetection: false
  },
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3004',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'client-portal-secret',
  }
};

module.exports = nextConfig;