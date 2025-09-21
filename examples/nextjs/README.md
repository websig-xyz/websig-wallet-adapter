# WebSig Wallet Adapter - Next.js Example

Simple example showing how to integrate WebSig wallet adapter with Next.js.

## Quick Start

### For HTTP (localhost only):
```bash
yarn dev
# Opens at http://localhost:3001
```

### For HTTPS (required for production WebSig):
```bash
# Install mkcert (one-time setup)
brew install mkcert  # On macOS
mkcert -install      # Install local CA

# Generate certificates
mkcert localhost

# Run with HTTPS
yarn dev:https
# Opens at https://localhost:3001
```

## How It Works

The adapter automatically detects the environment:
- **Same protocol (HTTPS → HTTPS)**: Uses iframe (like Porto)
- **Different protocols (HTTP → HTTPS)**: Uses popup (for security)
- **Local development**: Always uses iframe

## Porto-Style Approach

This example follows Porto's approach:
1. Simple, minimal setup
2. HTTPS in development using mkcert
3. Iframe for same-origin/protocol connections
4. Automatic fallback to popup when needed

## Testing

1. Start WebSig locally or use production (https://websig.xyz)
2. Run the example with `yarn dev` or `yarn dev:https`
3. Click "Select Wallet" and choose WebSig
4. Authenticate with your biometrics
5. Done!
