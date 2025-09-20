import {
  BaseMessageSignerWalletAdapter,
  WalletName,
  WalletReadyState,
  WalletConnectionError,
  WalletNotConnectedError,
  WalletSignTransactionError,
  WalletSignMessageError,
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
// Always default to production URL unless explicitly overridden via env
const WEBSIG_URL = process.env.NEXT_PUBLIC_WEBSIG_URL || 'https://websig.xyz';
const WEBSIG_ORIGIN = new URL(WEBSIG_URL).origin;

export class WebSigWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = WEBSIG_NAME;
  url = WEBSIG_URL;
  icon = WEBSIG_ICON;
  supportedTransactionVersions = new Set(['legacy', 0] as const);

  private _connecting = false;
  private _publicKey: PublicKey | null = null;
  private _responseHandlers = new Map<string, { resolve: Function; reject: Function }>();
  private _targetWindow: Window | null = null;
  private _iframeElement: HTMLIFrameElement | null = null;
  private _targetOrigin: string = WEBSIG_ORIGIN;
  private _dialogElement: HTMLDialogElement | null = null;
  private _styleElement: HTMLStyleElement | null = null;
  private _openerElement: HTMLElement | null = null;

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
    
    // Always show as "Installed" - WebSig is always ready!
    // This makes the wallet selector call connect() directly instead of opening a URL
    return WalletReadyState.Installed;
  }

  private _handleMessage(event: MessageEvent) {
    // Security: Only accept messages from WebSig
    if (event.origin !== this._targetOrigin) return;
    
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
    if (!this.connected) {
      throw new WalletNotConnectedError();
    }
    if (!this._targetWindow || (this._targetWindow as any).closed) {
      throw new WalletNotConnectedError();
    }
    
    const id = Math.random().toString(36).substr(2, 9);
    
    return new Promise((resolve, reject) => {
      this._responseHandlers.set(id, { resolve, reject });
      
      // Send message to the iframe/window that has our wallet
      try {
        this._targetWindow!.postMessage({
          source: 'websig-adapter',
          id,
          method,
          params,
        }, this._targetOrigin);
      } catch (err) {
        this._responseHandlers.delete(id);
        reject(err);
        return;
      }
      
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
        // Prefer integrated modal. With proper Permissions-Policy headers on host,
        // cross-origin WebAuthn works. Fallback to popup if it fails.
        try {
          await this._createIntegratedModal(url.toString());
        } catch (e) {
          await this._createPopup(url.toString());
        }
      }
    } catch (error: any) {
      this.emit('error', error);
      throw error;
    } finally {
      this._connecting = false;
    }
  }

  private async _createIntegratedModal(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Hide any existing wallet modal (like the wallet selector)
      const existingModals = document.querySelectorAll('.wallet-adapter-modal');
      existingModals.forEach(modal => {
        (modal as HTMLElement).style.display = 'none';
      });

      // Create native dialog element like Porto
      const dialog = document.createElement('dialog');
      dialog.dataset.websig = '';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-label', 'WebSig Wallet');
      
      // Style the dialog itself to be transparent
      Object.assign(dialog.style, {
        background: 'transparent',
        border: '0',
        outline: '0',
        padding: '0',
        position: 'fixed',
        maxWidth: '100vw',
        maxHeight: '100vh',
      });

      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.setAttribute('data-testid', 'websig');
      iframe.setAttribute('tabindex', '0');
      iframe.setAttribute('title', 'WebSig');
      // Allow clipboard access and other necessary permissions
      // Include all WebAuthn permissions and mark as same-origin
      iframe.setAttribute('allow', 'clipboard-read; clipboard-write; publickey-credentials-create *; publickey-credentials-get *; payment *');
      iframe.src = url;
      
      // Style iframe similar to Porto's overlay (near top, not centered vertically)
      Object.assign(iframe.style, {
        backgroundColor: 'transparent',
        border: '0',
        borderRadius: '16px',
        width: '380px',
        maxWidth: '92vw',
        height: '320px',
        position: 'fixed',
        left: '50%',
        top: '24px',
        transform: 'translate(-50%, 0)',
        zIndex: '999999',
      });

      // Add styles for backdrop and animations like Porto
      const style = document.createElement('style');
      style.innerHTML = `
        dialog[data-websig]::backdrop {
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
        }
        @keyframes websigFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes websigSlideDown {
          from { 
            transform: translate(-50%, -10px) scale(0.98); 
            opacity: 0; 
          }
          to { 
            transform: translate(-50%, 0) scale(1); 
            opacity: 1; 
          }
        }
        iframe[data-testid="websig"] { animation: websigSlideDown 0.2s ease; }
      `;
      document.head.appendChild(style);

      // Store body style to restore later (like Porto)
      let bodyStyle: CSSStyleDeclaration | null = null;
      let opener: HTMLElement | null = null;

      // Function to cleanup and restore
      const cleanup = () => {
        // Restore body scroll
        if (bodyStyle) {
          Object.assign(document.body.style, bodyStyle);
          document.body.style.overflow = bodyStyle.overflow ?? '';
        }
        
        // Close dialog
        if (dialog.open) {
          dialog.close();
        }
        
        // Remove from DOM
        if (dialog.parentNode) {
          dialog.remove();
        }
        
        // Remove styles
        if (style.parentNode) {
          document.head.removeChild(style);
        }
        
        // Restore focus
        opener?.focus();
        opener = null;
        
        // Restore hidden wallet modals
        const existingModals = document.querySelectorAll('.wallet-adapter-modal');
        existingModals.forEach(modal => {
          (modal as HTMLElement).style.display = '';
        });
      };

      // Handle backdrop click (dialog handles this natively)
      dialog.addEventListener('click', (e) => {
        // Check if click was on the backdrop (outside iframe)
        const rect = iframe.getBoundingClientRect();
        const clickedInside = 
          e.clientX >= rect.left && 
          e.clientX <= rect.right && 
          e.clientY >= rect.top && 
          e.clientY <= rect.bottom;
          
        if (!clickedInside) {
          cleanup();
          if (!this.connected) {
            reject(new WalletConnectionError('Connection cancelled'));
          }
        }
      });

      // Handle escape key (dialog handles this natively too)
      dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        cleanup();
        if (!this.connected) {
          reject(new WalletConnectionError('Connection cancelled'));
        }
      });

      // Listen for connection messages from iframe
      const handleMessage = (event: MessageEvent) => {
        // Check if the message is from our iframe (WebSig origin)
        if (event.origin !== this._targetOrigin) return;
        
        if (event.data.type === 'websig:connected') {
          this._publicKey = new PublicKey(event.data.publicKey);
          window.removeEventListener('message', handleMessage);
          // Persist the iframe for subsequent requests by moving it out of the dialog
          try {
            iframe.style.background = 'transparent';
            iframe.style.position = 'absolute';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            iframe.style.opacity = '0';
            iframe.style.pointerEvents = 'none';
            document.body.appendChild(iframe);
            this._iframeElement = iframe;
            this._targetWindow = iframe.contentWindow;
            this._targetOrigin = new URL(url).origin;
          } catch {}
          cleanup();
          this.emit('connect', this._publicKey);
          resolve();
        } else if (event.data.type === 'websig:rejected') {
          window.removeEventListener('message', handleMessage);
          cleanup();
          reject(new WalletConnectionError('User rejected the connection'));
        }
      };
      
      window.addEventListener('message', handleMessage);

      // Build dialog structure
      dialog.appendChild(iframe);
      document.body.appendChild(dialog);
      
      // Store current focused element
      if (document.activeElement instanceof HTMLElement) {
        opener = document.activeElement;
      }
      
      // Store body styles and prevent scrolling
      bodyStyle = Object.assign({}, document.body.style);
      document.body.style.overflow = 'hidden';
      
      // Show the dialog as modal (like Porto)
      dialog.showModal();
      iframe.focus();
    });
  }

  private async _createPopup(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Calculate center position for optimal viewing
      const width = 420;
      const height = 600;
      const left = Math.max(0, (window.screen.width - width) / 2);
      const top = Math.max(0, (window.screen.height - height) / 2);
      
      // Open popup window with clean, minimal chrome
      const popup = window.open(
        url,
        'WebSig Wallet',
        `width=${width},height=${height},left=${left},top=${top},` +
        `resizable=no,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no`
      );
      
      if (!popup) {
        reject(new WalletConnectionError('Please allow popups to connect your wallet'));
        return;
      }
      
      // Listen for messages from the popup (WebSig will post a message when connected)
      const handleMessage = (event: MessageEvent) => {
        // Verify the origin matches target origin
        if (event.origin !== this._targetOrigin) {
          return;
        }
        
        if (event.data?.type === 'websig:connected' && event.data?.publicKey) {
          // Connection successful
          window.removeEventListener('message', handleMessage);
          clearInterval(checkInterval);
          
          this._publicKey = new PublicKey(event.data.publicKey);
          this.emit('connect', this._publicKey);
          
          // Close the popup
          popup.close();
          resolve();
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      // Poll to check if popup was closed
      const checkInterval = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkInterval);
          window.removeEventListener('message', handleMessage);
          if (!this.connected) {
            reject(new WalletConnectionError('Connection cancelled'));
          }
        }
      }, 500);
      
      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        window.removeEventListener('message', handleMessage);
        if (!this.connected && !popup.closed) {
          popup.close();
          reject(new WalletConnectionError('Connection timeout'));
        }
      }, 120000);
    });
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      try {
        await this._sendMessage('disconnect');
      } catch {
        // Ignore errors during disconnect
      }
    }
    
    this._handleDisconnect();
  }

  private _handleDisconnect() {
    this._publicKey = null;
    this._responseHandlers.clear();
    // Clean up hidden iframe/channel
    try {
      if (this._iframeElement && this._iframeElement.parentNode) {
        this._iframeElement.parentNode.removeChild(this._iframeElement);
      }
    } catch {}
    this._iframeElement = null;
    this._targetWindow = null;
    
    this.emit('disconnect');
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T> {
    try {
      if (!this.connected) throw new WalletNotConnectedError();
      
      
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
      
      
      const response = await this._sendMessage('signMessage', {
        message: Buffer.from(message).toString('base64'),
      });
      
      return Buffer.from(response.signature, 'base64');
    } catch (error: any) {
      throw new WalletSignMessageError(error?.message || 'Message signing failed');
    }
  }
}
