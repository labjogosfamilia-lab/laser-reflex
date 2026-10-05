/**
 * LASER REFLEX - Jogo de Sobrevivência Arcade Neon
 * Desenvolvido em HTML5 Canvas + Web Audio API
 */

// --- CONFIGURAÇÃO E CONSTANTES ---
const VIRTUAL_WIDTH = 900;
const VIRTUAL_HEIGHT = 600;

const STATE = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  GAMEOVER: 'GAMEOVER',
  SHOP: 'SHOP',
  PHASE_SHOP: 'PHASE_SHOP'
};

// Dicionário de Skins da Loja
const SKINS = {
  cyan: { name: 'Ciano Neon', color: '#00f0ff', price: 0 },
  gold: { name: 'Ouro Solar', color: '#ffe600', price: 200 },
  crimson: { name: 'Fúria Carmesim', color: '#ff0055', price: 250 },
  emerald: { name: 'Matrix Esmeralda', color: '#00ffa3', price: 300 },
  purple: { name: 'Hiperdrive Roxo', color: '#b537f2', price: 350 },
  sans: { name: 'Olho de Sans 💀', color: '#00f0ff', price: 500 }
};

// Dicionário de Melhorias Roguelite da Rodada (Nível 1 a 5 - Resetam ao morrer)
const UPGRADES_CONFIG = {
  energyMagnet: {
    id: 'energyMagnet',
    name: 'Ímã de Energia',
    icon: '🧲',
    maxLevel: 5,
    basePrice: 70,
    priceMultiplier: 1.35,
    getDesc: (lvl) => {
      if (lvl === 0) return 'Atrai orbes da arena (Compre o Nível 1 para ativar)';
      const radius = 60 + lvl * 32;
      return `Raio magnético: ${radius}px | Velocidade: +${lvl * 25}%`;
    }
  },
  dashTurbine: {
    id: 'dashTurbine',
    name: 'Turbina de Dash',
    icon: '⚡',
    maxLevel: 5,
    basePrice: 80,
    priceMultiplier: 1.35,
    getDesc: (lvl) => {
      const cd = Math.max(0.70, 2.0 - lvl * 0.26);
      return `Tempo de recarga do Dash reduzido para ${cd.toFixed(2)}s`;
    }
  },
  shieldCore: {
    id: 'shieldCore',
    name: 'Núcleo de Escudo',
    icon: '🛡️',
    maxLevel: 5,
    basePrice: 90,
    priceMultiplier: 1.40,
    getDesc: (lvl) => {
      if (lvl === 0) return 'Restaura Escudo a cada nova fase (Bloqueado)';
      const invul = (1.6 + lvl * 0.20).toFixed(2);
      return `Gera Escudo em toda fase + Imunidade pós-dano de ${invul}s`;
    }
  },
  creditBoost: {
    id: 'creditBoost',
    name: 'Hack de Créditos',
    icon: '🪙',
    maxLevel: 5,
    basePrice: 60,
    priceMultiplier: 1.35,
    getDesc: (lvl) => {
      return `Ganhos de moedas na arena aumentados em +${lvl * 25}%`;
    }
  }
};

function getUpgradePrice(upgradeId, currentLevel) {
  const cfg = UPGRADES_CONFIG[upgradeId];
  if (!cfg || currentLevel >= cfg.maxLevel) return null;
  return Math.round(cfg.basePrice * Math.pow(cfg.priceMultiplier, currentLevel));
}

// --- ÁUDIO PROCEDURAL (Web Audio API) ---
class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playLaserWarning() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(700, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playLaserBlast() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.28);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.28);
  }

  playDash() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(250, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  playTargetLock() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1050, this.ctx.currentTime);
    osc.frequency.setValueAtTime(1350, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.09, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playHit() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  playCollect() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.12, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.15);
    });
  }

  playShieldUp() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    [400, 600, 800, 1000].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.1, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.2);
    });
  }

  playExtraLife() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Arpeggio celestial de cura e vida extra (Fá, Lá, Dó, Mi, Lá agudo)
    const notes = [349.23, 440.00, 523.25, 659.25, 880.00];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.14, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.28);
    });
  }

  playLevelUp() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Fanfarra triunfante em arpeggio com sustentação
    const notes = [392.00, 523.25, 659.25, 783.99, 1046.50]; // Sol, Dó, Mi, Sol, Dó agudo
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.18, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.35);
    });
  }

  playBuy() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.15, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.22);
    });
  }

  playEquip() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playError() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  playShoot() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.16);

    gain.gain.setValueAtTime(0.24, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  playPiercingHit() {
    if (!this.enabled || !this.ctx) return;
    // Impacto perfurante pesado: oscilador agudo decaindo + choque de estilhaço grave
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(1400, this.ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.25);
    gain1.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start();
    osc1.stop(this.ctx.currentTime + 0.25);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(95, this.ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.35);
    gain2.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start();
    osc2.stop(this.ctx.currentTime + 0.35);
  }

  // --- EFEITOS SONOROS DE SANS (UNDERTALE) ---
  playSansMegalovania() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    // O lendário riff de 4 notas de Megalovania: D4, D4, D5, A4, Ab4, G4, F4, D4, F4, G4
    const notes = [
      { f: 293.66, t: 0.00, d: 0.11 }, // D4
      { f: 293.66, t: 0.12, d: 0.11 }, // D4
      { f: 587.33, t: 0.24, d: 0.22 }, // D5
      { f: 440.00, t: 0.48, d: 0.30 }, // A4
      { f: 415.30, t: 0.82, d: 0.18 }, // Ab4
      { f: 392.00, t: 1.04, d: 0.18 }, // G4
      { f: 349.23, t: 1.26, d: 0.18 }, // F4
      { f: 293.66, t: 1.48, d: 0.12 }, // D4
      { f: 349.23, t: 1.62, d: 0.12 }, // F4
      { f: 392.00, t: 1.76, d: 0.25 }  // G4
    ];

    notes.forEach(n => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(0.18, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d);
    });
  }

  playGasterBlasterCharge() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(750, now + 0.35);
    gain.gain.setValueAtTime(0.20, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  playSansSlam() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.20);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.20);
  }
}

const sounds = new SoundController();
window.sounds = sounds;

// --- SISTEMA DE PARTÍCULAS ---
class Particle {
  constructor(x, y, color, vx, vy, life, size) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = vx;
    this.vy = vy;
    this.maxLife = life;
    this.life = life;
    this.size = size;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.life -= dt;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// --- CLASSE DO JOGADOR ---
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 12;
    this.baseSpeed = 240;
    this.vx = 0;
    this.vy = 0;

    // Sistema de 3 Vidas
    this.maxLives = 3;
    this.lives = 3;
    this.invulnerableTimer = 0; // Tempo de imunidade pós-dano
    this.invulnerableDuration = 1.6; // Duração base de imunidade pós-dano
    this.shieldActive = false;  // Escudo bônus
    this.skinColor = '#00f0ff'; // Cor visual da Skin equipada

    // Dash
    this.dashCooldownMax = 2.0; // Segundos
    this.dashCooldownTimer = 0;
    this.isDashing = false;
    this.dashDuration = 0.22;
    this.dashTimer = 0;
    this.dashSpeedMultiplier = 2.8;
    this.dashDirX = 0;
    this.dashDirY = 0;

    // Tiro a Laser (Bala Perfurante - 5s de recarga)
    this.shootCooldownMax = 5.0;
    this.shootCooldownTimer = 0;
    this.isBlueSoul = false;
    this.blueSoulTimer = 0;
    this.slamVx = 0;
    this.slamVy = 0;

