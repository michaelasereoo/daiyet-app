import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://checkout.paystack.com https://*.paystack.com",
              "style-src 'self' 'unsafe-inline' https://checkout.paystack.com https://paystack.com https://*.paystack.com",
              "font-src 'self' https://checkout.paystack.com https://fonts.gstatic.com https://fonts.googleapis.com data:",
              "img-src 'self' https://checkout.paystack.com https://*.paystack.com data: blob:",
              "connect-src 'self' https://api.paystack.co https://checkout.paystack.com https://*.paystack.com",
              "frame-src 'self' https://checkout.paystack.com https://*.paystack.com",
              "child-src 'self' https://checkout.paystack.com https://*.paystack.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://checkout.paystack.com",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
