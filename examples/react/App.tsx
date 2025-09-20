import React from 'react';
import { 
  ConnectionProvider, 
  WalletProvider 
} from '@solana/wallet-adapter-react';
import { 
  WalletModalProvider,
  WalletMultiButton 
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { WebSigWalletAdapter } from '@websig/wallet-adapter';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

function App() {
  // You can also use 'devnet', 'testnet', or custom RPC
  const endpoint = clusterApiUrl('mainnet-beta');
  
  // Initialize wallets - WebSig appears automatically!
  const wallets = React.useMemo(
    () => [
      new WebSigWalletAdapter(),
      // Add other wallets if needed
      // new PhantomWalletAdapter(),
      // new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}>
            <h1 style={{ color: 'white', marginBottom: '20px' }}>
              WebSig Wallet Demo
            </h1>
            
            <p style={{ color: 'white', marginBottom: '40px', textAlign: 'center' }}>
              Click the button below to connect your wallet.<br/>
              WebSig will appear in the wallet list - no extension needed!
            </p>
            
            {/* This button handles everything! */}
            <WalletMultiButton />
            
            <div style={{ 
              marginTop: '40px', 
              padding: '20px', 
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: 'white'
            }}>
              <h3>Features:</h3>
              <ul>
                <li>✅ Biometric authentication (Face ID, Touch ID)</li>
                <li>✅ No browser extension required</li>
                <li>✅ Works on mobile and desktop</li>
                <li>✅ Beautiful Porto-inspired UI</li>
                <li>✅ Zero configuration needed</li>
              </ul>
            </div>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
