import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Headers de seguridad (F6-01 — hardening pre-producción)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Previene MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Previene clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Legado XSS filter (soporte para browsers viejos)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Controla información enviada en Referer
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Deshabilita APIs de hardware no necesarias
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // HSTS: fuerza HTTPS por 1 año en producción (incluye subdominios)
          // En desarrollo se omite para no bloquear HTTP local
          ...(isProd
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains; preload',
                },
              ]
            : []),
          // Content Security Policy
          // Permite: mismo origen, Cognito (auth), S3 (PDFs/imágenes), fonts de Google
          // Bloquea: inline scripts sin nonce, eval(), iframes externos, plugins
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Scripts: mismo origen + Cognito hosted UI
              "script-src 'self' 'unsafe-inline' https://cognito-idp.us-east-1.amazonaws.com",
              // Estilos: mismo origen + inline (necesario para Tailwind/shadcn)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Fuentes
              "font-src 'self' https://fonts.gstatic.com",
              // Imágenes: mismo origen + S3 + data URIs (avatares inline)
              "img-src 'self' data: https://*.s3.amazonaws.com https://*.s3.us-east-1.amazonaws.com",
              // Conexiones API: mismo origen + Cognito + S3 presigned URLs
              "connect-src 'self' https://cognito-idp.us-east-1.amazonaws.com https://*.s3.amazonaws.com https://*.s3.us-east-1.amazonaws.com",
              // Iframes: ninguno permitido
              "frame-src 'none'",
              // Objetos/plugins: ninguno
              "object-src 'none'",
              // Base URI: solo mismo origen
              "base-uri 'self'",
              // Formularios: solo mismo origen
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  // Typed routes para App Router
  typedRoutes: true,

  // Imágenes - dominios permitidos
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
      },
    ],
  },
};

export default nextConfig;
