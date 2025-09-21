'use client';

import { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { WebSigWalletAdapter } from '@websig/wallet-adapter';
// In production, you'd use: import { WebSigWalletAdapter } from '@websig/wallet-adapter';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

import dynamic from 'next/dynamic';

// Dynamically import the wallet demo to avoid SSR issues
const WalletDemo = dynamic(() => import('./wallet-demo'), {
  ssr: false,
});

export default function Home() {
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
    // return process.env.NEXT_PUBLIC_RPC_URL || 'https://your-rpc-endpoint.com';
  }, []);

  // Initialize wallets
  const wallets = useMemo(() => {
    const websigUrl = process.env.NEXT_PUBLIC_WEBSIG_URL ||
      (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)
        ? 'http://localhost:3000'
        : 'https://websig.xyz')
    return [
      new WebSigWalletAdapter({ websigUrl }),
      // The adapter will auto-detect localhost and handle it properly
      // You can add other wallets here if needed:
      // new PhantomWalletAdapter(),
      // new SolflareWalletAdapter(),
    ];
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <WalletDemo />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
