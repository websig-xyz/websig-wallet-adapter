'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useCallback, useState } from 'react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

export default function WalletDemo() {
  const { publicKey, signTransaction, signMessage, disconnect, connected } = useWallet();
  const [signature, setSignature] = useState<string>('');
  const [txSignature, setTxSignature] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSignMessage = useCallback(async () => {
    if (!signMessage) {
      alert('Wallet does not support message signing!');
      return;
    }

    try {
      setLoading(true);
      const message = new TextEncoder().encode('Hello from WebSig!');
      const signature = await signMessage(message);
      setSignature(Buffer.from(signature).toString('hex'));
    } catch (error) {
      console.error('Error signing message:', error);
      alert('Failed to sign message');
    } finally {
      setLoading(false);
    }
  }, [signMessage]);

  const handleSendTransaction = useCallback(async () => {
    if (!publicKey || !signTransaction) {
      alert('Wallet not connected or does not support transactions!');
      return;
    }

    try {
      setLoading(true);
      
      // Create a simple transfer transaction
      const connection = new Connection('https://api.devnet.solana.com');
      const { blockhash } = await connection.getLatestBlockhash();
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: publicKey, // Send to self for demo
          lamports: 0.001 * LAMPORTS_PER_SOL,
        })
      );
      
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      // Sign the transaction
      const signed = await signTransaction(transaction);
      
      // Send the transaction
      const txid = await connection.sendRawTransaction(signed.serialize());
      setTxSignature(txid);
      
      console.log('Transaction sent:', txid);
    } catch (error) {
      console.error('Error sending transaction:', error);
      alert('Failed to send transaction');
    } finally {
      setLoading(false);
    }
  }, [publicKey, signTransaction]);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Connect Button */}
      <div className="flex justify-center mb-8">
        <WalletMultiButton />
      </div>

      {/* Wallet Info */}
      {connected && publicKey && (
        <div className="bg-gray-800 rounded-lg p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Connected Wallet</h3>
            <p className="font-mono text-sm text-gray-400 break-all">
              {publicKey.toBase58()}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <div>
              <button
                onClick={handleSignMessage}
                disabled={loading || !signMessage}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded transition"
              >
                {loading ? 'Signing...' : 'Sign Message'}
              </button>
              {signature && (
                <div className="mt-2 p-3 bg-gray-900 rounded">
                  <p className="text-xs text-gray-500 mb-1">Signature:</p>
                  <p className="font-mono text-xs text-green-400 break-all">
                    {signature.substring(0, 64)}...
                  </p>
                </div>
              )}
            </div>

            <div>
              <button
                onClick={handleSendTransaction}
                disabled={loading || !signTransaction}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded transition"
              >
                {loading ? 'Sending...' : 'Send Test Transaction'}
              </button>
              {txSignature && (
                <div className="mt-2 p-3 bg-gray-900 rounded">
                  <p className="text-xs text-gray-500 mb-1">Transaction ID:</p>
                  <a
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-blue-400 hover:text-blue-300 break-all"
                  >
                    {txSignature.substring(0, 64)}...
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={disconnect}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded transition"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!connected && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">How to Connect</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-400">
            <li>Click the "Connect Wallet" button above</li>
            <li>Select "WebSig" from the wallet options</li>
            <li>Authenticate with your biometrics in the popup/iframe</li>
            <li>Your wallet will be connected!</li>
          </ol>
          
          <div className="mt-6 p-4 bg-gray-900 rounded">
            <p className="text-sm text-gray-500">
              <strong>Note:</strong> The adapter automatically chooses between iframe 
              (for same-origin/trusted sites) and popup (for cross-origin) based on 
              the environment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
