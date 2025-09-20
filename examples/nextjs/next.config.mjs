/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        // Allow WebAuthn for websig.xyz when framed
        { key: 'Permissions-Policy', value: 'publickey-credentials-get=(self "https://websig.xyz"), publickey-credentials-create=(self "https://websig.xyz")' },
        // Allow framing from our domain (who can embed this example)
        { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://websig.xyz;" },
      ],
    },
  ],
};

export default nextConfig;