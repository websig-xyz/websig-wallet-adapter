import {
  BaseMessageSignerWalletAdapter,
  WalletName,
  WalletReadyState,
  WalletConnectionError,
  WalletNotConnectedError,
  WalletSignTransactionError,
  WalletSignMessageError,
  WalletNotReadyError,
  isVersionedTransaction,
} from '@solana/wallet-adapter-base';
import {
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { WEBSIG_ICON } from './icon';

export const WEBSIG_NAME = 'WebSig' as WalletName;

// Production URL - change this when deploying
const WEBSIG_URL = process.env.NEXT_PUBLIC_WEBSIG_URL || 'https://websig.xyz';

interface WebSigWindow extends Window {
  websig?: {
    isWebSig: boolean;
    connect: () => Promise<{ publicKey: PublicKey }>;
    disconnect: () => Promise<void>;
    signTransaction: (transaction: Transaction) => Promise<Transaction>;
    signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
  };
}

export class WebSigWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = WEBSIG_NAME;
  url = WEBSIG_URL;
  icon = WEBSIG_ICON;
  supportedTransactionVersions = new Set(['legacy', 0] as const);

  private _connecting = false;
  private _publicKey: PublicKey | null = null;
  private _popup: Window | null = null;
  private _responseHandlers = new Map<string, { resolve: Function; reject: Function }>();

  constructor() {
    super();
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this._handleMessage.bind(this));
    }
  }

  get publicKey() {
    return this._publicKey;
  }

  get connecting() {
    return this._connecting;
  }

  get readyState() {
    if (typeof window === 'undefined') return WalletReadyState.Unsupported;
    
    // Always show as "Loadable" - no extension needed!
    return WalletReadyState.Loadable;
  }

  private _handleMessage(event: MessageEvent) {
    // Security: Only accept messages from WebSig
    if (event.origin !== WEBSIG_URL) return;
    
    const { type, id, error, ...data } = event.data;
    
    // Handle async responses
    if (id && this._responseHandlers.has(id)) {
      const { resolve, reject } = this._responseHandlers.get(id)!;
      this._responseHandlers.delete(id);
      
      if (error) {
        reject(new Error(error));
      } else {
        resolve(data);
      }
      return;
    }
    
    // Handle events
    switch (type) {
      case 'websig:connected':
        this._publicKey = new PublicKey(data.publicKey);
        this.emit('connect', this._publicKey);
        break;
        
      case 'websig:disconnected':
        this._handleDisconnect();
        break;
        
      case 'websig:accountChanged':
        this._publicKey = new PublicKey(data.publicKey);
        // Emit disconnect and reconnect to notify of account change
        this.emit('disconnect');
        this.emit('connect', this._publicKey);
        break;
    }
  }

  private async _sendMessage(method: string, params?: any): Promise<any> {
    if (!this._popup || this._popup.closed) {
      throw new WalletNotConnectedError();
    }
    
    const id = Math.random().toString(36).substr(2, 9);
    
    return new Promise((resolve, reject) => {
      this._responseHandlers.set(id, { resolve, reject });
      
      this._popup?.postMessage({
        source: 'websig-adapter',
        id,
        method,
        params,
      }, WEBSIG_URL);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this._responseHandlers.has(id)) {
          this._responseHandlers.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async connect(): Promise<void> {
    try {
      if (this.connected || this.connecting) return;
      
      this._connecting = true;
      
      // Check if popup already exists
      if (this._popup && !this._popup.closed) {
        this._popup.focus();
        return;
      }
      
      // Build connection URL with DApp info
      const url = new URL('/connect', WEBSIG_URL);
      url.searchParams.set('origin', window.location.origin);
      url.searchParams.set('name', document.title || 'DApp');
      
      // Add DApp icon if available
      const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (favicon) {
        url.searchParams.set('icon', favicon.href);
      }
      
      // Detect mobile for better UX
      const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        // Mobile: Open in same tab with return URL
        url.searchParams.set('return', window.location.href);
        window.location.href = url.toString();
      } else {
        // Desktop: Open beautiful popup (Porto-style)
        const width = 420;
        const height = 600;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        
        this._popup = window.open(
          url.toString(),
          'WebSig Wallet',
          `width=${width},height=${height},left=${left},top=${top},resizable=no,menubar=no,toolbar=no,status=no`
        );
        
        if (!this._popup) {
          throw new WalletConnectionError('Please allow popups to connect your wallet');
        }
        
        // Wait for connection
        await this._waitForConnection();
      }
    } catch (error: any) {
      this.emit('error', error);
      throw error;
    } finally {
      this._connecting = false;
    }
  }

  private async _waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if popup closes
      const checkInterval = setInterval(() => {
        if (this._popup?.closed) {
          clearInterval(checkInterval);
          reject(new WalletConnectionError('Connection cancelled'));
        }
      }, 500);
      
      // Listen for connection message
      const handleConnect = (event: MessageEvent) => {
        if (event.origin !== WEBSIG_URL) return;
        if (event.data.type !== 'websig:connected') return;
        
        clearInterval(checkInterval);
        window.removeEventListener('message', handleConnect);
        
        this._publicKey = new PublicKey(event.data.publicKey);
        resolve();
      };
      
      window.addEventListener('message', handleConnect);
      
      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        window.removeEventListener('message', handleConnect);
        reject(new WalletConnectionError('Connection timeout'));
      }, 120000);
    });
  }

  async disconnect(): Promise<void> {
    if (this._popup && !this._popup.closed) {
      try {
        await this._sendMessage('disconnect');
      } catch {
        // Ignore errors during disconnect
      }
      this._popup.close();
    }
    
    this._handleDisconnect();
  }

  private _handleDisconnect() {
    this._popup = null;
    this._publicKey = null;
    this._responseHandlers.clear();
    
    this.emit('disconnect');
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T> {
    try {
      if (!this.connected) throw new WalletNotConnectedError();
      
      // Focus popup if minimized
      this._popup?.focus();
      
      // Serialize transaction
      const serialized = isVersionedTransaction(transaction)
        ? Buffer.from(transaction.serialize()).toString('base64')
        : Buffer.from(transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
          })).toString('base64');
      
      // Send to WebSig for signing
      const response = await this._sendMessage('signTransaction', {
        transaction: serialized,
        options: {
          isVersioned: isVersionedTransaction(transaction),
        },
      });
      
      // Deserialize and add signature
      const signature = Buffer.from(response.signature, 'base64');
      
      if (isVersionedTransaction(transaction)) {
        (transaction as VersionedTransaction).addSignature(
          this._publicKey!,
          signature
        );
      } else {
        (transaction as Transaction).addSignature(
          this._publicKey!,
          signature
        );
      }
      
      return transaction;
    } catch (error: any) {
      throw new WalletSignTransactionError(error?.message || 'Transaction signing failed');
    }
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]> {
    if (!this.connected) throw new WalletNotConnectedError();
    
    // Sign one by one with user approval for each
    const signed: T[] = [];
    for (const transaction of transactions) {
      signed.push(await this.signTransaction(transaction));
    }
    return signed;
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    try {
      if (!this.connected) throw new WalletNotConnectedError();
      
      // Focus popup if minimized
      this._popup?.focus();
      
      const response = await this._sendMessage('signMessage', {
        message: Buffer.from(message).toString('base64'),
      });
      
      return Buffer.from(response.signature, 'base64');
    } catch (error: any) {
      throw new WalletSignMessageError(error?.message || 'Message signing failed');
    }
  }
}
