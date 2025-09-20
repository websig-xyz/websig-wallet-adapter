/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        // Enable cross-origin WebAuthn in iframes (Chromium-based)
        { key: 'Permissions-Policy', value: 'publickey-credentials-get=("*"); publickey-credentials-create=("*")' },
        // Allow framing from our domain (who can embed this example)
        { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://websig.xyz;" },
      ],
    },
  ],
};

export default nextConfig;