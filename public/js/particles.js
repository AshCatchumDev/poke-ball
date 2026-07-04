// Particle & Effect Engine for Poke Ball
class Particle {
  constructor(x, y, vx, vy, color, radius, maxLife, gravity = 0) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.radius = radius;
    this.maxLife = maxLife;
    this.life = maxLife;
    this.gravity = gravity;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.life--;
  }

  draw(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update();
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      p.draw(ctx);
    }
  }

  clear() {
    this.particles = [];
  }

  // Emits gray dust for movement/landing
  emitDust(x, y, count = 5) {
    for (let i = 0; i < count; i++) {
      const vx = (Math.random() - 0.5) * 1.5;
      const vy = -Math.random() * 0.8 - 0.2;
      const radius = Math.random() * 3 + 1.5;
      const life = Math.random() * 20 + 15;
      this.particles.push(new Particle(x, y, vx, vy, 'rgba(148, 163, 184, 0.4)', radius, life, 0));
    }
  }

  // Emits goal confetti explosion
  emitGoalConfetti(x, y, count = 80) {
    const colors = ['#ec4899', '#06b6d4', '#eab308', '#ef4444', '#3b82f6', '#10b981', '#a855f7'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 2; // blow upwards slightly
      const color = colors[Math.floor(Math.random() * colors.length)];
      const radius = Math.random() * 4 + 2;
      const life = Math.random() * 50 + 40;
      this.particles.push(new Particle(x, y, vx, vy, color, radius, life, 0.15));
    }
  }

  // Emits elemental sparks based on Pokemon type
  emitElementalTrail(x, y, type, count = 2) {
    for (let i = 0; i < count; i++) {
      let color, radius, vx, vy, gravity, life;
      
      switch (type) {
        case 'pikachu': // Electric sparks
        case 'raichu':
        case 'jolteon':
          color = '#eab308';
          vx = (Math.random() - 0.5) * 3;
          vy = (Math.random() - 0.5) * 3;
          radius = Math.random() * 2 + 1;
          gravity = 0;
          life = Math.random() * 15 + 10;
          break;
        case 'charmander': // Fire embers
        case 'charizard':
        case 'dragonite':
          color = ['#ef4444', '#f97316', '#f59e0b'][Math.floor(Math.random() * 3)];
          vx = (Math.random() - 0.5) * 2;
          vy = -Math.random() * 2 - 0.5;
          radius = Math.random() * 3 + 1.5;
          gravity = -0.05; // float upwards
          life = Math.random() * 20 + 15;
          break;
        case 'squirtle': // Water bubbles
        case 'blastoise':
          color = 'rgba(59, 130, 246, 0.6)';
          vx = (Math.random() - 0.5) * 1.5;
          vy = (Math.random() - 0.5) * 1.5;
          radius = Math.random() * 3.5 + 1;
          gravity = 0.02;
          life = Math.random() * 25 + 15;
          break;
        case 'bulbasaur': // Leaves
        case 'venusaur':
          color = '#10b981';
          vx = (Math.random() - 0.5) * 2;
          vy = (Math.random() - 0.5) * 1;
          radius = Math.random() * 2.5 + 1;
          gravity = 0.03;
          life = Math.random() * 30 + 15;
          break;
        case 'eevee': // Swift gold stars
          color = '#f59e0b';
          vx = (Math.random() - 0.5) * 2;
          vy = (Math.random() - 0.5) * 2;
          radius = Math.random() * 2 + 1;
          gravity = 0.01;
          life = Math.random() * 20 + 10;
          break;
        case 'gastly': // Shadow purple sparks
        case 'gengar':
          color = '#a855f7';
          vx = (Math.random() - 0.5) * 2.5;
          vy = (Math.random() - 0.5) * 2.5;
          radius = Math.random() * 3 + 1;
          gravity = -0.02;
          life = Math.random() * 25 + 15;
          break;
        case 'geodude': // Rock/brown dust
        case 'golem':
          color = ['#b45309', '#78350f', '#d97706'][Math.floor(Math.random() * 3)];
          vx = (Math.random() - 0.5) * 3;
          vy = (Math.random() - 0.5) * 2;
          radius = Math.random() * 4 + 1.5;
          gravity = 0.15;
          life = Math.random() * 15 + 15;
          break;
        case 'mew': // Cosmic psychic pink sparks
        case 'mewtwo':
          color = '#ec4899';
          vx = (Math.random() - 0.5) * 2;
          vy = (Math.random() - 0.5) * 2;
          radius = Math.random() * 2.5 + 1;
          gravity = 0;
          life = Math.random() * 20 + 10;
          break;
        case 'abra': // Teleport rose sparks
        case 'alakazam':
          color = '#f43f5e';
          vx = (Math.random() - 0.5) * 3;
          vy = (Math.random() - 0.5) * 3;
          radius = Math.random() * 2 + 1;
          gravity = 0;
          life = Math.random() * 15 + 10;
          break;
        case 'dratini': // Dragon aura
          color = '#60a5fa';
          vx = (Math.random() - 0.5) * 2.5;
          vy = (Math.random() - 0.5) * 1.5;
          radius = Math.random() * 3 + 1;
          gravity = 0.01;
          life = Math.random() * 20 + 15;
          break;
      }
      
      this.particles.push(new Particle(x, y, vx, vy, color, radius, life, gravity));
    }
  }

  // Giant blast for special ability activation
  emitSpecialActivation(x, y, type) {
    let color, count = 35;
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
    color = typeColors[type] || '#ffffff';

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const radius = Math.random() * 3 + 2;
      const life = Math.random() * 25 + 20;
      this.particles.push(new Particle(x, y, vx, vy, color, radius, life, 0));
    }
  }
}

// Screen Shake helper
class ScreenShake {
  constructor() {
    this.intensity = 0;
    this.duration = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  shake(intensity, duration) {
    this.intensity = intensity;
    this.duration = duration;
  }

  update() {
    if (this.duration > 0) {
      this.offsetX = (Math.random() - 0.5) * this.intensity;
      this.offsetY = (Math.random() - 0.5) * this.intensity;
      this.duration--;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }

  apply(ctx) {
    // Disabled to prevent screen shifting and edge distortions as requested
  }
}