    // Rastro visual (Afterimage)
    this.trail = [];
    this.nameTag = null;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.lives = this.maxLives;
    this.invulnerableTimer = 0;
    this.shieldActive = false;
    this.dashCooldownTimer = 0;
    this.shootCooldownTimer = 0;
    this.isDashing = false;
    this.dashTimer = 0;
    this.isBlueSoul = false;
    this.blueSoulTimer = 0;
    this.slamVx = 0;
    this.slamVy = 0;
    this.baseSpeed = 240;
    this.dashSpeedMultiplier = 2.8;
    this.trail = [];
    this.nameTag = null;
  }

  triggerDash(inputX, inputY) {
    if (this.dashCooldownTimer > 0 || this.isDashing) return false;

    // Se o jogador não estiver se movendo, usa o último direcionamento ou para a direita
    let dx = inputX;
    let dy = inputY;
    if (dx === 0 && dy === 0) {
      dx = this.dashDirX || 1;
      dy = this.dashDirY || 0;
    }

    const len = Math.hypot(dx, dy) || 1;
    this.dashDirX = dx / len;
    this.dashDirY = dy / len;

    this.isDashing = true;
    this.dashTimer = this.dashDuration;
    this.dashCooldownTimer = this.dashCooldownMax;

    sounds.playDash();
    return true;
  }

  triggerShoot(aimDirX, aimDirY) {
    if (this.shootCooldownTimer > 0) return null;

    let dx = aimDirX;
    let dy = aimDirY;
    if (dx === undefined || dy === undefined || (dx === 0 && dy === 0)) {
      dx = this.dashDirX || 1;
      dy = this.dashDirY || 0;
    }

    const len = Math.hypot(dx, dy) || 1;
    const dirX = dx / len;
    const dirY = dy / len;

    this.dashDirX = dirX;
    this.dashDirY = dirY;
    this.shootCooldownTimer = this.shootCooldownMax;

    sounds.playShoot();

    // Ponto de saída na ponta frontal do drone
    const spawnDist = this.radius * 1.4;
    return {
      x: this.x + dirX * spawnDist,
      y: this.y + dirY * spawnDist,
      dirX: dirX,
      dirY: dirY
    };
  }

  takePiercingDamage(particles) {
    // Perfura o escudo e armadura! Elimina 1 vida diretamente
    this.lives = Math.max(0, this.lives - 1);
    this.invulnerableTimer = 0.5; // Breve piscar visual
    sounds.playPiercingHit();

    // Partículas densas de impacto perfurante
    if (particles) {
      for (let i = 0; i < 40; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 90 + Math.random() * 220;
        const color = (i % 2 === 0) ? '#ff0055' : '#ffffff';
        particles.push(new Particle(this.x, this.y, color, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.6, 3.5));
      }
    }

    return true;
  }

  takeDamage(particles) {
    if (this.invulnerableTimer > 0 || this.isDashing) {
      return false; // Ileso pelo dash ou imunidade
    }

    // Se possui escudo coletado, consome o escudo sem perder vida
    if (this.shieldActive) {
      this.shieldActive = false;
      this.invulnerableTimer = 1.0;
      sounds.playHit();
      for (let i = 0; i < 25; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 120;
        particles.push(new Particle(this.x, this.y, '#00ffaa', Math.cos(ang) * spd, Math.sin(ang) * spd, 0.5, 3));
      }
      return true;
    }

    this.lives--;
    this.invulnerableTimer = this.invulnerableDuration || 1.6; // Imunidade pós-dano com bônus de melhoria
    sounds.playHit();

    // Partículas de dano
    for (let i = 0; i < 35; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 80 + Math.random() * 200;
      particles.push(new Particle(this.x, this.y, '#ff0055', Math.cos(ang) * spd, Math.sin(ang) * spd, 0.6, 4));
    }

    return true;
  }

  update(dt, inputX, inputY, particles) {
    // Atualiza timers
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= dt;
    }
    if (this.shootCooldownTimer > 0) {
      this.shootCooldownTimer -= dt;
      if (this.shootCooldownTimer < 0) this.shootCooldownTimer = 0;
    }
    if (this.isBlueSoul && this.blueSoulTimer > 0) {
      this.blueSoulTimer -= dt;
      if (this.blueSoulTimer <= 0) this.isBlueSoul = false;
    }

    // Física de Movimento
    if (this.isDashing) {
      this.dashTimer -= dt;
      this.vx = this.dashDirX * this.baseSpeed * this.dashSpeedMultiplier;
      this.vy = this.dashDirY * this.baseSpeed * this.dashSpeedMultiplier;

      // Partículas do Dash
      particles.push(new Particle(
        this.x + (Math.random() - 0.5) * 8,
        this.y + (Math.random() - 0.5) * 8,
        '#00f0ff',
        -this.dashDirX * 80 + (Math.random() - 0.5) * 40,
        -this.dashDirY * 80 + (Math.random() - 0.5) * 40,
        0.3,
        4
      ));

      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    } else {
      const len = Math.hypot(inputX, inputY);
      if (len > 0) {
        this.vx = (inputX / len) * this.baseSpeed;
        this.vy = (inputY / len) * this.baseSpeed;
        this.dashDirX = inputX / len;
        this.dashDirY = inputY / len;
      } else {
        this.vx = 0;
        this.vy = 0;
      }
    }

    // Aplica impulso de telecinese / gravidade (Slam de Sans)
    if (this.slamVx !== 0 || this.slamVy !== 0) {
      this.x += this.slamVx * dt;
      this.y += this.slamVy * dt;
      this.slamVx *= Math.max(0, 1 - 5 * dt);
      this.slamVy *= Math.max(0, 1 - 5 * dt);
      if (Math.abs(this.slamVx) < 5) this.slamVx = 0;
      if (Math.abs(this.slamVy) < 5) this.slamVy = 0;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Limites da Arena (Bordas)
    const margin = this.radius + 6;
    if (this.x < margin) this.x = margin;
    if (this.x > VIRTUAL_WIDTH - margin) this.x = VIRTUAL_WIDTH - margin;
    if (this.y < margin) this.y = margin;
    if (this.y > VIRTUAL_HEIGHT - margin) this.y = VIRTUAL_HEIGHT - margin;

    // Rastro fantasma no Dash
    if (this.isDashing) {
      this.trail.unshift({ x: this.x, y: this.y, alpha: 0.6 });
      if (this.trail.length > 6) this.trail.pop();
    } else if (this.trail.length > 0) {
      this.trail.shift();
    }
  }

  draw(ctx) {
    ctx.save();

    // Desenha rastros do Dash
    for (let t of this.trail) {
      ctx.save();
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = this.skinColor || '#00f0ff';
      ctx.shadowColor = this.skinColor || '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Efeito de piscar quando invulnerável
    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
      ctx.restore();
      return;
    }

    // Escudo Extra Ativo
    if (this.shieldActive) {
      ctx.save();
      ctx.strokeStyle = '#00ffaa';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00ffaa';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Corpo do Jogador (Losango Cibernético / Drone)
    ctx.translate(this.x, this.y);
    const angle = Math.atan2(this.dashDirY, this.dashDirX);
    ctx.rotate(angle);

    ctx.fillStyle = this.isDashing ? '#ffffff' : (this.skinColor || '#00f0ff');
    ctx.shadowColor = this.skinColor || '#00f0ff';
    ctx.shadowBlur = this.isDashing ? 20 : 12;

    // Desenha Nave/Drone
    ctx.beginPath();
    ctx.moveTo(this.radius * 1.3, 0);
    ctx.lineTo(-this.radius, -this.radius * 0.9);
    ctx.lineTo(-this.radius * 0.5, 0);
    ctx.lineTo(-this.radius, this.radius * 0.9);
    ctx.closePath();
    ctx.fill();

    // Núcleo Luminoso Central
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Alma Azul de Undertale (Gravidade de Sans)
    if (this.isBlueSoul) {
      ctx.save();
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#0055ff';
      ctx.shadowBlur = 12;
      ctx.fillText('💙', this.x, this.y - 20);
      ctx.restore();
    }

    // Etiqueta com Nome/ID no Multiplayer X1
    if (this.nameTag) {
      ctx.save();
      const tagY = this.y - this.radius - 13;
      ctx.font = 'bold 10px Orbitron, sans-serif';
      const textWidth = ctx.measureText(this.nameTag).width;
      const tagW = textWidth + 12;
      const tagH = 15;

      ctx.fillStyle = 'rgba(10, 14, 25, 0.85)';
      ctx.strokeStyle = this.skinColor || '#00f0ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(this.x - tagW / 2, tagY - tagH / 2, tagW, tagH, 3);
      } else {
        ctx.rect(this.x - tagW / 2, tagY - tagH / 2, tagW, tagH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.skinColor || '#00f0ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.nameTag, this.x, tagY);
      ctx.restore();
    }
  }
}

// --- CLASSE DO PROJÉTIL A LASER (BALA PERFURANTE) ---
class LaserBullet {
  constructor(options) {
    this.id = options.id || ('b_' + Math.random().toString(36).substr(2, 9));
    this.shooterId = options.shooterId || 'player'; // 'p1', 'p2' ou 'player'
    this.x = options.x;
    this.y = options.y;
    this.prevX = options.x;
    this.prevY = options.y;
    this.dirX = options.dirX;
    this.dirY = options.dirY;
    this.speed = options.speed || 640;
    this.color = options.color || '#00f0ff';
    this.radius = 8;
    this.life = options.life || 2.4;
    this.trail = [];
  }

  update(dt, particles) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x += this.dirX * this.speed * dt;
    this.y += this.dirY * this.speed * dt;
    this.life -= dt;

    // Rastro dinâmico do projétil
    this.trail.unshift({ x: this.x, y: this.y, alpha: 0.85 });
    if (this.trail.length > 6) this.trail.pop();
    for (let t of this.trail) {
      t.alpha -= dt * 3.5;
    }

    // Centelhas sutis ao voar
    if (Math.random() < 0.4 && particles) {
      particles.push(new Particle(
        this.x + (Math.random() - 0.5) * 4,
        this.y + (Math.random() - 0.5) * 4,
        this.color,
        -this.dirX * 50 + (Math.random() - 0.5) * 30,
        -this.dirY * 50 + (Math.random() - 0.5) * 30,
        0.2,
        2.5
      ));
    }
  }

  draw(ctx) {
    ctx.save();

    // Rastro neon
    for (let t of this.trail) {
      if (t.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, t.alpha * 0.6);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.radius * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Projétil em formato de cápsula luminosa (Bala de Laser)
    ctx.translate(this.x, this.y);
    const angle = Math.atan2(this.dirY, this.dirX);
    ctx.rotate(angle);

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 16;

    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 5.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  checkCollision(targetX, targetY, targetRadius) {
    const totalR = this.radius + targetRadius + 6; // Hitbox generosa e justa
    // 1. Checa proximidade direta
    if (Math.hypot(this.x - targetX, this.y - targetY) <= totalR) return true;
    // 2. Checa projeção na reta da trajetória percorrida entre frames (evita tunneling)
    const segDx = this.x - this.prevX;
    const segDy = this.y - this.prevY;
    const segLenSq = segDx * segDx + segDy * segDy;
    if (segLenSq > 0) {
      const t = Math.max(0, Math.min(1, ((targetX - this.prevX) * segDx + (targetY - this.prevY) * segDy) / segLenSq));
      const projX = this.prevX + t * segDx;
      const projY = this.prevY + t * segDy;
      if (Math.hypot(targetX - projX, targetY - projY) <= totalR) return true;
    }
    return false;
  }

  isOutOfBounds() {
    return (
      this.x < -20 ||
      this.x > VIRTUAL_WIDTH + 20 ||
      this.y < -20 ||
      this.y > VIRTUAL_HEIGHT + 20 ||
      this.life <= 0
    );
  }
}

// --- CLASSE DOS FEIXES DE LASER ---
class Laser {
  constructor(options) {
    this.x1 = options.x1;
    this.y1 = options.y1;
    this.x2 = options.x2;
    this.y2 = options.y2;
    this.warningDuration = options.warningDuration || 0.85;
    this.fireDuration = options.fireDuration || 0.4;
    this.thickness = options.thickness || 14;
    this.color = options.color || '#ff0055';
    this.warningRgb = options.warningRgb || '255, 30, 80';

    this.timer = 0;
    this.state = 'WARNING'; // 'WARNING' | 'FIRING' | 'DONE'
    this.isTracking = options.isTracking || false; // Segue jogador antes de travar
    this.trackLockDelay = options.trackLockDelay !== undefined ? options.trackLockDelay : 0.20; // Delay de 0.2s com mira travada
    this.isLocked = false;
    this.lockSoundPlayed = false;
    this.lockedTargetX = options.x2 || 0;
    this.lockedTargetY = options.y2 || 0;
    this.currentAngle = options.currentAngle !== undefined ? options.currentAngle : Math.atan2(this.y2 - this.y1, this.x2 - this.x1);
    this.turnSpeed = options.turnSpeed !== undefined ? options.turnSpeed : 2.5; // Velocidade de rotação suave em radianos/segundo (sem teleporte)
    this.trackTarget = options.trackTarget || null;
    this.angle = options.angle || 0;
    this.rotSpeed = options.rotSpeed || 0; // Laser giratório
    this.centerAnchor = options.centerAnchor || null;
    this.length = options.length || 1200;
    this.targetPlayer = options.targetPlayer || 'p1'; // 'p1' ou 'p2' no multiplayer
    this.rawOptions = options; // Armazena opções para sincronização de rede

    // Recursos Especiais de Sans (Undertale)
    this.isGasterBlaster = options.isGasterBlaster || false;
    this.isBone = options.isBone || false;
    this.orbitRadius = options.orbitRadius || 0;
    this.orbitAngle = options.orbitAngle || 0;
    this.beamAngleOffset = options.beamAngleOffset !== undefined ? options.beamAngleOffset : 0;

    sounds.playLaserWarning();
  }

  update(dt, playerX, playerY, p2X, p2Y) {
    this.timer += dt;

    // Se for rotativo com órbita circular (ex: Círculo dos Gaster Blasters de Sans)
    if (this.rotSpeed !== 0 && this.centerAnchor && this.orbitRadius) {
      this.orbitAngle = (this.orbitAngle || 0) + this.rotSpeed * dt;
      this.x1 = this.centerAnchor.x + Math.cos(this.orbitAngle) * this.orbitRadius;
      this.y1 = this.centerAnchor.y + Math.sin(this.orbitAngle) * this.orbitRadius;
      const fireAngle = this.orbitAngle + (this.beamAngleOffset !== undefined ? this.beamAngleOffset : Math.PI);
      this.x2 = this.x1 + Math.cos(fireAngle) * this.length;
      this.y2 = this.y1 + Math.sin(fireAngle) * this.length;
    } else if (this.rotSpeed !== 0 && this.centerAnchor) {
      this.angle += this.rotSpeed * dt;
      this.x1 = this.centerAnchor.x;
      this.y1 = this.centerAnchor.y;
      this.x2 = this.x1 + Math.cos(this.angle) * this.length;
      this.y2 = this.y1 + Math.sin(this.angle) * this.length;
    }

    // Se for rastreador (Sniper): persegue APENAS durante o aviso e ANTES do delay de 0.2s
    if (this.state === 'WARNING' && this.isTracking) {
      const lockCutoff = Math.max(0.1, this.warningDuration - this.trackLockDelay);

      if (this.timer < lockCutoff && !this.isLocked) {
        let tgtX = playerX;
        let tgtY = playerY;
        if (this.targetPlayer === 'p2' && p2X !== undefined && p2Y !== undefined) {
          tgtX = p2X;
          tgtY = p2Y;
        }

        const targetAngle = Math.atan2(tgtY - this.y1, tgtX - this.x1);

        // Diferença angular no menor arco (-PI a +PI)
        const diff = Math.atan2(Math.sin(targetAngle - this.currentAngle), Math.cos(targetAngle - this.currentAngle));

        // Desaceleração suave na reta final antes de travar (evita movimentos bruscos ou rápidos na última hora)
        const timeToLock = lockCutoff - this.timer;
        const speedFactor = (timeToLock < 0.45) ? (0.35 + 0.65 * (timeToLock / 0.45)) : 1.0;
        const effectiveTurnSpeed = this.turnSpeed * speedFactor;

        // Rotação suave limitada por frame (sem teleporte)
        const maxTurn = effectiveTurnSpeed * dt;
        if (Math.abs(diff) <= maxTurn) {
          this.currentAngle = targetAngle;
        } else {
          this.currentAngle += Math.sign(diff) * maxTurn;
        }

        this.x2 = this.x1 + Math.cos(this.currentAngle) * this.length;
        this.y2 = this.y1 + Math.sin(this.currentAngle) * this.length;

        // Ponto projetado do feixe na distância do jogador (onde a mira visual está agora)
        const dist = Math.hypot(tgtX - this.x1, tgtY - this.y1);
        this.lockedTargetX = this.x1 + Math.cos(this.currentAngle) * dist;
        this.lockedTargetY = this.y1 + Math.sin(this.currentAngle) * dist;
      } else {
        // Trava totalmente a mira pelo tempo do delay (0.20s) - NENHUM MOVIMENTO!
        if (!this.isLocked) {
          this.isLocked = true;
        }
        if (!this.lockSoundPlayed) {
          this.lockSoundPlayed = true;
          sounds.playTargetLock();
        }
      }
    }

    if (this.state === 'WARNING') {
      if (this.timer >= this.warningDuration) {
        this.state = 'FIRING';
        this.isTracking = false; // NUNCA se move depois do delay nem durante o disparo!
        this.timer = 0;
        sounds.playLaserBlast();
      }
    } else if (this.state === 'FIRING') {
      if (this.timer >= this.fireDuration) {
        this.state = 'DONE';
      }
    }
  }

  // Verifica colisão precisa de círculo (Jogador) com segmento de reta (Laser)
  checkCollision(px, py, pr) {
    if (this.state !== 'FIRING') return false;

    const dx = this.x2 - this.x1;
    const dy = this.y2 - this.y1;
    const lineLenSq = dx * dx + dy * dy;

    if (lineLenSq === 0) return false;

    // Projeção do ponto na linha (clamped entre 0 e 1)
    let t = ((px - this.x1) * dx + (py - this.y1) * dy) / lineLenSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = this.x1 + t * dx;
    const closestY = this.y1 + t * dy;

    const distSq = (px - closestX) * (px - closestX) + (py - closestY) * (py - closestY);
    const hitRadius = pr + this.thickness * 0.45;

    return distSq <= hitRadius * hitRadius;
  }

  draw(ctx) {
    ctx.save();

    if (this.state === 'WARNING') {
      if (this.isLocked) {
        // Alerta visual de mira travada com delay de 0.2s antes do disparo
        const flash = Math.floor(Date.now() / 60) % 2 === 0;

        ctx.strokeStyle = flash ? '#ffe600' : '#ff0055';
        ctx.lineWidth = 3.5;
        ctx.setLineDash([10, 5]);
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();

        // Retículo de alvo no ponto onde a mira travou
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(this.lockedTargetX, this.lockedTargetY, 16, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(this.lockedTargetX - 22, this.lockedTargetY);
        ctx.lineTo(this.lockedTargetX + 22, this.lockedTargetY);
        ctx.moveTo(this.lockedTargetX, this.lockedTargetY - 22);
        ctx.lineTo(this.lockedTargetX, this.lockedTargetY + 22);
        ctx.stroke();
      } else {
        // Linha de Aviso (Pulsante e Tracejada)
        const progress = this.timer / this.warningDuration;
        const alpha = 0.25 + 0.55 * Math.abs(Math.sin(progress * Math.PI * 4));

        ctx.strokeStyle = `rgba(${this.warningRgb}, ${alpha})`;
        ctx.lineWidth = 2 + progress * 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();

        // Indicadores nas pontas
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x1, this.y1, 4, 0, Math.PI * 2);
        ctx.arc(this.x2, this.y2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.state === 'FIRING') {
      // Feixe Mortal Completo
      const lifeRatio = 1 - (this.timer / this.fireDuration);

      // Brilho Externo (Glow)
      ctx.strokeStyle = `rgba(${this.warningRgb}, ${0.45 * lifeRatio})`;
      ctx.lineWidth = this.thickness * 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x1, this.y1);
      ctx.lineTo(this.x2, this.y2);
      ctx.stroke();

      // Feixe Colorido Principal
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.thickness;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.moveTo(this.x1, this.y1);
      ctx.lineTo(this.x2, this.y2);
      ctx.stroke();

      // Núcleo Branco Super Quente
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = this.thickness * 0.45;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(this.x1, this.y1);
      ctx.lineTo(this.x2, this.y2);
      ctx.stroke();
    }

    // Renderiza Cabeça do Gaster Blaster na origem (x1, y1)
    if (this.isGasterBlaster) {
      const blasterAngle = Math.atan2(this.y2 - this.y1, this.x2 - this.x1);
      ctx.save();
      ctx.translate(this.x1, this.y1);
      ctx.rotate(blasterAngle);

      const isFiring = (this.state === 'FIRING');
      const isWarning = (this.state === 'WARNING');
      const scale = 1.3;
      ctx.scale(scale, scale);

      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = isFiring ? 25 : 12;

      // Crânio Superior
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#111116';
      ctx.lineWidth = 1.6;

      ctx.beginPath();
      ctx.moveTo(-18, -12);
      ctx.lineTo(-6, -18);
      ctx.lineTo(16, -14);
      ctx.lineTo(26, -4);
      ctx.lineTo(18, 0);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Chifres do Blaster
      ctx.beginPath();
      ctx.moveTo(-18, -12);
      ctx.lineTo(-28, -20);
      ctx.lineTo(-22, -10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Mandíbula Inferior (abre ao disparar)
      ctx.save();
      ctx.rotate(isFiring ? 0.38 : 0.08);
      ctx.beginPath();
      ctx.moveTo(-12, 2);
      ctx.lineTo(18, 2);
      ctx.lineTo(24, 9);
      ctx.lineTo(12, 15);
      ctx.lineTo(-6, 13);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Cavidade ocular direita
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(4, -6, 4, 6, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Cavidade ocular esquerda
      ctx.beginPath();
      ctx.ellipse(14, -4, 4.5, 6.5, 0.1, 0, Math.PI * 2);
      ctx.fill();

      // Pupila com Fogo Místico de Sans (Ciano / Amarelo)
      const eyeColor = (Math.floor(Date.now() / 120) % 2 === 0) ? '#00f0ff' : '#ffe600';
      ctx.fillStyle = eyeColor;
      ctx.shadowColor = eyeColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(14, -4, isFiring ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Fagulhas de energia na boca durante o carregamento
      if (isWarning) {
        const p = this.timer / this.warningDuration;
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(22, 2, 3 + p * 7, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Renderiza Ossos de Undertale nas pontas
    if (this.isBone) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.x1, this.y1, this.thickness * 0.7, 0, Math.PI * 2);
      ctx.arc(this.x2, this.y2, this.thickness * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}

// --- COLECIONÁVEIS (BATERIA, ESCUDO & VIDA EXTRA COM PRAZO) ---
class Pickup {
  constructor(x, y, type = 'ENERGY', id = null) {
    this.id = id || Math.random().toString(36).substring(2, 9);
    this.x = x;
    this.y = y;
    this.type = type; // 'ENERGY' | 'SHIELD' | 'LIFE'
    this.timer = 0;

    if (this.type === 'LIFE') {
      this.radius = 13;
      this.maxLife = 7.5; // Prazo de captura de 7.5 segundos
      this.life = this.maxLife;
    } else {
      this.radius = 9;
      this.maxLife = 10.0; // Desaparece se não pegar em 10s
      this.life = this.maxLife;
    }
  }

  update(dt) {
    this.timer += dt;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.save();

    if (this.type === 'LIFE') {
      // --- VIDA EXTRA COM PRAZO DE CAPTURA ---
      const isUrgent = this.life < 2.5;
      const beatRate = isUrgent ? 14 : 7;
      const pulse = 1 + Math.sin(this.timer * beatRate) * (isUrgent ? 0.20 : 0.12);
      const bob = Math.sin(this.timer * 4.5) * 3;
      const posY = this.y + bob;
      const currentRadius = this.radius * pulse;

      // Anel Medidor de Contagem Regressiva (Prazo de Captura)
      const ringRadius = this.radius + 7;
      const timeRatio = Math.max(0, Math.min(1, this.life / this.maxLife));

      // Trilha de fundo do anel
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, posY, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Arco de tempo restante (decai no sentido horário)
      const ringColor = isUrgent ? (Math.floor(this.timer * 8) % 2 === 0 ? '#ffe600' : '#ff0055') : '#ff0055';
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = isUrgent ? 15 : 8;
      ctx.beginPath();
      ctx.arc(this.x, posY, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * timeRatio, false);
      ctx.stroke();

      // Esfera de Energia Ruby / Pink
      ctx.fillStyle = isUrgent && (Math.floor(this.timer * 8) % 2 === 0) ? '#ff3377' : '#ff0055';
      ctx.shadowColor = '#ff0055';
      ctx.shadowBlur = isUrgent ? 22 : 16;
      ctx.beginPath();
      ctx.arc(this.x, posY, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      // Núcleo iluminado
      ctx.fillStyle = '#ff77aa';
      ctx.beginPath();
      ctx.arc(this.x, posY, currentRadius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Símbolo do Coração Branco Puro
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 6;
      ctx.font = `bold ${Math.round(14 * pulse)}px Orbitron, Rajdhani, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♥', this.x, posY + 1);

      // Plaquinha Flutuante com Cronômetro do Prazo (⏱ X.Xs)
      const badgeY = posY - this.radius - 14;
      const timeText = `⏱ ${Math.max(0, this.life).toFixed(1)}s`;
      ctx.font = 'bold 10px Orbitron, monospace';
      const textWidth = ctx.measureText(timeText).width;
      const pillW = textWidth + 12;
      const pillH = 15;

      ctx.fillStyle = 'rgba(10, 10, 25, 0.82)';
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(this.x - pillW / 2, badgeY - pillH / 2, pillW, pillH, 4);
      } else {
        ctx.rect(this.x - pillW / 2, badgeY - pillH / 2, pillW, pillH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isUrgent ? '#ffe600' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(timeText, this.x, badgeY);

    } else {
      // --- BATERIA (ENERGIA) OU ESCUDO ---
      const bob = Math.sin(this.timer * 5) * 3;
      const posY = this.y + bob;

      const color = this.type === 'ENERGY' ? '#ffe600' : '#00ffaa';
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;

      ctx.beginPath();
      ctx.arc(this.x, posY, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Desenha ícone interno
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px Orbitron';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.type === 'ENERGY' ? '⚡' : '🛡', this.x, posY);
    }

    ctx.restore();
  }
}
window.Pickup = Pickup;

// --- GERENCIADOR PRINCIPAL DO JOGO ---
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.gameState = STATE.MENU;
    this.player = new Player(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    this.lasers = [];
    this.pickups = [];
    this.particles = [];

    this.score = 0;
    this.survivalTime = 0;
    this.highScore = parseInt(localStorage.getItem('laser_reflex_highscore')) || 0;

    // Controle de Spawn e Dificuldade
    this.laserSpawnTimer = 0;
    this.pickupSpawnTimer = 0;
    this.screenShake = 0;

    // Sistema de Fases
    this.level = 1;
    this.pointsPerLevel = 5000;
    this.levelTransitionTimer = 0;
    this.bannerTimeout = null;

    // Chuva de Lasers Rápida (Evento da Fase 5)
    this.laserRainActive = false;
    this.laserRainTimer = 0;
    this.laserRainDropTimer = 0;
    this.phase5RainTriggered = false;
    this.phase5RainCooldown = 0;

    // Inputs
    this.keys = {};
    this.touchVector = { x: 0, y: 0 };

    // Elementos DOM da Interface
    this.domLives = document.querySelectorAll('#lives-display .heart');
    this.domLevelDisplay = document.getElementById('level-display');
    this.domLevelBanner = document.getElementById('level-up-banner');
    this.domBannerTitle = document.getElementById('banner-title');
    this.domBannerSub = document.getElementById('banner-subtitle');
    this.domScore = document.getElementById('score-display');
    this.domDashBar = document.getElementById('dash-bar');
    this.domStartScreen = document.getElementById('start-screen');
    this.domGameOverScreen = document.getElementById('game-over-screen');
    this.domFinalScore = document.getElementById('final-score');
    this.domFinalLevel = document.getElementById('final-level');
    this.domFinalTime = document.getElementById('final-time');
    this.domHighScore = document.getElementById('high-score');

    // Sistema de Economia e Loja (Créditos, Skins e Upgrades)
    let savedCredits = localStorage.getItem('laser_reflex_credits');
    this.credits = savedCredits !== null ? parseInt(savedCredits) : 300; // 300 créditos de presente inicial!
    this.equippedSkin = localStorage.getItem('laser_reflex_skin') || 'cyan';
    let savedOwned = [];
    try {
      savedOwned = JSON.parse(localStorage.getItem('laser_reflex_owned_skins')) || ['cyan'];
    } catch (e) {
      savedOwned = ['cyan'];
    }
    this.ownedSkins = Array.isArray(savedOwned) ? savedOwned : ['cyan'];

    // Melhorias são 100% da rodada (Roguelite). Iniciam no Nível 0 e resetam ao morrer!
    this.upgrades = {
      energyMagnet: 0,
      dashTurbine: 0,
      shieldCore: 0,
      creditBoost: 0
    };
    this.runCredits = 0;
    try {
      localStorage.removeItem('laser_reflex_upgrades');
    } catch (e) {}

    // Aplica a skin salva ao jogador
    this.player.skinColor = SKINS[this.equippedSkin]?.color || '#00f0ff';

    // Elementos DOM da Loja do Menu (Skins)
    this.domShopScreen = document.getElementById('shop-screen');
    this.domPlayerCredits = document.getElementById('player-credits');
    this.domSkinsView = document.getElementById('shop-skins-view');

    // Elementos DOM da Estação de Melhorias Entre Fases (Upgrades da Partida)
    this.domRunCreditsDisplay = document.getElementById('run-credits-display');
    this.domPhaseShopModal = document.getElementById('phase-shop-modal');
    this.domPhaseShopTitle = document.getElementById('phase-shop-title');
    this.domPhaseRunCredits = document.getElementById('phase-run-credits');
    this.domPhaseUpgradesContainer = document.getElementById('phase-upgrades-container');

    // Multiplayer (Duelo X1)
    this.isMultiplayer = false;
    this.isHost = false;
    this.remotePlayer = new Player(VIRTUAL_WIDTH - 180, VIRTUAL_HEIGHT / 2);
    this.remotePlayer.nameTag = 'P2';
    this.x1MatchTime = 0;
    this.networkSendTimer = 0;
    this.rematchRequested = false;

    // Elementos DOM do Multiplayer
    this.domHudSingle = document.getElementById('hud-single');
    this.domHudX1 = document.getElementById('hud-x1');
    this.domX1P1Name = document.getElementById('x1-p1-name');
    this.domX1P2Name = document.getElementById('x1-p2-name');
    this.domX1P1Lives = document.querySelectorAll('#x1-p1-lives .heart');
    this.domX1P2Lives = document.querySelectorAll('#x1-p2-lives .heart');
    this.domX1Timer = document.getElementById('x1-timer-display');

    this.domModeModal = document.getElementById('mode-modal');
    this.domLobbyModal = document.getElementById('lobby-modal');
    this.domLobbyCodeText = document.getElementById('lobby-code-text');
    this.domLobbyLinkInput = document.getElementById('lobby-link-input');
    this.domLobbyStatusText = document.getElementById('lobby-status-text');
    this.domCopyFeedback = document.getElementById('copy-feedback');

    this.domJoinModal = document.getElementById('join-modal');
    this.domJoinCodeInput = document.getElementById('join-code-input');
    this.domJoinStatusMessage = document.getElementById('join-status-message');

    this.domX1GameOverModal = document.getElementById('x1-gameover-modal');
    this.domX1ResultTitle = document.getElementById('x1-result-title');
    this.domX1ResultSubtitle = document.getElementById('x1-result-subtitle');
    this.domX1StatTime = document.getElementById('x1-stat-time');
    this.domX1StatMyLives = document.getElementById('x1-stat-my-lives');
    this.domX1StatEnemyLives = document.getElementById('x1-stat-enemy-lives');

    // Sistema de Balas de Laser (Exclusivo Multiplayer X1)
    this.bullets = [];
    this.consumedBulletIds = new Set();
    this.domShootBox = document.getElementById('hud-shoot-box');
    this.domShootBar = document.getElementById('shoot-bar');
    this.domShootTimerText = document.getElementById('shoot-timer-text');
    this.domMobileShootBtn = document.getElementById('mobile-shoot-btn');

    // Inicializa gerenciador de rede
    this.network = new NetworkManager(this);
    this.initMultiplayerEvents();

    // Estatísticas globais do jogador
    this.x1Wins = parseInt(localStorage.getItem('laser_reflex_x1_wins') || '0', 10);

    // Elementos DOM de Usuário e Ranking
    this.domUserBar = document.getElementById('user-bar');
    this.domUserGuestView = document.getElementById('user-guest-view');
    this.domUserLoggedView = document.getElementById('user-logged-view');
    this.domUserNickDisplay = document.getElementById('user-nick-display');
    this.domUserCreditsDisplay = document.getElementById('user-credits-display');
    this.domUserHighScoreDisplay = document.getElementById('user-highscore-display');

    // Modais de Auth, Ranking e Perfil
    this.domAuthModal = document.getElementById('auth-modal');
    this.domRankingModal = document.getElementById('ranking-modal');
    this.domProfileModal = document.getElementById('profile-modal');
    this.currentRankingCategory = 'score';

    // Inicializa Banco de Dados e Contas de Jogadores
    this.db = new DatabaseManager(this);
    this.initDatabaseEvents();

    this.initCanvasSize();
    this.setupEventListeners();
    this.renderShopUI();

    // Loop
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  initCanvasSize() {
    this.canvas.width = VIRTUAL_WIDTH;
    this.canvas.height = VIRTUAL_HEIGHT;
  }

  getVirtualMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = VIRTUAL_WIDTH / rect.width;
    const scaleY = VIRTUAL_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.initCanvasSize());

    // Disparo por clique do Mouse direcionado ao cursor (EXCLUSIVO MODO MULTIPLAYER X1)
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.isMultiplayer && this.gameState === STATE.PLAYING) {
        sounds.init();
        const pos = this.getVirtualMousePos(e);
        this.triggerPlayerShoot(pos.x, pos.y);
      }
    });

    // Teclado
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.gameState === STATE.PLAYING) {
          const { x, y } = this.getInputDirection();
          this.player.triggerDash(x, y);
        }
      }
      if (e.code === 'KeyE' || e.code === 'KeyJ' || e.code === 'Enter') {
        if (this.isMultiplayer && this.gameState === STATE.PLAYING) {
          e.preventDefault();
          sounds.init();
          this.triggerPlayerShoot();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Botões de Interface
    document.getElementById('start-btn').addEventListener('click', () => {
      sounds.init();
      this.showModeModal();
    });

    const mainSansBtn = document.getElementById('main-sans-btn');
    if (mainSansBtn) {
      mainSansBtn.addEventListener('click', () => {
        sounds.init();
        this.startSansBossDirect();
      });
    }

    document.getElementById('restart-btn').addEventListener('click', () => {
      sounds.init();
      this.startGame();
    });

    const restartSansBtn = document.getElementById('restart-sans-btn');
    if (restartSansBtn) {
      restartSansBtn.addEventListener('click', () => {
        sounds.init();
        this.startSansBossDirect();
      });
    }

    // Seleção de Modo (Solo ou Multiplayer X1)
    const btnModeCreate = document.getElementById('btn-mode-create');
    if (btnModeCreate) {
      btnModeCreate.addEventListener('click', () => {
        sounds.init();
        this.createMultiplayerRoom();
      });
    }

    const btnModeJoin = document.getElementById('btn-mode-join');
    if (btnModeJoin) {
      btnModeJoin.addEventListener('click', () => {
        sounds.init();
        this.showJoinModal();
      });
    }

    const btnModeSolo = document.getElementById('btn-mode-solo');
    if (btnModeSolo) {
      btnModeSolo.addEventListener('click', () => {
        sounds.init();
        this.hideModeModal();
        this.startGame();
      });
    }

    const btnModeSans = document.getElementById('btn-mode-sans');
    if (btnModeSans) {
      btnModeSans.addEventListener('click', () => {
        sounds.init();
        if (this.domModeModal) this.domModeModal.classList.add('hidden');
        if (this.domStartScreen) this.domStartScreen.classList.add('hidden');
        this.startSansBossDirect();
      });
    }

    const btnCloseMode = document.getElementById('btn-close-mode');
    if (btnCloseMode) {
      btnCloseMode.addEventListener('click', () => {
        sounds.init();
        this.hideModeModal();
      });
    }

    // Ações do Lobby do Host
    const btnCopyCode = document.getElementById('btn-copy-code');
    if (btnCopyCode) {
      btnCopyCode.addEventListener('click', () => {
        sounds.init();
        const code = this.domLobbyCodeText.textContent;
        navigator.clipboard.writeText(code).then(() => {
          this.showCopyFeedback('Código copiado: ' + code);
        }).catch(() => {
          this.showCopyFeedback('Código: ' + code);
        });
      });
    }

    const btnCopyLink = document.getElementById('btn-copy-link');
    if (btnCopyLink) {
      btnCopyLink.addEventListener('click', () => {
        sounds.init();
        const link = this.domLobbyLinkInput.value;
        navigator.clipboard.writeText(link).then(() => {
          this.showCopyFeedback('Link copiado! Envie para o oponente.');
        }).catch(() => {
          if (this.domLobbyLinkInput) {
            this.domLobbyLinkInput.select();
            this.showCopyFeedback('Selecione e copie o link acima.');
          }
        });
      });
    }

    const btnCancelLobby = document.getElementById('btn-cancel-lobby');
    if (btnCancelLobby) {
      btnCancelLobby.addEventListener('click', () => {
        sounds.init();
        this.network.disconnect();
        if (this.domLobbyModal) this.domLobbyModal.classList.add('hidden');
        if (this.domStartScreen) this.domStartScreen.classList.remove('hidden');
      });
    }

    // Modal Entrar em Sala
    const btnSubmitJoin = document.getElementById('btn-submit-join');
    if (btnSubmitJoin) {
      btnSubmitJoin.addEventListener('click', () => {
        sounds.init();
        const code = this.domJoinCodeInput.value.trim();
        if (!code) {
          if (this.domJoinStatusMessage) {
            this.domJoinStatusMessage.textContent = 'Digite o código da sala!';
            this.domJoinStatusMessage.style.color = '#ff0055';
          }
          return;
        }
        this.joinMultiplayerRoom(code);
      });
    }

    if (this.domJoinCodeInput && btnSubmitJoin) {
      this.domJoinCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          btnSubmitJoin.click();
        }
      });
    }

    const btnCloseJoin = document.getElementById('btn-close-join');
    if (btnCloseJoin) {
      btnCloseJoin.addEventListener('click', () => {
        sounds.init();
        this.network.disconnect();
        if (this.domJoinModal) this.domJoinModal.classList.add('hidden');
        this.showModeModal();
      });
    }

    // Modal X1 Game Over
    const btnX1Rematch = document.getElementById('btn-x1-rematch');
    if (btnX1Rematch) {
      btnX1Rematch.addEventListener('click', () => {
        sounds.init();
        this.requestRematch();
      });
    }

    const btnX1Leave = document.getElementById('btn-x1-leave');
    if (btnX1Leave) {
      btnX1Leave.addEventListener('click', () => {
        sounds.init();
        this.leaveMultiplayer();
      });
    }

    // Botões de Abrir Loja (No Menu Inicial e no Game Over)
    const shopBtn = document.getElementById('shop-btn');
    if (shopBtn) {
      shopBtn.addEventListener('click', () => {
        sounds.init();
        this.openShop();
      });
    }

    const goShopBtn = document.getElementById('gameover-shop-btn');
    if (goShopBtn) {
      goShopBtn.addEventListener('click', () => {
        sounds.init();
        this.openShop();
      });
    }

    // Botão de Voltar ao Menu (Fechar Loja)
    const closeShopBtn = document.getElementById('close-shop-btn');
    if (closeShopBtn) {
      closeShopBtn.addEventListener('click', () => {
        sounds.init();
        this.closeShop();
      });
    }

    // Ações de Skins na Loja (Comprar e Equipar)
    document.querySelectorAll('.shop-item-card').forEach(card => {
      const btn = card.querySelector('.item-action-btn');
      const skinId = card.getAttribute('data-skin');
      if (btn && skinId) {
        btn.addEventListener('click', () => {
          sounds.init();
          this.buyOrEquipSkin(skinId);
        });
      }
    });

    // Ações da Estação de Melhorias Entre Fases (Upgrades Roguelite da Partida)
    const nextPhaseBtn = document.getElementById('btn-next-phase');
    if (nextPhaseBtn) {
      nextPhaseBtn.addEventListener('click', () => {
        sounds.init();
        this.continueToNextPhase();
      });
    }

    if (this.domPhaseUpgradesContainer) {
      this.domPhaseUpgradesContainer.addEventListener('click', (e) => {
        const buyBtn = e.target.closest('[data-upgrade-id]');
        if (buyBtn && !buyBtn.disabled) {
          const upgradeId = buyBtn.getAttribute('data-upgrade-id');
          if (upgradeId) {
            sounds.init();
            this.buyPhaseUpgrade(upgradeId);
          }
          return;
        }

        const healBtn = e.target.closest('[data-heal-btn]');
        if (healBtn && !healBtn.disabled && this.player.lives < 3) {
          sounds.init();
          this.buyPhaseHeal();
        }
      });
    }

    // Mobile Dash
    const dashBtn = document.getElementById('mobile-dash-btn');
    if (dashBtn) {
      dashBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        sounds.init();
        if (this.gameState === STATE.PLAYING) {
          this.player.triggerDash(this.touchVector.x, this.touchVector.y);
        }
      });
    }

    // Mobile Tiro a Laser (Recarga de 5s - Exclusivo Duelo X1)
    const shootBtn = document.getElementById('mobile-shoot-btn');
    if (shootBtn) {
      const handleShoot = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.isMultiplayer && this.gameState === STATE.PLAYING) {
          sounds.init();
          this.triggerPlayerShoot();
        }
      };
      shootBtn.addEventListener('touchstart', handleShoot, { passive: false });
      shootBtn.addEventListener('click', handleShoot);
    }

    // Touch Joystick Virtual
    const stickZone = document.getElementById('touch-joystick-zone');
    const stickHandle = document.getElementById('touch-stick-handle');
    let touchId = null;
    let baseRect = null;

    if (stickZone && stickHandle) {
      stickZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        sounds.init();
        const touch = e.changedTouches[0];
        touchId = touch.identifier;
        baseRect = stickZone.getBoundingClientRect();
      });

      window.addEventListener('touchmove', (e) => {
        if (touchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === touchId && baseRect) {
            const centerX = baseRect.left + baseRect.width / 2;
            const centerY = baseRect.top + baseRect.height / 2;
            let dx = t.clientX - centerX;
            let dy = t.clientY - centerY;
            const dist = Math.hypot(dx, dy);
            const maxRadius = baseRect.width / 2;

            if (dist > maxRadius) {
              dx = (dx / dist) * maxRadius;
              dy = (dy / dist) * maxRadius;
            }

            stickHandle.style.transform = `translate(${dx}px, ${dy}px)`;
            this.touchVector.x = dx / maxRadius;
            this.touchVector.y = dy / maxRadius;
          }
        }
      });

      const resetStick = () => {
        touchId = null;
        stickHandle.style.transform = `translate(0px, 0px)`;
        this.touchVector.x = 0;
        this.touchVector.y = 0;
      };

      window.addEventListener('touchend', resetStick);
      window.addEventListener('touchcancel', resetStick);
    }
  }

  getInputDirection() {
    let x = 0;
    let y = 0;

    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;

    // Incorpora touch caso ativo
    if (Math.hypot(this.touchVector.x, this.touchVector.y) > 0.15) {
      x = this.touchVector.x;
      y = this.touchVector.y;
    }

    return { x, y };
  }

  initMultiplayerEvents() {
    this.network.onConnected = () => {
      sounds.playLevelUp();
      if (this.network.isHost) {
        if (this.domLobbyStatusText) {
          this.domLobbyStatusText.textContent = '⚔️ OPONENTE CONECTADO! PREPARANDO X1...';
        }
        // Host inicia a contagem e notifica o client
        setTimeout(() => {
          this.network.send({ type: 'MATCH_COUNTDOWN' });
          this.runX1CountdownAndStart();
        }, 800);
      } else {
        if (this.domJoinStatusMessage) {
          this.domJoinStatusMessage.textContent = '⚔️ CONECTADO AO HOST! AGUARDANDO INÍCIO...';
          this.domJoinStatusMessage.style.color = '#00ffa3';
        }
      }
    };

    this.network.onDisconnected = () => {
      console.log('Oponente desconectou.');
      if (this.isMultiplayer && this.gameState === STATE.PLAYING) {
        this.showLevelBanner('OPONENTE SAIU', 'A conexão com o rival foi encerrada.', 2500);
        setTimeout(() => {
          this.leaveMultiplayer();
        }, 2200);
      }
    };

    this.network.onMessage = (msg) => {
      this.handleNetworkMessage(msg);
    };

    // Auto-detecta link de convite na URL (?room=XXXX)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (roomParam) {
        setTimeout(() => {
          this.showJoinModal(roomParam.toUpperCase().trim());
        }, 400);
      }
    } catch (e) {}
  }

  initDatabaseEvents() {
    this.db.onUserChange = (user) => {
      this.updateUserBar(user);
    };

    // Botões da barra de usuário e menu
    const btnOpenAuth = document.getElementById('btn-open-auth');
    if (btnOpenAuth) {
      btnOpenAuth.addEventListener('click', () => {
        sounds.init();
        this.showAuthModal(false);
      });
    }

    const btnOpenRanking = document.getElementById('btn-open-ranking');
    if (btnOpenRanking) {
      btnOpenRanking.addEventListener('click', () => {
        sounds.init();
        this.showRankingModal('score');
      });
    }

    const btnOpenRankingLogged = document.getElementById('btn-open-ranking-logged');
    if (btnOpenRankingLogged) {
      btnOpenRankingLogged.addEventListener('click', () => {
        sounds.init();
        this.showRankingModal('score');
      });
    }

    const btnRankingMenu = document.getElementById('ranking-btn');
    if (btnRankingMenu) {
      btnRankingMenu.addEventListener('click', () => {
        sounds.init();
        this.showRankingModal('score');
      });
    }

    const btnOpenProfile = document.getElementById('btn-open-profile');
    if (btnOpenProfile) {
      btnOpenProfile.addEventListener('click', () => {
        sounds.init();
        this.showProfileModal();
      });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        sounds.init();
        this.db.logout();
      });
    }

    const btnProfileLogout = document.getElementById('btn-profile-logout');
    if (btnProfileLogout) {
      btnProfileLogout.addEventListener('click', () => {
        sounds.init();
        this.db.logout();
        if (this.domProfileModal) this.domProfileModal.classList.add('hidden');
      });
    }

    // Modal de Autenticação (Login / Cadastro)
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authForm = document.getElementById('auth-form');
    const authNickInput = document.getElementById('auth-nickname-input');
    const authPinInput = document.getElementById('auth-pin-input');
    const authStatusMsg = document.getElementById('auth-status-message');
    const btnCloseAuth = document.getElementById('btn-close-auth');

    let isRegisterMode = false;

    if (tabLogin && tabRegister) {
      tabLogin.addEventListener('click', () => {
        isRegisterMode = false;
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        if (authSubmitBtn) authSubmitBtn.textContent = 'ENTRAR NO JOGO ▶';
        if (authStatusMsg) authStatusMsg.textContent = '';
        const savedBox = document.getElementById('saved-accounts-container');
        if (savedBox && this.db && this.db.getSavedNicknames().length > 0) {
          savedBox.classList.remove('hidden');
        }
      });

      tabRegister.addEventListener('click', () => {
        isRegisterMode = true;
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        if (authSubmitBtn) authSubmitBtn.textContent = 'CRIAR CONTA E SALVAR ▶';
        if (authStatusMsg) authStatusMsg.textContent = '';
        const savedBox = document.getElementById('saved-accounts-container');
        if (savedBox) savedBox.classList.add('hidden');
      });
    }

    const btnFillMasterPin = document.getElementById('btn-fill-master-pin');
    if (btnFillMasterPin) {
      btnFillMasterPin.addEventListener('click', () => {
        sounds.init();
        if (authPinInput) {
          authPinInput.value = '8398';
          authPinInput.focus();
          if (authStatusMsg) {
            authStatusMsg.textContent = '🔑 Senha Mestra (8398) inserida! Clique em ENTRAR.';
            authStatusMsg.style.color = '#ffe600';
          }
        }
      });
    }

    const executeAuthAction = async () => {
      sounds.init();
      const nick = (authNickInput?.value || '').trim();
      const pin = (authPinInput?.value || '').trim();

      if (!nick) {
        if (authStatusMsg) {
          authStatusMsg.textContent = '⚠️ Digite seu apelido de piloto!';
          authStatusMsg.style.color = '#ffe600';
        }
        authNickInput?.focus();
        return;
      }

      if (!pin) {
        if (authStatusMsg) {
          authStatusMsg.textContent = '⚠️ Digite sua senha ou 8398!';
          authStatusMsg.style.color = '#ffe600';
        }
        authPinInput?.focus();
        return;
      }

      if (authStatusMsg) {
        authStatusMsg.textContent = 'Verificando dados...';
        authStatusMsg.style.color = '#00f0ff';
      }
      if (authSubmitBtn) authSubmitBtn.disabled = true;

      try {
        let user = null;
        if (isRegisterMode) {
          user = await this.db.register(nick, pin);
          if (authStatusMsg) {
            authStatusMsg.textContent = `✅ Conta "${user.nickname}" criada com sucesso!`;
            authStatusMsg.style.color = '#00ffa3';
          }
        } else {
          user = await this.db.login(nick, pin);
          if (authStatusMsg) {
            authStatusMsg.textContent = `✅ Bem-vindo, ${user.nickname}! Conectado com sucesso.`;
            authStatusMsg.style.color = '#00ffa3';
          }
        }

        sounds.playLevelUp();
        setTimeout(() => {
          if (this.domAuthModal) this.domAuthModal.classList.add('hidden');
          if (authNickInput) authNickInput.value = '';
          if (authPinInput) authPinInput.value = '';
          if (authStatusMsg) authStatusMsg.textContent = '';
          if (authSubmitBtn) authSubmitBtn.disabled = false;
        }, 500);
      } catch (err) {
        sounds.playError();
        if (authSubmitBtn) authSubmitBtn.disabled = false;
        const msg = err.message || 'Erro ao processar.';

        if (authStatusMsg) {
          if (msg.includes('Senha/PIN') || msg.includes('incorret')) {
            authStatusMsg.innerHTML = `
              <div style="margin-bottom:6px;">❌ ${msg}</div>
              <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:center;">
                <button type="button" id="btn-fallback-master-pw" class="mini-glow-btn highlight-gold" style="cursor:pointer; padding:6px 12px; font-size:0.8rem;">
                  🔑 Entrar com Senha Mestra (8398)
                </button>
              </div>
            `;
            authStatusMsg.style.color = '#ff0055';

            const btnFbMasterPw = document.getElementById('btn-fallback-master-pw');
            if (btnFbMasterPw) {
              btnFbMasterPw.addEventListener('click', () => {
                if (authPinInput) authPinInput.value = '8398';
                executeAuthAction();
              });
            }
          } else if (msg.includes('não encontrado')) {
            authStatusMsg.innerHTML = `
              <div style="margin-bottom:6px;">⚠️ ${msg}</div>
              <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:center;">
                <button type="button" id="btn-fallback-register" class="mini-glow-btn highlight-gold" style="cursor:pointer; padding:6px 12px; font-size:0.8rem;">
                  ✨ Cadastrar "${nick}" agora com esta senha
                </button>
                <button type="button" id="btn-fallback-master" class="mini-glow-btn" style="cursor:pointer; padding:6px 12px; font-size:0.8rem;">
                  🔑 Entrar com Senha Mestra (8398)
                </button>
              </div>
            `;
            authStatusMsg.style.color = '#ffe600';

            const btnFbReg = document.getElementById('btn-fallback-register');
            if (btnFbReg) {
              btnFbReg.addEventListener('click', async () => {
                try {
                  authStatusMsg.innerHTML = '⏳ Criando sua conta...';
                  authStatusMsg.style.color = '#00f0ff';
                  const newUser = await this.db.register(nick, pin);
                  authStatusMsg.textContent = `✅ Conta "${newUser.nickname}" criada com sucesso!`;
                  authStatusMsg.style.color = '#00ffa3';
                  sounds.playLevelUp();
                  setTimeout(() => {
                    if (this.domAuthModal) this.domAuthModal.classList.add('hidden');
                    if (authNickInput) authNickInput.value = '';
                    if (authPinInput) authPinInput.value = '';
                    if (authStatusMsg) authStatusMsg.textContent = '';
                  }, 500);
                } catch (e2) {
                  authStatusMsg.textContent = e2.message;
                  authStatusMsg.style.color = '#ff0055';
                }
              });
            }

            const btnFbMaster = document.getElementById('btn-fallback-master');
            if (btnFbMaster) {
              btnFbMaster.addEventListener('click', () => {
                if (authPinInput) authPinInput.value = '8398';
                executeAuthAction();
              });
            }
          } else {
            authStatusMsg.textContent = msg;
            authStatusMsg.style.color = '#ff0055';
          }
        }
      }
    };

    if (authSubmitBtn) {
      authSubmitBtn.addEventListener('click', executeAuthAction);
    }

    if (authForm) {
      authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        executeAuthAction();
      });
    }

    if (authNickInput) {
      authNickInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (authPinInput) authPinInput.focus();
        }
      });
    }

    if (authPinInput) {
      authPinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeAuthAction();
        }
      });
    }

    if (btnCloseAuth) {
      btnCloseAuth.addEventListener('click', () => {
        if (this.domAuthModal) this.domAuthModal.classList.add('hidden');
      });
    }

    // Modal de Ranking
    const tabRankScore = document.getElementById('tab-rank-score');
    const tabRankSans = document.getElementById('tab-rank-sans');
    const tabRankX1 = document.getElementById('tab-rank-x1');
    const btnRefreshRanking = document.getElementById('btn-refresh-ranking');
    const btnCloseRanking = document.getElementById('btn-close-ranking');

    if (tabRankScore) {
      tabRankScore.addEventListener('click', () => {
        this.showRankingModal('score');
      });
    }

    if (tabRankSans) {
      tabRankSans.addEventListener('click', () => {
        this.showRankingModal('sans');
      });
    }

    if (tabRankX1) {
      tabRankX1.addEventListener('click', () => {
        this.showRankingModal('x1');
      });
    }

    if (btnRefreshRanking) {
      btnRefreshRanking.addEventListener('click', () => {
        this.showRankingModal(this.currentRankingCategory);
      });
    }

    const btnAdminRanking = document.getElementById('btn-admin-ranking');
    if (btnAdminRanking) {
      btnAdminRanking.addEventListener('click', async () => {
        sounds.init();
        const pin = prompt('🔒 ÁREA RESTRITA AO CRIADOR / ADMINISTRADOR\n\nDigite a Senha Mestra de Administrador para gerenciar o ranking:');
        if (!pin) return;

        if (pin.trim() === '8398') {
          const confirmReset = confirm('👑 Autenticação de Administrador Concluída!\n\nDeseja ZERAR a pontuação de todos os jogadores no ranking agora?');
          if (confirmReset) {
            await this.db.zeroAllRankingScores();
            alert('✅ Sucesso! Todas as pontuações do ranking foram zeradas.');
            this.showRankingModal(this.currentRankingCategory || 'score');
          }
        } else {
          alert('❌ Senha Mestra incorreta! Acesso negado. Apenas o dono do jogo pode zerar a pontuação.');
        }
      });
    }

    // Atalho secreto: 3 cliques no título do Ranking também solicitam a senha de Admin
    const rankingTitle = document.querySelector('#ranking-modal .glow-title-small');
    let titleClicks = 0;
    let titleTimer = null;
    if (rankingTitle) {
      rankingTitle.style.cursor = 'pointer';
      rankingTitle.addEventListener('click', () => {
        titleClicks++;
        clearTimeout(titleTimer);
        titleTimer = setTimeout(() => { titleClicks = 0; }, 1500);
        if (titleClicks >= 3) {
          titleClicks = 0;
          btnAdminRanking?.click();
        }
      });
    }

    const btnGameOverRanking = document.getElementById('gameover-ranking-btn');
    if (btnGameOverRanking) {
      btnGameOverRanking.addEventListener('click', () => {
        sounds.init();
        const initialCat = (this.level === 10) ? 'sans' : 'score';
        this.showRankingModal(initialCat);
      });
    }

    if (btnCloseRanking) {
      btnCloseRanking.addEventListener('click', () => {
        if (this.domRankingModal) this.domRankingModal.classList.add('hidden');
      });
    }

    // Modal de Perfil
    const btnCloseProfile = document.getElementById('btn-close-profile');
    if (btnCloseProfile) {
      btnCloseProfile.addEventListener('click', () => {
        if (this.domProfileModal) this.domProfileModal.classList.add('hidden');
      });
    }

    this.updateUserBar(this.db.currentUser);
  }

  updateUserBar(user) {
    if (user) {
      if (this.domUserGuestView) this.domUserGuestView.classList.add('hidden');
      if (this.domUserLoggedView) this.domUserLoggedView.classList.remove('hidden');
      if (this.domUserNickDisplay) this.domUserNickDisplay.textContent = user.nickname;
      if (this.domUserCreditsDisplay) this.domUserCreditsDisplay.textContent = user.credits ?? this.credits;
      if (this.domUserHighScoreDisplay) this.domUserHighScoreDisplay.textContent = user.highScore ?? this.highScore;
    } else {
      if (this.domUserGuestView) this.domUserGuestView.classList.remove('hidden');
      if (this.domUserLoggedView) this.domUserLoggedView.classList.add('hidden');
    }
  }

  showAuthModal(isRegister = false) {
    if (this.domAuthModal) {
      this.domAuthModal.classList.remove('hidden');
      const tabLogin = document.getElementById('tab-login');
      const tabRegister = document.getElementById('tab-register');
      const authNickInput = document.getElementById('auth-nickname-input');
      const authPinInput = document.getElementById('auth-pin-input');
      const authStatusMsg = document.getElementById('auth-status-message');
      const savedBox = document.getElementById('saved-accounts-container');
      const savedChips = document.getElementById('saved-accounts-chips');

      if (authStatusMsg) authStatusMsg.textContent = '';

      // Renderiza pilotos salvos neste aparelho para preenchimento com 1 clique
      const savedNicks = (this.db && this.db.getSavedNicknames) ? this.db.getSavedNicknames() : [];
      if (savedBox && savedChips) {
        if (savedNicks.length > 0 && !isRegister) {
          savedChips.innerHTML = savedNicks.map(nick => `
            <button type="button" class="account-chip-btn" data-nick="${nick}">
              🛸 <strong>${nick}</strong>
            </button>
          `).join('');

          savedChips.querySelectorAll('.account-chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const n = btn.getAttribute('data-nick');
              if (authNickInput) authNickInput.value = n;
              if (authPinInput) authPinInput.focus();
              if (authStatusMsg) {
                authStatusMsg.textContent = `Piloto "${n}" selecionado. Digite a senha (ou 8398) para entrar!`;
                authStatusMsg.style.color = '#00f0ff';
              }
            });
          });

          savedBox.classList.remove('hidden');

          // Pré-preenche se o campo de texto estiver vazio
          if (authNickInput && !authNickInput.value) {
            authNickInput.value = savedNicks[0];
          }
        } else {
          savedBox.classList.add('hidden');
        }
      }

      if (isRegister) {
        tabRegister?.click();
      } else {
        tabLogin?.click();
      }
    }
  }

  async showRankingModal(category = 'score') {
    this.currentRankingCategory = category;
    if (this.domRankingModal) {
      this.domRankingModal.classList.remove('hidden');
    }

    const tabRankScore = document.getElementById('tab-rank-score');
    const tabRankSans = document.getElementById('tab-rank-sans');
    const tabRankX1 = document.getElementById('tab-rank-x1');
    const statHeader = document.getElementById('ranking-stat-header');
    const levelHeader = document.getElementById('ranking-level-header');
    const listContainer = document.getElementById('ranking-list-container');

    tabRankScore?.classList.remove('active');
    tabRankSans?.classList.remove('active');
    tabRankX1?.classList.remove('active');

    if (category === 'sans') {
      tabRankSans?.classList.add('active');
      if (statHeader) statHeader.textContent = 'TEMPO SAM';
      if (levelHeader) levelHeader.textContent = 'STATUS';
    } else if (category === 'x1') {
      tabRankX1?.classList.add('active');
      if (statHeader) statHeader.textContent = 'VITÓRIAS X1';
      if (levelHeader) levelHeader.textContent = 'FASE MÁX';
    } else {
      tabRankScore?.classList.add('active');
      if (statHeader) statHeader.textContent = 'PONTUAÇÃO';
      if (levelHeader) levelHeader.textContent = 'FASE MÁX';
    }

    if (listContainer) {
      listContainer.innerHTML = '<div class="ranking-loading">Consultando banco de dados em tempo real...</div>';
    }

    const dbBadge = document.getElementById('ranking-db-badge');

    try {
      const list = await this.db.getRanking(category);

      // Atualiza badge de status da fonte do banco
      if (dbBadge && this.db) {
        if (this.db.lastRankingSource === 'cloud') {
          dbBadge.className = 'ranking-db-badge cloud';
          dbBadge.innerHTML = '🟢 <strong>Banco de Dados: Firestore Nuvem</strong> (Conectado em Tempo Real)';
        } else if (this.db.lastRankingSource === 'cloud_disabled') {
          dbBadge.className = 'ranking-db-badge cloud-disabled';
          dbBadge.innerHTML = '⚠️ <strong>Banco Nuvem: Criação Pendente no Firebase Console</strong> (Exibindo Banco Local)<br>' +
            '<span style="font-size:0.75rem; opacity:0.9;">Para sincronizar com outros aparelhos, conclua a ativação do Firestore:</span><br>' +
            '<a href="https://console.firebase.google.com/project/lazer-reflex/firestore" target="_blank" class="btn-activate-cloud-link">👉 Clique aqui para Criar o Banco Firestore no Console</a>';
        } else {
          dbBadge.className = 'ranking-db-badge local';
          dbBadge.innerHTML = '🟢 <strong>Ranking Global Oficial</strong> (Pilotos Competindo em Tempo Real)';
        }
      }

      if (!listContainer) return;

      if (!list || list.length === 0) {
        listContainer.innerHTML = '<div class="ranking-empty">Nenhum piloto registrado ainda no banco de dados. Jogue uma partida ou crie sua conta para inaugurar o ranking!</div>';
        return;
      }

      let html = '';
      if (category === 'sans') {
        html += `
          <div class="ranking-sans-intro-card">
            <span class="sans-intro-icon">💀</span>
            <div class="sans-intro-text">
              <strong>DESAFIO DO CHEFÃO SAM (ROTA GENOCIDA):</strong>
              <span>Sobreviva aos 53.0s de ataques brutais com 3 Vidas e poderes NV.10! Derrote o Sans para entrar no topo da Liga!</span>
            </div>
          </div>
          <div class="ranking-row sans-boss-row">
            <span class="col-pos">👑 BOSS</span>
            <span class="col-pilot">💀 SAM (SANS SUPREMO)</span>
            <span class="col-stat">53.0s</span>
            <span class="col-level">INTOCÁVEL</span>
          </div>
        `;
      }

      const currentNick = this.db.currentUser ? this.db.currentUser.nickname : (this.db.getGuestNickname ? this.db.getGuestNickname() : '');

      list.forEach((item, index) => {
        const rank = index + 1;
        let medal = `#${rank}`;
        let rowClass = 'ranking-row';
        if (rank === 1) {
          medal = '🥇 1º';
          rowClass += ' top-1';
        } else if (rank === 2) {
          medal = '🥈 2º';
          rowClass += ' top-2';
        } else if (rank === 3) {
          medal = '🥉 3º';
          rowClass += ' top-3';
        }

        const isMe = currentNick && (currentNick === item.nickname);
        if (isMe) rowClass += ' current-player';

        let statVal = '';
        let extraVal = '';

        if (category === 'sans') {
          const sTime = (item.sansTime !== undefined && item.sansTime > 0) ? `${item.sansTime.toFixed(1)}s` : '0.0s';
          const sVictories = item.sansVictories || 0;
          if (sVictories > 0) {
            statVal = `⭐ ${sTime}`;
            extraVal = `🏆 ${sVictories}x Venceu`;
          } else if (item.sansTime >= 46.0) {
            statVal = `⚡ ${sTime}`;
            extraVal = `💀 Cerco 360°`;
          } else if (item.sansTime >= 33.0) {
            statVal = `⚡ ${sTime}`;
            extraVal = `💀 Roda Mortal`;
          } else if (item.sansTime >= 26.0) {
            statVal = `🔥 ${sTime}`;
            extraVal = `💀 Telecinese`;
          } else if (item.sansTime >= 16.0) {
            statVal = `🔥 ${sTime}`;
            extraVal = `💀 Blasters`;
          } else if (item.sansTime >= 7.0) {
            statVal = `${sTime}`;
            extraVal = `💀 Chuva Ossos`;
          } else if (item.sansTime > 0) {
            statVal = `${sTime}`;
            extraVal = `💀 Slam Inicial`;
          } else {
            statVal = `0.0s`;
            extraVal = `Não Enfrentou`;
          }
        } else if (category === 'x1') {
          statVal = (item.x1Wins || 0).toLocaleString('pt-BR');
          extraVal = `Fase ${item.maxLevel || 1}`;
        } else {
          statVal = (item.highScore || 0).toLocaleString('pt-BR');
          extraVal = (item.maxLevel >= 10) ? '💀 Fase 10 (Sam)' : `Fase ${item.maxLevel || 1}`;
        }

        html += `
          <div class="${rowClass}">
            <span class="col-pos">${medal}</span>
            <span class="col-pilot">${item.nickname} ${isMe ? '⭐ (Você)' : ''}</span>
            <span class="col-stat">${statVal}</span>
            <span class="col-level">${extraVal}</span>
          </div>
        `;
      });

      listContainer.innerHTML = html;
    } catch (e) {
      if (listContainer) {
        listContainer.innerHTML = '<div class="ranking-empty">Erro ao carregar o ranking do banco de dados. Tente novamente mais tarde.</div>';
      }
    }
  }

  showProfileModal() {
    if (this.domProfileModal) {
      const user = this.db.currentUser;
      if (!user) {
        this.showAuthModal(false);
        return;
      }

      const nickElem = document.getElementById('profile-nick');
      const joinedElem = document.getElementById('profile-joined');
      const scoreElem = document.getElementById('profile-highscore');
      const levelElem = document.getElementById('profile-maxlevel');
      const x1Elem = document.getElementById('profile-x1wins');
      const creditsElem = document.getElementById('profile-credits');
      const matchesElem = document.getElementById('profile-matches');
      const skinsElem = document.getElementById('profile-skins');

      if (nickElem) nickElem.textContent = user.nickname;
      if (joinedElem) {
        const d = new Date(user.createdAt || Date.now());
        joinedElem.textContent = `Piloto desde ${d.toLocaleDateString('pt-BR')}`;
      }
      if (scoreElem) scoreElem.textContent = (user.highScore || this.highScore || 0).toLocaleString('pt-BR');
      if (levelElem) levelElem.textContent = user.maxLevel || 1;
      if (x1Elem) x1Elem.textContent = user.x1Wins || this.x1Wins || 0;
      if (creditsElem) creditsElem.textContent = `🪙 ${(user.credits ?? this.credits ?? 0).toLocaleString('pt-BR')}`;
      if (matchesElem) matchesElem.textContent = user.matchesPlayed || 0;
      if (skinsElem) skinsElem.textContent = (user.unlockedSkins?.length || this.ownedSkins?.length || 1);

      const sansElem = document.getElementById('profile-sanstime');
      if (sansElem) {
        const sTime = (user.sansTime !== undefined && user.sansTime > 0) ? `${user.sansTime.toFixed(1)}s` : '0.0s';
        const sVic = user.sansVictories || 0;
        sansElem.textContent = sVic > 0 ? `${sTime} (🏆 ${sVic}x)` : sTime;
      }

      this.domProfileModal.classList.remove('hidden');
    }
  }

  showModeModal() {
    if (this.domStartScreen) this.domStartScreen.classList.add('hidden');
    if (this.domModeModal) this.domModeModal.classList.remove('hidden');
  }

  hideModeModal() {
    if (this.domModeModal) this.domModeModal.classList.add('hidden');
    if (this.domStartScreen) this.domStartScreen.classList.remove('hidden');
  }

  createMultiplayerRoom() {
    if (this.domModeModal) this.domModeModal.classList.add('hidden');
    if (this.domLobbyModal) {
      if (this.domLobbyCodeText) this.domLobbyCodeText.textContent = 'GERANDO...';
      if (this.domLobbyLinkInput) this.domLobbyLinkInput.value = '';
      if (this.domLobbyStatusText) this.domLobbyStatusText.textContent = '📡 Conectando ao servidor global de salas...';
      this.domLobbyModal.classList.remove('hidden');
    }

    this.network.createRoom(
      (code, link) => {
        if (this.domLobbyCodeText) this.domLobbyCodeText.textContent = code;
        if (this.domLobbyLinkInput) this.domLobbyLinkInput.value = link;
      },
      (statusMsg) => {
        if (this.domLobbyStatusText) this.domLobbyStatusText.textContent = statusMsg;
      }
    );
  }

  showJoinModal(prefilledCode = '') {
    if (this.domModeModal) this.domModeModal.classList.add('hidden');
    if (this.domStartScreen) this.domStartScreen.classList.add('hidden');
    if (this.domJoinModal) {
      this.domJoinModal.classList.remove('hidden');
      if (this.domJoinCodeInput) {
        this.domJoinCodeInput.value = prefilledCode;
        this.domJoinCodeInput.focus();
      }
      if (this.domJoinStatusMessage) {
        this.domJoinStatusMessage.textContent = prefilledCode ? 'Código detectado do link! Clique em Conectar.' : '';
        this.domJoinStatusMessage.style.color = prefilledCode ? '#00ffa3' : '#ff0055';
      }
    }
  }

  joinMultiplayerRoom(code) {
    if (this.domJoinStatusMessage) {
      this.domJoinStatusMessage.textContent = '📡 Conectando à sala ' + code + '...';
      this.domJoinStatusMessage.style.color = '#00f0ff';
    }

    this.network.joinRoom(
      code,
      (statusMsg) => {
        if (this.domJoinStatusMessage) {
          this.domJoinStatusMessage.textContent = statusMsg;
          this.domJoinStatusMessage.style.color = '#00f0ff';
        }
      },
      (err) => {
        if (this.domJoinStatusMessage) {
          this.domJoinStatusMessage.textContent = err || 'Erro ao conectar na sala.';
          this.domJoinStatusMessage.style.color = '#ff0055';
        }
      }
    );
  }

  showCopyFeedback(text) {
    if (this.domCopyFeedback) {
      this.domCopyFeedback.textContent = text;
      setTimeout(() => {
        if (this.domCopyFeedback && this.domCopyFeedback.textContent === text) {
          this.domCopyFeedback.textContent = '';
        }
      }, 3500);
    }
  }

  runX1CountdownAndStart() {
    if (this.domLobbyModal) this.domLobbyModal.classList.add('hidden');
    if (this.domJoinModal) this.domJoinModal.classList.add('hidden');
    if (this.domModeModal) this.domModeModal.classList.add('hidden');
    if (this.domStartScreen) this.domStartScreen.classList.add('hidden');
    if (this.domGameOverScreen) this.domGameOverScreen.classList.add('hidden');
    if (this.domX1GameOverModal) this.domX1GameOverModal.classList.add('hidden');

    let count = 3;
    if (this.domLevelBanner && this.domBannerTitle && this.domBannerSub) {
      this.domLevelBanner.classList.remove('hidden');
      this.domBannerTitle.textContent = '⚔️ DUELO X1 ⚔️';
      this.domBannerSub.textContent = `INICIANDO EM ${count}...`;
      sounds.playLaserWarning();

      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          this.domBannerSub.textContent = `INICIANDO EM ${count}...`;
          sounds.playLaserWarning();
        } else {
          clearInterval(interval);
          this.domBannerSub.textContent = '💥 LUTA!';
          sounds.playLaserBlast();
          setTimeout(() => {
            if (this.domLevelBanner) this.domLevelBanner.classList.add('hidden');
          }, 900);
          this.startX1Match();
        }
      }, 1000);
    } else {
      this.startX1Match();
    }
  }

  startX1Match() {
    this.isMultiplayer = true;
    this.isHost = this.network.isHost;
    this.gameState = STATE.PLAYING;
    this.score = 0;
    this.survivalTime = 0;
    this.x1MatchTime = 0;
    this.level = 1;
    this.lasers = [];
    this.pickups = [];
    this.particles = [];
    this.bullets = [];
    this.consumedBulletIds = new Set();
    this.player.shootCooldownTimer = 0;
    this.laserSpawnTimer = 0;
    this.pickupSpawnTimer = 0;
    this.rematchRequested = false;

    // Exibe barra de tiro a laser e botão mobile exclusivamente no Modo X1
    if (this.domShootBox) this.domShootBox.classList.remove('hidden');
    if (this.domMobileShootBtn) this.domMobileShootBtn.classList.remove('hidden');

    // Esconde telas e modais
    if (this.domStartScreen) this.domStartScreen.classList.add('hidden');
    if (this.domGameOverScreen) this.domGameOverScreen.classList.add('hidden');
    if (this.domX1GameOverModal) this.domX1GameOverModal.classList.add('hidden');
    if (this.domLobbyModal) this.domLobbyModal.classList.add('hidden');
    if (this.domJoinModal) this.domJoinModal.classList.add('hidden');
    if (this.domModeModal) this.domModeModal.classList.add('hidden');

    // Alterna HUD Solo para HUD X1
    if (this.domHudSingle) this.domHudSingle.classList.add('hidden');
    if (this.domHudX1) this.domHudX1.classList.remove('hidden');

    // Configuração dos Drones e Cores Distintas (P1 Ciano vs P2 Carmesim)
    if (this.isHost) {
      this.player.reset(180, VIRTUAL_HEIGHT / 2);
      this.player.nameTag = 'P1 (VOCÊ) - CIANO';
      this.player.skinColor = '#00f0ff';

      this.remotePlayer.reset(VIRTUAL_WIDTH - 180, VIRTUAL_HEIGHT / 2);
      this.remotePlayer.nameTag = 'P2 (RIVAL) - CARMESIM';
      this.remotePlayer.skinColor = '#ff0055';

      if (this.domX1P1Name) this.domX1P1Name.textContent = 'P1 (VOCÊ) - CIANO';
      if (this.domX1P2Name) this.domX1P2Name.textContent = 'P2 (RIVAL) - CARMESIM';
    } else {
      this.player.reset(VIRTUAL_WIDTH - 180, VIRTUAL_HEIGHT / 2);
      this.player.nameTag = 'P2 (VOCÊ) - CARMESIM';
      this.player.skinColor = '#ff0055';

      this.remotePlayer.reset(180, VIRTUAL_HEIGHT / 2);
      this.remotePlayer.nameTag = 'P1 (RIVAL) - CIANO';
      this.remotePlayer.skinColor = '#00f0ff';

      if (this.domX1P1Name) this.domX1P1Name.textContent = 'P1 (RIVAL) - CIANO';
      if (this.domX1P2Name) this.domX1P2Name.textContent = 'P2 (VOCÊ) - CARMESIM';
    }

    // No Duelo X1, ambos os jogadores competem com status padrão equilibrados
    this.player.dashCooldownMax = 2.0;
    this.player.invulnerableDuration = 1.6;

    this.updateX1HUD();
  }

  updateX1HUD() {
    const p1Lives = this.isHost ? this.player.lives : this.remotePlayer.lives;
    const p2Lives = this.isHost ? this.remotePlayer.lives : this.player.lives;

    if (this.domX1P1Lives) {
      this.domX1P1Lives.forEach((heart, idx) => {
        if (idx < p1Lives) heart.classList.add('active');
        else heart.classList.remove('active');
      });
    }

    if (this.domX1P2Lives) {
      this.domX1P2Lives.forEach((heart, idx) => {
        if (idx < p2Lives) heart.classList.add('active');
        else heart.classList.remove('active');
      });
    }

    if (this.domX1Timer) {
      const mins = Math.floor(this.x1MatchTime / 60);
      const secs = Math.floor(this.x1MatchTime % 60);
      this.domX1Timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // Barra de Dash local
    const dashCooldown = this.player.dashCooldownTimer;
    const dashMax = this.player.dashCooldownMax;
    const ratio = Math.max(0, 1 - (dashCooldown / dashMax));
    if (this.domDashBar) {
      this.domDashBar.style.width = `${ratio * 100}%`;
      if (dashCooldown <= 0) {
        this.domDashBar.classList.add('ready');
      } else {
        this.domDashBar.classList.remove('ready');
      }
    }

    // Atualiza Barra e Status do Tiro a Laser
    this.updateShootHUD();
  }

  handleNetworkMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'HANDSHAKE':
        if (msg.nickname) {
          this.remotePlayer.nameTag = msg.nickname;
          if (this.domX1P2Name) this.domX1P2Name.textContent = msg.nickname + ' (RIVAL)';
        }
        if (this.domX1P1Name) {
          const myNick = this.db?.currentUser?.nickname || 'VOCÊ';
          this.domX1P1Name.textContent = myNick + ' (VOCÊ)';
        }
        if (msg.skin && typeof SKINS !== 'undefined' && SKINS[msg.skin]) {
          this.remotePlayer.skinColor = SKINS[msg.skin].color;
        }
        break;

      case 'MATCH_COUNTDOWN':
        if (this.domX1P1Name) {
          const myNick = this.db?.currentUser?.nickname || 'VOCÊ';
          this.domX1P1Name.textContent = myNick + ' (VOCÊ)';
        }
        this.runX1CountdownAndStart();
        break;

      case 'PLAYER_STATE':
        this.remotePlayer.x = msg.x;
        this.remotePlayer.y = msg.y;
        this.remotePlayer.vx = msg.vx;
        this.remotePlayer.vy = msg.vy;
        if (msg.dirX !== undefined && msg.dirY !== undefined) {
          this.remotePlayer.dashDirX = msg.dirX;
          this.remotePlayer.dashDirY = msg.dirY;
        }
        this.remotePlayer.isDashing = msg.isDashing;
        this.remotePlayer.lives = msg.lives;
        this.remotePlayer.shieldActive = msg.shieldActive;
        if (msg.skinColor) this.remotePlayer.skinColor = msg.skinColor;
        this.updateX1HUD();

        if (this.gameState === STATE.PLAYING && this.remotePlayer.lives <= 0) {
          this.triggerX1GameOver(true);
        }
        break;

      case 'SPAWN_BULLET':
        if (msg.bullet) {
          if (!this.bullets.some(b => b.id === msg.bullet.id)) {
            this.bullets.push(new LaserBullet(msg.bullet));
            sounds.playShoot();
          }
        }
        break;

      case 'PLAYER_BULLET_HIT':
        if (msg.bulletId) this.consumedBulletIds.add(msg.bulletId);
        for (let i = this.bullets.length - 1; i >= 0; i--) {
          if (this.bullets[i].id === msg.bulletId) {
            this.bullets.splice(i, 1);
            break;
          }
        }
        if (msg.victimLives !== undefined) {
          this.remotePlayer.lives = msg.victimLives;
        } else if (msg.lives !== undefined) {
          this.remotePlayer.lives = msg.lives;
        }
        if (msg.victimShield !== undefined) {
          this.remotePlayer.shieldActive = msg.victimShield;
        }
        this.updateX1HUD();
        sounds.playPiercingHit();

        for (let k = 0; k < 40; k++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 80 + Math.random() * 200;
          this.particles.push(new Particle(this.remotePlayer.x, this.remotePlayer.y, '#ff0055', Math.cos(ang) * spd, Math.sin(ang) * spd, 0.6, 3.5));
        }

        if (this.gameState === STATE.PLAYING && this.remotePlayer.lives <= 0) {
          this.triggerX1GameOver(true);
        }
        break;

      case 'DIRECT_BULLET_IMPACT':
        if (msg.bulletId && !this.consumedBulletIds.has(msg.bulletId)) {
          this.consumedBulletIds.add(msg.bulletId);
          for (let i = this.bullets.length - 1; i >= 0; i--) {
            if (this.bullets[i].id === msg.bulletId) {
              this.bullets.splice(i, 1);
              break;
            }
          }
          this.player.takePiercingDamage(this.particles);
          this.screenShake = 16;
          this.updateX1HUD();

          if (this.player.lives <= 0) {
            const enemyRole = this.isHost ? 'p2' : 'p1';
            this.network.send({
              type: 'GAME_OVER_X1',
              winner: enemyRole
            });
            this.triggerX1GameOver(false);
            return;
          }
        }
        break;

      case 'SPAWN_LASER':
        if (!this.isHost && msg.laser) {
          this.lasers.push(new Laser(msg.laser));
        }
        break;

      case 'SPAWN_PICKUP':
        if (!this.isHost) {
          this.pickups.push(new Pickup(msg.x, msg.y, msg.pickupType, msg.id));
        }
        break;

      case 'COLLECT_PICKUP':
        for (let i = this.pickups.length - 1; i >= 0; i--) {
          const p = this.pickups[i];
          if (p.id === msg.id) {
            const pColor = (p.type === 'LIFE') ? '#ff0055' : (p.type === 'ENERGY' ? '#ffe600' : '#00ffaa');
            for (let k = 0; k < 18; k++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 60 + Math.random() * 100;
              this.particles.push(new Particle(p.x, p.y, pColor, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.45, 3));
            }
            this.pickups.splice(i, 1);
            sounds.playCollect();
            break;
          }
        }
        break;

      case 'PLAYER_HIT':
        this.remotePlayer.lives = msg.lives;
        this.remotePlayer.shieldActive = msg.shieldActive;
        this.updateX1HUD();
        for (let k = 0; k < 16; k++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 50 + Math.random() * 90;
          this.particles.push(new Particle(this.remotePlayer.x, this.remotePlayer.y, '#ff0055', Math.cos(ang) * spd, Math.sin(ang) * spd, 0.4, 3));
        }
        if (this.gameState === STATE.PLAYING && this.remotePlayer.lives <= 0) {
          this.triggerX1GameOver(true);
        }
        break;

      case 'GAME_OVER_X1':
        if (this.gameState === STATE.PLAYING) {
          const myRole = this.isHost ? 'p1' : 'p2';
          this.triggerX1GameOver(msg.winner === myRole);
        }
        break;

      case 'REMATCH_REQUEST':
        sounds.playLevelUp();
        this.showLevelBanner('REVANCHE!', 'Reiniciando duelo X1...', 2000);
        setTimeout(() => {
          this.runX1CountdownAndStart();
        }, 1500);
        break;
    }
  }

  triggerX1GameOver(isWinner) {
    this.gameState = STATE.GAMEOVER;
    this.screenShake = 16;

    if (isWinner) {
      if (this.domX1ResultTitle) this.domX1ResultTitle.textContent = '🏆 VITÓRIA NO X1!';
      if (this.domX1ResultSubtitle) this.domX1ResultSubtitle.textContent = 'Você sobreviveu e destruiu o drone rival!';
      sounds.playLevelUp();
      this.addCredits(80); // Recompensa de campeão do X1!
      this.x1Wins = (this.x1Wins || 0) + 1;
      localStorage.setItem('laser_reflex_x1_wins', this.x1Wins);
    } else {
      if (this.domX1ResultTitle) this.domX1ResultTitle.textContent = '💀 DERROTADO NO X1!';
      if (this.domX1ResultSubtitle) this.domX1ResultSubtitle.textContent = 'Seu drone foi destruído pelos feixes de laser!';
      sounds.playHit();
      this.addCredits(25);
    }

    const earnedCredits = isWinner ? 80 : 25;
    if (this.db) {
      this.db.recordMatchResult({
        mode: 'x1',
        isWinner: isWinner,
        survivalTime: parseFloat(this.x1MatchTime.toFixed(1)),
        creditsEarned: earnedCredits
      });
    }

    const x1DbBadge = document.getElementById('x1-db-badge');
    if (x1DbBadge) {
      if (this.db && this.db.currentUser) {
        x1DbBadge.textContent = `💾 Duelo gravado no perfil de ${this.db.currentUser.nickname}!`;
      } else {
        x1DbBadge.textContent = '💾 Resultado do duelo gravado no banco de dados!';
      }
    }

    if (this.domX1StatTime) this.domX1StatTime.textContent = `${this.x1MatchTime.toFixed(1)}s`;
    if (this.domX1StatMyLives) this.domX1StatMyLives.textContent = this.player.lives;
    if (this.domX1StatEnemyLives) this.domX1StatEnemyLives.textContent = this.remotePlayer.lives;

    if (this.domX1GameOverModal) {
      this.domX1GameOverModal.classList.remove('hidden');
    }
  }

  requestRematch() {
    this.network.send({ type: 'REMATCH_REQUEST' });
    this.showLevelBanner('REVANCHE SOLICITADA', 'Aguardando o oponente...', 2000);
    setTimeout(() => {
      this.runX1CountdownAndStart();
    }, 1500);
  }

  leaveMultiplayer() {
    this.network.disconnect();
    this.isMultiplayer = false;
    this.gameState = STATE.MENU;

    if (this.domX1GameOverModal) this.domX1GameOverModal.classList.add('hidden');
    if (this.domHudX1) this.domHudX1.classList.add('hidden');
    if (this.domHudSingle) this.domHudSingle.classList.remove('hidden');
    if (this.domStartScreen) this.domStartScreen.classList.remove('hidden');
    if (this.domPhaseShopModal) this.domPhaseShopModal.classList.add('hidden');

    this.player.reset(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    this.player.nameTag = null;
    this.remotePlayer.nameTag = null;
    this.lasers = [];
    this.pickups = [];
    this.particles = [];
    this.bullets = [];
    this.consumedBulletIds = new Set();
    if (this.domShootBox) this.domShootBox.classList.add('hidden');
    if (this.domMobileShootBtn) this.domMobileShootBtn.classList.add('hidden');
  }

  addLaser(options) {
    const laser = new Laser(options);
    this.lasers.push(laser);
    if (this.isMultiplayer && this.isHost && this.network.isConnected) {
      this.network.send({
        type: 'SPAWN_LASER',
        laser: options
      });
    }
    return laser;
  }

  startGame() {
    this.isMultiplayer = false;
    this.gameState = STATE.PLAYING;
    this.score = 0;
    this.survivalTime = 0;
    this.level = 1;
    this.levelTransitionTimer = 0;
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    if (this.domLevelDisplay) this.domLevelDisplay.textContent = '1';
    if (this.domLevelBanner) this.domLevelBanner.classList.add('hidden');

    this.lasers = [];
    this.pickups = [];
    this.particles = [];
    this.bullets = [];
    this.consumedBulletIds = new Set();
    if (this.domShootBox) this.domShootBox.classList.add('hidden');
    if (this.domMobileShootBtn) this.domMobileShootBtn.classList.add('hidden');
    this.laserSpawnTimer = 0;
    this.pickupSpawnTimer = 0;
    this.laserRainActive = false;
    this.laserRainTimer = 0;
    this.laserRainDropTimer = 0;
    this.phase5RainTriggered = false;
    this.phase5RainCooldown = 0;

    // SE MORRE RESETA: garante que nova partida começa com 0 upgrades e 0 créditos da rodada
    this.upgrades = {
      energyMagnet: 0,
      dashTurbine: 0,
      shieldCore: 0,
      creditBoost: 0
    };
    this.runCredits = 0;
    this.updateRunCreditsDisplay();
    try {
      localStorage.removeItem('laser_reflex_upgrades');
    } catch (e) {}

    // Reseta o jogador com a skin equipada e status base da rodada
    this.player.reset(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    this.player.nameTag = null;
    this.player.skinColor = SKINS[this.equippedSkin]?.color || '#00f0ff';
    this.applyUpgradesToPlayer();

    if (this.domHudSingle) this.domHudSingle.classList.remove('hidden');
    if (this.domHudX1) this.domHudX1.classList.add('hidden');
    if (this.domStartScreen) this.domStartScreen.classList.add('hidden');
    if (this.domGameOverScreen) this.domGameOverScreen.classList.add('hidden');
    if (this.domShopScreen) this.domShopScreen.classList.add('hidden');
    if (this.domPhaseShopModal) this.domPhaseShopModal.classList.add('hidden');
    if (this.domModeModal) this.domModeModal.classList.add('hidden');
    if (this.domLobbyModal) this.domLobbyModal.classList.add('hidden');
    if (this.domJoinModal) this.domJoinModal.classList.add('hidden');
    if (this.domX1GameOverModal) this.domX1GameOverModal.classList.add('hidden');
    document.getElementById('restart-sans-btn')?.classList.add('hidden');
    this.updateHUD();
  }

  applyUpgradesToPlayer() {
    // 1. Turbina de Dash (Nível 10: recarga ultra veloz de 0.35s + 3.2x velocidade de dash)
    const dashLvl = this.upgrades.dashTurbine || 0;
    if (dashLvl >= 10) {
      this.player.dashCooldownMax = 0.35;
      this.player.dashSpeedMultiplier = 3.2;
    } else {
      this.player.dashCooldownMax = Math.max(0.70, 2.0 - dashLvl * 0.26);
      this.player.dashSpeedMultiplier = 2.8;
    }

    // 2. Núcleo de Escudo (imunidade ampliada: Nível 10 = 3.6s)
    const shieldLvl = this.upgrades.shieldCore || 0;
    this.player.invulnerableDuration = 1.6 + shieldLvl * 0.20;

    // 3. Ímã de Energia (Nível 10: Calibração de propulsores aumenta velocidade base para 280px/s)
    const magnetLvl = this.upgrades.energyMagnet || 0;
    if (magnetLvl >= 10) {
      this.player.baseSpeed = 280;
    } else {
      this.player.baseSpeed = 240;
    }
  }

  updateRunCreditsDisplay() {
    if (this.domRunCreditsDisplay) {
      this.domRunCreditsDisplay.textContent = `🪙 ${this.runCredits || 0}`;
    }
    if (this.domPhaseRunCredits) {
      this.domPhaseRunCredits.textContent = this.runCredits || 0;
    }
  }

  addCredits(amount) {
    if (!this.isMultiplayer) {
      this.runCredits = (this.runCredits || 0) + amount;
      this.updateRunCreditsDisplay();
    }

    this.credits = (this.credits || 0) + amount;
    localStorage.setItem('laser_reflex_credits', this.credits);
    if (this.domPlayerCredits) {
      this.domPlayerCredits.textContent = this.credits;
    }
  }

  openShop() {
    this.gameState = STATE.SHOP;
    if (this.domStartScreen) this.domStartScreen.classList.add('hidden');
    if (this.domGameOverScreen) this.domGameOverScreen.classList.add('hidden');
    if (this.domShopScreen) this.domShopScreen.classList.remove('hidden');
    this.renderShopUI();
  }

  closeShop() {
    this.gameState = STATE.MENU;
    if (this.domShopScreen) this.domShopScreen.classList.add('hidden');
    if (this.domStartScreen) this.domStartScreen.classList.remove('hidden');
  }

  renderShopUI() {
    if (this.domPlayerCredits) {
      this.domPlayerCredits.textContent = this.credits;
    }

    // Renderiza botões das Skins da loja do menu
    document.querySelectorAll('.shop-item-card').forEach(card => {
      const skinId = card.getAttribute('data-skin');
      const btn = card.querySelector('.item-action-btn');
      if (!btn || !SKINS[skinId]) return;

      btn.className = 'item-action-btn';

      if (this.equippedSkin === skinId) {
        btn.textContent = 'EQUIPADO';
        btn.classList.add('equipped');
      } else if (Array.isArray(this.ownedSkins) && this.ownedSkins.includes(skinId)) {
        btn.textContent = 'EQUIPAR';
        btn.classList.add('equip-ready');
      } else {
        btn.textContent = `${SKINS[skinId].price} 🪙`;
        btn.classList.add('buy-btn');
      }
    });
  }

  buyOrEquipSkin(skinId) {
    if (!SKINS[skinId]) return;

    if (this.equippedSkin === skinId) {
      return;
    }

    if (this.ownedSkins.includes(skinId)) {
      this.equippedSkin = skinId;
      localStorage.setItem('laser_reflex_skin', skinId);
      this.player.skinColor = SKINS[skinId].color;
      sounds.playEquip();
      this.renderShopUI();
      if (this.db) {
        this.db.saveProgress({
          credits: this.credits,
          unlockedSkins: this.ownedSkins,
          equippedSkin: this.equippedSkin
        });
      }
      return;
    }

    // Comprar skin
    const price = SKINS[skinId].price;
    if (this.credits >= price) {
      this.credits -= price;
      this.ownedSkins.push(skinId);
      this.equippedSkin = skinId;
      localStorage.setItem('laser_reflex_credits', this.credits);
      localStorage.setItem('laser_reflex_owned_skins', JSON.stringify(this.ownedSkins));
      localStorage.setItem('laser_reflex_skin', skinId);
      this.player.skinColor = SKINS[skinId].color;

      sounds.playBuy();
      this.renderShopUI();
      if (this.db) {
        this.db.saveProgress({
          credits: this.credits,
          unlockedSkins: this.ownedSkins,
          equippedSkin: this.equippedSkin
        });
      }
    } else {
      sounds.playError();
      if (this.domPlayerCredits) {
        this.domPlayerCredits.parentElement.style.animation = 'pulse-bar 0.3s 2';
        setTimeout(() => {
          if (this.domPlayerCredits) this.domPlayerCredits.parentElement.style.animation = '';
        }, 600);
      }
    }
  }

  openPhaseShop() {
    this.gameState = STATE.PHASE_SHOP;
    this.keys = {};
    this.player.vx = 0;
    this.player.vy = 0;

    // Limpa projéteis e feixes da arena
    this.lasers = [];
    this.bullets = [];
    this.laserSpawnTimer = 0;
    this.pickupSpawnTimer = 0;

    // Bônus de conclusão de fase para os créditos da partida
    const boostLvl = this.upgrades.creditBoost || 0;
    const creditMult = 1 + boostLvl * 0.25;
    this.addCredits(Math.round(50 * creditMult));

    // Recupera 1 vida de graça se ferido
    if (this.player.lives < 3) {
      this.player.lives++;
    }
    this.updateHUD();

    // Fanfarra sonora
    sounds.playLevelUp();

    if (this.domPhaseShopTitle) {
      this.domPhaseShopTitle.textContent = `★ FASE ${this.level} CONCLUÍDA! ★`;
    }
    this.updateRunCreditsDisplay();
    this.renderPhaseShopUI();

    if (this.domPhaseShopModal) {
      this.domPhaseShopModal.classList.remove('hidden');
    }
  }

  continueToNextPhase() {
    if (this.domPhaseShopModal) {
      this.domPhaseShopModal.classList.add('hidden');
    }

    this.level++;
    if (this.domLevelDisplay) this.domLevelDisplay.textContent = this.level;

    // Se possui Núcleo de Escudo adquirido, concede o escudo para a nova fase
    const shieldLvl = this.upgrades.shieldCore || 0;
    if (shieldLvl > 0) {
      this.player.shieldActive = true;
    }

    this.applyUpgradesToPlayer();
    this.updateHUD();

    // Exibe banner da nova fase
    if (this.domLevelBanner && this.domBannerTitle && this.domBannerSub) {
      this.domBannerTitle.textContent = `★ FASE ${this.level} ★`;
      if (this.level === 2) {
        this.domBannerSub.textContent = `SOBRECARGA ULTRAVIOLETA: Lasers Rastreadores (delay para esquivar)!`;
      } else if (this.level === 3) {
        this.domBannerSub.textContent = `HIPERDRIVE QUÂNTICO: Feixes Duplos e Velocidade Extrema!`;
      } else if (this.level === 4) {
        this.domBannerSub.textContent = `ZONA CRÍTICA: Reflexos no Limite Absoluto!`;
      } else if (this.level === 5) {
        this.domBannerSub.textContent = `⚡ TEMPESTADE CIBERNÉTICA: CHUVA DE LASERS POR 5 SEGUNDOS! ⚡`;
      } else if (this.level === 10) {
        this.domBannerTitle.textContent = `💀 FASE 10: SANS (UNDERTALE) 💀`;
        this.domBannerSub.textContent = `VOCÊ VAI TER UM TEMPO RUIM! Sobreviva aos Gaster Blasters e ao Círculo Giratório!`;
        sounds.playSansMegalovania();
      } else {
        this.domBannerSub.textContent = `SOBREVIVÊNCIA MÁXIMA: Nível de Ameaça Extremo!`;
      }

      this.domLevelBanner.classList.remove('hidden');
      if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
      this.bannerTimeout = setTimeout(() => {
        if (this.domLevelBanner) this.domLevelBanner.classList.add('hidden');
      }, 2300);
    }

    if (this.level === 5) {
      this.phase5RainTriggered = false;
      this.phase5RainCooldown = 0.5;
    } else if (this.level === 10) {
      this.initSansBossPhase();
    }

    this.lasers = [];
    this.laserSpawnTimer = 0;
    this.levelTransitionTimer = 2.4;
    this.gameState = STATE.PLAYING;
  }

  renderPhaseShopUI() {
    this.updateRunCreditsDisplay();
    if (!this.domPhaseUpgradesContainer) return;
    this.domPhaseUpgradesContainer.innerHTML = '';

    Object.values(UPGRADES_CONFIG).forEach(cfg => {
      const currentLvl = this.upgrades[cfg.id] || 0;
      const isMax = currentLvl >= cfg.maxLevel;
      const nextPrice = getUpgradePrice(cfg.id, currentLvl);
      const canAfford = !isMax && ((this.runCredits || 0) >= nextPrice);

      const card = document.createElement('div');
      card.className = 'phase-upgrade-card' + (isMax ? ' maxed' : '');

      let pipsHtml = '';
      for (let i = 1; i <= cfg.maxLevel; i++) {
        const filled = i <= currentLvl ? (isMax ? 'filled max' : 'filled') : '';
        pipsHtml += `<div class="phase-level-pip ${filled}"></div>`;
      }

      const badgeText = isMax ? 'MÁXIMO' : `Nv. ${currentLvl}/${cfg.maxLevel}`;

      let btnHtml = '';
      if (isMax) {
        btnHtml = `<button class="phase-buy-btn maxed-btn" disabled>MAX ✓</button>`;
      } else {
        btnHtml = `<button class="phase-buy-btn ${canAfford ? 'can-buy' : 'cant-afford'}" data-upgrade-id="${cfg.id}">+1 NV (${nextPrice} 🪙)</button>`;
      }

      card.innerHTML = `
        <div class="phase-upgrade-icon">${cfg.icon}</div>
        <div class="phase-upgrade-info">
          <div class="phase-upgrade-title-row">
            <span class="phase-upgrade-title">${cfg.name}</span>
            <span class="phase-level-badge ${isMax ? 'max' : ''}">${badgeText}</span>
          </div>
          <div class="phase-level-track">
            ${pipsHtml}
          </div>
          <div class="phase-upgrade-desc">${cfg.getDesc(currentLvl)}</div>
        </div>
        <div class="phase-upgrade-action">
          ${btnHtml}
        </div>
      `;

      this.domPhaseUpgradesContainer.appendChild(card);
    });

    // Opção extra: Reparo de Drone (+1 Vida se estiver ferido)
    const healPrice = 80;
    const needsHeal = this.player.lives < 3;
    const canAffordHeal = needsHeal && ((this.runCredits || 0) >= healPrice);
    const healCard = document.createElement('div');
    healCard.className = 'phase-upgrade-card heal-card';
    healCard.innerHTML = `
      <div class="phase-upgrade-icon">💖</div>
      <div class="phase-upgrade-info">
        <div class="phase-upgrade-title-row">
          <span class="phase-upgrade-title">Reparo Nano (+1 Vida)</span>
          <span class="phase-level-badge ${needsHeal ? '' : 'max'}">${needsHeal ? `${this.player.lives}/3 Vidas` : 'VIDAS CHEIAS'}</span>
        </div>
        <div class="phase-upgrade-desc">Restaura 1 coração de vida imediatamente para prosseguir na partida.</div>
      </div>
      <div class="phase-upgrade-action">
        <button class="phase-buy-btn ${needsHeal ? (canAffordHeal ? 'can-buy heal' : 'cant-afford') : 'maxed-btn'}" data-heal-btn="true" ${needsHeal ? '' : 'disabled'}>
          ${needsHeal ? `+1 ♥ (${healPrice} 🪙)` : 'CHEIO ✓'}
        </button>
      </div>
    `;
    this.domPhaseUpgradesContainer.appendChild(healCard);
  }

  buyPhaseUpgrade(upgradeId) {
    const cfg = UPGRADES_CONFIG[upgradeId];
    if (!cfg) return;

    const currentLvl = this.upgrades[upgradeId] || 0;
    if (currentLvl >= cfg.maxLevel) return;

    const price = getUpgradePrice(upgradeId, currentLvl);
    if ((this.runCredits || 0) >= price) {
      this.runCredits -= price;
      this.upgrades[upgradeId] = currentLvl + 1;
      this.applyUpgradesToPlayer();

      sounds.playBuy();
      this.updateRunCreditsDisplay();
      this.renderPhaseShopUI();
    } else {
      sounds.playError();
      if (this.domPhaseRunCredits) {
        this.domPhaseRunCredits.parentElement.style.animation = 'pulse-bar 0.3s 2';
        setTimeout(() => {
          if (this.domPhaseRunCredits) this.domPhaseRunCredits.parentElement.style.animation = '';
        }, 600);
      }
    }
  }

  buyPhaseHeal() {
    const healPrice = 80;
    if (this.player.lives >= 3) return;

    if ((this.runCredits || 0) >= healPrice) {
      this.runCredits -= healPrice;
      this.player.lives++;
      sounds.playBuy();
      this.updateHUD();
      this.updateRunCreditsDisplay();
      this.renderPhaseShopUI();
    } else {
      sounds.playError();
      if (this.domPhaseRunCredits) {
        this.domPhaseRunCredits.parentElement.style.animation = 'pulse-bar 0.3s 2';
        setTimeout(() => {
          if (this.domPhaseRunCredits) this.domPhaseRunCredits.parentElement.style.animation = '';
        }, 600);
      }
    }
  }

  triggerGameOver(isVictory = false) {
    this.gameState = STATE.GAMEOVER;
    this.screenShake = isVictory ? 10 : 20;

    // SE MORRE RESETA: zera completamente os upgrades e créditos da partida!
    this.upgrades = {
      energyMagnet: 0,
      dashTurbine: 0,
      shieldCore: 0,
      creditBoost: 0
    };
    this.runCredits = 0;
    this.updateRunCreditsDisplay();
    try {
      localStorage.removeItem('laser_reflex_upgrades');
    } catch (e) {}

    // Bônus permanente de créditos de performance para comprar skins na Cyber Loja
    const matchBonus = isVictory ? 500 : Math.max(15, Math.floor(this.score / 80));
    this.credits = (this.credits || 0) + matchBonus;
    localStorage.setItem('laser_reflex_credits', this.credits);
    if (this.domPlayerCredits) {
      this.domPlayerCredits.textContent = this.credits;
    }

    const finalScoreVal = Math.floor(this.score);
    if (finalScoreVal > this.highScore) {
      this.highScore = finalScoreVal;
      localStorage.setItem('laser_reflex_highscore', this.highScore);
    }

    const isSansFight = (this.level === 10);
    const sansTimeVal = isSansFight ? parseFloat((this.sansTimer || 0).toFixed(1)) : 0;

    if (isSansFight && sansTimeVal > 0) {
      const bestSans = parseFloat(localStorage.getItem('laser_guest_sanstime') || '0');
      if (sansTimeVal > bestSans) {
        localStorage.setItem('laser_guest_sanstime', sansTimeVal.toString());
      }
      if (isVictory) {
        const curV = parseInt(localStorage.getItem('laser_guest_sansvictories') || '0', 10);
        localStorage.setItem('laser_guest_sansvictories', (curV + 1).toString());
      }
    }

    if (this.db) {
      this.db.recordMatchResult({
        mode: 'solo',
        score: finalScoreVal,
        level: this.level,
        survivalTime: parseFloat(this.survivalTime.toFixed(1)),
        creditsEarned: matchBonus,
        victory: !!isVictory,
        isSans: isSansFight,
        sansTime: isSansFight ? sansTimeVal : undefined,
        sansVictory: isSansFight ? !!isVictory : undefined
      });
    }

    const titleEl = document.querySelector('.game-over-title');
    const subEl = document.querySelector('.game-over-subtitle');

    if (isVictory) {
      if (titleEl) {
        titleEl.textContent = '🏆 VITÓRIA LENDÁRIA! 🏆';
        titleEl.classList.add('victory');
      }
      if (subEl) {
        subEl.textContent = 'Você sobreviveu à rota mais difícil de Undertale e derrotou o Sans!';
        subEl.classList.add('victory');
      }
      sounds.playLevelUp();
    } else {
      if (titleEl) {
        titleEl.textContent = 'SISTEMA CRÍTICO';
        titleEl.classList.remove('victory');
      }
      if (subEl) {
        subEl.textContent = 'O drone foi destruído pelos feixes de laser.';
        subEl.classList.remove('victory');
      }
    }

    const goDbBadge = document.getElementById('gameover-db-badge');
    if (goDbBadge) {
      const playerNick = this.db && this.db.currentUser ? this.db.currentUser.nickname : (this.db && this.db.getGuestNickname ? this.db.getGuestNickname() : 'PILOTO');
      if (isSansFight) {
        if (isVictory) {
          goDbBadge.textContent = `🏆 VITÓRIA CONTRA O SAM gravada para ${playerNick}! Ranking do Sam atualizado.`;
        } else {
          goDbBadge.textContent = `💀 Sobreviveu ${sansTimeVal.toFixed(1)}s contra o Sam! Recorde gravado no Ranking para ${playerNick}.`;
        }
      } else {
        if (this.db && this.db.currentUser) {
          goDbBadge.textContent = isVictory
            ? `🏆 VITÓRIA LENDÁRIA gravada no perfil de ${playerNick}! Ranking atualizado.`
            : `💾 Partida registrada no perfil de ${playerNick}! Pontuação salva no Ranking.`;
        } else {
          goDbBadge.textContent = isVictory
            ? `🏆 VITÓRIA LENDÁRIA registrada no Ranking como ${playerNick}!`
            : `💾 Partida registrada no Ranking como ${playerNick}! (Crie uma conta para salvar seu nome oficial)`;
        }
      }
    }

    this.domFinalScore.textContent = finalScoreVal;
    if (this.domFinalLevel) this.domFinalLevel.textContent = this.level;
    this.domFinalTime.textContent = `${this.survivalTime.toFixed(1)}s`;
    this.domHighScore.textContent = this.highScore;

    if (this.level === 10) {
      document.getElementById('restart-sans-btn')?.classList.remove('hidden');
    } else {
      document.getElementById('restart-sans-btn')?.classList.add('hidden');
    }

    this.domGameOverScreen.classList.remove('hidden');
  }

  spawnLaserPattern() {
    const t = this.survivalTime;

    // Configurações visuais e de balanceamento calibradas por fase
    let laserColor = '#ff0055';
    let warningRgb = '255, 30, 80';
    let warningTime = 0.85;
    let sniperChance = 0;
    let rotChance = 0;
    let rotSpeed = 0.40;

    if (this.level === 1) {
      laserColor = '#ff0055';
      warningRgb = '255, 30, 80';
      warningTime = Math.max(0.75, 0.92 - t * 0.004);
      sniperChance = 0; // Nenhum rastreador na Fase 1
      rotChance = (t > 18) ? 0.20 : 0;
      rotSpeed = 0.38;
    } else if (this.level === 2) {
      // FASE 2: Suave, acessível, lasers mais lentos e com bastante tempo de reação!
      laserColor = '#ff3b00';
      warningRgb = '255, 75, 0';
      warningTime = 0.85;  // 0.85s de aviso: tempo confortável para você se desviar com folga
      sniperChance = 0.16; // Apenas 16% de chance de sniper (bem espaçado)
      rotChance = 0.30;    // Giratório suave
      rotSpeed = 0.40;     // Rotação calma e previsível
    } else {
      // FASE 3+: Desafio avançado
      laserColor = '#ff0033';
      warningRgb = '255, 20, 20';
      warningTime = 0.65;
      sniperChance = 0.30;
      rotChance = 0.50;
      rotSpeed = 0.68;
    }

    const fireTime = 0.35;
    const roll = Math.random();

    if (roll < sniperChance) {
      // Padrão: Laser Rastreador / Sniper (Apenas Fase 2+, persegue com rotação suave e contínua sem teleportar)
      const startSide = Math.floor(Math.random() * 4);
      let sx = 0, sy = 0;
      if (startSide === 0) { sx = Math.random() * VIRTUAL_WIDTH; sy = 0; }
      else if (startSide === 1) { sx = VIRTUAL_WIDTH; sy = Math.random() * VIRTUAL_HEIGHT; }
      else if (startSide === 2) { sx = Math.random() * VIRTUAL_WIDTH; sy = VIRTUAL_HEIGHT; }
      else { sx = 0; sy = Math.random() * VIRTUAL_HEIGHT; }

      // No multiplayer X1, alterna ou sorteia qual jogador será o alvo do Sniper
      const targetPlayer = this.isMultiplayer ? (Math.random() < 0.5 ? 'p1' : 'p2') : 'p1';
      const targetObj = (this.isMultiplayer && targetPlayer === 'p2' && this.remotePlayer) ? this.remotePlayer : this.player;

      // Ângulo inicial com desvio suave: não surge teleportado diretamente no jogador
      const targetAngle = Math.atan2(targetObj.y - sy, targetObj.x - sx);
      const angleOffset = (Math.random() > 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.30);
      const initialAngle = targetAngle + angleOffset;

      const trackFollowTime = (this.level === 2) ? 1.05 : 0.85;
      const trackLockDelay = 0.20; // Delay de 0.2s com mira travada em todas as fases
      const totalWarningTime = trackFollowTime + trackLockDelay;
      const turnSpeed = (this.level === 2) ? 1.30 : 1.65; // Velocidade suave e calma em rad/s (sem correria na última hora)

      this.addLaser({
        x1: sx,
        y1: sy,
        x2: sx + Math.cos(initialAngle) * 1200,
        y2: sy + Math.sin(initialAngle) * 1200,
        currentAngle: initialAngle,
        turnSpeed: turnSpeed,
        warningDuration: totalWarningTime,
        fireDuration: fireTime,
        thickness: 16,
        isTracking: true,
        trackLockDelay: trackLockDelay,
        targetPlayer: targetPlayer,
        color: laserColor,
        warningRgb: warningRgb
      });
    } else if (roll < rotChance) {
      // Padrão: Laser Giratório (Movimento calmo)
      const anchor = {
        x: Math.random() > 0.5 ? VIRTUAL_WIDTH * 0.25 : VIRTUAL_WIDTH * 0.75,
        y: VIRTUAL_HEIGHT * 0.5
      };
      this.addLaser({
        x1: anchor.x,
        y1: anchor.y,
        x2: anchor.x + 800,
        y2: anchor.y,
        warningDuration: warningTime * 1.15,
        fireDuration: 0.75,
        thickness: 14,
        rotSpeed: (Math.random() > 0.5 ? 1 : -1) * rotSpeed,
        centerAnchor: anchor,
        color: laserColor,
        warningRgb: warningRgb
      });
    } else if (roll < 0.82) {
      // Padrão: Linhas Horizontais ou Verticais
      const isHorizontal = Math.random() > 0.5;
      if (isHorizontal) {
        const y = 50 + Math.random() * (VIRTUAL_HEIGHT - 100);
        this.addLaser({
          x1: 0,
          y1: y,
          x2: VIRTUAL_WIDTH,
          y2: y,
          warningDuration: warningTime,
          fireDuration: fireTime,
          thickness: 15,
          color: laserColor,
          warningRgb: warningRgb
        });
      } else {
        const x = 50 + Math.random() * (VIRTUAL_WIDTH - 100);
        this.addLaser({
          x1: x,
          y1: 0,
          x2: x,
          y2: VIRTUAL_HEIGHT,
          warningDuration: warningTime,
          fireDuration: fireTime,
          thickness: 15,
          color: laserColor,
          warningRgb: warningRgb
        });
      }
    } else {
      // Padrão Cruzado (Grade)
      const x = 100 + Math.random() * (VIRTUAL_WIDTH - 200);
      const y = 80 + Math.random() * (VIRTUAL_HEIGHT - 160);
      this.addLaser({
        x1: x, y1: 0, x2: x, y2: VIRTUAL_HEIGHT,
        warningDuration: warningTime, fireDuration: fireTime, thickness: 14,
        color: laserColor, warningRgb: warningRgb
      });
      this.addLaser({
        x1: 0, y1: y, x2: VIRTUAL_WIDTH, y2: y,
        warningDuration: warningTime, fireDuration: fireTime, thickness: 14,
        color: laserColor, warningRgb: warningRgb
      });
    }
  }

  triggerLaserRain(duration = 5.0) {
    this.laserRainActive = true;
    this.laserRainTimer = duration;
    this.laserRainDropTimer = 0;
    this.screenShake = 14;

    // Spawna uma bateria de energia para dar chance de Dash durante a tempestade
    this.spawnPickup();
    sounds.playLevelUp();
  }

  spawnPickup() {
    const margin = 70;
    const x = margin + Math.random() * (VIRTUAL_WIDTH - margin * 2);
    const y = margin + Math.random() * (VIRTUAL_HEIGHT - margin * 2);

    // Checa se já existe uma vida extra ativa na arena (mantém única e especial)
    const hasLifeActive = this.pickups.some(p => p.type === 'LIFE');

    let type = 'ENERGY';
    const roll = Math.random();

    // Probabilidade de vida extra com prazo de captura:
    // Se o jogador estiver com 1 vida (perigo crítico!): 50% de chance
    // Se o jogador estiver com 2 vidas: 35% de chance
    // Se o jogador estiver com 3 vidas (cheio): 15% de chance (bônus)
    const lifeChance = (!hasLifeActive) ? (this.player.lives === 1 ? 0.50 : (this.player.lives === 2 ? 0.35 : 0.15)) : 0;

    if (roll < lifeChance) {
      type = 'LIFE';
    } else if (!this.player.shieldActive && Math.random() < 0.35) {
      type = 'SHIELD';
    } else {
      type = 'ENERGY';
    }

    const pickup = new Pickup(x, y, type);
    this.pickups.push(pickup);

    if (this.isMultiplayer && this.isHost && this.network.isConnected) {
      this.network.send({
        type: 'SPAWN_PICKUP',
        id: pickup.id,
        x: pickup.x,
        y: pickup.y,
        pickupType: pickup.type
      });
    }
  }

  updateHUD() {
    // Atualiza corações de vida
    this.domLives.forEach((heart, idx) => {
      if (idx < this.player.lives) {
        heart.classList.add('active');
      } else {
        heart.classList.remove('active');
      }
    });

    // Pontos
    this.domScore.textContent = Math.floor(this.score);

    // Barra de Dash
    const dashCooldown = this.player.dashCooldownTimer;
    const dashMax = this.player.dashCooldownMax;
    const ratio = Math.max(0, 1 - (dashCooldown / dashMax));
    this.domDashBar.style.width = `${ratio * 100}%`;

    if (dashCooldown <= 0) {
      this.domDashBar.classList.add('ready');
    } else {
      this.domDashBar.classList.remove('ready');
    }
  }

  triggerPlayerShoot(aimWorldX, aimWorldY) {
    // O tiro a laser funciona EXCLUSIVAMENTE no multiplayer (Duelo X1)
    if (!this.isMultiplayer || this.gameState !== STATE.PLAYING) return;

    let dirX = 0;
    let dirY = 0;
    if (aimWorldX !== undefined && aimWorldY !== undefined) {
      dirX = aimWorldX - this.player.x;
      dirY = aimWorldY - this.player.y;
    } else {
      dirX = this.player.dashDirX || 1;
      dirY = this.player.dashDirY || 0;
    }

    const shotData = this.player.triggerShoot(dirX, dirY);
    if (!shotData) return; // Recarga de 5s ainda em andamento

    const myRole = this.isHost ? 'p1' : 'p2';
    const bulletColor = this.isHost ? '#00f0ff' : '#ff0055';

    const bulletId = 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const bullet = new LaserBullet({
      id: bulletId,
      shooterId: myRole,
      x: shotData.x,
      y: shotData.y,
      dirX: shotData.dirX,
      dirY: shotData.dirY,
      speed: 640,
      color: bulletColor
    });

    this.bullets.push(bullet);

    // Efeito de partículas no canhão do drone
    for (let k = 0; k < 14; k++) {
      const ang = Math.atan2(shotData.dirY, shotData.dirX) + (Math.random() - 0.5) * 1.3;
      const spd = 40 + Math.random() * 90;
      this.particles.push(new Particle(shotData.x, shotData.y, bulletColor, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.3, 3));
    }

    if (this.network && this.network.isConnected) {
      this.network.send({
        type: 'SPAWN_BULLET',
        bullet: {
          id: bullet.id,
          shooterId: myRole,
          x: bullet.x,
          y: bullet.y,
          dirX: bullet.dirX,
          dirY: bullet.dirY,
          speed: bullet.speed,
          color: bullet.color
        }
      });
    }

    this.updateShootHUD();
  }

  updateShootHUD() {
    if (!this.isMultiplayer) return;

    const cd = this.player.shootCooldownTimer;
    const maxCd = this.player.shootCooldownMax;
    const ratio = Math.max(0, 1 - (cd / maxCd));

    if (this.domShootBar) {
      this.domShootBar.style.width = `${ratio * 100}%`;
      if (cd <= 0) {
        this.domShootBar.classList.add('ready');
      } else {
        this.domShootBar.classList.remove('ready');
      }
    }

    if (this.domShootTimerText) {
      if (cd <= 0) {
        this.domShootTimerText.textContent = '⚡ TIRO PRONTO (E / CLIQUE)';
        this.domShootTimerText.classList.add('ready');
      } else {
        this.domShootTimerText.textContent = `⏳ RECARGA: ${cd.toFixed(1)}s`;
        this.domShootTimerText.classList.remove('ready');
      }
    }

    if (this.domMobileShootBtn) {
      if (cd <= 0) {
        this.domMobileShootBtn.classList.add('ready');
        this.domMobileShootBtn.style.opacity = '1';
      } else {
        this.domMobileShootBtn.classList.remove('ready');
        this.domMobileShootBtn.style.opacity = '0.55';
      }
    }
  }

  update(dt) {
    if (this.gameState !== STATE.PLAYING) return;

    if (this.isMultiplayer) {
      this.x1MatchTime += dt;
      this.networkSendTimer += dt;
      // Envia posição e estado a ~35Hz (a cada 0.028s)
      if (this.networkSendTimer >= 0.028) {
        this.networkSendTimer = 0;
        this.network.send({
          type: 'PLAYER_STATE',
          x: this.player.x,
          y: this.player.y,
          vx: this.player.vx,
          vy: this.player.vy,
          dirX: this.player.dashDirX,
          dirY: this.player.dashDirY,
          isDashing: this.player.isDashing,
          lives: this.player.lives,
          shieldActive: this.player.shieldActive,
          skinColor: this.player.skinColor
        });
      }

      // Atualiza rastros do oponente remoto se ele estiver com dash
      if (this.remotePlayer.isDashing) {
        this.remotePlayer.trail.unshift({ x: this.remotePlayer.x, y: this.remotePlayer.y, alpha: 0.6 });
        if (this.remotePlayer.trail.length > 6) this.remotePlayer.trail.pop();
      } else if (this.remotePlayer.trail.length > 0) {
        this.remotePlayer.trail.shift();
      }
    } else {
      this.survivalTime += dt;
      this.score += dt * 15; // Pontos por segundo vivo

      // Checagem de FASE: Conclui a fase ao atingir múltiplos de 5000 pontos (abre a Estação de Melhorias)
      // Exclui a Fase 10 (Boss Sans de Undertale), pois possui lógica própria de tempo de sobrevivência e vitória
      if (this.level !== 10 && this.score >= this.level * this.pointsPerLevel) {
        this.openPhaseShop();
      }
    }

    // Shake de tela amortecido
    if (this.screenShake > 0) {
      this.screenShake -= dt * 30;
      if (this.screenShake < 0) this.screenShake = 0;
    }

    // Input do Jogador
    const { x, y } = this.getInputDirection();
    this.player.update(dt, x, y, this.particles);

    // Evento Especial da Fase 5: Chuva de Lasers por 5 Segundos (apenas no modo solo)
    if (!this.isMultiplayer && this.level === 5 && this.levelTransitionTimer <= 0) {
      if (!this.phase5RainTriggered) {
        this.phase5RainTriggered = true;
        this.triggerLaserRain(5.0);
        this.phase5RainCooldown = 22.0;
      } else if (!this.laserRainActive) {
        this.phase5RainCooldown -= dt;
        if (this.phase5RainCooldown <= 0) {
          this.triggerLaserRain(5.0);
          this.phase5RainCooldown = 24.0;
        }
      }
    }

    // Evento Especial da Fase 10: Boss Sans de Undertale (Modo Solo)
    if (!this.isMultiplayer && this.level === 10 && this.gameState === STATE.PLAYING && this.levelTransitionTimer <= 0) {
      this.updateSansBossPhase(dt);
    }

    // Processamento da Chuva de Lasers Rápida (5 segundos de feixes rápidos)
    if (!this.isMultiplayer && this.laserRainActive) {
      this.laserRainTimer -= dt;
      this.laserRainDropTimer += dt;
      this.screenShake = Math.max(this.screenShake, 3);

      // Dispara feixes rápidos verticais e inclinados a cada 0.12s
      if (this.laserRainDropTimer >= 0.12) {
        this.laserRainDropTimer = 0;
        const rx = 35 + Math.random() * (VIRTUAL_WIDTH - 70);
        const slant = (Math.random() - 0.5) * 80;

        this.addLaser({
          x1: rx,
          y1: 0,
          x2: rx + slant,
          y2: VIRTUAL_HEIGHT,
          warningDuration: 0.38, // Aviso rápido
          fireDuration: 0.18,    // Disparo rápido
          thickness: 11,
          color: (Math.random() > 0.45) ? '#00f0ff' : '#ffe600',
          warningRgb: '0, 240, 255'
        });
      }

      if (this.laserRainTimer <= 0) {
        this.laserRainActive = false;
        // Bônus de sobrevida: concede um escudo ou orbe ao sobreviver à tempestade!
        this.spawnPickup();
      }
    }

    // Se estiver em transição de fase (pausa tática pós-anúncio), aguarda antes de novos disparos
    if (!this.isMultiplayer && this.levelTransitionTimer > 0) {
      this.levelTransitionTimer -= dt;
    } else if (!this.laserRainActive && (!this.isMultiplayer || this.isHost) && this.level !== 10) {
      // Spawners de Lasers com cadência equilibrada e justa (pausado durante a chuva rápida de 5s)
      this.laserSpawnTimer += dt;
      let currentSpawnRate = 1.30;
      if (this.isMultiplayer) {
        // No duelo X1: cadência dinâmica e intensa conforme o tempo de partida avança
        currentSpawnRate = Math.max(0.70, 1.25 - this.x1MatchTime * 0.008);
      } else if (this.level === 1) {
        currentSpawnRate = Math.max(1.10, 1.6 - this.survivalTime * 0.008);
      } else if (this.level === 2) {
        // Na Fase 2: intervalo relaxado de 1.25 segundos entre feixes (bem mais fácil de desviar)
        currentSpawnRate = 1.25;
      } else {
        currentSpawnRate = 0.90;
      }

      if (this.laserSpawnTimer >= currentSpawnRate) {
        this.laserSpawnTimer = 0;
        this.spawnLaserPattern();
      }
    }

    // Spawner de Pickups (apenas no solo ou host)
    if (!this.isMultiplayer || this.isHost) {
      this.pickupSpawnTimer += dt;
      const pickupCooldown = this.isMultiplayer ? 4.8 : (this.level === 2 ? 4.2 : 5.5);
      if (this.pickupSpawnTimer >= pickupCooldown) {
        this.pickupSpawnTimer = 0;
        if (this.pickups.length < 3) {
          this.spawnPickup();
        }
      }
    }

    // Atualiza Lasers e Colisões
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      if (this.isMultiplayer) {
        const p1X = this.isHost ? this.player.x : this.remotePlayer.x;
        const p1Y = this.isHost ? this.player.y : this.remotePlayer.y;
        const p2X = this.isHost ? this.remotePlayer.x : this.player.x;
        const p2Y = this.isHost ? this.remotePlayer.y : this.player.y;
        laser.update(dt, p1X, p1Y, p2X, p2Y);
      } else {
        laser.update(dt, this.player.x, this.player.y);
      }

      if (laser.state === 'DONE') {
        this.lasers.splice(i, 1);
        continue;
      }

      // Checa colisão com o jogador local
      if (laser.checkCollision(this.player.x, this.player.y, this.player.radius)) {
        const tookHit = this.player.takeDamage(this.particles);
        if (tookHit) {
          if (this.level === 10) {
            // KR (Karmic Retribution): Com Núcleo de Escudo Nível 10, protege por 0.75s (ao invés de 0.45s)
            const shieldLvl = this.upgrades.shieldCore || 0;
            this.player.invulnerableTimer = (shieldLvl >= 10) ? 0.75 : 0.45;
            this.screenShake = 18;
          } else {
            this.screenShake = 12;
          }
          if (this.isMultiplayer) {
            this.updateX1HUD();
            this.network.send({
              type: 'PLAYER_HIT',
              lives: this.player.lives,
              shieldActive: this.player.shieldActive
            });
            if (this.player.lives <= 0) {
              const enemyRole = this.isHost ? 'p2' : 'p1';
              this.network.send({
                type: 'GAME_OVER_X1',
                winner: enemyRole
              });
              this.triggerX1GameOver(false);
              return;
            }
          } else {
            this.updateHUD();
            if (this.player.lives <= 0) {
              this.triggerGameOver();
              return;
            }
          }
        }
      }
    }

    // Atualiza Balas de Laser e Colisões (Dano Perfurante)
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt, this.particles);

      if (b.isOutOfBounds()) {
        this.bullets.splice(i, 1);
        continue;
      }

      // No modo Multiplayer: checa colisões do tiro nos dois jogadores (Dano Perfurante 100% garantido)
      if (this.isMultiplayer) {
        const myRole = this.isHost ? 'p1' : 'p2';
        const enemyRole = this.isHost ? 'p2' : 'p1';

        // 1. Checa se uma bala disparada pelo oponente acertou o drone LOCAL
        if (b.shooterId !== myRole && !this.consumedBulletIds.has(b.id)) {
          if (b.checkCollision(this.player.x, this.player.y, this.player.radius)) {
            this.consumedBulletIds.add(b.id);
            this.bullets.splice(i, 1);
            this.player.takePiercingDamage(this.particles);
            this.screenShake = 16;
            this.updateX1HUD();

            this.network.send({
              type: 'PLAYER_BULLET_HIT',
              bulletId: b.id,
              victimLives: this.player.lives,
              victimShield: this.player.shieldActive
            });

            if (this.player.lives <= 0) {
              this.network.send({
                type: 'GAME_OVER_X1',
                winner: enemyRole
              });
              this.triggerX1GameOver(false);
              return;
            }
            continue;
          }
        }

        // 2. Checa se a MINHA bala acertou o drone RIVAL (Shooter-authoritative: garante o dano visual)
        if (b.shooterId === myRole && !this.consumedBulletIds.has(b.id)) {
          if (b.checkCollision(this.remotePlayer.x, this.remotePlayer.y, this.remotePlayer.radius)) {
            this.consumedBulletIds.add(b.id);
            this.bullets.splice(i, 1);
            this.remotePlayer.lives = Math.max(0, this.remotePlayer.lives - 1);
            sounds.playPiercingHit();
            this.screenShake = 16;

            for (let k = 0; k < 40; k++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 90 + Math.random() * 200;
              this.particles.push(new Particle(this.remotePlayer.x, this.remotePlayer.y, '#ff0055', Math.cos(ang) * spd, Math.sin(ang) * spd, 0.6, 3.5));
            }

            this.updateX1HUD();

            this.network.send({
              type: 'DIRECT_BULLET_IMPACT',
              bulletId: b.id,
              newRivalLives: this.remotePlayer.lives
            });

            if (this.remotePlayer.lives <= 0) {
              this.network.send({
                type: 'GAME_OVER_X1',
                winner: myRole
              });
              this.triggerX1GameOver(true);
              return;
            }
            continue;
          }
        }
      }
    }

    if (!this.isMultiplayer && this.bullets.length > 0) {
      this.bullets = [];
    }

    // Atualiza Coletáveis (Pickups)
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.update(dt);

      // Se a melhoria Ímã de Energia estiver ativa, atrai os colecionáveis próximos conforme o nível (1 a 10)
      const magnetLvl = this.upgrades.energyMagnet || 0;
      if (magnetLvl > 0) {
        const mDist = Math.hypot(this.player.x - p.x, this.player.y - p.y);
        const magnetRadius = 60 + magnetLvl * 28; // Nv 1: 88px ... Nv 10: 340px (atrai quase a tela toda!)
        const magnetSpeed = 130 + magnetLvl * 24;  // Nv 1: 154px/s ... Nv 10: 370px/s
        if (mDist < magnetRadius && mDist > 1) {
          p.x += ((this.player.x - p.x) / mDist) * magnetSpeed * dt;
          p.y += ((this.player.y - p.y) / mDist) * magnetSpeed * dt;
        }
      }

      // Coleta pelo jogador local
      const dist = Math.hypot(this.player.x - p.x, this.player.y - p.y);
      if (dist <= this.player.radius + p.radius) {
        const boostLvl = this.upgrades.creditBoost || 0;
        const creditMult = 1 + boostLvl * 0.20; // Nv 10: +200% de moedas (3x créditos!)

        if (p.type === 'ENERGY') {
          this.score += 350;
          this.addCredits(Math.round(15 * creditMult));
          this.player.dashCooldownTimer = 0; // Recarrega Dash imediatamente!
          sounds.playCollect();
        } else if (p.type === 'SHIELD') {
          this.player.shieldActive = true;
          this.score += 200;
          this.addCredits(Math.round(10 * creditMult));
          sounds.playShieldUp();
        } else if (p.type === 'LIFE') {
          // VIDA EXTRA COM PRAZO DE CAPTURA!
          if (this.player.lives < 3) {
            this.player.lives++;
            this.score += 500;
          } else {
            // Se já estiver com vidas cheias: concede escudo + super bônus de pontos
            this.player.shieldActive = true;
            this.score += 800;
          }
          this.addCredits(Math.round(25 * creditMult));
          sounds.playExtraLife();
        }

        // Partículas de coleta
        const pColor = (p.type === 'LIFE') ? '#ff0055' : (p.type === 'ENERGY' ? '#ffe600' : '#00ffaa');
        const pCount = (p.type === 'LIFE') ? 28 : 18;
        for (let k = 0; k < pCount; k++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = (p.type === 'LIFE' ? 80 : 60) + Math.random() * 120;
          this.particles.push(new Particle(p.x, p.y, pColor, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.55, (p.type === 'LIFE' ? 4 : 3)));
        }

        if (this.isMultiplayer) {
          this.network.send({
            type: 'COLLECT_PICKUP',
            id: p.id
          });
          this.updateX1HUD();
        } else {
          this.updateHUD();
        }

        this.pickups.splice(i, 1);
        continue;
      }

      if (p.life <= 0) {
        if (p.type === 'LIFE') {
          // Efeito de perda / dissipação da vida extra expirada
          for (let k = 0; k < 14; k++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 30 + Math.random() * 60;
            this.particles.push(new Particle(p.x, p.y, 'rgba(255, 50, 100, 0.6)', Math.cos(ang) * spd, Math.sin(ang) * spd, 0.45, 2.5));
          }
        }
        this.pickups.splice(i, 1);
      }
    }

    // Atualiza Partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];
      part.update(dt);
      if (part.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Trava de segurança de partículas para estabilizar FPS em sessões longas e bullet hell denso
    if (this.particles.length > 250) {
      this.particles.splice(0, this.particles.length - 250);
    }

    if (this.isMultiplayer) {
      this.updateX1HUD();
    } else {
      this.updateHUD();
    }
  }

  draw() {
    this.ctx.save();

    // Aplica Screen Shake
    if (this.screenShake > 0) {
      const ox = (Math.random() - 0.5) * this.screenShake;
      const oy = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(ox, oy);
    }

    // Fundo da Arena
    this.ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Paleta de Cores Dinâmica da Arena conforme a Fase
    let gridColor = 'rgba(0, 240, 255, 0.04)';
    let borderColor = 'rgba(0, 240, 255, 0.35)';
    if (this.level === 2) {
      gridColor = 'rgba(181, 55, 242, 0.06)';
      borderColor = 'rgba(181, 55, 242, 0.45)';
    } else if (this.level === 10) {
      // Estilo Monocromático de Undertale / Sans: Preto profundo e borda branca de batalha!
      gridColor = 'rgba(0, 240, 255, 0.07)';
      borderColor = 'rgba(255, 255, 255, 0.90)';
    } else if (this.level >= 3) {
      gridColor = 'rgba(255, 230, 0, 0.06)';
      borderColor = 'rgba(255, 230, 0, 0.50)';
    }

    // Grade Tecnológica de Fundo
    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 1;
    const gridSize = 45;
    for (let x = 0; x < VIRTUAL_WIDTH; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, VIRTUAL_HEIGHT);
      this.ctx.stroke();
    }
    for (let y = 0; y < VIRTUAL_HEIGHT; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(VIRTUAL_WIDTH, y);
      this.ctx.stroke();
    }

    // Borda Neon da Arena
    this.ctx.strokeStyle = borderColor;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(4, 4, VIRTUAL_WIDTH - 8, VIRTUAL_HEIGHT - 8);

    // Desenha Elementos
    for (let p of this.pickups) {
      p.draw(this.ctx);
    }

    for (let l of this.lasers) {
      l.draw(this.ctx);
    }

    for (let b of this.bullets) {
      b.draw(this.ctx);
    }

    for (let part of this.particles) {
      part.draw(this.ctx);
    }

    if (this.gameState === STATE.PLAYING || this.gameState === STATE.MENU) {
      this.player.draw(this.ctx);
      if (this.isMultiplayer) {
        this.remotePlayer.draw(this.ctx);
      }
    }

    // HUD e Visual do Boss Sans na Fase 10
    if (!this.isMultiplayer && this.level === 10 && this.gameState === STATE.PLAYING) {
      this.drawSansBossHUD();
    }

    // Alerta Visual de Chuva de Lasers Rápida (Fase 5)
    if (this.laserRainActive && this.laserRainTimer > 0) {
      this.ctx.save();
      this.ctx.textAlign = 'center';
      this.ctx.font = '900 15px "Orbitron", sans-serif';
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 14;
      this.ctx.fillText(`⚡ CHUVA DE LASERS: ${Math.max(0, this.laserRainTimer).toFixed(1)}s ⚡`, VIRTUAL_WIDTH / 2, 75);
      this.ctx.restore();
    }

    this.ctx.restore();
  }

  // ==========================================
  // SANS BOSS FIGHT (FASE 10 - UNDERTALE)
  // ==========================================

  startSansBossDirect() {
    this.isMultiplayer = false;
    this.gameState = STATE.PLAYING;
    this.score = 45000;
    this.survivalTime = 0;
    this.level = 10;
    this.levelTransitionTimer = 0;
    this.lasers = [];
    this.bullets = [];
    this.pickups = [];
    this.particles = [];
    this.consumedBulletIds = new Set();

    if (this.domShootBox) this.domShootBox.classList.add('hidden');
    if (this.domMobileShootBtn) this.domMobileShootBtn.classList.add('hidden');

    this.player.reset(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    this.player.lives = 3;
    this.player.nameTag = null;
    this.player.skinColor = SKINS[this.equippedSkin]?.color || '#00f0ff';

    // Todos os poderes no NÍVEL 10 para o duelo contra Sans (vida mantida em 3 corações)
    this.upgrades = {
      energyMagnet: 10,
      dashTurbine: 10,
      shieldCore: 10,
      creditBoost: 10
    };
    this.player.shieldActive = true;
    this.sansShieldRechargeTimer = 0;
    this.applyUpgradesToPlayer();

    // Fecha todas as telas sobrepostas e ativa a HUD de jogo
    if (this.domHudSingle) this.domHudSingle.classList.remove('hidden');
    if (this.domHudX1) this.domHudX1.classList.add('hidden');
    if (this.domStartScreen) this.domStartScreen.classList.add('hidden');
    if (this.domGameOverScreen) this.domGameOverScreen.classList.add('hidden');
    if (this.domShopScreen) this.domShopScreen.classList.add('hidden');
    if (this.domPhaseShopModal) this.domPhaseShopModal.classList.add('hidden');
    if (this.domModeModal) this.domModeModal.classList.add('hidden');
    if (this.domLobbyModal) this.domLobbyModal.classList.add('hidden');
    if (this.domJoinModal) this.domJoinModal.classList.add('hidden');
    if (this.domX1GameOverModal) this.domX1GameOverModal.classList.add('hidden');
    if (this.domAuthModal) this.domAuthModal.classList.add('hidden');
    if (this.domRankingModal) this.domRankingModal.classList.add('hidden');
    if (this.domProfileModal) this.domProfileModal.classList.add('hidden');

    this.updateHUD();
    this.initSansBossPhase();
  }

  initSansBossPhase() {
    this.sansTimer = 0;
    this.sansStep1Triggered = false;
    this.sansStep2Triggered = false;
    this.sansStep3Triggered = false;
    this.sansCircleTriggered = false;
    this.sansSpecialRingTriggered = false;
    this.sansVictoryTriggered = false;
    this.sansBoneTimer = 0;
    this.sansBlasterTimer = 0;
    this.sansGravityTimer = 0;
    this.sansCircleSubTimer = 0;
    this.sansSlamStep = 0;
    this.sansDialogue = '💀 SANS: "é um belo dia lá fora..."';
    this.sansDialogueTimer = 3.0;

    // Garante todos os poderes no Nível 10 (menos a vida, que é mantida em 3 corações)
    this.upgrades = {
      energyMagnet: 10,
      dashTurbine: 10,
      shieldCore: 10,
      creditBoost: 10
    };
    this.player.shieldActive = true;
    this.sansShieldRechargeTimer = 0;
    this.applyUpgradesToPlayer();

    sounds.playSansMegalovania();
    this.showLevelBanner('★ FASE 10: SANS (MODO GENOCIDA) ★', '⚡ TODOS OS PODERES NO NÍVEL 10 ATIVADOS! | Sobreviva com suas 3 Vidas!', 3200);
  }

  updateSansBossPhase(dt) {
    this.sansTimer += dt;
    const t = this.sansTimer;

    // Diálogos clássicos e intensos de Sans
    if (t < 2.4) {
      this.sansDialogue = '💀 SANS: "é um belo dia lá fora. pássaros cantando, flores desabrochando..."';
    } else if (t < 4.5) {
      this.sansDialogue = '💀 SANS: "em dias como esses, crianças como você..."';
    } else if (t < 7.0) {
      this.sansDialogue = '💀 SANS: "DEVERIAM QUEIMAR NO INFERNO!"';
    } else if (t < 16.0) {
      this.sansDialogue = '💀 SANS: "sente seus pecados rastejando pelas costas? DESVIE DOS OSSOS!"';
    } else if (t < 26.0) {
      this.sansDialogue = '💀 SANS: "GASTER BLASTERS DUPLOS! MIRA DE 0.4s! VAI AGUENTAR?!"';
    } else if (t < 33.0) {
      this.sansDialogue = '💀 SANS: "TELECINESE TOTAL! CONTROLE DE GRAVIDADE!"';
    } else if (t < 46.0) {
      this.sansDialogue = '💀 SANS: "MEU ATAQUE FINAL: A RODA DA MORTE DOS GASTER BLASTERS!"';
    } else if (t < 50.0) {
      this.sansDialogue = '💀 SANS: "ÚLTIMO GOLPE: CERCO DE BLASTERS EM 360°! USE O DASH AGORA!"';
    } else if (t < 53.0) {
      this.sansDialogue = '💀 SANS: "argh... você... é insistente demais... zzz... zzz..."';
    }

    // Núcleo de Escudo Nível 10: Auto-regeneração de Escudo a cada 14s sem escudo!
    if (!this.player.shieldActive) {
      this.sansShieldRechargeTimer = (this.sansShieldRechargeTimer || 0) + dt;
      if (this.sansShieldRechargeTimer >= 14.0) {
        this.sansShieldRechargeTimer = 0;
        this.player.shieldActive = true;
        sounds.playShieldUp();
        this.showLevelBanner('🛡️ ESCUDO NÍVEL 10 RESTAURADO! 🛡️', 'O Núcleo Quântico gerou uma nova barreira protetora!', 2000);
      }
    } else {
      this.sansShieldRechargeTimer = 0;
    }

    // Spawna orbe de cura/escudo de emergência em momentos estratégicos
    if ((Math.abs(t - 14.0) < dt || Math.abs(t - 28.0) < dt || Math.abs(t - 40.0) < dt) && this.pickups.length < 2) {
      this.spawnPickup();
    }

    // 1. O PRIMEIRO GOLPE (0s - 7s): Abertura brutal e veloz
    if (t >= 2.2 && !this.sansStep1Triggered) {
      this.sansStep1Triggered = true;
      this.triggerSansGravitySlam('DOWN');
      this.addLaser({
        x1: 240, y1: 0, x2: 240, y2: VIRTUAL_HEIGHT,
        warningDuration: 0.38, fireDuration: 0.40, thickness: 34,
        isGasterBlaster: true, color: '#00f0ff', warningRgb: '0, 240, 255'
      });
      this.addLaser({
        x1: 660, y1: 0, x2: 660, y2: VIRTUAL_HEIGHT,
        warningDuration: 0.38, fireDuration: 0.40, thickness: 34,
        isGasterBlaster: true, color: '#00f0ff', warningRgb: '0, 240, 255'
      });
    }

    if (t >= 3.8 && !this.sansStep2Triggered) {
      this.sansStep2Triggered = true;
      this.triggerSansGravitySlam('RIGHT');
      this.addLaser({
        x1: 0, y1: 160, x2: VIRTUAL_WIDTH, y2: 160,
        warningDuration: 0.38, fireDuration: 0.40, thickness: 34,
        isGasterBlaster: true, color: '#00f0ff', warningRgb: '0, 240, 255'
      });
      this.addLaser({
        x1: 0, y1: 440, x2: VIRTUAL_WIDTH, y2: 440,
        warningDuration: 0.38, fireDuration: 0.40, thickness: 34,
        isGasterBlaster: true, color: '#00f0ff', warningRgb: '0, 240, 255'
      });
    }

    if (t >= 5.4 && !this.sansStep3Triggered) {
      this.sansStep3Triggered = true;
      this.triggerSansGravitySlam('UP');
      this.addLaser({
        x1: 0, y1: 0, x2: VIRTUAL_WIDTH, y2: VIRTUAL_HEIGHT,
        warningDuration: 0.38, fireDuration: 0.40, thickness: 30,
        isGasterBlaster: true, color: '#00f0ff', warningRgb: '0, 240, 255'
      });
      this.addLaser({
        x1: VIRTUAL_WIDTH, y1: 0, x2: 0, y2: VIRTUAL_HEIGHT,
        warningDuration: 0.38, fireDuration: 0.40, thickness: 30,
        isGasterBlaster: true, color: '#00f0ff', warningRgb: '0, 240, 255'
      });
    }

    // 2. TEMPESTADE E MATRIX DE OSSOS (7s - 16s) - Frequência acelerada de 0.65s!
    if (t >= 7.0 && t < 16.0) {
      this.sansBoneTimer = (this.sansBoneTimer || 0) + dt;
      if (this.sansBoneTimer >= 0.65) {
        this.sansBoneTimer = 0;
        this.triggerSansHardcoreBoneWave();
      }
    }

    // 3. GASTER BLASTERS SNIPERS DUPLOS (16s - 26s) - 2 Blasters com delay de mira de 0.4s!
    if (t >= 16.0 && t < 26.0) {
      this.sansBlasterTimer = (this.sansBlasterTimer || 0) + dt;
      if (this.sansBlasterTimer >= 0.85) {
        this.sansBlasterTimer = 0;
        this.triggerSansTargetBlastersDouble();
      }
    }

    // 4. CAOS DE TELECINESE / MULTI-SLAM (26s - 33s) - Slams a cada 0.85s!
    if (t >= 26.0 && t < 33.0) {
      this.sansGravityTimer = (this.sansGravityTimer || 0) + dt;
      if (this.sansGravityTimer >= 0.85) {
        this.sansGravityTimer = 0;
        this.sansSlamStep = (this.sansSlamStep || 0) + 1;
        const dirs = ['DOWN', 'LEFT', 'UP', 'RIGHT', 'DOWN'];
        const dir = dirs[this.sansSlamStep % dirs.length];
        this.triggerSansGravitySlam(dir);
      }
    }

    // 5. O CÍRCULO GIRATÓRIO DA MORTE (33s - 46s) - 8 Blasters a 1.30 rad/s + Perigos Centrais
    if (t >= 33.0 && !this.sansCircleTriggered) {
      this.sansCircleTriggered = true;
      this.triggerSansSpinningCircle(13.0);
    }

    if (t >= 33.0 && t < 46.0) {
      this.sansCircleSubTimer = (this.sansCircleSubTimer || 0) + dt;
      if (this.sansCircleSubTimer >= 1.6) {
        this.sansCircleSubTimer = 0;
        // Spawna feixe extra no centro para obrigar esquiva constante
        this.triggerSansHardcoreBoneWave();
      }
    }

    // 6. ATAQUE ESPECIAL FINAL: CERCO 360° (46.5s - 50s)
    if (t >= 46.5 && !this.sansSpecialRingTriggered) {
      this.sansSpecialRingTriggered = true;
      this.triggerSansRingOfBlasters();
    }

    // 7. VITÓRIA CONTRA SANS (53s+)
    if (t >= 53.0 && !this.sansVictoryTriggered) {
      this.sansVictoryTriggered = true;
      this.triggerSansVictory();
    }
  }

  triggerSansGravitySlam(dir) {
    sounds.playSansSlam();
    this.screenShake = 18;
    this.player.isBlueSoul = true;
    this.player.blueSoulTimer = 1.4;

    const slamSpeed = 820;
    if (dir === 'DOWN') {
      this.player.y = Math.min(VIRTUAL_HEIGHT - 60, this.player.y + 25);
      this.player.slamVy = slamSpeed;
      for (let k = 0; k < 25; k++) {
        this.particles.push(new Particle(this.player.x, this.player.y, '#0055ff', (Math.random() - 0.5) * 140, -100 - Math.random() * 200, 0.5, 3.5));
      }
      this.addLaser({
        x1: 15, y1: VIRTUAL_HEIGHT - 35, x2: VIRTUAL_WIDTH - 15, y2: VIRTUAL_HEIGHT - 35,
        warningDuration: 0.38, fireDuration: 0.35, thickness: 26,
        isBone: true, color: '#ffffff', warningRgb: '0, 150, 255'
      });
    } else if (dir === 'UP') {
      this.player.y = Math.max(60, this.player.y - 25);
      this.player.slamVy = -slamSpeed;
      for (let k = 0; k < 25; k++) {
        this.particles.push(new Particle(this.player.x, this.player.y, '#0055ff', (Math.random() - 0.5) * 140, 100 + Math.random() * 200, 0.5, 3.5));
      }
      this.addLaser({
        x1: 15, y1: 35, x2: VIRTUAL_WIDTH - 15, y2: 35,
        warningDuration: 0.38, fireDuration: 0.35, thickness: 26,
        isBone: true, color: '#ffffff', warningRgb: '0, 150, 255'
      });
    } else if (dir === 'LEFT') {
      this.player.x = Math.max(60, this.player.x - 25);
      this.player.slamVx = -slamSpeed;
      for (let k = 0; k < 25; k++) {
        this.particles.push(new Particle(this.player.x, this.player.y, '#0055ff', 100 + Math.random() * 200, (Math.random() - 0.5) * 140, 0.5, 3.5));
      }
      this.addLaser({
        x1: 35, y1: 15, x2: 35, y2: VIRTUAL_HEIGHT - 15,
        warningDuration: 0.38, fireDuration: 0.35, thickness: 26,
        isBone: true, color: '#ffffff', warningRgb: '0, 150, 255'
      });
    } else if (dir === 'RIGHT') {
      this.player.x = Math.min(VIRTUAL_WIDTH - 60, this.player.x + 25);
      this.player.slamVx = slamSpeed;
      for (let k = 0; k < 25; k++) {
        this.particles.push(new Particle(this.player.x, this.player.y, '#0055ff', -100 - Math.random() * 200, (Math.random() - 0.5) * 140, 0.5, 3.5));
      }
      this.addLaser({
        x1: VIRTUAL_WIDTH - 35, y1: 15, x2: VIRTUAL_WIDTH - 35, y2: VIRTUAL_HEIGHT - 15,
        warningDuration: 0.38, fireDuration: 0.35, thickness: 26,
        isBone: true, color: '#ffffff', warningRgb: '0, 150, 255'
      });
    }
  }

  triggerSansHardcoreBoneWave() {
    sounds.playGasterBlasterCharge();
    const mode = Math.floor(Math.random() * 3);

    if (mode === 0) {
      // Duplo feixe horizontal com fresta estreita
      const gapY = 120 + Math.random() * (VIRTUAL_HEIGHT - 240);
      const gapHeight = 110;
      this.addLaser({
        x1: 0, y1: gapY - gapHeight / 2,
        x2: VIRTUAL_WIDTH, y2: gapY - gapHeight / 2,
        warningDuration: 0.46, fireDuration: 0.35, thickness: 22,
        isBone: true, color: '#ffffff', warningRgb: '255, 255, 255'
      });
      this.addLaser({
        x1: 0, y1: gapY + gapHeight / 2,
        x2: VIRTUAL_WIDTH, y2: gapY + gapHeight / 2,
        warningDuration: 0.46, fireDuration: 0.35, thickness: 22,
        isBone: true, color: '#ffffff', warningRgb: '255, 255, 255'
      });
    } else if (mode === 1) {
      // Duplo feixe vertical com fresta estreita
      const gapX = 140 + Math.random() * (VIRTUAL_WIDTH - 280);
      const gapWidth = 110;
      this.addLaser({
        x1: gapX - gapWidth / 2, y1: 0,
        x2: gapX - gapWidth / 2, y2: VIRTUAL_HEIGHT,
        warningDuration: 0.46, fireDuration: 0.35, thickness: 22,
        isBone: true, color: '#ffffff', warningRgb: '255, 255, 255'
      });
      this.addLaser({
        x1: gapX + gapWidth / 2, y1: 0,
        x2: gapX + gapWidth / 2, y2: VIRTUAL_HEIGHT,
        warningDuration: 0.46, fireDuration: 0.35, thickness: 22,
        isBone: true, color: '#ffffff', warningRgb: '255, 255, 255'
      });
    } else {
      // Cruzamento simultâneo horizontal + vertical nos eixos do jogador
      const pX = Math.max(80, Math.min(VIRTUAL_WIDTH - 80, this.player.x));
      const pY = Math.max(80, Math.min(VIRTUAL_HEIGHT - 80, this.player.y));
      this.addLaser({
        x1: 0, y1: pY,
        x2: VIRTUAL_WIDTH, y2: pY,
        warningDuration: 0.44, fireDuration: 0.35, thickness: 24,
        isBone: true, color: '#ffffff', warningRgb: '255, 255, 255'
      });
      this.addLaser({
        x1: pX, y1: 0,
        x2: pX, y2: VIRTUAL_HEIGHT,
        warningDuration: 0.44, fireDuration: 0.35, thickness: 24,
        isBone: true, color: '#ffffff', warningRgb: '255, 255, 255'
      });
    }
  }

  triggerSansTargetBlastersDouble() {
    sounds.playGasterBlasterCharge();
    const sides = [0, 1, 2, 3];
    const s1 = sides[Math.floor(Math.random() * sides.length)];
    const s2 = (s1 + 2) % 4; // Lado oposto para feixes cruzados

    [s1, s2].forEach((side, idx) => {
      let sx = 0, sy = 0;
      if (side === 0) { sx = 80 + Math.random() * (VIRTUAL_WIDTH - 160); sy = 0; }
      else if (side === 1) { sx = VIRTUAL_WIDTH; sy = 60 + Math.random() * (VIRTUAL_HEIGHT - 120); }
      else if (side === 2) { sx = 80 + Math.random() * (VIRTUAL_WIDTH - 160); sy = VIRTUAL_HEIGHT; }
      else { sx = 0; sy = 60 + Math.random() * (VIRTUAL_HEIGHT - 120); }

      const angle = Math.atan2(this.player.y - sy, this.player.x - sx);

      const trackFollowTime = 0.35 + idx * 0.05;
      const trackLockDelay = 0.40; // Delay aumentado para 0.4s apenas na fase do Sam conforme solicitado

      this.addLaser({
        x1: sx, y1: sy,
        x2: sx + Math.cos(angle) * 1400,
        y2: sy + Math.sin(angle) * 1400,
        currentAngle: angle,
        turnSpeed: 3.2,
        warningDuration: trackFollowTime + trackLockDelay,
        fireDuration: 0.35,
        thickness: 34,
        isTracking: true,
        trackLockDelay: trackLockDelay,
        isGasterBlaster: true,
        color: '#00f0ff',
        warningRgb: '0, 240, 255'
      });
    });
  }

  triggerSansSpinningCircle(duration = 13.0) {
    sounds.playGasterBlasterCharge();
    this.screenShake = 18;
    this.showLevelBanner('💀 ATAQUE FINAL: RODA DA MORTE DOS GASTER BLASTERS! 💀', '8 Gaster Blasters girando em alta velocidade! Acompanhe a órbita!', 3000);

    const center = { x: VIRTUAL_WIDTH / 2, y: VIRTUAL_HEIGHT / 2 };
    const numBlasters = 8;
    const orbitRadius = 275;
    const rotSpeed = 1.30; // 1.30 rad/s - muito mais veloz e mortal!

    for (let i = 0; i < numBlasters; i++) {
      const baseAngle = (i / numBlasters) * Math.PI * 2;
      this.addLaser({
        centerAnchor: center,
        orbitRadius: orbitRadius,
        orbitAngle: baseAngle,
        rotSpeed: rotSpeed,
        beamAngleOffset: Math.PI,
        length: 800,
        warningDuration: 0.75,
        fireDuration: duration,
        thickness: 28,
        isGasterBlaster: true,
        color: '#00f0ff',
        warningRgb: '0, 240, 255'
      });
    }
  }

  triggerSansRingOfBlasters() {
    sounds.playGasterBlasterCharge();
    this.screenShake = 24;
    this.showLevelBanner('⚠️ ATAQUE ESPECIAL DE SANS: CERCO TOTAL 360°! ⚠️', 'USE O DASH PARA ESCAPAR DO ANEL ANTES DO DISPARO!', 2500);

    const center = { x: VIRTUAL_WIDTH / 2, y: VIRTUAL_HEIGHT / 2 };
    const numBlasters = 10;
    const radius = 340;

    for (let i = 0; i < numBlasters; i++) {
      const angle = (i / numBlasters) * Math.PI * 2;
      const bx = center.x + Math.cos(angle) * radius;
      const by = center.y + Math.sin(angle) * radius;
      const beamAngle = angle + Math.PI;

      this.addLaser({
        x1: bx, y1: by,
        x2: bx + Math.cos(beamAngle) * 900,
        y2: by + Math.sin(beamAngle) * 900,
        warningDuration: 0.85,
        fireDuration: 0.65,
        thickness: 36,
        isGasterBlaster: true,
        color: '#00f0ff',
        warningRgb: '0, 240, 255'
      });
    }
  }

  triggerSansVictory() {
    this.lasers = [];
    sounds.playLevelUp();
    this.screenShake = 16;
    this.sansDialogue = '💀 SANS: "droga... você venceu... nada mal, pivete..."';
    this.showLevelBanner('🏆 VOCÊ DERROTOU O SANS! 🏆', 'Sobreviveu à rota mais difícil de Undertale! (+1000 🪙)', 4200);

    this.addCredits(1000);

    if (!this.ownedSkins.includes('sans')) {
      this.ownedSkins.push('sans');
      localStorage.setItem('laser_reflex_owned_skins', JSON.stringify(this.ownedSkins));
      if (this.db) {
        this.db.saveProgress({ unlockedSkins: this.ownedSkins });
      }
    }

    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this.spawnPickup();
      }, i * 250);
    }

    // Após 4 segundos de celebração e orbes na arena, abre a tela de vitória oficial!
    setTimeout(() => {
      if (this.gameState === STATE.PLAYING && this.level === 10) {
        this.triggerGameOver(true);
      }
    }, 4000);
  }

  drawSansBossHUD() {
    this.ctx.save();

    // 1. Barra de Sobrevivência do Boss Sans no Topo
    const barWidth = 360;
    const barHeight = 14;
    const barX = (VIRTUAL_WIDTH - barWidth) / 2;
    const barY = 26;

    const totalBossTime = 53.0;
    const progress = Math.min(1.0, this.sansTimer / totalBossTime);

    this.ctx.fillStyle = 'rgba(10, 12, 20, 0.92)';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(barX, barY, barWidth, barHeight);
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);

    const fillWidth = barWidth * (1.0 - progress);
    this.ctx.fillStyle = (Math.floor(Date.now() / 120) % 2 === 0) ? '#00f0ff' : '#ffe600';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 12;
    this.ctx.fillRect(barX, barY, fillWidth, barHeight);

    // Texto de Status com KR
    this.ctx.font = 'bold 12px "Orbitron", sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 8;
    this.ctx.fillText(`💀 SANS (GENOCIDA) | SOBREVIVA: ${Math.max(0, totalBossTime - this.sansTimer).toFixed(1)}s | KR ATIVO`, VIRTUAL_WIDTH / 2, 19);

    // 2. Indicador dos Poderes no Nível 10 (Vida mantida em 3 corações)
    this.ctx.font = 'bold 11px "Orbitron", sans-serif';
    this.ctx.fillStyle = '#ffe600';
    this.ctx.textAlign = 'center';
    this.ctx.shadowColor = '#ffe600';
    this.ctx.shadowBlur = 6;
    this.ctx.fillText(`⚡ PODERES NV.10: ⚡ Turbina 0.35s | 🧲 Super Ímã 340px | 🛡️ Auto-Escudo | 🪙 Moedas x3 | ♥ Vidas: ${this.player.lives}/3`, VIRTUAL_WIDTH / 2, 53);

    // Diálogo Flutuante de Sans
    if (this.sansDialogue) {
      this.ctx.font = 'bold 15px "Rajdhani", sans-serif';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = '#000000';
      this.ctx.shadowBlur = 6;
      this.ctx.fillText(this.sansDialogue, VIRTUAL_WIDTH / 2, 73);
    }

    // 2. Olho místico de Sans no fundo da arena
    const eyeX = VIRTUAL_WIDTH / 2;
    const eyeY = VIRTUAL_HEIGHT / 2 - 20;
    const pulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.005);
    this.ctx.globalAlpha = 0.12 * pulse;
    this.ctx.fillStyle = (Math.floor(Date.now() / 100) % 2 === 0) ? '#00f0ff' : '#ffe600';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 40;
    this.ctx.beginPath();
    this.ctx.arc(eyeX, eyeY, 65, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.font = '60px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('💀', eyeX, eyeY);

    this.ctx.restore();
  }

  gameLoop(time) {
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    this.update(dt);
    this.draw();

    requestAnimationFrame(this.gameLoop.bind(this));
  }
}

// Inicia o jogo quando o DOM carregar
window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new Game();
});
