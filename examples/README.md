# WebSig Wallet Adapter Examples

This directory contains fully functional examples showing how to integrate WebSig wallet adapter into your DApp.

## 📁 Examples

### 1. Vanilla JavaScript (`vanilla.html`)
A simple HTML page that demonstrates WebSig integration without any framework.

**Features:**
- Connect/disconnect wallet
- Sign messages
- Sign transactions
- Display balance
- Environment switcher (production/local dev)

**How to run:**
```bash
# Simply open the HTML file in your browser
open vanilla.html

# Or serve it with any HTTP server
npx serve .
python3 -m http.server 8000
```

### 2. Next.js Application (`nextjs/`)
A modern Next.js 15 + React 19 app using the standard Solana wallet adapter.

**Features:**
- Full wallet adapter integration
- Beautiful UI with wallet modal
- Send transactions
- Sign messages
- Balance display
- Server-side rendering support
- No Buffer polyfill issues

**How to run:**
```bash
cd nextjs
yarn install
yarn dev      # Opens at http://localhost:3001 by default

# Or use a different port:
yarn dev -p 3004
```

### 3. React + Vite (`react/`) - Legacy
A React app using Vite bundler (kept for reference).

**Note:** The Next.js example is recommended over this one as it handles Node.js polyfills better.

**How to run:**
```bash
cd react
yarn install
yarn dev --port 3005  # Different port to avoid conflicts
```

## 🔧 Environment Configuration

Both examples support two environments:

1. **Production** (https://websig.xyz)
   - Use this when testing with the live WebSig app
   - No setup required

2. **Local Development** (http://localhost:3000)
   - Use this when developing WebSig locally
   - Start WebSig first: `yarn dev` in the main WebSig directory (defaults to port 3000)

### Switching Environments

**Vanilla Example:**
- Use the dropdown in the top-right corner

**React Example:**
- The adapter auto-detects localhost and uses local WebSig
- For production, it automatically uses websig.xyz

## 🚀 Quick Start

### Test with Production WebSig:
1. Open any example
2. Click "Connect Wallet"
3. Authenticate with biometrics in the popup
4. Start using your wallet!

### Test with Local Development:
1. Start WebSig locally:
   ```bash
   cd ../../.. # Go to main WebSig directory
   yarn dev    # Starts on http://localhost:3000
   ```

2. Open the example:
   - **Vanilla**: Open `vanilla.html` and select "Local Dev" from dropdown
   - **React**: Run `yarn dev --port 3004` (to avoid conflict with WebSig on port 3000)

3. Connect and test!

## 💡 Integration Tips

### For New DApps

```typescript
// Install the adapter
npm install @websig/wallet-adapter

// Import and use
import { WebSigWalletAdapter } from '@websig/wallet-adapter';

const wallets = [new WebSigWalletAdapter()];
```

### Key Features
- ✅ **No Extension Required**: Works in any browser
- ✅ **Biometric Auth**: Secure Face ID / Touch ID
- ✅ **Mobile Friendly**: Works great on phones
- ✅ **Standard Compatible**: Uses Solana wallet adapter standard

### Testing Checklist
- [ ] Wallet connects successfully
- [ ] Public key is displayed
- [ ] Can sign a message
- [ ] Can sign a transaction
- [ ] Disconnect works
- [ ] Popup handles errors gracefully
- [ ] Works on mobile (test with ngrok)

## 📱 Mobile Testing

To test on mobile devices:

1. Use ngrok to expose your local server:
   ```bash
   ngrok http 3000  # For React example
   ngrok http 8000  # For vanilla served with Python
   ```

2. Update WebSig URL in adapter to use your ngrok URL

3. Open the ngrok URL on your mobile device

## 🎯 Common Use Cases

### Simple Integration
See `vanilla.html` for the most basic integration

### Full DApp Integration
See `react/` for complete wallet adapter integration with UI

### Custom Styling
Both examples show how to maintain your app's design while using WebSig

## 🐛 Troubleshooting

### "Popup blocked"
- Allow popups for the domain
- WebSig needs popups for the wallet connection flow

### "Connection timeout"
- Make sure WebSig is running (locally or websig.xyz is accessible)
- Check that the URL is correct in environment settings

### "Not connected" after connecting
- Check browser console for errors
- Ensure origins match (localhost vs production)

## 📚 Resources

- [WebSig Documentation](https://websig.xyz/docs)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [NPM Package](https://www.npmjs.com/package/@websig/wallet-adapter)

---

**Need help?** Open an issue on GitHub or reach out to the WebSig team!
