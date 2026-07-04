// Solana Wallet Standard Event Registry for modern extensions (like Jupiter Wallet)
const StandardWallets = {
  list: [],
  init() {
    console.log("[Wallet Standard Registry] Initializing event listener...");
    
    const registerCallback = (wallet) => {
      if (wallet && !this.list.some(w => w.name === wallet.name)) {
        this.list.push(wallet);
        console.log("[Wallet Standard Registry] Registered wallet via event:", wallet.name);
      }
    };

    // Listen for wallet-standard:register-wallet events
    window.addEventListener('wallet-standard:register-wallet', (event) => {
      try {
        const register = event.detail;
        if (typeof register === 'function') {
          register({
            register: registerCallback
          });
        }
      } catch (e) {
        console.error("[Wallet Standard Registry] Error registering wallet:", e);
      }
    });

    // Listen for wallets registered directly on navigator
    if (window.navigator?.wallets?.on) {
      try {
        window.navigator.wallets.on('register', () => {
          const wallets = window.navigator.wallets.get();
          for (const wallet of wallets) {
            registerCallback(wallet);
          }
        });
      } catch (e) {
        console.warn("Failed to set navigator.wallets listener:", e);
      }
    }

    // Check existing wallets on navigator immediately
    if (window.navigator?.wallets?.get) {
      try {
        const wallets = window.navigator.wallets.get();
        for (const wallet of wallets) {
          registerCallback(wallet);
        }
      } catch (e) {
        console.warn("Failed to read navigator.wallets:", e);
      }
    }

    // Signal that the app is ready so already-loaded extensions re-trigger registration events
    try {
      window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', {
        detail: {
          register: registerCallback
        }
      }));
    } catch (e) {
      console.warn("Failed to dispatch wallet-standard:app-ready:", e);
    }
  }
};
StandardWallets.init();

