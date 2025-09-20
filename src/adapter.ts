import {
  PublicKey,
  Transaction,
  TransactionSignature,
  VersionedTransaction,
  SendOptions,
} from '@solana/web3.js';
import {
  BaseMessageSignerWalletAdapter,
  WalletName,
  WalletReadyState,
  WalletConnectionError,
  WalletDisconnectedError,
  WalletNotConnectedError,
  WalletPublicKeyError,
  WalletSignMessageError,
  WalletSignTransactionError,
} from '@solana/wallet-adapter-base';
import bs58 from 'bs58';

// Porto-style messaging system
interface Messenger {
  send: (topic: string, payload: any) => void;
  on: (topic: string, callback: (payload: any) => void) => () => void;
  destroy: () => void;
}

export class WebSigWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = 'WebSig' as WalletName<'WebSig'>;
  url = 'https://websig.xyz';
  icon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iIzFBMUExQSIvPgo8cGF0aCBkPSJNMTYgOEwxMiAxMkwxNiAxNkwyMCAxMkwxNiA4WiIgZmlsbD0iIzAwRkY4OCIvPgo8cGF0aCBkPSJNMTIgMTZMMTYgMjBMMjAgMTZMMTYgMTJMMTIgMTZaIiBmaWxsPSIjMDBGRjg4Ii8+Cjwvc3ZnPg==';
  supportedTransactionVersions = new Set(['legacy', 0] as const);

  private _connecting = false;
  private _publicKey: PublicKey | null = null;
  private _dialog: HTMLDialogElement | null = null;
  private _iframe: HTMLIFrameElement | null = null;
  private _messenger: Messenger | null = null;
  private _websigUrl = 'https://websig.xyz';

  constructor() {
    super();
  }

  get publicKey() {
    return this._publicKey;
  }

  get connecting() {
    return this._connecting;
  }

  get connected() {
    return !!this._publicKey;
  }

  get readyState(): WalletReadyState {
    return typeof window !== 'undefined' ? WalletReadyState.Installed : WalletReadyState.Unsupported;
  }

  private _createMessenger(iframe: HTMLIFrameElement): Messenger {
    const targetOrigin = new URL(this._websigUrl).origin;
    const listeners = new Map<string, (payload: any) => void>();
    
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from WebSig iframe
      if (event.origin !== targetOrigin) {
        // Log for debugging but don't process
        console.debug('Ignoring message from:', event.origin, 'expected:', targetOrigin);
        return;
      }
      
      // Handle the message
      const { topic, payload } = event.data;
      if (!topic) {
        console.debug('Message missing topic:', event.data);
        return;
      }
      
      const listener = listeners.get(topic);
      if (listener) {
        listener(payload);
      } else {
        console.debug('No listener for topic:', topic);
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    return {
      send: (topic: string, payload: any) => {
        if (!iframe.contentWindow) {
          console.warn('iframe.contentWindow not available');
          return;
        }
        console.debug('Sending message to iframe:', topic, 'target:', targetOrigin);
        iframe.contentWindow.postMessage({ topic, payload }, targetOrigin);
      },
      on: (topic: string, callback: (payload: any) => void) => {
        listeners.set(topic, callback);
        return () => listeners.delete(topic);
      },
      destroy: () => {
        window.removeEventListener('message', handleMessage);
        listeners.clear();
      }
    };
  }

  private async _openDialog(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Clean up any existing dialog
      this._closeDialog();

      // Create native dialog element (Porto style)
      const dialog = document.createElement('dialog');
      dialog.dataset.websig = '';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-label', 'WebSig Wallet');
      
      // Style the dialog to be transparent - all styling happens in iframe
      Object.assign(dialog.style, {
        background: 'transparent',
        border: '0',
        outline: '0',
        padding: '0',
        position: 'fixed',
        maxWidth: '100vw',
        maxHeight: '100vh',
        width: '100%',
        height: '100%',
      });

      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.setAttribute('data-testid', 'websig');
      iframe.setAttribute('title', 'WebSig');
      iframe.setAttribute('tabindex', '0');
      iframe.setAttribute('allow', 'publickey-credentials-create *; publickey-credentials-get *; clipboard-write');
      
      // Include the origin in the URL so WebSig knows who's connecting
      const connectUrl = new URL(`${this._websigUrl}/connect`);
      connectUrl.searchParams.set('origin', window.location.origin);
      connectUrl.searchParams.set('name', window.location.hostname);
      iframe.src = connectUrl.toString();
      
      // Style iframe to fill dialog
      Object.assign(iframe.style, {
        backgroundColor: 'transparent',
        border: '0',
        colorScheme: 'light dark',
        height: '100%',
        width: '100%',
        position: 'fixed',
        left: '0',
        top: '0',
      });

      // Add custom styles for backdrop
      const style = document.createElement('style');
      style.innerHTML = `
        dialog[data-websig]::backdrop {
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
        }
        dialog[data-websig] {
          animation: websigFadeIn 0.2s ease-out;
        }
        @keyframes websigFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `;
      document.head.appendChild(style);

      // Append elements
      dialog.appendChild(iframe);
      document.body.appendChild(dialog);

      // Store references
      this._dialog = dialog;
      this._iframe = iframe;

      // Create messenger for communication
      this._messenger = this._createMessenger(iframe);

      // Handle dialog close on backdrop click
      dialog.addEventListener('click', (e) => {
        const rect = iframe.getBoundingClientRect();
        const clickedInside = 
          e.clientX >= rect.left && 
          e.clientX <= rect.right && 
          e.clientY >= rect.top && 
          e.clientY <= rect.bottom;
        
        if (!clickedInside) {
          this._closeDialog();
          reject(new WalletConnectionError('User cancelled connection'));
        }
      });

      // Handle escape key
      dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        this._closeDialog();
        reject(new WalletConnectionError('User cancelled connection'));
      });

      // Listen for connection response
      const unsubscribe = this._messenger.on('websig:connected', (data) => {
        if (data.publicKey) {
          this._publicKey = new PublicKey(data.publicKey);
          this._closeDialog();
          unsubscribe();
          resolve();
        }
      });

      this._messenger.on('websig:rejected', () => {
        this._closeDialog();
        reject(new WalletConnectionError('User rejected connection'));
      });

      // Show dialog as modal
      dialog.showModal();

      // Send connect request after iframe loads
      iframe.addEventListener('load', () => {
        this._messenger?.send('websig:connect', {
          adapter: 'websig-wallet-adapter'
        });
      });
    });
  }

  private _closeDialog() {
    if (this._dialog) {
      this._dialog.close();
      this._dialog.remove();
      this._dialog = null;
    }
    if (this._iframe) {
      this._iframe = null;
    }
    if (this._messenger) {
      this._messenger.destroy();
      this._messenger = null;
    }
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this._connecting) return;

    this._connecting = true;

    try {
      await this._openDialog();
      
      if (!this._publicKey) {
        throw new WalletPublicKeyError('Failed to get public key');
      }

      this.emit('connect', this._publicKey);
    } catch (error: any) {
      this.emit('error', error);
      throw error;
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this._publicKey) {
      this._publicKey = null;
      this._closeDialog();
      this.emit('disconnect');
    }
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T> {
    if (!this.connected) throw new WalletNotConnectedError();

    try {
      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      const base58 = bs58.encode(serialized);

      // Open dialog for signing
      await this._openDialog();

      return new Promise((resolve, reject) => {
        if (!this._messenger) {
          reject(new WalletSignTransactionError('No messenger available'));
          return;
        }

        const unsubscribe = this._messenger.on('websig:signed', (data) => {
          try {
            const signature = bs58.decode(data.signature);
            const signed = transaction instanceof Transaction
              ? Transaction.from(signature)
              : VersionedTransaction.deserialize(signature);
            
            this._closeDialog();
            unsubscribe();
            resolve(signed as T);
          } catch (error) {
            this._closeDialog();
            reject(new WalletSignTransactionError('Failed to deserialize transaction'));
          }
        });

        this._messenger.on('websig:rejected', () => {
          this._closeDialog();
          reject(new WalletSignTransactionError('User rejected transaction'));
        });

        this._messenger.send('websig:signTransaction', {
          transaction: base58,
          publicKey: this._publicKey?.toBase58()
        });
      });
    } catch (error: any) {
      this.emit('error', error);
      throw error;
    }
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]> {
    const signed: T[] = [];
    for (const tx of transactions) {
      signed.push(await this.signTransaction(tx));
    }
    return signed;
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.connected) throw new WalletNotConnectedError();

    try {
      const base58Message = bs58.encode(message);

      // Open dialog for signing
      await this._openDialog();

      return new Promise((resolve, reject) => {
        if (!this._messenger) {
          reject(new WalletSignMessageError('No messenger available'));
          return;
        }

        const unsubscribe = this._messenger.on('websig:messageSigned', (data) => {
          try {
            const signature = bs58.decode(data.signature);
            this._closeDialog();
            unsubscribe();
            resolve(signature);
          } catch (error) {
            this._closeDialog();
            reject(new WalletSignMessageError('Failed to decode signature'));
          }
        });

        this._messenger.on('websig:rejected', () => {
          this._closeDialog();
          reject(new WalletSignMessageError('User rejected message signing'));
        });

        this._messenger.send('websig:signMessage', {
          message: base58Message,
          publicKey: this._publicKey?.toBase58()
        });
      });
    } catch (error: any) {
      this.emit('error', error);
      throw error;
    }
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection: any,
    options?: SendOptions
  ): Promise<TransactionSignature> {
    const signed = await this.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize(), options);
    return signature;
  }
}