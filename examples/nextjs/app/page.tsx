'use client';

import { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { WebSigWalletAdapter } from '@websig/wallet-adapter';

import '@solana/wallet-adapter-react-ui/styles.css';

import dynamic from 'next/dynamic';

const WalletDemo = dynamic(() => import('./wallet-demo'), {
  ssr: false,
});

export default function Home() {
  const endpoint = useMemo(() => clusterApiUrl('devnet'), []);
  
  // Configure WebSig URL - defaults to production
  // For local development with both on localhost, use: http://localhost:3000
  // For production, use: https://websig.xyz (default)
  const websigUrl = process.env.NEXT_PUBLIC_WEBSIG_URL || 'https://websig.xyz';
  
  const wallets = useMemo(() => {
    console.log('[WebSig Example] Using WebSig URL:', websigUrl);
    
    return [
      new WebSigWalletAdapter({ 
        websigUrl,
        // Optional: Force a specific dialog type (iframe or popup)
        // forceDialogType: 'popup' 
      }),
    ];
  }, [websigUrl]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <div className="min-h-screen bg-gray-900 text-white">
            <div className="container mx-auto px-4 py-16">
              <header className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">
                  WebSig Wallet Adapter Demo
                </h1>
                <p className="text-gray-400">
                  Connect your WebSig wallet using biometric authentication
                </p>
              </header>
              
              <WalletDemo />
              
              <footer className="mt-16 text-center text-gray-500 text-sm">
                <p>
                  {websigUrl === 'https://websig.xyz' ? (
                    <>Using production WebSig (popup mode for cross-origin)</>
                  ) : (
                    <>Using local WebSig at {websigUrl} (iframe mode)</>
                  )}
                </p>
              </footer>
            </div>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}