// Solana Wallet Integration & Matchmaking for Poke Ball
const SolanaWallet = {
  publicKey: null,
  connected: false,
  isMock: false,
  isEvolving: false,
  provider: null,
  walletType: null, // 'phantom', 'solflare', 'backpack', 'jupiter', 'mock'
  peer: null,
  conn: null,
  isHost: false,
  matchSubscription: null,

  init() {
    this.setupListeners();
    this.checkIfConnected();
  },

  hasEvolved(type) {
    if (!this.connected) return false;
    const evolvedList = JSON.parse(localStorage.getItem(`evolved_${this.publicKey}`) || '[]');
    return evolvedList.includes(type);
  },

  evolve(type) {
    if (this.isEvolving) return false;
    if (!this.connected) {
      alert("Lütfen önce cüzdanınızı bağlayın!");
      return false;
    }
    
    this.isEvolving = true;
    
    const confirmEvolve = window.location.search.includes('test=true') || confirm(
      `${type.toUpperCase()} karakterini 1.0 SOL ödeyerek kalıcı olarak evrimleştirmek istiyor musunuz?`
    );
    if (!confirmEvolve) {
      this.isEvolving = false;
      return false;
    }
    
    // Save to localStorage
    const evolvedList = JSON.parse(localStorage.getItem(`evolved_${this.publicKey}`) || '[]');
    if (!evolvedList.includes(type)) {
      evolvedList.push(type);
      localStorage.setItem(`evolved_${this.publicKey}`, JSON.stringify(evolvedList));
    }
    
    // Trigger animated evolution sequence
    if (window.Game && typeof window.Game.runEvolutionSequence === 'function') {
      window.Game.runEvolutionSequence(type);
    } else {
      alert(`Tebrikler! ${type.toUpperCase()} başarıyla evrimleşti!`);
      if (window.Game && typeof window.Game.renderRosterGrid === 'function') {
        window.Game.renderRosterGrid();
        window.Game.updateSelectionUI();
      }
    }
    
    // Reset the evolving lock after 5 seconds (allows animation overlay to close)
    setTimeout(() => {
      this.isEvolving = false;
    }, 5000);
    
    return true;
  },

  setupListeners() {
    const connectBtn = document.getElementById('wallet-connect-btn');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => {
        if (!this.connected) {
          // Open Wallet Selection Modal
          const modal = document.getElementById('wallet-modal');
          if (modal) modal.style.display = 'flex';
        } else {
          this.disconnect();
        }
      });
    }

    // Close Modal Button
    const closeBtn = document.getElementById('close-wallet-modal-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const modal = document.getElementById('wallet-modal');
        if (modal) modal.style.display = 'none';
      });
    }

    // Close Modal when clicking outside the modal content
    const modal = document.getElementById('wallet-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    }

    // Wallet Option Buttons inside modal
    const optionBtns = document.querySelectorAll('.wallet-option-btn');
    optionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const walletType = btn.getAttribute('data-wallet');
        if (modal) modal.style.display = 'none';
        this.connectWallet(walletType);
      });
    });

    // Matchmaking Cancel Button
    const cancelBtn = document.getElementById('cancel-matchmaking-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.cancelMatchmaking();
      });
    }
  },

  getWalletProvider(walletType) {
    // Debugging logs to help identify what providers are present in the user's browser
    console.log(`[Wallet Debug] Detecting provider for: ${walletType}`);
    console.log("[Wallet Debug] window.solana:", window.solana);
    console.log("[Wallet Debug] window.solanaProviders:", window.solanaProviders);
    console.log("[Wallet Debug] window.phantom:", window.phantom);
    console.log("[Wallet Debug] window.solflare:", window.solflare);
    console.log("[Wallet Debug] window.backpack:", window.backpack);
    console.log("[Wallet Debug] window.jupiter:", window.jupiter);
    console.log("[Wallet Debug] window.navigator.wallets:", window.navigator?.wallets?.get ? window.navigator.wallets.get() : "undefined");

    let provider = null;

    if (walletType === 'phantom') {
      provider = window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null);
      if (!provider && window.solanaProviders) {
        if (Array.isArray(window.solanaProviders)) {
          provider = window.solanaProviders.find(p => p.isPhantom);
        } else if (typeof window.solanaProviders === 'object') {
          provider = window.solanaProviders.phantom || Object.values(window.solanaProviders).find(p => p.isPhantom);
        }
      }
    }
    else if (walletType === 'solflare') {
      provider = window.solflare || (window.solana?.isSolflare ? window.solana : null);
      if (!provider && window.solanaProviders) {
        if (Array.isArray(window.solanaProviders)) {
          provider = window.solanaProviders.find(p => p.isSolflare);
        } else if (typeof window.solanaProviders === 'object') {
          provider = window.solanaProviders.solflare || Object.values(window.solanaProviders).find(p => p.isSolflare);
        }
      }
    }
    else if (walletType === 'backpack') {
      provider = window.backpack || (window.solana?.isBackpack ? window.solana : null);
      if (!provider && window.solanaProviders) {
        if (Array.isArray(window.solanaProviders)) {
          provider = window.solanaProviders.find(p => p.isBackpack || p.constructor?.name?.toLowerCase().includes('backpack'));
        } else if (typeof window.solanaProviders === 'object') {
          provider = window.solanaProviders.backpack || Object.values(window.solanaProviders).find(p => p.isBackpack || p.constructor?.name?.toLowerCase().includes('backpack'));
        }
      }
    }
    else if (walletType === 'jupiter') {
      // 1. Direct window.jupiter check
      if (window.jupiter) return window.jupiter;

      // 2. Check window.solanaProviders (if multiple extensions are installed, e.g., Phantom + Jupiter)
      if (window.solanaProviders) {
        if (Array.isArray(window.solanaProviders)) {
          provider = window.solanaProviders.find(p => p.isJupiter || p.constructor?.name?.toLowerCase().includes('jupiter'));
        } else if (typeof window.solanaProviders === 'object') {
          provider = window.solanaProviders.jupiter || Object.values(window.solanaProviders).find(p => p.isJupiter || p.constructor?.name?.toLowerCase().includes('jupiter'));
        }
      }

      // 3. Check window.solana?.isJupiter
      if (!provider && window.solana?.isJupiter) {
        provider = window.solana;
      }

      // 4. Check Wallet Standard (window.navigator.wallets & Event Registry) - Modern approach
      let jupWallet = null;
      if (window.navigator?.wallets?.get) {
        const standardWallets = window.navigator.wallets.get();
        jupWallet = standardWallets.find(w => w.name?.toLowerCase().includes('jupiter'));
      }
      if (!jupWallet) {
        jupWallet = StandardWallets.list.find(w => w.name?.toLowerCase().includes('jupiter'));
      }

      if (!provider && jupWallet) {
        console.log("[Wallet Debug] Found Jupiter via Wallet Standard:", jupWallet);
        provider = {
          isStandardWallet: true,
          wallet: jupWallet,
          async connect(options = {}) {
            const connectFeature = jupWallet.features['standard:connect'];
            if (!connectFeature) throw new Error("Wallet does not support connect feature");
            const { accounts } = await connectFeature.connect({ silent: !!options.onlyIfTrusted });
            const address = accounts[0].address;
            return {
              publicKey: {
                toString() { return address; }
              }
            };
          },
          async signMessage(message, encoding) {
            const signFeature = jupWallet.features['solana:signMessage'];
            if (!signFeature) {
              console.warn("Wallet does not support solana:signMessage feature");
              return null;
            }
            return await signFeature.signMessage({
              account: jupWallet.accounts[0],
              message
            });
          }
        };
      }

      // 5. Fallback: If window.solana exists and does not belong to other well-known wallets (Phantom, Solflare, Backpack), it might be Jupiter!
      if (!provider && window.solana && !window.solana.isPhantom && !window.solana.isSolflare && !window.solana.isBackpack) {
        provider = window.solana;
      }
    }

    return provider;
  },

  async checkIfConnected() {
    try {
      // Do not auto-reconnect if user explicitly disconnected in their previous action
      if (localStorage.getItem('wallet_disconnected_by_user') === 'true') {
        return;
      }

      const lastWallet = localStorage.getItem('last_wallet_type');
      if (!lastWallet || lastWallet === 'mock') return;

      const selectedProvider = this.getWalletProvider(lastWallet);

      if (selectedProvider) {
        this.provider = selectedProvider;
        this.walletType = lastWallet;
        const response = await this.provider.connect({ onlyIfTrusted: true });
        this.onConnected(response.publicKey.toString(), false);
      }
    } catch (err) {
      // Silent error: user has not approved yet
    }
  },

  async connectWallet(walletType) {
    try {
      this.walletType = walletType;

      if (walletType === 'mock') {
        this.mockConnect();
        return;
      }

      const selectedProvider = this.getWalletProvider(walletType);

      if (!selectedProvider) {
        alert(`${walletType.toUpperCase()} cüzdanı tarayıcınızda yüklü değil! Lütfen resmi sitesinden kurabilir veya test için "Sanal Cüzdan" seçeneğini kullanabilirsiniz.`);
        return;
      }

      this.provider = selectedProvider;
      const response = await this.provider.connect();
      this.onConnected(response.publicKey.toString(), false);

      // Save last selected wallet type so we can try to auto-reconnect on next load
      localStorage.setItem('last_wallet_type', walletType);

    } catch (err) {
      console.error(`${walletType} connection failed`, err);
      alert("Cüzdan bağlantısı reddedildi veya başarısız oldu.");
    }
  },

  mockConnect() {
    // Generate a random mock public key
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let mockKey = 'Mock';
    for (let i = 0; i < 40; i++) {
      mockKey += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.onConnected(mockKey, true);
  },

  onConnected(publicKey, isMock) {
    // Clear user disconnect flag since they have explicitly connected now
    localStorage.removeItem('wallet_disconnected_by_user');

    this.publicKey = publicKey;
    this.connected = true;
    this.isMock = isMock;

    // Update UI elements
    const connectBtn = document.getElementById('wallet-connect-btn');
    const btnText = document.getElementById('wallet-btn-text');
    if (connectBtn && btnText) {
      connectBtn.classList.add('connected');
      const shortKey = publicKey.substring(0, 4) + '...' + publicKey.substring(publicKey.length - 4);
      
      let prefix = '🟢 ';
      if (isMock) {
        prefix = '🤖 Mock: ';
      } else {
        const walletNames = {
          phantom: '👻 ',
          solflare: '☀️ ',
          backpack: '🎒 ',
          jupiter: '🪐 '
        };
        prefix = walletNames[this.walletType] || '🟢 ';
      }
      btnText.textContent = `${prefix}${shortKey}`;
    }

    // Unlock Online Versus Button
    const pvpBtn = document.getElementById('mode-pvp');
    if (pvpBtn) {
      pvpBtn.classList.remove('locked');
      const badge = document.getElementById('mode-pvp-badge');
      if (badge) {
        badge.textContent = 'AKTİF';
        badge.classList.remove('badge-locked');
        badge.classList.add('badge-active');
      }
      const desc = document.getElementById('mode-pvp-desc');
      if (desc) {
        desc.textContent = 'Solana lobisine bağlanmak için tıklayın';
      }
    }
    
    if (window.Game && typeof window.Game.renderRosterGrid === 'function') {
      window.Game.renderRosterGrid();
      window.Game.updateSelectionUI();
    }
    SoundEffects.playKick();
  },

  disconnect() {
    // Explicitly disconnect active session if exists
    if (this.provider && typeof this.provider.disconnect === 'function') {
      try {
        this.provider.disconnect();
      } catch (e) {
        console.warn("Wallet provider disconnect failed:", e);
      }
    }

    // Set flag so we do not auto-reconnect on next page load
    localStorage.setItem('wallet_disconnected_by_user', 'true');
    localStorage.removeItem('last_wallet_type');

    this.provider = null;
    this.walletType = null;
    this.publicKey = null;
    this.connected = false;
    this.isMock = false;

    // Reset UI
    const connectBtn = document.getElementById('wallet-connect-btn');
    const btnText = document.getElementById('wallet-btn-text');
    if (connectBtn && btnText) {
      connectBtn.classList.remove('connected');
      btnText.textContent = 'Cüzdan Bağla';
    }

    // Lock Online Versus Button
    const pvpBtn = document.getElementById('mode-pvp');
    if (pvpBtn) {
      pvpBtn.classList.add('locked');
      const badge = document.getElementById('mode-pvp-badge');
      if (badge) {
        badge.textContent = 'KİLİTLİ';
        badge.classList.add('badge-locked');
        badge.classList.remove('badge-active');
      }
      const desc = document.getElementById('mode-pvp-desc');
      if (desc) {
        desc.textContent = 'Cüzdan bağlayarak Solana arenasına katılın';
      }
    }
    
    if (window.Game && typeof window.Game.renderRosterGrid === 'function') {
      window.Game.renderRosterGrid();
      window.Game.updateSelectionUI();
    }
    SoundEffects.playBounce();
  },

  async startMatchmaking() {
    // Switch to matchmaking screen
    Game.switchScreen('matchmaking-screen');
    SoundEffects.playKick();

    const statusText = document.getElementById('matchmaking-status');
    const stepWallet = document.getElementById('step-wallet');
    const stepSig = document.getElementById('step-signature');
    const stepSearch = document.getElementById('step-search');

    // Reset steps UI
    stepWallet.querySelector('.step-check').textContent = '🟢';
    stepWallet.classList.add('active');
    
    stepSig.querySelector('.step-check').textContent = '⏳';
    stepSig.classList.remove('active');
    
    stepSearch.querySelector('.step-check').textContent = '⏳';
    stepSearch.classList.remove('active');

    try {
      // Step 2: Request message signature
      await this.sleep(1000);
      stepSig.classList.add('active');
      statusText.textContent = "Solana cüzdan lobi imzanız isteniyor...";

      if (!this.isMock && this.provider) {
        const messageText = `Poke Ball Arena Versus Girişi\nPublic Key: ${this.publicKey}\nZaman: ${new Date().toISOString()}`;
        const encoded = new TextEncoder().encode(messageText);
        await this.provider.signMessage(encoded, "utf8");
      } else {
        // Simulate signature wait
        await this.sleep(1500);
      }

      stepSig.querySelector('.step-check').textContent = '🟢';
      
      // Step 3: Searching for opponent using Supabase & PeerJS
      await this.sleep(1000);
      stepSearch.classList.add('active');
      statusText.textContent = "Lobi ağında uygun rakip aranıyor...";

      // Delete any stale queue entries for this user
      await window.supabase.from('matchmaking_queue').delete().eq('wallet_address', this.publicKey);

      // Initialize PeerJS if not already active
      if (!this.peer) {
        console.log("[PeerJS] Initializing connection with ID:", this.publicKey);
        this.peer = new Peer(this.publicKey, {
          debug: 1
        });

        await new Promise((resolve, reject) => {
          this.peer.on('open', (id) => {
            console.log("[PeerJS] Connection opened. ID is:", id);
            resolve();
          });
          this.peer.on('error', (err) => {
            console.error("[PeerJS] Init error:", err);
            reject(err);
          });
        });
      }

      // Check if there is an active opponent waiting in the queue
      const isEvolved = Game.isPokemonEvolvedActive(Game.p1Selected);
      
      const { data: queue, error: queueError } = await window.supabase
        .from('matchmaking_queue')
        .select('*')
        .eq('status', 'waiting')
        .eq('is_evolved', isEvolved)
        .neq('wallet_address', this.publicKey)
        .order('created_at', { ascending: true })
        .limit(1);

      if (queueError) throw queueError;

      if (queue && queue.length > 0) {
        // Match found! We are the CLIENT.
        const opponent = queue[0];
        console.log("[Matchmaking] Found opponent waiting in queue:", opponent);
        
        // Update their row to mark as matched
        const { error: matchError } = await window.supabase
          .from('matchmaking_queue')
          .update({
            status: 'matched',
            matched_wallet: this.publicKey,
            matched_peer_id: this.publicKey
          })
          .eq('wallet_address', opponent.wallet_address)
          .eq('status', 'waiting');

        if (matchError) throw matchError;

        this.isHost = false;
        stepSearch.querySelector('.step-check').textContent = '🟢';
        statusText.textContent = `Rakip Bulundu! Bağlantı kuruluyor...`;

        // Connect to Host
        console.log("[WebRTC] Connecting to Host Peer ID:", opponent.peer_id);
        const conn = this.peer.connect(opponent.peer_id, { reliable: true });
        this.conn = conn;
        this.setupGameConnection(conn);

      } else {
        // No opponent found. We are the HOST.
        console.log("[Matchmaking] No opponent found. Inserting ourselves as Host...");
        this.isHost = true;

        const { error: insertError } = await window.supabase
          .from('matchmaking_queue')
          .insert({
            wallet_address: this.publicKey,
            peer_id: this.publicKey,
            pokemon: Game.p1Selected,
            is_evolved: isEvolved,
            status: 'waiting',
            role: 'host'
          });

        if (insertError) throw insertError;

        // Set up real-time listener on our row to see when someone matches us
        this.matchSubscription = window.supabase.channel('matchmaking_lobby')
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'matchmaking_queue',
            filter: `wallet_address=eq.${this.publicKey}`
          }, (payload) => {
            const row = payload.new;
            if (row.status === 'matched') {
              console.log("[Matchmaking] Match detected via Realtime! Opponent is:", row.matched_wallet);
              
              this.unsubscribeMatchmaking();
              
              stepSearch.querySelector('.step-check').textContent = '🟢';
              statusText.textContent = `Rakip Bulundu! Karşılaşma başlıyor...`;
              
              // We just wait for their incoming PeerJS connection!
            }
          })
          .subscribe();

        // Listen for incoming PeerJS connection from Client
        this.peer.on('connection', (conn) => {
          console.log("[WebRTC] Received incoming connection from Client!");
          this.conn = conn;
          this.setupGameConnection(conn);
        });
      }

    } catch (err) {
      console.error("Matchmaking error", err);
      statusText.textContent = "Bağlantı veya eşleşme hatası oluştu.";
      await this.sleep(2000);
      this.cancelMatchmaking();
    }
  },

  setupGameConnection(conn) {
    conn.on('open', () => {
      console.log("[WebRTC] Data channel is fully open!");
      
      // Handshake details
      conn.send({
        type: 'handshake',
        pokemon: Game.p1Selected,
        isEvolved: Game.isPokemonEvolvedActive(Game.p1Selected),
        wallet: this.publicKey
      });
    });

    conn.on('data', (data) => {
      if (data.type === 'handshake') {
        console.log("[WebRTC] Received handshake data:", data);
        
        // Remove matchmaking row as we are successfully playing
        window.supabase.from('matchmaking_queue').delete().eq('wallet_address', this.publicKey).then(() => {
          console.log("[Matchmaking] Cleanup complete.");
        });

        // Initialize online versus game
        Game.startOnlineVersusGame(data.wallet, data.pokemon, data.isEvolved);
      }
      else if (data.type === 'state') {
        Game.receiveHostState(data);
      }
      else if (data.type === 'input') {
        Game.receiveClientInput(data.keys);
      }
      else if (data.type === 'action') {
        Game.receiveAction(data);
      }
    });

    conn.on('close', () => {
      console.log("[WebRTC] Connection closed.");
      Game.handleDisconnect();
    });

    conn.on('error', (err) => {
      console.error("[WebRTC] Connection error:", err);
      Game.handleDisconnect();
    });
  },

  async cancelMatchmaking() {
    this.unsubscribeMatchmaking();
    if (this.connected && this.publicKey) {
      try {
        await window.supabase.from('matchmaking_queue').delete().eq('wallet_address', this.publicKey);
      } catch (e) {
        console.warn("Failed to delete matchmaking queue row:", e);
      }
    }
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    Game.switchScreen('menu-screen');
    SoundEffects.playBounce();
  },

  unsubscribeMatchmaking() {
    if (this.matchSubscription) {
      window.supabase.removeChannel(this.matchSubscription);
      this.matchSubscription = null;
    }
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Initialize wallet connection when script loads
window.addEventListener('DOMContentLoaded', () => {
  SolanaWallet.init();
});
window.SolanaWallet = SolanaWallet;
