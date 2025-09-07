/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/api/ocr/:path*',
        destination: 'http://localhost:3002/:path*'
      },
      {
        source: '/api/pdf-fill/:path*',
        destination: 'http://localhost:3005/:path*'
      },
      {
        source: '/api/e-signature/:path*',
        destination: 'http://localhost:3006/:path*'
      },
      {
        source: '/api/case-status/:path*',
        destination: 'http://localhost:3007/:path*'
      }
    ];
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3008',
    NEXT_PUBLIC_OCR_SERVICE_URL: process.env.OCR_SERVICE_URL || 'http://localhost:3002',
    NEXT_PUBLIC_PDF_SERVICE_URL: process.env.PDF_SERVICE_URL || 'http://localhost:3005',
    NEXT_PUBLIC_SIGNATURE_SERVICE_URL: process.env.SIGNATURE_SERVICE_URL || 'http://localhost:3006',
    NEXT_PUBLIC_CASE_STATUS_SERVICE_URL: process.env.CASE_STATUS_SERVICE_URL || 'http://localhost:3007'
  }
};

module.exports = nextConfig;