/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        // Enable cross-origin WebAuthn in iframes (Chromium-based)
        { key: 'Permissions-Policy', value: 'publickey-credentials-get=("*"); publickey-credentials-create=("*")' },
        // Allow embedding websig.xyz as cross-origin iframe
        { key: 'X-Frame-Options', value: 'ALLOWALL' },
        // Allow framing from our domain
        { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://websig.xyz;" },
      ],
    },
  ],
};

export default nextConfig;