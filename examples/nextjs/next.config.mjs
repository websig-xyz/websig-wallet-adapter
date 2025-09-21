/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // CRITICAL: Allow WebAuthn for websig.xyz iframe
          // This delegates WebAuthn permissions to the iframe
          { 
            key: 'Permissions-Policy', 
            value: 'publickey-credentials-get=(self "https://websig.xyz"), publickey-credentials-create=(self "https://websig.xyz")' 
          },
          // Allow embedding from localhost for development
          { 
            key: 'Content-Security-Policy', 
            value: "frame-src 'self' https://websig.xyz http://localhost:* https://localhost:*; frame-ancestors 'self';" 
          },
        ],
      },
    ];
  },
};

export default nextConfig;