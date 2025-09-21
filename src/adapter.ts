import {
  BaseMessageSignerWalletAdapter,
  WalletConnectionError,
  WalletDisconnectionError,
  WalletName,
  WalletNotConnectedError,
  WalletNotReadyError,
  WalletPublicKeyError,
  WalletReadyState,
  WalletSignMessageError,
  WalletSignTransactionError,
} from '@solana/wallet-adapter-base';
import type {
  SolanaSignInInput,
  SolanaSignInOutput,
} from '@solana/wallet-standard-features';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

export interface WebSigWalletAdapterConfig {
  websigUrl?: string;
  /** Force a specific dialog type instead of auto-detection */
  forceDialogType?: 'iframe' | 'popup';
}

export const WebSigWalletName = 'WebSig' as WalletName<'WebSig'>;

interface Messenger {
  send: (topic: string, payload: any) => void;
  on: (topic: string, handler: (payload: any) => void) => () => void;
  destroy: () => void;
}

export class WebSigWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = WebSigWalletName;
  url = 'https://websig.xyz';
  icon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTAwIiBmaWxsPSJ1cmwoI3BhaW50MF9saW5lYXJfMV8yKSIvPgo8cGF0aCBkPSJNMjU2IDE2MEMyMDIuOTgxIDE2MCAxNjAgMjAyLjk4MSAxNjAgMjU2QzE2MCAzMDkuMDE5IDIwMi45ODEgMzUyIDI1NiAzNTJDMzA5LjAxOSAzNTIgMzUyIDMwOS4wMTkgMzUyIDI1NkMzNTIgMjAyLjk4MSAzMDkuMDE5IDE2MCAyNTYgMTYwWiIgZmlsbD0id2hpdGUiLz4KPGNpcmNsZSBjeD0iMjU2IiBjeT0iMjU2IiByPSI0MCIgZmlsbD0idXJsKCNwYWludDFfbGluZWFyXzFfMikiLz4KPGRlZnM+CjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQwX2xpbmVhcl8xXzIiIHgxPSIwIiB5MT0iMCIgeDI9IjUxMiIgeTI9IjUxMiIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjNjY3ZUVBIHN0b3Atb3BhY2l0eT0iMSIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM3NjRCQTIiIHN0b3Atb3BhY2l0eT0iMSIvPgo8L2xpbmVhckdyYWRpZW50Pgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MV9saW5lYXJfMV8yIiB4MT0iMjE2IiB5MT0iMjE2IiB4Mj0iMjk2IiB5Mj0iMjk2IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiM2NjdFRUEiIHN0b3Atb3BhY2l0eT0iMSIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM3NjRCQTIiIHN0b3Atb3BhY2l0eT0iMSIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM+Cjwvc3ZnPg==';
  supportedTransactionVersions = new Set(['legacy', 0] as const);

  private _connecting: boolean;
  private _publicKey: PublicKey | null;
  private _websigUrl: string;
  private _dialog: HTMLElement | null = null;
  private _iframe: HTMLIFrameElement | null = null;
  private _popup: Window | null = null;
  private _messenger: Messenger | null = null;
  private _dialogType: 'iframe' | 'popup' = 'iframe';

  constructor(config: WebSigWalletAdapterConfig = {}) {
    super();
    this._connecting = false;
    this._publicKey = null;
    
    // Default to production WebSig
    this._websigUrl = config.websigUrl || 'https://websig.xyz';
    
    // Remove trailing slash if present
    if (this._websigUrl.endsWith('/')) {
      this._websigUrl = this._websigUrl.slice(0, -1);
    }

    // Force dialog type if specified
    if (config.forceDialogType) {
      this._dialogType = config.forceDialogType;
    }

    // Porto-style: Listen for CSP violations and switch to popup
    if (typeof document !== 'undefined') {
      document.addEventListener('securitypolicyviolation', this._handleCSPViolation.bind(this));
    }

    // Porto-style: Try to restore connection from storage
    this._restoreConnection();
  }

  get publicKey() {
    return this._publicKey;
  }

  get connecting() {
    return this._connecting;
  }

  get readyState(): WalletReadyState {
    return typeof window !== 'undefined' ? WalletReadyState.Installed : WalletReadyState.Unsupported;
  }

  private _restoreConnection() {
    // Porto-style: Restore connection from localStorage
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('websig:connection');
      if (stored) {
        const { publicKey, timestamp } = JSON.parse(stored);
        // Only restore if less than 24 hours old
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          this._publicKey = new PublicKey(publicKey);
          // Note: We don't emit 'connect' here as the adapter might not be ready
        } else {
          // Clear expired connection
          localStorage.removeItem('websig:connection');
        }
      }
    } catch (error) {
      // Ignore storage errors
      console.debug('[WebSig Adapter] Could not restore connection:', error);
    }
  }

  private _saveConnection() {
    // Porto-style: Save connection to localStorage
    if (typeof window === 'undefined' || !this._publicKey) return;
    
    try {
      localStorage.setItem('websig:connection', JSON.stringify({
        publicKey: this._publicKey.toBase58(),
        timestamp: Date.now()
      }));
    } catch (error) {
      // Ignore storage errors
      console.debug('[WebSig Adapter] Could not save connection:', error);
    }
  }

  private _handleCSPViolation(event: SecurityPolicyViolationEvent) {
    // Check if it's our iframe being blocked
    if (!event.blockedURI?.includes(this._websigUrl)) return;
    
    console.log('[WebSig Adapter] CSP violation detected, switching to popup mode');
    
    // If we have an iframe dialog open, close it and switch to popup
    if (this._dialogType === 'iframe' && this._dialog) {
      this._closeDialog();
      this._dialogType = 'popup';
      // The connect flow will automatically retry with popup
    }
  }

  private _createMessenger(target: HTMLIFrameElement | Window): Messenger {
    const targetOrigin = new URL(this._websigUrl).origin;
    const listeners = new Map<string, (payload: any) => void>();
    
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from the configured WebSig URL
      if (event.origin !== targetOrigin) {
        return;
      }
      
      // Handle the message
      const { topic, payload } = event.data;
      if (!topic) {
        return;
      }
      
      const listener = listeners.get(topic);
      if (listener) {
        listener(payload);
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    return {
      send: (topic: string, payload: any) => {
        // Check if target is an iframe or a window
        const targetWindow = (target instanceof HTMLIFrameElement) 
          ? target.contentWindow 
          : (target as Window);
        
        if (!targetWindow || (targetWindow !== window && (targetWindow as Window).closed)) {
          console.warn('[WebSig Adapter] Target window not available');
          return;
        }
        // Only log in development
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
          console.debug('[WebSig Adapter] Sending message:', topic);
        }
        targetWindow.postMessage({ topic, payload }, targetOrigin);
      },
      on: (topic: string, handler: (payload: any) => void) => {
        listeners.set(topic, handler);
        return () => {
          listeners.delete(topic);
        };
      },
      destroy: () => {
        window.removeEventListener('message', handleMessage);
        listeners.clear();
      }
    };
  }

  async connect(): Promise<void> {
    try {
      if (this.connected || this.connecting) return;
      if (this.readyState !== WalletReadyState.Installed) throw new WalletNotReadyError();

      this._connecting = true;

      // Try iframe first, will automatically fall back to popup if CSP blocks it
      await this._openConnection();

      if (!this._publicKey) {
        throw new WalletPublicKeyError('No public key returned');
      }

      // Porto-style: Save connection for persistence
      this._saveConnection();

      this.emit('connect', this._publicKey);
    } catch (error: any) {
      this.emit('error', error);
      throw error;
    } finally {
      this._connecting = false;
    }
  }

  private async _openConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Build connect URL
      const connectUrl = new URL(`${this._websigUrl}/connect`);
      connectUrl.searchParams.set('origin', window.location.origin);
      connectUrl.searchParams.set('name', window.location.hostname);
      
      const pageOrigin = window.location.origin;
      const targetOrigin = new URL(this._websigUrl).origin;
      
      // Debug logging
      console.log('[WebSig Adapter] Page origin:', pageOrigin);
      console.log('[WebSig Adapter] Target origin:', targetOrigin);
      
      // Porto-style: Detect Safari (doesn't support WebAuthn in iframes)
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isSafari) {
        console.log('[WebSig Adapter] Safari detected, using POPUP mode (WebAuthn limitation)');
        this._openPopupWindow(connectUrl, resolve, reject);
        return;
      }
      
      // Check if both are localhost/loopback (always works)
      const bothLocalhost = 
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(pageOrigin) &&
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(targetOrigin);
      
      // Same origin always works with iframe
      const sameOrigin = pageOrigin === targetOrigin;
      
      // For same origin or both localhost, use iframe directly
      if (sameOrigin || bothLocalhost) {
        console.log('[WebSig Adapter] Using IFRAME mode (same origin or both localhost)');
        this._openIframeDialog(connectUrl, resolve, reject);
        return;
      }
      
      // For cross-origin to production websig.xyz, we know it won't work until
      // the trusted hosts system is deployed, so use popup directly
      const isProductionWebsig = targetOrigin === 'https://websig.xyz' || targetOrigin === 'https://www.websig.xyz';
      if (isProductionWebsig) {
        console.log('[WebSig Adapter] Cross-origin to production WebSig - using POPUP mode');
        this._openPopupWindow(connectUrl, resolve, reject);
        return;
      }
      
      // For other cross-origin scenarios (e.g., staging), try iframe with fallback
      const handleCSPViolation = (event: SecurityPolicyViolationEvent) => {
        if (event.blockedURI?.includes(this._websigUrl) && event.violatedDirective === 'frame-ancestors') {
          console.log('[WebSig Adapter] CSP violation detected - not in trusted hosts, falling back to POPUP');
          document.removeEventListener('securitypolicyviolation', handleCSPViolation);
          
          // Clean up failed iframe attempt
          if (this._dialog) {
            this._closeDialog();
          }
          
          // Fallback to popup
          this._openPopupWindow(connectUrl, resolve, reject);
        }
      };
      
      document.addEventListener('securitypolicyviolation', handleCSPViolation);
      
      console.log('[WebSig Adapter] Attempting IFRAME mode (will fallback to popup if not trusted)');
      
      // Try iframe - if we're trusted, it will work
      // If not, CSP violation will trigger popup fallback
      this._openIframeDialog(connectUrl, () => {
        document.removeEventListener('securitypolicyviolation', handleCSPViolation);
        resolve();
      }, (error) => {
        document.removeEventListener('securitypolicyviolation', handleCSPViolation);
        reject(error);
      });
      
      // Timeout fallback - if iframe doesn't load in 2 seconds, try popup
      setTimeout(() => {
        if (this._dialog && !this._publicKey) {
          console.log('[WebSig Adapter] Iframe timeout - falling back to POPUP');
          document.removeEventListener('securitypolicyviolation', handleCSPViolation);
          this._closeDialog();
          this._openPopupWindow(connectUrl, resolve, reject);
        }
      }, 2000);
    });
  }

  private _openIframeDialog(connectUrl: URL, resolve: () => void, reject: (error: any) => void) {
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
      // Porto-style iframe permissions
      const hostUrl = new URL(this._websigUrl);
      iframe.setAttribute(
        'allow',
        `publickey-credentials-get ${hostUrl.origin}; publickey-credentials-create ${hostUrl.origin}; clipboard-write`
      );
      
      iframe.src = connectUrl.toString();
      
      // Style iframe to fill dialog
      Object.assign(iframe.style, {
        backgroundColor: 'transparent',
        border: '0',
        colorScheme: 'light dark',
        height: '100%',
        width: '100%',
      });

      dialog.appendChild(iframe);
      document.body.appendChild(dialog);
      
      // Store references
      this._dialog = dialog;
      this._iframe = iframe;
      this._messenger = this._createMessenger(iframe);

      // Show dialog
      (dialog as any).showModal();

      // Handle dialog close
      dialog.addEventListener('close', () => {
        this._closeDialog();
        reject(new WalletConnectionError('User cancelled connection'));
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

      // Send connect message after iframe loads
      iframe.addEventListener('load', () => {
        this._messenger?.send('websig:connect', {
          adapter: 'websig-wallet-adapter'
        });
      });
  }

  private _openPopupWindow(connectUrl: URL, resolve: () => void, reject: (error: any) => void) {
    // Use a real popup window for cross-origin production
    const width = 420;
    const height = 700;
    const left = (window.innerWidth - width) / 2 + window.screenX;
    const top = (window.innerHeight - height) / 2 + window.screenY;
    
    console.log('[WebSig Adapter] Opening popup window:', connectUrl.toString());
    
    const popup = window.open(
      connectUrl.toString(),
      'websig-connect',
      `width=${width},height=${height},left=${left},top=${top},resizable,scrollbars=no,status=no,location=no,toolbar=no,menubar=no`
    );
    
    if (!popup) {
      reject(new WalletConnectionError('Popup blocked. Please allow popups for this site.'));
      return;
    }
    
    // Store reference
    this._popup = popup;
    this._messenger = this._createMessenger(popup);
    
    // Check if popup is closed
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        this._closeDialog();
        reject(new WalletConnectionError('User closed popup'));
      }
    }, 500);
    
    // Listen for connection response
    const unsubscribe = this._messenger.on('websig:connected', (data) => {
      if (data.publicKey) {
        this._publicKey = new PublicKey(data.publicKey);
        clearInterval(checkClosed);
        this._closeDialog();
        unsubscribe();
        resolve();
      }
    });

    this._messenger.on('websig:rejected', () => {
      clearInterval(checkClosed);
      this._closeDialog();
      reject(new WalletConnectionError('User rejected connection'));
    });

    // Send connect message after popup loads
    // Give it a moment to load
    setTimeout(() => {
      if (!popup.closed) {
        this._messenger?.send('websig:connect', {
          adapter: 'websig-wallet-adapter'
        });
      }
    }, 1000);
  }

  private _closeDialog() {
    if (this._dialog) {
      // Check if it's a native dialog or our custom overlay
      if (typeof (this._dialog as any).close === 'function') {
        (this._dialog as any).close();
      }
      this._dialog.remove();
      this._dialog = null;
    }
    if (this._iframe) {
      this._iframe = null;
    }
    if (this._popup) { // This was for the old popup window approach
      try {
        if (!this._popup.closed) {
          this._popup.close();
        }
      } catch {}
      this._popup = null;
    }
    if (this._messenger) {
      this._messenger.destroy();
      this._messenger = null;
    }
  }

  async disconnect(): Promise<void> {
    const publicKey = this._publicKey;
    if (publicKey) {
      this._publicKey = null;

      // Porto-style: Clear saved connection
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('websig:connection');
        } catch {}
      }

      try {
        this.emit('disconnect');
      } catch (error: any) {
        this.emit('error', new WalletDisconnectionError(error?.message, error));
      }
    }
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    try {
      const publicKey = this._publicKey;
      if (!publicKey) throw new WalletNotConnectedError();

      const response = await this._sendRequest('signMessage', {
        message: Array.from(message),
        publicKey: publicKey.toBase58(),
      });

      if (!response.signature) {
        throw new Error('No signature returned');
      }

      return new Uint8Array(response.signature);
    } catch (error: any) {
      this.emit('error', error);
      throw new WalletSignMessageError(error?.message, error);
    }
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T> {
    try {
      const publicKey = this._publicKey;
      if (!publicKey) throw new WalletNotConnectedError();

      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      const response = await this._sendRequest('signTransaction', {
        transaction: Array.from(serialized),
        publicKey: publicKey.toBase58(),
      });

      if (!response.signedTransaction) {
        throw new Error('No signed transaction returned');
      }

      const signedTx = new Uint8Array(response.signedTransaction);

      if ('version' in transaction) {
        return VersionedTransaction.deserialize(signedTx) as T;
      } else {
        return Transaction.from(signedTx) as T;
      }
    } catch (error: any) {
      this.emit('error', error);
      throw new WalletSignTransactionError(error?.message, error);
    }
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]> {
    const signedTransactions: T[] = [];
    for (const transaction of transactions) {
      signedTransactions.push(await this.signTransaction(transaction));
    }
    return signedTransactions;
  }

  async signIn(input?: SolanaSignInInput): Promise<SolanaSignInOutput> {
    try {
      const publicKey = this._publicKey;
      if (!publicKey) throw new WalletNotConnectedError();

      const response = await this._sendRequest('signIn', {
        ...input,
        publicKey: publicKey.toBase58(),
      });

      return response as SolanaSignInOutput;
    } catch (error: any) {
      this.emit('error', error);
      throw error;
    }
  }

  private async _sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // Open a temporary iframe/popup for signing
      const requestUrl = new URL(`${this._websigUrl}/sign`);
      requestUrl.searchParams.set('origin', window.location.origin);
      requestUrl.searchParams.set('method', method);

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = requestUrl.toString();
      
      // Porto-style iframe permissions
      const hostUrl = new URL(this._websigUrl);
      iframe.setAttribute(
        'allow',
        `publickey-credentials-get ${hostUrl.origin}; publickey-credentials-create ${hostUrl.origin}`
      );
      
      document.body.appendChild(iframe);

      const messenger = this._createMessenger(iframe);

      // Set up timeout
      const timeout = setTimeout(() => {
        iframe.remove();
        messenger.destroy();
        reject(new Error('Request timeout'));
      }, 60000); // 60 second timeout

      // Listen for response
      const unsubscribe = messenger.on('websig:response', (data) => {
        clearTimeout(timeout);
        iframe.remove();
        messenger.destroy();
        unsubscribe();
        
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve(data.result);
        }
      });

      // Send request after iframe loads
      iframe.addEventListener('load', () => {
        messenger.send('websig:request', {
          method,
          params,
        });
      });
    });
  }
}