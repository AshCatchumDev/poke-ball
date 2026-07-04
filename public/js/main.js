// Poke Ball Game Main Controller & Loop
const Game = {
  canvas: null,
  ctx: null,
  state: 'landing', // 'landing', 'menu', 'select', 'playing', 'paused', 'gameover'
  mode: 'vs-ai', // 'vs-ai' or 'pvp'
  difficulty: 'medium', // 'easy', 'medium', 'hard'
  
  // Game Objects
  p1: null,
  p2: null,
  ball: null,
  leftGoal: null,
  rightGoal: null,
  
  // Effects
  particles: null,
  shake: null,
  
  // Scoring & Timing
  scoreP1: 0,
  scoreP2: 0,
  timeLeft: 90,
  timerInterval: null,
  
  // Selection Screen State
  p1Selected: 'pikachu',
  p2Selected: 'charmander',
  activeSelector: 'p1', // tracks who is selecting in PvP

  // Key tracking
  keysPressed: {},

  // Game loop controls
  animationFrameId: null,
  goalFreeze: false,
  goalFreezeTimer: 0,

  // Form preferences: pokeName -> boolean (whether to use evolved form if unlocked)
  evoPreferences: {},

  isPokemonEvolvedActive(poke) {
    const hasEvolved = window.SolanaWallet && window.SolanaWallet.connected && window.SolanaWallet.hasEvolved(poke);
    if (!hasEvolved) return false;
    // Default to true if evolved, unless explicitly toggled off in preferences
    return Game.evoPreferences[poke] !== false;
  },

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Load evolution preferences
    try {
      const saved = localStorage.getItem('poke_evo_preferences');
      this.evoPreferences = saved ? JSON.parse(saved) : {};
      if (!this.evoPreferences || typeof this.evoPreferences !== 'object') {
        this.evoPreferences = {};
      }
    } catch(e) {
      this.evoPreferences = {};
    }
    
    // Initialize systems
    this.particles = new ParticleSystem();
    window.gameParticles = this.particles; // Expose globally for AI & entities
    this.shake = new ScreenShake();
    
    // Preload stadium image
    this.stadiumImage = new Image();
    this.stadiumImage.src = 'stadium.jpg';
    this.stadiumImageLoaded = false;
    this.stadiumImage.onload = () => {
      this.stadiumImageLoaded = true;
    };
    
    this.setupUIEventListeners();
    this.setupInputListeners();
    this.updateSelectionUI();
  },

  setupUIEventListeners() {
    // Landing Page Navigation
    document.getElementById('landing-play-btn').addEventListener('click', () => {
      this.switchScreen('menu-screen');
      SoundEffects.playKick();
    });

    document.getElementById('hero-play-btn').addEventListener('click', () => {
      this.switchScreen('menu-screen');
      SoundEffects.playKick();
    });

    document.getElementById('back-to-landing-btn').addEventListener('click', () => {
      this.switchScreen('landing-screen');
      SoundEffects.playBounce();
    });

    // Main Menu Navigation
    document.getElementById('mode-vs-ai').addEventListener('click', () => {
      this.mode = 'vs-ai';
      this.activeSelector = 'p1';
      document.getElementById('p2-selection').querySelector('h3').textContent = 'AI RAKİP';
      document.getElementById('ai-settings').style.display = 'flex';
      document.getElementById('hud-p2-label').textContent = 'AI';
      document.getElementById('start-game-btn').textContent = 'SAVAŞI BAŞLAT';
      this.switchScreen('select-screen');
      SoundEffects.playKick();
    });

    document.getElementById('mode-pvp').addEventListener('click', (e) => {
      e.preventDefault();
      if (!window.SolanaWallet || !window.SolanaWallet.connected) {
        alert('Lütfen önce sağ üstteki "Cüzdan Bağla" butonundan Solana cüzdanınızı bağlayın!');
        return;
      }
      this.mode = 'versus';
      this.activeSelector = 'p1';
      document.getElementById('p2-selection').querySelector('h3').textContent = 'RAKİP ARANIYOR';
      document.getElementById('ai-settings').style.display = 'none';
      document.getElementById('start-game-btn').textContent = 'RAKİP ARA';
      this.switchScreen('select-screen');
      SoundEffects.playKick();
    });

    document.getElementById('back-to-menu-btn').addEventListener('click', () => {
      this.switchScreen('menu-screen');
      SoundEffects.playBounce();
    });


    // AI Difficulty select
    const diffBtns = document.querySelectorAll('.diff-btn');
    diffBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        diffBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.difficulty = btn.getAttribute('data-diff');
        SoundEffects.playKick();
      });
    });

    // Start Button
    document.getElementById('start-game-btn').addEventListener('click', () => {
      if (this.mode === 'versus') {
        window.SolanaWallet.startMatchmaking();
      } else {
        this.startGame();
      }
      SoundEffects.playGoal();
    });

    // Pause Controls
    document.getElementById('pause-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.togglePause();
      e.currentTarget.blur();
    });

    document.getElementById('resume-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.togglePause();
      SoundEffects.playKick();
      e.currentTarget.blur();
    });

    // Quit buttons trigger custom modal
    const showQuitConfirm = (fromPlaying) => {
      this.wasPlayingBeforeQuit = fromPlaying;
      if (fromPlaying && this.state === 'playing') {
        this.state = 'paused';
      }
      document.getElementById('quit-confirm-modal').style.display = 'flex';
      SoundEffects.playBounce();
    };

    document.getElementById('quit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      showQuitConfirm(false); // From pause screen
      e.currentTarget.blur();
    });

    document.getElementById('direct-quit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      showQuitConfirm(true); // Direct from gameplay screen
      e.currentTarget.blur();
    });

    // Custom confirmation modal button event handlers
    document.getElementById('quit-confirm-yes-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      document.getElementById('quit-confirm-modal').style.display = 'none';
      this.quitGame();
      SoundEffects.playKick();
      e.currentTarget.blur();
    });

    document.getElementById('quit-confirm-no-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      document.getElementById('quit-confirm-modal').style.display = 'none';
      if (this.wasPlayingBeforeQuit) {
        this.state = 'playing';
      }
      SoundEffects.playBounce();
      e.currentTarget.blur();
    });

    // Sound toggle is handled inline in index.html to guarantee event execution.

    // Game Over actions
    document.getElementById('rematch-btn').addEventListener('click', () => {
      this.startGame();
    });

    document.getElementById('exit-to-menu-btn').addEventListener('click', () => {
      this.switchScreen('menu-screen');
    });
  },

  setupInputListeners() {
    window.addEventListener('keydown', (e) => {
      this.keysPressed[e.code] = true;
      
      // Prevent browser scrolling with space or arrow keys when game is active
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && this.state === 'playing') {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed[e.code] = false;
    });
  },

  switchScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    // Toggle main game header visibility (hidden on landing screen)
    const header = document.querySelector('.game-header');
    if (header) {
      header.style.display = (screenId === 'landing-screen') ? 'none' : 'flex';
    }
    
    // Set Game State
    if (screenId === 'landing-screen') this.state = 'landing';
    else if (screenId === 'menu-screen') this.state = 'menu';
    else if (screenId === 'select-screen') {
      this.state = 'select';
      this.renderRosterGrid();
      this.updateSelectionUI();
    }
    else if (screenId === 'game-screen') this.state = 'playing';
    else if (screenId === 'gameover-screen') this.state = 'gameover';
  },

  updateSelectionUI() {
    const isP1EvolvedUnlocked = window.SolanaWallet && window.SolanaWallet.connected && window.SolanaWallet.hasEvolved(Game.p1Selected);
    const isP1EvolvedActive = Game.isPokemonEvolvedActive(Game.p1Selected);
    
    // AI or second player always matches the default evolution unlock condition (always active if unlocked)
    const isP2Evolved = window.SolanaWallet && window.SolanaWallet.connected && window.SolanaWallet.hasEvolved(this.p2Selected);

    const pokeInfo = {
      pikachu: {
        base: { name: 'Pikachu', desc: 'Hızlı ve elektrik çarpıcı!', special: '⚡ Thunderbolt' },
        evolved: { name: 'Raichu', desc: 'Devasa elektrik hasarı!', special: '⚡ Volt Tackle' }
      },
      charmander: {
        base: { name: 'Charmander', desc: 'Alevli şutların ustası!', special: '🔥 Fire Blast' },
        evolved: { name: 'Charizard', desc: 'Kızgın lav püskürtücü!', special: '🔥 Blast Burn' }
      },
      squirtle: {
        base: { name: 'Squirtle', desc: 'Kaygan ve tazyikli savunma!', special: '💧 Water Gun' },
        evolved: { name: 'Blastoise', desc: 'Çift tazyikli su roketleri!', special: '💧 Hydro Pump' }
      },
      bulbasaur: {
        base: { name: 'Bulbasaur', desc: 'Ağır, dayanıklı ve sarmaşıklı!', special: '🍃 Vine Whip' },
        evolved: { name: 'Venusaur', desc: 'Ormanın dev yaprak koruması!', special: '🍃 Frenzy Plant' }
      },
      eevee: {
        base: { name: 'Eevee', desc: 'Sevimli ama dengeli!', special: '⭐ Swift' },
        evolved: { name: 'Jolteon', desc: 'Yüksek hız ve yıldırım gücü!', special: '⚡ Thunder Fang' }
      },
      gastly: {
        base: { name: 'Gastly', desc: 'Yarı görünmez hayalet şutu!', special: '👻 Night Shade' },
        evolved: { name: 'Gengar', desc: 'Karanlık enerji küresi fırlatıcı!', special: '👻 Shadow Ball' }
      },
      geodude: {
        base: { name: 'Geodude', desc: 'Ağır ve sert kaya savunması!', special: '🪨 Rock Throw' },
        evolved: { name: 'Golem', desc: 'Deprem yaratan sarsıntı darbesi!', special: '🪨 Earthquake' }
      },
      mew: {
        base: { name: 'Mew', desc: 'Efsanevi ve mistik güç!', special: '🔮 Pound' },
        evolved: { name: 'Mewtwo', desc: 'Kozmik zihin gücü patlaması!', special: '🔮 Psystrike' }
      },
      dratini: {
        base: { name: 'Dratini', desc: 'Ejderha rüzgarı koruması!', special: '🐉 Twister' },
        evolved: { name: 'Dragonite', desc: 'Gökten yağan ejderha ateşi!', special: '🐉 Draco Meteor' }
      },
      abra: {
        base: { name: 'Abra', desc: 'Gizemli kaçışların ustası!', special: '🔮 Teleport' },
        evolved: { name: 'Alakazam', desc: 'Geleceği gören akıl kaşıkları!', special: '🔮 Future Sight' }
      }
    };

    // Update Player 1 Showcase
    const p1Data = isP1EvolvedActive ? pokeInfo[Game.p1Selected].evolved : pokeInfo[Game.p1Selected].base;
    document.getElementById('p1-selected-name').textContent = p1Data.name;
    document.getElementById('p1-selected-desc').textContent = p1Data.desc;
    document.getElementById('p1-special-badge').textContent = p1Data.special;
    
    const p1Avatar = document.getElementById('p1-avatar-preview');
    p1Avatar.className = 'poke-avatar-large idle-bounce';
    p1Avatar.style.backgroundImage = `url(${getPokemonSpriteUrl(Game.p1Selected, isP1EvolvedActive)})`;
    p1Avatar.style.backgroundSize = 'contain';
    p1Avatar.style.backgroundRepeat = 'no-repeat';
    p1Avatar.style.backgroundPosition = 'center';

    // Evolve Button logic
    const evolveBtn = document.getElementById('p1-evolve-btn');
    if (evolveBtn) {
      if (window.SolanaWallet && window.SolanaWallet.connected) {
        if (isP1EvolvedUnlocked) {
          if (isP1EvolvedActive) {
            evolveBtn.textContent = 'EVRİM: AKTİF (NORMAL FORMA GEÇ)';
            evolveBtn.className = 'evolve-action-btn completed-toggle';
          } else {
            evolveBtn.textContent = 'EVRİM: DEVRE DIŞI (EVRİM FORMA GEÇ)';
            evolveBtn.className = 'evolve-action-btn completed-toggle-off';
          }
          evolveBtn.disabled = false;
          
          // Dynamically bind toggle preference click behavior
          evolveBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            Game.evoPreferences[Game.p1Selected] = !Game.isPokemonEvolvedActive(Game.p1Selected);
            localStorage.setItem('poke_evo_preferences', JSON.stringify(Game.evoPreferences));
            SoundEffects.playBounce();
            Game.updateSelectionUI();
            Game.renderRosterGrid();
          };
        } else {
          evolveBtn.textContent = 'EVRİMLEŞTİR (1.0 SOL) 🔥';
          evolveBtn.className = 'evolve-action-btn';
          evolveBtn.disabled = false;
          
          // Dynamically bind evolve transaction trigger behavior
          evolveBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.SolanaWallet.evolve(Game.p1Selected);
          };
        }
      } else {
        evolveBtn.textContent = 'Cüzdan Bağla (1.0 SOL)';
        evolveBtn.className = 'evolve-action-btn locked';
        evolveBtn.disabled = true;
        evolveBtn.onclick = null;
      }
    }

    // Update Player 2 Showcase
    const p2Data = isP2Evolved ? pokeInfo[Game.p2Selected].evolved : pokeInfo[Game.p2Selected].base;
    document.getElementById('p2-selected-name').textContent = p2Data.name;
    document.getElementById('p2-selected-desc').textContent = p2Data.desc;
    document.getElementById('p2-special-badge').textContent = p2Data.special;

    const p2Avatar = document.getElementById('p2-avatar-preview');
    p2Avatar.className = 'poke-avatar-large idle-bounce';
    p2Avatar.style.backgroundImage = `url(${getPokemonSpriteUrl(Game.p2Selected, isP2Evolved)})`;
    p2Avatar.style.backgroundSize = 'contain';
    p2Avatar.style.backgroundRepeat = 'no-repeat';
    p2Avatar.style.backgroundPosition = 'center';

    // Update roster cards active highlight
    const cards = document.querySelectorAll('.roster-card');
    cards.forEach(card => {
      const poke = card.getAttribute('data-poke');
      card.classList.remove('active');
      if (poke === Game.p1Selected || poke === Game.p2Selected) {
        card.classList.add('active');
      }
    });
  },

  startGame() {
    this.scoreP1 = 0;
    this.scoreP2 = 0;
    this.timeLeft = 90;
    this.goalFreeze = false;
    this.particles.clear();
    
    const p1Evo = Game.isPokemonEvolvedActive(Game.p1Selected);
    // Opponent evolution state matches Player 1's active evolution state for balance in both AI and Versus modes
    const p2Evo = p1Evo;
    
    // Update HTML HUD names
    document.getElementById('hud-p1-name').textContent = getPokemonDisplayName(this.p1Selected, p1Evo);
    if (this.mode === 'versus') {
      document.getElementById('hud-p2-name').textContent = this.opponentName;
      document.getElementById('hud-p2-label').textContent = this.opponentWallet;
    } else {
      document.getElementById('hud-p2-name').textContent = getPokemonDisplayName(this.p2Selected, p2Evo);
      document.getElementById('hud-p2-label').textContent = 'AI';
    }
    document.getElementById('score-p1').textContent = '0';
    document.getElementById('score-p2').textContent = '0';
    document.getElementById('timer').textContent = this.timeLeft;

    // Initialize Game Entities
    this.p1 = new PokemonPlayer(220, 360, this.p1Selected, 'left', this, p1Evo);
    this.p2 = new PokemonPlayer(804, 360, this.p2Selected, 'right', this, p2Evo);
    this.ball = new GameBall(512, 150);
    
    this.leftGoal = new GameGoal('left', 576);
    this.rightGoal = new GameGoal('right', 576);

    this.switchScreen('game-screen');
    this.triggerPrepareToast('HAZIRLANIN...');

    // Start timer interval
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.state === 'playing' && !this.goalFreeze) {
        this.timeLeft--;
        document.getElementById('timer').textContent = this.timeLeft;

        if (this.timeLeft <= 0) {
          this.endGame();
        }
      }
    }, 1000);

    // Cancel old game loop and start new one
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.gameLoop();

    // Focus window to capture keyboard input immediately
    window.focus();
    if (this.canvas) this.canvas.focus();
  },

  triggerPrepareToast(msg) {
    const toast = document.getElementById('action-toast');
    toast.textContent = msg;
    toast.classList.add('show');
    
    this.goalFreeze = true;
    this.goalFreezeTimer = 100; // Freeze for ~1.6s

    // Send action to Client
    if (this.mode === 'versus' && this.isHost) {
      this.sendActionToClient('prepare_toast', { msg: msg });
    }

    setTimeout(() => {
      toast.textContent = "SAVAŞ!";
      SoundEffects.playKick();
      
      if (this.mode === 'versus' && this.isHost) {
        this.sendActionToClient('prepare_toast', { msg: "SAVAŞ!" });
        this.sendActionToClient('sound_kick');
      }

      setTimeout(() => {
        toast.classList.remove('show');
        if (this.mode === 'versus' && this.isHost) {
          this.sendActionToClient('hide_toast');
        }
        this.goalFreeze = false;
      }, 600);
    }, 1200);
  },

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      document.getElementById('pause-overlay').classList.add('active');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      document.getElementById('pause-overlay').classList.remove('active');
    }
  },

  startVersusMatch(opponentName, opponentWallet) {
    this.mode = 'versus';
    this.opponentName = opponentName;
    this.opponentWallet = opponentWallet;
    this.difficulty = 'hard'; // Versus is always hard difficulty

    // Update selection screen player 2 header
    document.getElementById('p2-selection').querySelector('h3').textContent = opponentName;

    // Hide AI zorluk selector
    document.getElementById('ai-settings').style.display = 'none';

    // Transition to select screen
    this.activeSelector = 'p1';
    this.switchScreen('select-screen');
  },

  quitGame() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    document.getElementById('pause-overlay').classList.remove('active');
    document.getElementById('quit-confirm-modal').style.display = 'none';
    
    if (this.mode === 'versus') {
      if (window.SolanaWallet) {
        window.SolanaWallet.cancelMatchmaking();
      }
    } else {
      this.switchScreen('menu-screen');
    }
  },

  endGame() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.state = 'gameover';
    SoundEffects.playGameOver();

    if (this.mode === 'versus' && this.isHost) {
      this.sendActionToClient('game_over');
    }

    // Determine winner text
    let winnerTitle = "BERABERE!";
    let winnerDetail = "Savaşta yenişemediniz.";
    if (this.scoreP1 > this.scoreP2) {
      if (this.mode === 'versus') {
        winnerTitle = this.isHost ? "SAVAŞI KAZANDINIZ!" : "MAĞLUP OLDUNUZ!";
        winnerDetail = this.isHost ? `${this.p1Selected.toUpperCase()} ile zafer kazandınız!` : `${this.p1Selected.toUpperCase()} rakibine yenildiniz.`;
      } else {
        winnerTitle = "SAVAŞI KAZANDINIZ!";
        winnerDetail = `${this.p1Selected.toUpperCase()}, ${this.p2Selected.toUpperCase()} rakibini alt etti!`;
      }
    } else if (this.scoreP2 > this.scoreP1) {
      if (this.mode === 'versus') {
        winnerTitle = this.isHost ? "MAĞLUP OLDUNUZ!" : "SAVAŞI KAZANDINIZ!";
        winnerDetail = this.isHost ? `${this.p2Selected.toUpperCase()} rakibine yenildiniz.` : `${this.p2Selected.toUpperCase()} ile zafer kazandınız!`;
      } else {
        winnerTitle = "AI RAKİP KAZANDI!";
        winnerDetail = `${this.p2Selected.toUpperCase()} botu sizi mağlup etti.`;
      }
    }

    document.getElementById('winner-title').textContent = winnerTitle;
    document.getElementById('winner-detail').textContent = winnerDetail;
    document.getElementById('result-score').textContent = `${this.scoreP1} : ${this.scoreP2}`;
    
    // Mock static stat counter for visual flair
    document.getElementById('result-specials').textContent = Math.floor(Math.random() * 8 + 4) + ' Kez';

    this.switchScreen('gameover-screen');
  },

  // Goal scorer event handler
  scoreGoal(scorer) {
    this.goalFreeze = true;
    this.goalFreezeTimer = 120; // 2 seconds delay

    if (scorer === 'p1') {
      this.scoreP1++;
      document.getElementById('score-p1').textContent = this.scoreP1;
      this.particles.emitGoalConfetti(960, 360, 80); // explode confetti inside right goal mouth
      this.shake.shake(4, 20); // Gentle professional shake rumble

      if (this.mode === 'versus' && this.isHost) {
        this.sendActionToClient('goal_confetti', { x: 960, y: 360, count: 80 });
        this.sendActionToClient('sound_goal');
      }
    } else {
      this.scoreP2++;
      document.getElementById('score-p2').textContent = this.scoreP2;
      this.particles.emitGoalConfetti(64, 360, 80); // explode inside left goal mouth
      this.shake.shake(4, 20);

      if (this.mode === 'versus' && this.isHost) {
        this.sendActionToClient('goal_confetti', { x: 64, y: 360, count: 80 });
        this.sendActionToClient('sound_goal');
      }
    }

    SoundEffects.playGoal();

    // Show Goal Alert banner
    const toast = document.getElementById('action-toast');
    toast.textContent = "GOL!";
    toast.classList.add('show');
    if (this.mode === 'versus' && this.isHost) {
      this.sendActionToClient('prepare_toast', { msg: "GOL!" });
    }

    setTimeout(() => {
      toast.classList.remove('show');
      if (this.mode === 'versus' && this.isHost) {
        this.sendActionToClient('hide_toast');
      }
      this.resetRound();
    }, 1800);
  },

  resetRound() {
    this.p1.pos.x = 220;
    this.p1.pos.y = 455;
    this.p1.vel.x = 0;
    this.p1.vel.y = 0;
    this.p1.energy = 0;
    this.p1.frozen = false;
    this.p1.specialActive = false;

    this.p2.pos.x = 804;
    this.p2.pos.y = 455;
    this.p2.vel.x = 0;
    this.p2.vel.y = 0;
    this.p2.energy = 0;
    this.p2.frozen = false;
    this.p2.specialActive = false;

    this.ball.reset(512, 150);
    this.particles.clear();

    this.triggerPrepareToast('HAZIRLANIN...');
  },

  handleInput() {
    if (this.goalFreeze || this.state !== 'playing') return;

    // Player 1 controls (A/D or Arrows to Move, W/Up to Jump, Q/Shift to Special)
    if (this.keysPressed['KeyA'] || this.keysPressed['ArrowLeft']) this.p1.moveLeft();
    if (this.keysPressed['KeyD'] || this.keysPressed['ArrowRight']) this.p1.moveRight();
    if (this.keysPressed['KeyW'] || this.keysPressed['ArrowUp']) this.p1.jump();
    if (this.keysPressed['KeyQ'] || this.keysPressed['ShiftLeft'] || this.keysPressed['ShiftRight']) {
      this.p1.useSpecial(this.ball, this.p2, this.particles);
    }
  },

  update() {
    this.shake.update();
    this.particles.update();

    if (this.state !== 'playing') return;

    // If Client, just send inputs and skip local physics execution
    if (this.mode === 'versus' && !this.isHost) {
      this.sendInputsToHost();
      return;
    }

    // If goalFreeze is active, block all movement calculations (holds entities in place)
    if (this.goalFreeze) {
      if (this.mode === 'versus' && this.isHost) {
        this.broadcastStateToClient();
      }
      return;
    }

    // Host or Local VS AI runs updates:
    this.handleInput();

    if (this.mode === 'versus' && this.isHost) {
      // Apply remote inputs on Host for Player 2
      if (this.remoteInputs) {
        if (this.remoteInputs.left) this.p2.moveLeft();
        if (this.remoteInputs.right) this.p2.moveRight();
        if (this.remoteInputs.jump) this.p2.jump();
        if (this.remoteInputs.special) {
          this.p2.useSpecial(this.ball, this.p1, this.particles);
        }
      }
    } else {
      // AI
      AI.update(this.p2, this.p1, this.ball, this.difficulty);
    }

    // Entity updates
    this.p1.update(this.particles, this.ball, this.p2);
    this.p2.update(this.particles, this.ball, this.p1);
    
    // Let ball handle wall collision and posts
    this.ball.update(this.particles, this.leftGoal, this.rightGoal);

    // Dynamic collision resolution
    // 1. Player 1 vs Player 2
    Physics.resolveCircleCollision(this.p1, this.p2, 0.4);
    
    // 2. Player 1 vs Ball
    const p1BallCollision = Physics.checkCircleCollision(this.p1, this.ball);
    if (p1BallCollision.collided) {
      Physics.resolveCircleCollision(this.p1, this.ball, this.p1.stats.kickPower);
      SoundEffects.playKick();
      this.shake.shake(3, 10);

      if (this.mode === 'versus' && this.isHost) {
        this.sendActionToClient('sound_kick');
      }
    }

    // 3. Player 2 vs Ball
    const p2BallCollision = Physics.checkCircleCollision(this.p2, this.ball);
    if (p2BallCollision.collided) {
      Physics.resolveCircleCollision(this.p2, this.ball, this.p2.stats.kickPower);
      SoundEffects.playKick();
      this.shake.shake(3, 10);

      if (this.mode === 'versus' && this.isHost) {
        this.sendActionToClient('sound_kick');
      }
    }

    // Check for goal scoring conditions
    if (!this.goalFreeze) {
      if (this.ball.pos.x < (this.leftGoal.x + this.leftGoal.width - 5) && this.ball.pos.y > this.leftGoal.y) {
        this.scoreGoal('p2');
      }
      else if (this.ball.pos.x > (this.rightGoal.x + 5) && this.ball.pos.y > this.rightGoal.y) {
        this.scoreGoal('p1');
      }
    }

    // Host sends game state to client
    if (this.mode === 'versus' && this.isHost) {
      this.broadcastStateToClient();
    }

    // Update Energy Fill UI indicators
    document.getElementById('hud-p1-energy').style.width = `${(this.p1.energy / this.p1.maxEnergy) * 100}%`;
    document.getElementById('hud-p2-energy').style.width = `${(this.p2.energy / this.p2.maxEnergy) * 100}%`;
  },

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    // Apply Screen Shake offset if active
    this.shake.apply(this.ctx);

    // Draw field elements
    this.drawStadium(this.ctx);

    // Draw Goals
    this.leftGoal.draw(this.ctx);
    this.rightGoal.draw(this.ctx);

    // Draw Entities
    this.p1.draw(this.ctx, this.particles);
    this.p2.draw(this.ctx, this.particles);
    this.ball.draw(this.ctx);

    // Draw Effects
    this.particles.draw(this.ctx);

    this.ctx.restore();
  },

  // ==========================================
  // REAL-TIME MULTIPLAYER SYSTEM METHODS
  // ==========================================
  
  startOnlineVersusGame(opponentWallet, opponentPokemon, opponentEvolved) {
    this.mode = 'versus';
    this.opponentWallet = opponentWallet;
    this.opponentName = opponentWallet.substring(0, 4) + '...' + opponentWallet.substring(opponentWallet.length - 4);
    this.p2Selected = opponentPokemon;
    this.opponentEvolved = opponentEvolved;
    this.isHost = SolanaWallet.isHost;

    // Reset score and state
    this.scoreP1 = 0;
    this.scoreP2 = 0;
    this.timeLeft = 90;
    this.goalFreeze = false;
    this.particles.clear();
    
    const p1Evo = this.isPokemonEvolvedActive(this.p1Selected);
    const p2Evo = opponentEvolved;
    
    // Update HTML HUD names
    document.getElementById('hud-p1-name').textContent = getPokemonDisplayName(this.p1Selected, p1Evo);
    document.getElementById('hud-p2-name').textContent = this.opponentName;
    document.getElementById('hud-p2-label').textContent = opponentWallet.substring(0, 8) + '...';
    
    document.getElementById('score-p1').textContent = '0';
    document.getElementById('score-p2').textContent = '0';
    document.getElementById('timer').textContent = this.timeLeft;

    // Initialize Game Entities
    this.p1 = new PokemonPlayer(220, 360, this.p1Selected, 'left', this, p1Evo);
    this.p2 = new PokemonPlayer(804, 360, this.p2Selected, 'right', this, p2Evo);
    this.ball = new GameBall(512, 150);
    
    this.leftGoal = new GameGoal('left', 576);
    this.rightGoal = new GameGoal('right', 576);

    this.switchScreen('game-screen');
    this.triggerPrepareToast('HAZIRLANIN...');

    // Host handles timer countdown
    if (this.isHost) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        if (this.state === 'playing' && !this.goalFreeze) {
          this.timeLeft--;
          document.getElementById('timer').textContent = this.timeLeft;

          if (this.timeLeft <= 0) {
            this.endGame();
          }
        }
      }, 1000);
    }

    // Cancel old game loop and start new one
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.gameLoop();

    // Focus window to capture keyboard input immediately
    window.focus();
    if (this.canvas) this.canvas.focus();
  },

  sendInputsToHost() {
    if (SolanaWallet.conn && SolanaWallet.conn.open) {
      const keys = {
        left: this.keysPressed['KeyA'] || this.keysPressed['ArrowLeft'] || false,
        right: this.keysPressed['KeyD'] || this.keysPressed['ArrowRight'] || false,
        jump: this.keysPressed['KeyW'] || this.keysPressed['ArrowUp'] || false,
        special: this.keysPressed['KeyQ'] || this.keysPressed['ShiftLeft'] || this.keysPressed['ShiftRight'] || false
      };
      SolanaWallet.conn.send({
        type: 'input',
        keys: keys
      });
    }
  },

  broadcastStateToClient() {
    if (SolanaWallet.conn && SolanaWallet.conn.open) {
      SolanaWallet.conn.send({
        type: 'state',
        p1: {
          pos: { x: this.p1.pos.x, y: this.p1.pos.y },
          vel: { x: this.p1.vel.x, y: this.p1.vel.y },
          energy: this.p1.energy,
          state: this.p1.state,
          animFrame: this.p1.animFrame,
          specialActive: this.p1.specialActive
        },
        p2: {
          pos: { x: this.p2.pos.x, y: this.p2.pos.y },
          vel: { x: this.p2.vel.x, y: this.p2.vel.y },
          energy: this.p2.energy,
          state: this.p2.state,
          animFrame: this.p2.animFrame,
          specialActive: this.p2.specialActive
        },
        ball: {
          pos: { x: this.ball.pos.x, y: this.ball.pos.y },
          vel: { x: this.ball.vel.x, y: this.ball.vel.y }
        },
        scoreP1: this.scoreP1,
        scoreP2: this.scoreP2,
        timeLeft: this.timeLeft,
        goalFreeze: this.goalFreeze
      });
    }
  },

  sendActionToClient(actionName, data = {}) {
    if (SolanaWallet.conn && SolanaWallet.conn.open) {
      SolanaWallet.conn.send({
        type: 'action',
        action: actionName,
        data: data
      });
    }
  },

  receiveHostState(data) {
    if (!this.p1 || !this.p2 || !this.ball) return;
    
    // Authoritative override
    this.p1.pos.x = data.p1.pos.x;
    this.p1.pos.y = data.p1.pos.y;
    this.p1.vel.x = data.p1.vel.x;
    this.p1.vel.y = data.p1.vel.y;
    this.p1.energy = data.p1.energy;
    this.p1.state = data.p1.state;
    this.p1.animFrame = data.p1.animFrame;
    this.p1.specialActive = data.p1.specialActive;

    this.p2.pos.x = data.p2.pos.x;
    this.p2.pos.y = data.p2.pos.y;
    this.p2.vel.x = data.p2.vel.x;
    this.p2.vel.y = data.p2.vel.y;
    this.p2.energy = data.p2.energy;
    this.p2.state = data.p2.state;
    this.p2.animFrame = data.p2.animFrame;
    this.p2.specialActive = data.p2.specialActive;

    this.ball.pos.x = data.ball.pos.x;
    this.ball.pos.y = data.ball.pos.y;
    this.ball.vel.x = data.ball.vel.x;
    this.ball.vel.y = data.ball.vel.y;

    this.scoreP1 = data.scoreP1;
    this.scoreP2 = data.scoreP2;
    this.timeLeft = data.timeLeft;
    this.goalFreeze = data.goalFreeze;

    // Update UI elements
    document.getElementById('score-p1').textContent = this.scoreP1;
    document.getElementById('score-p2').textContent = this.scoreP2;
    document.getElementById('timer').textContent = this.timeLeft;
    document.getElementById('hud-p1-energy').style.width = `${(this.p1.energy / this.p1.maxEnergy) * 100}%`;
    document.getElementById('hud-p2-energy').style.width = `${(this.p2.energy / this.p2.maxEnergy) * 100}%`;
  },

  receiveClientInput(keys) {
    this.remoteInputs = keys;
  },

  receiveAction(data) {
    if (data.action === 'sound_kick') {
      SoundEffects.playKick();
      this.shake.shake(3, 10);
    }
    else if (data.action === 'sound_goal') {
      SoundEffects.playGoal();
      this.shake.shake(4, 20);
    }
    else if (data.action === 'goal_confetti') {
      this.particles.emitGoalConfetti(data.data.x, data.data.y, data.data.count);
    }
    else if (data.action === 'prepare_toast') {
      const toast = document.getElementById('action-toast');
      toast.textContent = data.data.msg;
      toast.classList.add('show');
    }
    else if (data.action === 'hide_toast') {
      document.getElementById('action-toast').classList.remove('show');
    }
    else if (data.action === 'game_over') {
      this.endGame();
    }
  },

  handleDisconnect() {
    if (this.state === 'playing' || this.state === 'paused') {
      alert("Rakip oyundan ayrıldı veya bağlantısı koptu!");
      this.quitGame();
    }
  },

  drawStadium(ctx) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (this.stadiumImageLoaded) {
      ctx.drawImage(this.stadiumImage, 0, 0, w, h);
      return;
    }

    const groundY = 430;

    // 1. Draw stadium background sky (dark gradient)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#040612');
    skyGrad.addColorStop(0.5, '#0b1129');
    skyGrad.addColorStop(1, '#020308');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Draw spectator stands & glowing neon seats (layered stands)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    
    // Left stand
    ctx.beginPath();
    ctx.moveTo(0, groundY - 120);
    ctx.lineTo(250, groundY);
    ctx.lineTo(0, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right stand
    ctx.beginPath();
    ctx.moveTo(w, groundY - 120);
    ctx.lineTo(w - 250, groundY);
    ctx.lineTo(w, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw little crowd lights (spectator camera flashes)
    const time = Date.now() / 1000;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 25; i++) {
      const flashX = Math.sin(i * 1234 + time * 2) * 450 + w/2;
      const flashY = Math.cos(i * 4567 + time * 3) * 120 + 250;
      if (Math.random() < 0.08) {
        ctx.save();
        ctx.globalAlpha = Math.random() * 0.7 + 0.3;
        ctx.beginPath();
        ctx.arc(flashX, flashY, Math.random() * 3 + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 3. Draw giant stadium pillars & neon lights
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(100, groundY);
    ctx.lineTo(300, 120);
    ctx.lineTo(w - 300, 120);
    ctx.lineTo(w - 100, groundY);
    ctx.stroke();

    // 4. Draw diagonal light beams from floodlights
    ctx.save();
    const beamGradLeft = ctx.createLinearGradient(0, 0, w/2, groundY);
    beamGradLeft.addColorStop(0, 'rgba(6, 182, 212, 0.15)');
    beamGradLeft.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = beamGradLeft;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(150, 0);
    ctx.lineTo(w/2 + 100, groundY);
    ctx.lineTo(w/2 - 200, groundY);
    ctx.closePath();
    ctx.fill();

    const beamGradRight = ctx.createLinearGradient(w, 0, w/2, groundY);
    beamGradRight.addColorStop(0, 'rgba(236, 72, 153, 0.15)');
    beamGradRight.addColorStop(1, 'rgba(236, 72, 153, 0)');
    ctx.fillStyle = beamGradRight;
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w - 150, 0);
    ctx.lineTo(w/2 + 200, groundY);
    ctx.lineTo(w/2 - 100, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 5. Draw pitch ground (dark green Pokemon-style arena floor)
    ctx.fillStyle = '#064e3b'; // dark forest green
    ctx.fillRect(0, groundY, w, h - groundY);

    // Light green checkerboard stripes on grass
    ctx.fillStyle = '#047857'; // emerald green
    const stripeWidth = 60;
    for (let x = 0; x < w; x += stripeWidth * 2) {
      ctx.fillRect(x, groundY, stripeWidth, h - groundY);
    }
    
    // Pitch white/neon border lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();

    // 6. Draw central Poké Ball stadium logo (flattened perspective)
    ctx.save();
    ctx.translate(w / 2, groundY); // center bottom
    ctx.scale(1, 0.25); // flattened perspective
    
    // Poké Ball outer ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 180, 0, Math.PI * 2);
    ctx.stroke();

    // Top half red fill
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.beginPath();
    ctx.arc(0, 0, 180, Math.PI, 0);
    ctx.fill();

    // Bottom half white fill
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(0, 0, 180, 0, Math.PI, 0); // Correct shape drawing
    ctx.fill();

    // Center dividing line
    ctx.beginPath();
    ctx.moveTo(-180, 0);
    ctx.lineTo(180, 0);
    ctx.stroke();

    // Center button circle
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();

    // Side advertisement boards / neon decals
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(90, groundY + 12, 100, 40);
    ctx.fillRect(w - 190, groundY + 12, 100, 40);
    
    // Draw symbols on boards
    ctx.fillStyle = '#eab308';
    ctx.font = 'bold 12px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ ELEC', 140, groundY + 36);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('🔥 FIRE', w - 140, groundY + 36);
  },

  renderRosterGrid() {
    const grid = document.getElementById('roster-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const pokemonList = ['pikachu', 'charmander', 'squirtle', 'bulbasaur', 'eevee', 'gastly', 'geodude', 'mew', 'dratini', 'abra'];

    pokemonList.forEach(poke => {
      const card = document.createElement('div');
      card.className = `roster-card ${this.p1Selected === poke ? 'active' : ''}`;
      card.setAttribute('data-poke', poke);

      const isUnlocked = window.SolanaWallet && window.SolanaWallet.connected && window.SolanaWallet.hasEvolved(poke);
      const isEvolvedActive = Game.isPokemonEvolvedActive(poke);
      const elementClass = this.getElementClass(poke);

      // Get correct display name and capitalize it (Sentence Case)
      const rawDisplayName = getPokemonDisplayName(poke, isEvolvedActive);
      const displayName = rawDisplayName.charAt(0).toUpperCase() + rawDisplayName.slice(1).toLowerCase();

      card.innerHTML = `
        <div class="card-glow ${elementClass}"></div>
        <div class="poke-sprite-thumb" style="background-image: url(${getPokemonSpriteUrl(poke, isEvolvedActive)})"></div>
        <span class="poke-name font-outfit">${displayName}</span>
        ${isUnlocked ? `<span class="evolved-badge ${isEvolvedActive ? 'active' : 'inactive'}">EVO</span>` : ''}
      `;

      card.addEventListener('click', () => {
        SoundEffects.playKick();
        Game.p1Selected = poke;
        
        document.querySelectorAll('.roster-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const options = pokemonList.filter(p => p !== poke);
        Game.p2Selected = options[Math.floor(Math.random() * options.length)];

        Game.updateSelectionUI();
      });

      grid.appendChild(card);
    });
  },

  getElementClass(poke) {
    const mapping = {
      pikachu: 'electric',
      charmander: 'fire',
      squirtle: 'water',
      bulbasaur: 'grass',
      eevee: 'electric',
      gastly: 'ghost',
      geodude: 'rock',
      mew: 'psychic',
      dratini: 'dragon',
      abra: 'psychic'
    };
    return mapping[poke] || 'normal';
  },

  runEvolutionSequence(type) {
    const overlay = document.getElementById('evolution-overlay');
    const sprite = document.getElementById('evo-avatar-sprite');
    const statusText = document.getElementById('evo-status-text');
    const continueBtn = document.getElementById('evo-continue-btn');
    if (!overlay || !sprite || !statusText || !continueBtn) return;

    // Reset overlay elements
    overlay.style.display = 'flex';
    continueBtn.style.display = 'none';
    sprite.className = 'evo-avatar-sprite';
    
    // Set base sprite image initially
    sprite.style.backgroundImage = `url(${getPokemonSpriteUrl(type, false)})`;
    statusText.textContent = "SOLANA AĞINDAN İŞLEM ONAYI BEKLENİYOR...";

    // 1. Play transaction confirm sound
    SoundEffects.playEvoChargingStart();

    // After 1.5s: transaction confirmed, start shaking/charging base Pokemon!
    setTimeout(() => {
      statusText.textContent = `${type.toUpperCase()} İÇİN ENERJİ TOPLANIYOR...`;
      sprite.classList.add('evo-shake');
      
      // Emit particle charging effects
      this.startEvoParticles();
      SoundEffects.playEvoChargingLoop();
    }, 1500);

    // After 3.8s: flash brightness
    setTimeout(() => {
      statusText.textContent = `EVRİM GERÇEKLEŞİYOR!!!`;
      sprite.classList.add('evo-bright');
    }, 3800);

    // After 4.5s: Explosion burst + transform to evolved shape!
    setTimeout(() => {
      this.stopEvoParticles();
      sprite.classList.remove('evo-shake', 'evo-bright');
      sprite.classList.add('evo-burst');
      
       const isEvolved = true;
      sprite.style.backgroundImage = `url(${getPokemonSpriteUrl(type, isEvolved)})`;
      
      // Enable evolved form by default on successful evolution
      this.evoPreferences[type] = true;
      localStorage.setItem('poke_evo_preferences', JSON.stringify(this.evoPreferences));
      
      // Update text
      const evoNames = {
        pikachu: 'RAICHU', charmander: 'CHARIZARD', squirtle: 'BLASTOISE', bulbasaur: 'VENUSAUR',
        eevee: 'JOLTEON', gastly: 'GENGAR', geodude: 'GOLEM', mew: 'MEWTWO', dratini: 'DRAGONITE', abra: 'ALAKAZAM'
      };
      const evolvedName = evoNames[type] || type.toUpperCase();
      statusText.innerHTML = `TEBRİKLER!<br><span style="font-size:1.8rem; color:#f43f5e; font-weight:900;">${evolvedName}</span> BAŞARIYLA KİLİTLENDİ! ⚡`;
      
      SoundEffects.playEvoSuccessFanfare();
      continueBtn.style.display = 'inline-block';
    }, 4500);

    continueBtn.onclick = () => {
      overlay.style.display = 'none';
      Game.renderRosterGrid();
      Game.updateSelectionUI();
      SoundEffects.playKick();
    };
  },

  startEvoParticles() {
    const canvas = document.getElementById('evo-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    this.evoParticles = [];
    this.evoParticlesActive = true;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const animate = () => {
      if (!this.evoParticlesActive) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (Math.random() < 0.4) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 300 + Math.random() * 200;
        this.evoParticles.push({
          x: centerX + Math.cos(angle) * dist,
          y: centerY + Math.sin(angle) * dist,
          vx: -Math.cos(angle) * (3 + Math.random() * 4),
          vy: -Math.sin(angle) * (3 + Math.random() * 4),
          radius: 2 + Math.random() * 4,
          color: `hsl(${250 + Math.random() * 80}, 100%, 70%)`, // Cosmic purples
          alpha: 1,
          decay: 0.006 + Math.random() * 0.005
        });
      }

      for (let i = this.evoParticles.length - 1; i >= 0; i--) {
        const p = this.evoParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        if (p.alpha <= 0) {
          this.evoParticles.splice(i, 1);
        }
      }
      
      this.evoAnimationFrame = requestAnimationFrame(animate);
    };
    
    animate();
  },

  triggerEvoExplosion() {
    const canvas = document.getElementById('evo-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    for (let i = 0; i < 150; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 12;
      this.evoParticles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 6,
        color: i % 2 === 0 ? '#f43f5e' : '#a855f7', // Rose red and purple neon
        alpha: 1,
        decay: 0.01 + Math.random() * 0.015
      });
    }
  },

  stopEvoParticles() {
    this.triggerEvoExplosion();
    setTimeout(() => {
      this.evoParticlesActive = false;
      cancelAnimationFrame(this.evoAnimationFrame);
      const canvas = document.getElementById('evo-canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }, 1500);
  },

  gameLoop() {
    this.update();
    this.draw();
    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }
};

// Start the game initialization when DOM loads
window.addEventListener('DOMContentLoaded', () => {
  window.Game = Game;
  Game.init();
});
