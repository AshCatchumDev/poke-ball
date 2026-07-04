// Global helper to fetch sprite artwork from PokeAPI
function getPokemonSpriteUrl(type, isEvolved = false) {
  // Pokedex mapping
  const dex = {
    pikachu: { base: 25, evolved: 26 },
    charmander: { base: 4, evolved: 6 },
    squirtle: { base: 7, evolved: 9 },
    bulbasaur: { base: 1, evolved: 3 },
    eevee: { base: 133, evolved: 135 },
    gastly: { base: 92, evolved: 94 },
    geodude: { base: 74, evolved: 76 },
    mew: { base: 151, evolved: 150 },
    dratini: { base: 147, evolved: 149 },
    abra: { base: 63, evolved: 65 }
  };
  
  const entry = dex[type];
  if (!entry) return '';
  const num = isEvolved ? entry.evolved : entry.base;
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${num}.png`;
}

// Global helper to get display name of Pokemon
function getPokemonDisplayName(type, isEvolved = false) {
  const evoNames = {
    pikachu: 'RAICHU', charmander: 'CHARIZARD', squirtle: 'BLASTOISE', bulbasaur: 'VENUSAUR',
    eevee: 'JOLTEON', gastly: 'GENGAR', geodude: 'GOLEM', mew: 'MEWTWO', dratini: 'DRAGONITE', abra: 'ALAKAZAM'
  };
  if (isEvolved && evoNames[type]) {
    return evoNames[type];
  }
  return type.toUpperCase();
}

// Game Entities for Poke Ball
class GameGoal {
  constructor(side, canvasHeight) {
    this.side = side; // 'left' or 'right'
    this.width = 105;
    this.height = 220;
    this.y = 210; // Aligns with the hedge/stadium divider boundary in stadium.jpg, bottom is at y=430
    
    if (side === 'left') {
      this.x = 20;
    } else {
      this.x = 1024 - 20 - this.width; // canvasWidth is 1024
    }

    // Hitbox for the crossbar (rebound box)
    this.crossbar = {
      x: this.x,
      y: this.y - 10,
      width: this.width,
      height: 15
    };

    // Hitbox for the vertical post (placed at the back of the net so goal mouth is open)
    this.post = {
      x: side === 'left' ? this.x : this.x + this.width - 10,
      y: this.y,
      width: 10,
      height: this.height
    };
  }

  draw(ctx) {
    ctx.save();
    
    // 1. Net background (slightly darkened semi-transparent slate to define the net area)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.beginPath();
    ctx.rect(this.x, this.y, this.width, this.height);
    ctx.fill();

    // 2. High-tech net grid (glowing grid lines)
    ctx.strokeStyle = this.side === 'left' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)';
    ctx.lineWidth = 1.5;
    const cols = 6;
    const rows = 5;
    
    // Horizontal grid lines
    for (let i = 1; i < rows; i++) {
      const yOffset = this.y + (this.height / rows) * i;
      ctx.beginPath();
      ctx.moveTo(this.x, yOffset);
      ctx.lineTo(this.x + this.width, yOffset);
      ctx.stroke();
    }
    
    // Vertical grid lines
    for (let i = 1; i < cols; i++) {
      const xOffset = this.x + (this.width / cols) * i;
      ctx.beginPath();
      ctx.moveTo(xOffset, this.y);
      ctx.lineTo(xOffset, this.y + this.height);
      ctx.stroke();
    }

    // 3. Thick metallic frame (silver-grey stadium metal)
    ctx.strokeStyle = '#64748b'; // slate-500
    ctx.fillStyle = '#334155'; // slate-700
    ctx.lineWidth = 3;
    
    // Crossbar
    ctx.beginPath();
    ctx.roundRect(this.x - 2, this.y - 8, this.width + 4, 10, 3);
    ctx.fill();
    ctx.stroke();

    // Outer support posts (back post against the wall)
    ctx.beginPath();
    const backPostX = this.side === 'left' ? this.x : this.x + this.width - 6;
    ctx.roundRect(backPostX, this.y, 6, this.height, 2);
    ctx.fill();
    ctx.stroke();

    // 4. Glowing Neon LED strips on the front vertical post (goalmouth entry)
    ctx.save();
    const frontPostX = this.side === 'left' ? this.x + this.width - 8 : this.x;
    const glowColor = this.side === 'left' ? '#ef4444' : '#3b82f6';
    
    // LED backing
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(frontPostX, this.y, 8, this.height);
    
    // Glowing LED core
    ctx.shadowBlur = 12;
    ctx.shadowColor = glowColor;
    ctx.fillStyle = glowColor;
    ctx.fillRect(frontPostX + 2, this.y + 2, 4, this.height - 4);
    ctx.restore();

  }
}

class PokemonPlayer {
  constructor(x, y, type, side, config, isEvolved = false) {
    this.type = type; 
    this.side = side; // 'left' or 'right'
    this.facing = side === 'left' ? 1 : -1;
    this.isPlayer = true;
    this.config = config; // shared configurations
    this.isEvolved = isEvolved;

    // Character stats configuration
    this.stats = this.getStatsByType(type, isEvolved);
    
    // Physics radius: evolved forms are slightly larger (base 70, evolved 75)
    this.radius = isEvolved ? 75 : 70;
    
    // Position starts exactly touching the ground (ground height is 430)
    this.pos = new Physics.Vector2D(x, 430 - this.radius);
    this.vel = new Physics.Vector2D(0, 0);

    // Jump and movement variables
    this.groundY = 430 - this.radius;
    this.isGrounded = true;

    // Special power bar
    this.energy = 0;
    this.maxEnergy = 100;
    this.energyRechargeRate = 0.28; // rate per frame (~17% per second, 40% faster)
    this.specialActive = false;
    this.specialTimer = 0;
    this.specialMaxDuration = 100; // in frames (about 1.6s)

    // Frozen state (Pikachu ability target)
    this.frozen = false;
    this.frozenTimer = 0;

    // Water jet push back force (Squirtle target)
    this.pushVelocity = 0;

    // Load PokeAPI Official Artwork
    this.image = new Image();
    this.image.src = this.getSpriteUrl(type);
    this.imageLoaded = false;
    this.image.onload = () => {
      this.imageLoaded = true;
    };
  }

  getSpriteUrl(type) {
    return getPokemonSpriteUrl(type, this.isEvolved);
  }

  getStatsByType(type, isEvolved = false) {
    const baseStats = {
      pikachu: { speed: 6.8, jumpPower: 11.5, kickPower: 1.0, color: '#eab308', sizeMultiplier: 1.05 },
      charmander: { speed: 5.5, jumpPower: 10.5, kickPower: 1.35, color: '#ef4444', sizeMultiplier: 1.0 },
      squirtle: { speed: 6.0, jumpPower: 11.0, kickPower: 1.05, color: '#3b82f6', sizeMultiplier: 1.0 },
      bulbasaur: { speed: 5.2, jumpPower: 9.8, kickPower: 1.2, color: '#10b981', sizeMultiplier: 0.95 },
      eevee: { speed: 6.0, jumpPower: 10.5, kickPower: 1.1, color: '#d97706', sizeMultiplier: 1.0 },
      gastly: { speed: 6.5, jumpPower: 11.2, kickPower: 1.0, color: '#a855f7', sizeMultiplier: 1.05 },
      geodude: { speed: 4.8, jumpPower: 9.0, kickPower: 1.4, color: '#64748b', sizeMultiplier: 1.0 },
      mew: { speed: 6.3, jumpPower: 11.0, kickPower: 1.15, color: '#ec4899', sizeMultiplier: 1.1 },
      dratini: { speed: 5.8, jumpPower: 10.2, kickPower: 1.25, color: '#3b82f6', sizeMultiplier: 1.1 },
      abra: { speed: 6.2, jumpPower: 10.8, kickPower: 1.05, color: '#fbbf24', sizeMultiplier: 1.0 }
    };

    const evolvedStats = {
      pikachu: { speed: 8.5, jumpPower: 14.0, kickPower: 1.2, color: '#fcd34d', sizeMultiplier: 1.2 }, // Raichu
      charmander: { speed: 7.5, jumpPower: 13.0, kickPower: 1.7, color: '#ef4444', sizeMultiplier: 1.45 }, // Charizard
      squirtle: { speed: 7.8, jumpPower: 13.5, kickPower: 1.3, color: '#60a5fa', sizeMultiplier: 1.35, invertFacing: true }, // Blastoise
      bulbasaur: { speed: 6.8, jumpPower: 12.0, kickPower: 1.5, color: '#34d399', sizeMultiplier: 1.25 }, // Venusaur
      eevee: { speed: 8.2, jumpPower: 13.0, kickPower: 1.35, color: '#fbbf24', sizeMultiplier: 1.2 }, // Jolteon
      gastly: { speed: 8.0, jumpPower: 14.0, kickPower: 1.25, color: '#c084fc', sizeMultiplier: 1.3 }, // Gengar
      geodude: { speed: 6.2, jumpPower: 11.0, kickPower: 1.85, color: '#cbd5e1', sizeMultiplier: 1.35 }, // Golem
      mew: { speed: 8.0, jumpPower: 13.8, kickPower: 1.5, color: '#f472b6', sizeMultiplier: 1.4 }, // Mewtwo
      dratini: { speed: 7.6, jumpPower: 12.8, kickPower: 1.6, color: '#93c5fd', sizeMultiplier: 1.5 }, // Dragonite
      abra: { speed: 8.0, jumpPower: 13.5, kickPower: 1.3, color: '#fcd34d', sizeMultiplier: 1.25 } // Alakazam
    };

    const stats = isEvolved ? evolvedStats[type] : baseStats[type];
    return stats || { speed: 5.5, jumpPower: 10.5, kickPower: 1.0, color: '#ffffff', sizeMultiplier: 1.0 };
  }

  moveLeft() {
    if (this.frozen) return;
    this.vel.x = -this.stats.speed;
    this.facing = -1;
  }

  moveRight() {
    if (this.frozen) return;
    this.vel.x = this.stats.speed;
    this.facing = 1;
  }

  jump() {
    if (this.frozen) return;
    if (this.isGrounded) {
      this.vel.y = -this.stats.jumpPower;
      this.isGrounded = false;
      SoundEffects.playJump();
    }
  }

  useSpecial(ball, opponent, particleSystem) {
    if (this.energy < this.maxEnergy || this.specialActive || this.frozen) return;
    
    this.energy = 0;
    this.specialActive = true;
    this.specialTimer = this.specialMaxDuration;

    SoundEffects.playSpecial(this.type);
    particleSystem.emitSpecialActivation(this.pos.x, this.pos.y, this.type);

    // Initialize Guided Strike on the ball
    ball.guidedToGoal = true;
    ball.guidedType = this.type;
    ball.guidedTargetX = this.side === 'left' ? 950 : 74;
    ball.guidedTargetY = 240 + Math.random() * 140; // Random height within open net mouth (y=210 to y=430)

    // Briefly freeze the opponent for tactical advantage & visual impact
    opponent.freeze(50);
  }

  freeze(duration) {
    this.frozen = true;
    this.frozenTimer = duration;
    this.vel.x = 0;
  }

  update(particleSystem, ball, opponent) {
    // Recharge special meter
    if (this.energy < this.maxEnergy && !this.specialActive) {
      this.energy = Math.min(this.maxEnergy, this.energy + this.energyRechargeRate);
    }

    // Frozen state countdown
    if (this.frozen) {
      this.frozenTimer--;
      if (this.frozenTimer <= 0) {
        this.frozen = false;
      }
    }

    // Special duration countdown
    if (this.specialActive) {
      this.specialTimer--;
      
      // Squirtle continuous special logic: Push water jet
      if (this.type === 'squirtle' && this.specialTimer % 2 === 0) {
        // Spray water particles facing direction
        const sprayX = this.pos.x + this.facing * 50;
        const sprayY = this.pos.y - 10;
        particleSystem.emitElementalTrail(sprayX, sprayY, 'squirtle', 3);

        // Check if ball is in spray path (horizontal sweep)
        const dxBall = ball.pos.x - this.pos.x;
        const dyBall = Math.abs(ball.pos.y - this.pos.y);
        
        if (Math.sign(dxBall) === this.facing && Math.abs(dxBall) < 400 && dyBall < 100) {
          ball.vel.x += this.facing * 0.6;
          ball.vel.y -= 0.1;
        }

        // Check if opponent is in spray path
        const dxOpp = opponent.pos.x - this.pos.x;
        const dyOpp = Math.abs(opponent.pos.y - this.pos.y);
        if (Math.sign(dxOpp) === this.facing && Math.abs(dxOpp) < 350 && dyOpp < 100) {
          opponent.pos.x += this.facing * 3.5;
        }
      }

      if (this.specialTimer <= 0) {
        this.specialActive = false;
        this.stats.speed = this.getStatsByType(this.type, this.isEvolved).speed;
      }
    }

    // Physics movement
    if (!this.frozen) {
      this.pos.x += this.vel.x;
    }
    this.pos.y += this.vel.y;

    // Apply gravity
    if (!this.isGrounded) {
      this.vel.y += Physics.GRAVITY;
      if (this.vel.y > Physics.TERMINAL_VELOCITY) this.vel.y = Physics.TERMINAL_VELOCITY;
    }

    // Ground collision
    if (this.pos.y >= this.groundY) {
      this.pos.y = this.groundY;
      this.vel.y = 0;
      if (!this.isGrounded) {
        this.isGrounded = true;
        particleSystem.emitDust(this.pos.x, this.pos.y + this.radius - 10, 8);
      }
    } else {
      // If player is pushed into the air by collision or force, update grounded state
      this.isGrounded = false;
    }

    // Ceiling boundary collision (keep player fully on screen)
    if (this.pos.y < this.radius) {
      this.pos.y = this.radius;
      this.vel.y = 0;
    }

    // Wall collision (keep within pitch bounds and out of goals)
    const minX = 90;
    const maxX = 1024 - 90;
    
    // Simple side walls
    if (this.pos.x < minX) {
      this.pos.x = minX;
      this.vel.x = 0;
    }
    if (this.pos.x > maxX) {
      this.pos.x = maxX;
      this.vel.x = 0;
    }

    // Prevent passing through goal posts
    // Left goal post is at x = 125
    if (this.pos.x < 130 && this.pos.y > 210) {
      this.pos.x = 130;
      this.vel.x = 0;
    }
    // Right goal post is at x = 899
    if (this.pos.x > 894 && this.pos.y > 210) {
      this.pos.x = 894;
      this.vel.x = 0;
    }

    // Apply drag/friction
    this.vel.x *= Physics.FRICTION;
    if (Math.abs(this.vel.x) < 0.1) this.vel.x = 0;

    // Dust particles on running
    if (this.isGrounded && Math.abs(this.vel.x) > 1 && Math.random() < 0.15) {
      particleSystem.emitDust(this.pos.x - Math.sign(this.vel.x) * 20, this.pos.y + this.radius - 10, 1);
    }
  }

  draw(ctx, particleSystem) {
    ctx.save();
    
    // Electric charging sparks if full energy
    if (this.energy >= this.maxEnergy && Math.random() < 0.12) {
      particleSystem.emitElementalTrail(this.pos.x, this.pos.y, this.type, 1);
    }

    // Stunned/Frozen visual effect
    if (this.frozen) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#06b6d4';
      // Draw ice block outline
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Character drawing: Official Artwork
    ctx.translate(this.pos.x, this.pos.y);
    
    let scaleX = -this.facing;
    if (this.stats.invertFacing) {
      scaleX = this.facing;
    }
    ctx.scale(scaleX, 1);

    // Glowing element indicators when special active
    if (this.specialActive) {
      ctx.shadowBlur = 30;
      ctx.shadowColor = this.stats.color;
    }

    // Render image
    if (this.imageLoaded) {
      // Draw official sprite centered (size is slightly larger than the physics hitbox circle radius)
      const sizeMultiplier = this.stats.sizeMultiplier || 1.0;
      const size = this.radius * 2.2 * sizeMultiplier;
      ctx.drawImage(this.image, -size / 2, -size / 2, size, size);
    } else {
      // Fallback simple colored circle while loading
      ctx.fillStyle = this.stats.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

class GameBall {
  constructor(x, y) {
    this.pos = new Physics.Vector2D(x, y);
    this.vel = new Physics.Vector2D(0, 0);
    this.radius = 22;
    this.isPlayer = false;

    // Ball status effects (e.g. fire/lightning tail)
    this.isAflame = false;
    this.flameColor = '#ef4444';
    this.rotation = 0;

    // Guided strike variables
    this.guidedToGoal = false;
    this.guidedType = '';
    this.guidedTargetX = 0;
    this.guidedTargetY = 0;
  }

  update(particleSystem, leftGoal, rightGoal) {
    if (this.guidedToGoal) {
      const dx = this.guidedTargetX - this.pos.x;
      const dy = this.guidedTargetY - this.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const speed = 25;
      if (dist > speed) {
        this.vel.x = (dx / dist) * speed;
        this.vel.y = (dy / dist) * speed;
      } else {
        this.vel.x = dx;
        this.vel.y = dy;
        this.guidedToGoal = false;
      }

      this.pos.add(this.vel);
      this.rotation += this.vel.x * 0.08;

      // Emit themed special strike trail particles
      particleSystem.emitElementalTrail(this.pos.x, this.pos.y, this.guidedType, 6);
      return;
    }

    // Apply gravity
    this.vel.y += Physics.GRAVITY * 0.75; // Ball has slightly less gravity than players
    
    // Limit speed
    const maxSpeed = 22;
    const speed = this.vel.mag();
    if (speed > maxSpeed) {
      this.vel.normalize().mult(maxSpeed);
    }

    // Move ball
    this.pos.add(this.vel);

    // Apply rotation based on x speed
    this.rotation += this.vel.x * 0.05;

    // Ground bounce
    const groundY = 430 - this.radius; // ground y coordinate minus radius (aligns with red/blue field in stadium.jpg)
    if (this.pos.y >= groundY) {
      this.pos.y = groundY;
      this.vel.y = -Math.abs(this.vel.y) * Physics.BALL_BOUNCE;
      this.vel.x *= 0.98; // ground friction
      
      if (Math.abs(this.vel.y) > 1.5) {
        SoundEffects.playBounce();
      }
    }

    // Ceiling bounce
    if (this.pos.y < this.radius) {
      this.pos.y = this.radius;
      this.vel.y = Math.abs(this.vel.y) * Physics.BALL_BOUNCE;
    }

    // Left and right walls bounce (excluding goal mouths)
    const leftWallX = 20 + this.radius;
    const rightWallX = 1024 - 20 - this.radius;

    // Left Goal area limits
    const leftGoalTop = leftGoal.y;
    const leftGoalBot = leftGoal.y + leftGoal.height;

    // If ball is above the left goal, bounce off the left wall
    if (this.pos.y < leftGoalTop || this.pos.y > leftGoalBot) {
      if (this.pos.x < leftWallX) {
        this.pos.x = leftWallX;
        this.vel.x = Math.abs(this.vel.x) * Physics.BALL_BOUNCE;
        SoundEffects.playBounce();
      }
    } else {
      // Inside left goal mouth: check outer limits
      if (this.pos.x < 20 + this.radius) {
        this.pos.x = 20 + this.radius;
        this.vel.x = Math.abs(this.vel.x) * 0.5; // less bounce inside net
      }
    }

    // Right Goal area limits
    const rightGoalTop = rightGoal.y;
    const rightGoalBot = rightGoal.y + rightGoal.height;

    // If ball is above the right goal, bounce off the right wall
    if (this.pos.y < rightGoalTop || this.pos.y > rightGoalBot) {
      if (this.pos.x > rightWallX) {
        this.pos.x = rightWallX;
        this.vel.x = -Math.abs(this.vel.x) * Physics.BALL_BOUNCE;
        SoundEffects.playBounce();
      }
    } else {
      // Inside right goal mouth
      if (this.pos.x > 1024 - 20 - this.radius) {
        this.pos.x = 1024 - 20 - this.radius;
        this.vel.x = -Math.abs(this.vel.x) * 0.5;
      }
    }

    // Crossbars & Posts collision resolution
    // Resolve collision with Left Goal vertical post & crossbar
    const hitLeftCross = Physics.resolveAABBCollision(leftGoal.crossbar, this, Physics.BALL_BOUNCE);
    const hitLeftPost = Physics.resolveAABBCollision(leftGoal.post, this, Physics.BALL_BOUNCE);
    
    // Resolve collision with Right Goal vertical post & crossbar
    const hitRightCross = Physics.resolveAABBCollision(rightGoal.crossbar, this, Physics.BALL_BOUNCE);
    const hitRightPost = Physics.resolveAABBCollision(rightGoal.post, this, Physics.BALL_BOUNCE);

    if (hitLeftCross || hitLeftPost || hitRightCross || hitRightPost) {
      SoundEffects.playBounce();
    }

    // Flame trail logic if high speed or special activated
    if (this.vel.mag() > 8 || this.isAflame) {
      particleSystem.emitElementalTrail(this.pos.x, this.pos.y, this.isAflame ? (this.flameColor === '#ef4444' ? 'charmander' : (this.flameColor === '#eab308' ? 'pikachu' : 'bulbasaur')) : 'bulbasaur', 2);
    }

    // Extinguish ball if moving slow
    if (this.vel.mag() < 3) {
      this.isAflame = false;
    }
  }

  reset(x, y) {
    this.pos.x = x;
    this.pos.y = y;
    this.vel.x = 0;
    this.vel.y = 0;
    this.isAflame = false;
    this.guidedToGoal = false;
  }

  draw(ctx) {
    ctx.save();
    
    // Draw ball glow shadow if active or guided
    if (this.guidedToGoal) {
      ctx.shadowBlur = 35;
      const typeColors = {
        pikachu: '#eab308', raichu: '#eab308', jolteon: '#eab308',
        charmander: '#ef4444', charizard: '#ef4444', dragonite: '#ef4444',
        squirtle: '#3b82f6', blastoise: '#3b82f6',
        bulbasaur: '#10b981', venusaur: '#10b981',
        eevee: '#f59e0b',
        gastly: '#a855f7', gengar: '#a855f7',
        geodude: '#b45309', golem: '#b45309',
        mew: '#ec4899', mewtwo: '#ec4899',
        abra: '#f43f5e', alakazam: '#f43f5e',
        dratini: '#60a5fa'
      };
      ctx.shadowColor = typeColors[this.guidedType] || '#ffffff';
    } else {
      ctx.shadowBlur = this.isAflame ? 20 : 6;
      ctx.shadowColor = this.isAflame ? this.flameColor : 'rgba(255, 255, 255, 0.4)';
    }

    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.rotation);

    // Draw Poke Ball design
    // Outer circle
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Red top half
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, Math.PI, 0);
    ctx.fill();

    // Middle black dividing line
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-this.radius, -2, this.radius * 2, 4);

    // Middle button circle
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
