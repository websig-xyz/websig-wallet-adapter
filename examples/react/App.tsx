import React, { useMemo, useCallback } from 'react';
import { 
  ConnectionProvider, 
  WalletProvider,
  useConnection,
  useWallet 
} from '@solana/wallet-adapter-react';
import { 
  WalletModalProvider,
  WalletMultiButton,
  WalletDisconnectButton 
} from '@solana/wallet-adapter-react-ui';
import { 
  clusterApiUrl,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
// For local testing, import from source
import { WebSigWalletAdapter } from '../../src/adapter';
// For production, you would use:
// import { WebSigWalletAdapter } from '@websig/wallet-adapter';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

// Demo component showing wallet interactions
function WalletDemo() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signMessage, connected } = useWallet();
  const [balance, setBalance] = React.useState<number | null>(null);
  const [sending, setSending] = React.useState(false);
  const [signing, setSigning] = React.useState(false);
  
  // Fetch balance when wallet connects
  React.useEffect(() => {
    if (publicKey) {
      connection.getBalance(publicKey).then(balance => {
        setBalance(balance / LAMPORTS_PER_SOL);
      });
    } else {
      setBalance(null);
    }
  }, [publicKey, connection]);
  
  // Send transaction (0.001 SOL to self for demo)
  const handleSendTransaction = useCallback(async () => {
    if (!publicKey) return;
    
    setSending(true);
    try {
      // Create a simple transfer to self
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: publicKey, // Send to self for testing
          lamports: 0.001 * LAMPORTS_PER_SOL,
        })
      );
      
      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      
      // Wait for confirmation
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        ...latestBlockhash,
      });
      
      alert(`Transaction sent!\nSignature: ${signature}`);
      
      // Refresh balance
      const newBalance = await connection.getBalance(publicKey);
      setBalance(newBalance / LAMPORTS_PER_SOL);
    } catch (error: any) {
      console.error('Transaction failed:', error);
      alert(`Transaction failed: ${error.message}`);
    } finally {
      setSending(false);
    }
  }, [publicKey, sendTransaction, connection]);
  
  // Sign message
  const handleSignMessage = useCallback(async () => {
    if (!signMessage) return;
    
    setSigning(true);
    try {
      const message = new TextEncoder().encode(
        'Hello from WebSig!\nThis is a test message to sign.'
      );
      const signature = await signMessage(message);
      alert(`Message signed!\nSignature: ${Buffer.from(signature).toString('base64')}`);
    } catch (error: any) {
      console.error('Signing failed:', error);
      alert(`Signing failed: ${error.message}`);
    } finally {
      setSigning(false);
    }
  }, [signMessage]);
  
  return (
    <div style={{ textAlign: 'center', color: 'white' }}>
      {connected && publicKey && (
        <>
          <div style={{ 
            margin: '20px 0',
            padding: '15px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '10px'
          }}>
            <div>Connected Address:</div>
            <code style={{ fontSize: '12px' }}>{publicKey.toString()}</code>
            {balance !== null && (
              <div style={{ marginTop: '10px' }}>
                Balance: {balance.toFixed(4)} SOL
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={handleSignMessage}
              disabled={signing}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'white',
                color: '#764ba2',
                fontWeight: 'bold',
                cursor: signing ? 'not-allowed' : 'pointer',
                opacity: signing ? 0.5 : 1,
              }}
            >
              {signing ? 'Signing...' : 'Sign Message'}
            </button>
            
            <button
              onClick={handleSendTransaction}
              disabled={sending}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'white',
                color: '#764ba2',
                fontWeight: 'bold',
                cursor: sending ? 'not-allowed' : 'pointer',
                opacity: sending ? 0.5 : 1,
              }}
            >
              {sending ? 'Sending...' : 'Send 0.001 SOL'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function App() {
  // Configure endpoint - can be mainnet, devnet, or custom RPC
  const endpoint = useMemo(() => {
    // Use a reliable RPC endpoint
    // Option 1: Use Helius free tier (reliable for testing)
    return 'https://sparkling-attentive-replica.solana-mainnet.quiknode.pro/b83cf5c147d67a45906264e195574aa2a0150568/';
    
    // Option 2: Use public Solana RPC (may have rate limits)
    // return clusterApiUrl('mainnet-beta');
    
    // Option 3: For testing on devnet (free SOL from faucet)
    // return clusterApiUrl('devnet');
    
    // Option 4: Use your own RPC (QuickNode, Alchemy, etc.)
    // return process.env.REACT_APP_RPC_URL || 'https://your-rpc-endpoint.com';
  }, []);
  
  // Initialize wallets
  const wallets = useMemo(() => {
    // Set WebSig URL based on environment
    // In production, the adapter will use https://websig.xyz by default
    // For local development, you can override it:
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      // If testing locally, WebSig adapter will automatically use localhost:3000
      process.env.NEXT_PUBLIC_WEBSIG_URL = 'http://localhost:3000';
    }
    
    return [
      new WebSigWalletAdapter(),
      // You can add other wallets here if needed:
      // new PhantomWalletAdapter(),
      // new SolflareWalletAdapter(),
    ];
  }, []);

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
            <h1 style={{ 
              color: 'white', 
              marginBottom: '20px',
              fontSize: '2.5em',
              fontWeight: 'bold' 
            }}>
              WebSig Wallet Demo
            </h1>
            
            <p style={{ 
              color: 'white', 
              marginBottom: '40px', 
              textAlign: 'center',
              maxWidth: '500px',
              lineHeight: 1.6
            }}>
              Experience the future of Web3 authentication.<br/>
              Connect your wallet using biometrics - no extensions needed!
            </p>
            
            {/* Wallet connect/disconnect buttons */}
            <div style={{ marginBottom: '30px' }}>
              <WalletMultiButton />
              {' '}
              <WalletDisconnectButton />
            </div>
            
            {/* Demo interactions */}
            <WalletDemo />
            
            {/* Feature list */}
            <div style={{ 
              marginTop: '40px', 
              padding: '20px', 
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              color: 'white',
              maxWidth: '400px'
            }}>
              <h3 style={{ marginBottom: '15px' }}>✨ WebSig Features</h3>
              <ul style={{ 
                listStyle: 'none', 
                padding: 0,
                textAlign: 'left' 
              }}>
                <li style={{ padding: '5px 0' }}>
                  ✅ Biometric authentication (Face ID, Touch ID)
                </li>
                <li style={{ padding: '5px 0' }}>
                  ✅ No browser extension required
                </li>
                <li style={{ padding: '5px 0' }}>
                  ✅ Works on mobile and desktop
                </li>
                <li style={{ padding: '5px 0' }}>
                  ✅ Beautiful Porto-inspired UI
                </li>
                <li style={{ padding: '5px 0' }}>
                  ✅ Standard wallet adapter compatible
                </li>
                <li style={{ padding: '5px 0' }}>
                  ✅ Secure passkey technology
                </li>
              </ul>
            </div>
            
            {/* Instructions */}
            <div style={{ 
              marginTop: '20px',
              padding: '15px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '10px',
              color: 'white',
              fontSize: '14px',
              maxWidth: '400px'
            }}>
              <strong>How to use:</strong>
              <ol style={{ 
                textAlign: 'left', 
                margin: '10px 0 0 20px' 
              }}>
                <li>Click "Select Wallet" button</li>
                <li>Choose "WebSig" from the list</li>
                <li>Authenticate with your biometrics</li>
                <li>Start signing transactions!</li>
              </ol>
            </div>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;