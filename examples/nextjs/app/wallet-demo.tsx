'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  useConnection,
  useWallet
} from '@solana/wallet-adapter-react';
import {
  WalletMultiButton,
  WalletDisconnectButton
} from '@solana/wallet-adapter-react-ui';
import {
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

export default function WalletDemo() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signMessage, connected } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [signing, setSigning] = useState(false);
  const [txSignature, setTxSignature] = useState<string>('');
  const [msgSignature, setMsgSignature] = useState<string>('');

  // Fetch balance when wallet connects
  useEffect(() => {
    if (publicKey && connection) {
      connection.getBalance(publicKey).then(bal => {
        setBalance(bal / LAMPORTS_PER_SOL);
      });
    } else {
      setBalance(null);
      setTxSignature('');
      setMsgSignature('');
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
      setTxSignature(signature);

      // Wait for confirmation
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        ...latestBlockhash,
      });

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
        'Hello from WebSig!\nThis is a test message to sign with your biometric wallet.'
      );
      const signature = await signMessage(message);
      const sig = Buffer.from(signature).toString('base64');
      setMsgSignature(sig);
    } catch (error: any) {
      console.error('Signing failed:', error);
      alert(`Signing failed: ${error.message}`);
    } finally {
      setSigning(false);
    }
  }, [signMessage]);

  return (
    <div className="container">
      {/* Minimal header */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-white mb-4">
          WebSig
        </h1>
        <p className="text-zinc-400 text-lg">
          Biometric authentication for Web3
        </p>
      </div>

      {/* Clean wallet buttons */}
      <div className="wallet-section">
        <div className="flex gap-3 justify-center">
          <WalletMultiButton 
            style={{
              background: connected ? '#27272a' : 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          />
          {connected && (
            <WalletDisconnectButton 
              style={{
                background: 'transparent',
                color: '#71717a',
                border: '1px solid #27272a',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600'
              }}
            />
          )}
        </div>
      </div>

      {connected && publicKey && (
        <div className="mt-12">
          {/* Wallet info in minimal card */}
          <div className="max-w-2xl mx-auto bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-8">
            <div className="text-center mb-8">
              <p className="text-zinc-500 text-sm mb-2">CONNECTED WALLET</p>
              <p className="font-mono text-zinc-300 text-sm">
                {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
              </p>
              {balance !== null && (
                <p className="text-3xl font-bold text-white mt-4">
                  {balance.toFixed(4)} SOL
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleSignMessage}
                disabled={signing || !signMessage}
                className="px-6 py-3 bg-zinc-800 text-zinc-300 rounded-xl font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                {signing ? 'Signing...' : 'Sign Message'}
              </button>
              <button
                onClick={handleSendTransaction}
                disabled={sending}
                className="px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-zinc-100 transition-colors disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Test Transaction'}
              </button>
            </div>

            {/* Results */}
            {(msgSignature || txSignature) && (
              <div className="mt-8 pt-8 border-t border-zinc-800">
                {msgSignature && (
                  <div className="mb-4">
                    <p className="text-zinc-500 text-xs mb-2">SIGNATURE</p>
                    <p className="font-mono text-zinc-400 text-xs break-all">
                      {msgSignature.slice(0, 64)}...
                    </p>
                  </div>
                )}
                {txSignature && (
                  <div>
                    <p className="text-zinc-500 text-xs mb-2">TRANSACTION</p>
                    <a
                      href={`https://solscan.io/tx/${txSignature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-purple-400 text-xs hover:text-purple-300"
                    >
                      View on Solscan →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Features - super minimal */}
      <div className="mt-16 text-center">
        <div className="inline-flex gap-6 text-zinc-500 text-sm">
          <span>Biometric Auth</span>
          <span>•</span>
          <span>No Extensions</span>
          <span>•</span>
          <span>Cross-Platform</span>
          <span>•</span>
          <span>Open Source</span>
        </div>
      </div>
    </div>
  );
}
