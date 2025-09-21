/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    const websigUrl = process.env.NEXT_PUBLIC_WEBSIG_URL || 'https://websig.xyz'
    return [
      {
        source: '/:path*',
        headers: [
          // Delegate WebAuthn permission to the iframe origin (WebSig)
          { 
            key: 'Permissions-Policy', 
            value: `publickey-credentials-get=(self "${websigUrl}"), publickey-credentials-create=(self "${websigUrl}")` 
          },
          // Allow loading iframe from WebSig and local loopback in dev
          { 
            key: 'Content-Security-Policy', 
            value: `frame-src 'self' ${websigUrl} http://localhost:* https://localhost:*; frame-ancestors 'self';` 
          },
        ],
      },
    ];
  },
};

export default nextConfig;