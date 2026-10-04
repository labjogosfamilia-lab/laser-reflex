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
  SHOP: 'SHOP'
};

// Dicionário de Skins da Loja
const SKINS = {
  cyan: { name: 'Ciano Neon', color: '#00f0ff', price: 0 },
  gold: { name: 'Ouro Solar', color: '#ffe600', price: 200 },
  crimson: { name: 'Fúria Carmesim', color: '#ff0055', price: 250 },
  emerald: { name: 'Matrix Esmeralda', color: '#00ffa3', price: 300 },
  purple: { name: 'Hiperdrive Roxo', color: '#b537f2', price: 350 }
};

// Dicionário de Melhorias Progressivas (Nível 1 até Nível 10)
const UPGRADES_CONFIG = {
  energyMagnet: {
    id: 'energyMagnet',
    name: 'Ímã de Energia',
    icon: '🧲',
    maxLevel: 10,
    basePrice: 100,
    priceMultiplier: 1.35,
    getDesc: (lvl) => {
      if (lvl === 0) return 'Atrai orbes da arena (Compre o Nível 1 para ativar)';
      const radius = 60 + lvl * 25;
      return `Raio magnético: ${radius}px | Velocidade de atração: +${lvl * 18}%`;
    }
  },
  dashTurbine: {
    id: 'dashTurbine',
    name: 'Turbina de Dash',
    icon: '⚡',
    maxLevel: 10,
    basePrice: 120,
    priceMultiplier: 1.35,
    getDesc: (lvl) => {
      const cd = Math.max(0.8, 2.0 - lvl * 0.12);
      return `Tempo de recarga do Dash reduzido para ${cd.toFixed(2)}s`;
    }
  },
  shieldCore: {
    id: 'shieldCore',
    name: 'Núcleo de Escudo',
    icon: '🛡️',
    maxLevel: 10,
    basePrice: 130,
    priceMultiplier: 1.36,
    getDesc: (lvl) => {
      if (lvl === 0) return 'Comece as partidas com Escudo de Força (Bloqueado)';
      const invul = (1.6 + lvl * 0.12).toFixed(2);
      return `Inicia com Escudo + Imunidade pós-dano de ${invul}s`;
    }
  },
  creditBoost: {
    id: 'creditBoost',
    name: 'Hack de Créditos',
    icon: '🪙',
    maxLevel: 10,
    basePrice: 110,
    priceMultiplier: 1.38,
    getDesc: (lvl) => {
      return `Ganhos de moedas na arena aumentados em +${lvl * 15}%`;
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
    if (this.invulnerableTimer > 0 || this.isDashing) {
      return false; // Ileso pelo dash ativo ou invulnerabilidade
    }

    // Perfura o escudo! Elimina 1 vida diretamente mesmo se ele tiver escudo
    this.lives--;
    this.invulnerableTimer = 1.0;
    sounds.playPiercingHit();

    // Partículas densas de impacto perfurante
    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 90 + Math.random() * 220;
      const color = (i % 2 === 0) ? '#ff0055' : '#ffffff';
      particles.push(new Particle(this.x, this.y, color, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.6, 3.5));
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
    this.dirX = options.dirX;
    this.dirY = options.dirY;
    this.speed = options.speed || 620;
    this.color = options.color || '#00f0ff';
    this.radius = 6;
    this.life = options.life || 2.4;
    this.trail = [];
  }

  update(dt, particles) {
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
    const dist = Math.hypot(this.x - targetX, this.y - targetY);
    return dist < (this.radius + targetRadius);
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
    this.trackLockDelay = options.trackLockDelay !== undefined ? options.trackLockDelay : 0.50; // Delay de meio segundo (0.50s) com mira travada
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

    sounds.playLaserWarning();
  }

  update(dt, playerX, playerY, p2X, p2Y) {
    this.timer += dt;

    // Se for rotativo
    if (this.rotSpeed !== 0 && this.centerAnchor) {
      this.angle += this.rotSpeed * dt;
      this.x1 = this.centerAnchor.x;
      this.y1 = this.centerAnchor.y;
      this.x2 = this.x1 + Math.cos(this.angle) * this.length;
      this.y2 = this.y1 + Math.sin(this.angle) * this.length;
    }

    // Se for rastreador (Sniper): persegue APENAS durante o aviso e ANTES do delay de 0.5s
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
        // Trava totalmente a mira pelo tempo do delay (0.50s) - NENHUM MOVIMENTO!
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
        // Alerta visual de mira travada com delay de 0.5s antes do disparo
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

    // Carrega melhorias com suporte a níveis de 0 a 10 e migração de versão anterior
    let savedUpgrades = {};
    try {
      savedUpgrades = JSON.parse(localStorage.getItem('laser_reflex_upgrades')) || {};
    } catch (e) {
      savedUpgrades = {};
    }

    const parseUpgradeLevel = (val) => {
      if (val === true) return 1;
      const num = parseInt(val, 10);
      return isNaN(num) ? 0 : Math.max(0, Math.min(10, num));
    };

    this.upgrades = {
      energyMagnet: parseUpgradeLevel(savedUpgrades.energyMagnet),
      dashTurbine: parseUpgradeLevel(savedUpgrades.dashTurbine),
      shieldCore: parseUpgradeLevel(savedUpgrades.shieldCore !== undefined ? savedUpgrades.shieldCore : savedUpgrades.startShield),
      creditBoost: parseUpgradeLevel(savedUpgrades.creditBoost)
    };

    // Aplica a skin salva ao jogador
    this.player.skinColor = SKINS[this.equippedSkin]?.color || '#00f0ff';

    // Elementos DOM da Loja
    this.domShopScreen = document.getElementById('shop-screen');
    this.domPlayerCredits = document.getElementById('player-credits');
    this.domTabBtnSkins = document.getElementById('tab-btn-skins');
    this.domTabBtnUpgrades = document.getElementById('tab-btn-upgrades');
    this.domSkinsView = document.getElementById('shop-skins-view');
    this.domUpgradesView = document.getElementById('shop-upgrades-view');
    this.domUpgradesContainer = document.getElementById('upgrades-list-container');

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

    // Sistema de Balas de Laser
    this.bullets = [];
    this.domShootBar = document.getElementById('shoot-bar');
    this.domShootTimerText = document.getElementById('shoot-timer-text');
    this.domMobileShootBtn = document.getElementById('mobile-shoot-btn');

    // Inicializa gerenciador de rede
    this.network = new NetworkManager(this);
    this.initMultiplayerEvents();

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

    // Disparo por clique do Mouse direcionado ao cursor
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.gameState === STATE.PLAYING) {
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
        e.preventDefault();
        if (this.gameState === STATE.PLAYING) {
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

    document.getElementById('restart-btn').addEventListener('click', () => {
      sounds.init();
      this.startGame();
    });

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

    // Alternar Abas da Loja (Skins vs Upgrades)
    if (this.domTabBtnSkins && this.domTabBtnUpgrades) {
      this.domTabBtnSkins.addEventListener('click', () => {
        sounds.init();
        this.domTabBtnSkins.classList.add('active');
        this.domTabBtnUpgrades.classList.remove('active');
        if (this.domSkinsView) this.domSkinsView.classList.remove('hidden');
        if (this.domUpgradesView) this.domUpgradesView.classList.add('hidden');
      });

      this.domTabBtnUpgrades.addEventListener('click', () => {
        sounds.init();
        this.domTabBtnUpgrades.classList.add('active');
        this.domTabBtnSkins.classList.remove('active');
        if (this.domUpgradesView) this.domUpgradesView.classList.remove('hidden');
        if (this.domSkinsView) this.domSkinsView.classList.add('hidden');
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

    // Ações de Upgrades na Loja (Delegação de Eventos para os cards dinâmicos)
    if (this.domUpgradesContainer) {
      this.domUpgradesContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.upgrade-action-btn');
        if (!btn || btn.disabled) return;
        const upgradeId = btn.getAttribute('data-upgrade-id');
        if (upgradeId) {
          sounds.init();
          this.buyUpgrade(upgradeId);
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

    // Mobile Tiro a Laser (Recarga de 5s)
    const shootBtn = document.getElementById('mobile-shoot-btn');
    if (shootBtn) {
      const handleShoot = (e) => {
        e.preventDefault();
        sounds.init();
        if (this.gameState === STATE.PLAYING) {
          this.triggerPlayerShoot();
        }
      };
      shootBtn.addEventListener('touchstart', handleShoot);
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
      if (this.domLobbyStatusText) this.domLobbyStatusText.textContent = '📡 Criando sala e gerando link...';
      this.domLobbyModal.classList.remove('hidden');
    }

    this.network.createRoom((code, link) => {
      if (this.domLobbyCodeText) this.domLobbyCodeText.textContent = code;
      if (this.domLobbyLinkInput) this.domLobbyLinkInput.value = link;
      if (this.domLobbyStatusText) this.domLobbyStatusText.textContent = '📡 Aguardando oponente se conectar...';
    });
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
      (c) => {
        if (this.domJoinStatusMessage) {
          this.domJoinStatusMessage.textContent = '📡 Procurando host ' + c + '...';
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
    this.laserSpawnTimer = 0;
    this.pickupSpawnTimer = 0;
    this.rematchRequested = false;

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

    // Melhores atributos da loja para o jogador local
    const dashLvl = this.upgrades.dashTurbine || 0;
    this.player.dashCooldownMax = Math.max(0.8, 2.0 - dashLvl * 0.12);
    const shieldLvl = this.upgrades.shieldCore || 0;
    this.player.invulnerableDuration = 1.6 + shieldLvl * 0.12;
    if (shieldLvl > 0) {
      this.player.shieldActive = true;
    }

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
      case 'MATCH_COUNTDOWN':
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
        for (let i = this.bullets.length - 1; i >= 0; i--) {
          if (this.bullets[i].id === msg.bulletId) {
            this.bullets.splice(i, 1);
            break;
          }
        }
        this.remotePlayer.lives = msg.lives;
        this.remotePlayer.shieldActive = msg.shieldActive;
        this.updateX1HUD();
        sounds.playPiercingHit();

        for (let k = 0; k < 35; k++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 70 + Math.random() * 180;
          this.particles.push(new Particle(this.remotePlayer.x, this.remotePlayer.y, '#ff0055', Math.cos(ang) * spd, Math.sin(ang) * spd, 0.55, 3.5));
        }

        if (this.gameState === STATE.PLAYING && this.remotePlayer.lives <= 0) {
          this.triggerX1GameOver(true);
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
    } else {
      if (this.domX1ResultTitle) this.domX1ResultTitle.textContent = '💀 DERROTADO NO X1!';
      if (this.domX1ResultSubtitle) this.domX1ResultSubtitle.textContent = 'Seu drone foi destruído pelos feixes de laser!';
      sounds.playHit();
      this.addCredits(25);
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

    this.player.reset(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    this.player.nameTag = null;
    this.remotePlayer.nameTag = null;
    this.lasers = [];
    this.pickups = [];
    this.particles = [];
    this.bullets = [];
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
    this.laserSpawnTimer = 0;
    this.pickupSpawnTimer = 0;
    this.laserRainActive = false;
    this.laserRainTimer = 0;
    this.laserRainDropTimer = 0;
    this.phase5RainTriggered = false;
    this.phase5RainCooldown = 0;

    // Reseta o jogador com a skin equipada e melhorias da loja
    this.player.reset(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    this.player.nameTag = null;
    this.player.skinColor = SKINS[this.equippedSkin]?.color || '#00f0ff';

    // Turbina de Dash (Nível 0 a 10: 2.0s -> 0.8s)
    const dashLvl = this.upgrades.dashTurbine || 0;
    this.player.dashCooldownMax = Math.max(0.8, 2.0 - dashLvl * 0.12);

    // Núcleo de Escudo (Nível 0 a 10: inicia com escudo se lvl >= 1 e amplia imunidade pós-dano)
    const shieldLvl = this.upgrades.shieldCore || 0;
    this.player.invulnerableDuration = 1.6 + shieldLvl * 0.12;
    if (shieldLvl > 0) {
      this.player.shieldActive = true;
    }

    if (this.domHudSingle) this.domHudSingle.classList.remove('hidden');
    if (this.domHudX1) this.domHudX1.classList.add('hidden');
    if (this.domStartScreen) this.domStartScreen.classList.add('hidden');
    if (this.domGameOverScreen) this.domGameOverScreen.classList.add('hidden');
    if (this.domShopScreen) this.domShopScreen.classList.add('hidden');
    if (this.domModeModal) this.domModeModal.classList.add('hidden');
    if (this.domLobbyModal) this.domLobbyModal.classList.add('hidden');
    if (this.domJoinModal) this.domJoinModal.classList.add('hidden');
    if (this.domX1GameOverModal) this.domX1GameOverModal.classList.add('hidden');
    this.updateHUD();
  }

  addCredits(amount) {
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

    // Abre com a aba de Melhorias ativa por padrão
    if (this.domTabBtnUpgrades) this.domTabBtnUpgrades.classList.add('active');
    if (this.domTabBtnSkins) this.domTabBtnSkins.classList.remove('active');
    if (this.domUpgradesView) this.domUpgradesView.classList.remove('hidden');
    if (this.domSkinsView) this.domSkinsView.classList.add('hidden');

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

    // Renderiza botões das Skins
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

    // Renderiza os Cards de Melhorias com 10 Níveis Dinâmicos e Preços Crescentes
    if (this.domUpgradesContainer) {
      this.domUpgradesContainer.innerHTML = '';
      Object.values(UPGRADES_CONFIG).forEach(cfg => {
        const currentLvl = this.upgrades[cfg.id] || 0;
        const isMax = currentLvl >= cfg.maxLevel;
        const nextPrice = getUpgradePrice(cfg.id, currentLvl);

        const row = document.createElement('div');
        row.className = 'upgrade-row';
        row.setAttribute('data-upgrade', cfg.id);

        // Gera os 10 pips da barra de progresso visual
        let pipsHtml = '';
        for (let i = 1; i <= cfg.maxLevel; i++) {
          const filled = i <= currentLvl ? (isMax ? 'filled max' : 'filled') : '';
          pipsHtml += `<div class="level-pip ${filled}"></div>`;
        }

        const badgeClass = isMax ? 'upgrade-level-badge max' : 'upgrade-level-badge';
        const badgeText = isMax ? 'NÍVEL MÁXIMO' : `Nv. ${currentLvl}/${cfg.maxLevel}`;

        let btnHtml = '';
        if (isMax) {
          btnHtml = `<button class="upgrade-action-btn purchased" disabled>MAX ✓</button>`;
        } else {
          btnHtml = `<button class="upgrade-action-btn buy-btn" data-upgrade-id="${cfg.id}">+1 NV (${nextPrice} 🪙)</button>`;
        }

        row.innerHTML = `
          <div class="upgrade-icon">${cfg.icon}</div>
          <div class="upgrade-info">
            <div class="upgrade-title-row">
              <span class="upgrade-title">${cfg.name}</span>
              <span class="${badgeClass}">${badgeText}</span>
            </div>
            <div class="upgrade-level-track">
              ${pipsHtml}
            </div>
            <div class="upgrade-desc">${cfg.getDesc(currentLvl)}</div>
          </div>
          ${btnHtml}
        `;

        this.domUpgradesContainer.appendChild(row);
      });
    }
  }

  buyOrEquipSkin(skinId) {
    if (!SKINS[skinId]) return;

    if (this.equippedSkin === skinId) {
      return; // Já está equipado
    }

    if (this.ownedSkins.includes(skinId)) {
      // Já possui a skin, equipa
      this.equippedSkin = skinId;
      localStorage.setItem('laser_reflex_skin', skinId);
      this.player.skinColor = SKINS[skinId].color;
      sounds.playEquip();
      this.renderShopUI();
      return;
    }

    // Comprar
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

  buyUpgrade(upgradeId) {
    const cfg = UPGRADES_CONFIG[upgradeId];
    if (!cfg) return;

    const currentLvl = this.upgrades[upgradeId] || 0;
    if (currentLvl >= cfg.maxLevel) return;

    const price = getUpgradePrice(upgradeId, currentLvl);
    if (this.credits >= price) {
      this.credits -= price;
      this.upgrades[upgradeId] = currentLvl + 1;
      localStorage.setItem('laser_reflex_credits', this.credits);
      localStorage.setItem('laser_reflex_upgrades', JSON.stringify(this.upgrades));

      sounds.playBuy();
      this.renderShopUI();
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

  advanceLevel() {
    this.level++;
    if (this.domLevelDisplay) this.domLevelDisplay.textContent = this.level;

    // Toca fanfarra sonora de nova fase
    sounds.playLevelUp();

    // Bônus de créditos ao avançar de fase (ampliado com Hack de Créditos)
    const boostLvl = this.upgrades.creditBoost || 0;
    const creditMult = 1 + boostLvl * 0.15;
    this.addCredits(Math.round(50 * creditMult));

    // Recompensa: Recupera +1 Vida se estiver com menos de 3!
    if (this.player.lives < 3) {
      this.player.lives++;
    }
    this.updateHUD();

    // Limpa a arena e concede 2.4s de intervalo seguro
    this.lasers = [];
    this.laserSpawnTimer = 0;
    this.levelTransitionTimer = 2.4;
    this.screenShake = 12;

    // Chuva de partículas de celebração neon
    const colors = ['#ffe600', '#00f0ff', '#ff00aa', '#00ffa3', '#ffffff'];
    for (let i = 0; i < 50; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 200;
      const col = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push(new Particle(
        VIRTUAL_WIDTH / 2 + (Math.random() - 0.5) * 160,
        VIRTUAL_HEIGHT / 2 + (Math.random() - 0.5) * 90,
        col,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd,
        0.8,
        4
      ));
    }

    // Exibe o Banner de Transição de Fase
    if (this.domLevelBanner && this.domBannerTitle && this.domBannerSub) {
      this.domBannerTitle.textContent = `★ FASE ${this.level} ★`;

      if (this.level === 2) {
        this.domBannerSub.textContent = `SOBRECARGA ULTRAVIOLETA: Lasers Rastreadores (com 0.5s de delay para esquivar)!`;
      } else if (this.level === 3) {
        this.domBannerSub.textContent = `HIPERDRIVE QUÂNTICO: Feixes Duplos e Velocidade Extrema!`;
      } else if (this.level === 4) {
        this.domBannerSub.textContent = `ZONA CRÍTICA: Reflexos no Limite Absoluto!`;
      } else if (this.level === 5) {
        this.domBannerSub.textContent = `⚡ TEMPESTADE CIBERNÉTICA: CHUVA DE LASERS POR 5 SEGUNDOS! ⚡`;
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
    }
  }

  triggerGameOver() {
    this.gameState = STATE.GAMEOVER;
    this.screenShake = 20;

    // Bônus de créditos proporcional ao desempenho da partida (ampliado com Hack de Créditos)
    const boostLvl = this.upgrades.creditBoost || 0;
    const creditMult = 1 + boostLvl * 0.15;
    const matchBonus = Math.max(15, Math.floor(this.score / 80));
    this.addCredits(Math.round(matchBonus * creditMult));

    if (this.score > this.highScore) {
      this.highScore = Math.floor(this.score);
      localStorage.setItem('laser_reflex_highscore', this.highScore);
    }

    this.domFinalScore.textContent = Math.floor(this.score);
    if (this.domFinalLevel) this.domFinalLevel.textContent = this.level;
    this.domFinalTime.textContent = `${this.survivalTime.toFixed(1)}s`;
    this.domHighScore.textContent = this.highScore;

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
      const trackLockDelay = 0.50; // Meio segundo de delay com mira travada em todas as fases
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

    // Atualiza Barra e Status do Tiro a Laser
    this.updateShootHUD();
  }

  triggerPlayerShoot(aimWorldX, aimWorldY) {
    if (this.gameState !== STATE.PLAYING) return;

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
    if (!shotData) return; // Recarga ainda em andamento

    const myRole = this.isMultiplayer ? (this.isHost ? 'p1' : 'p2') : 'player';
    const bulletColor = this.isMultiplayer
      ? (this.isHost ? '#00f0ff' : '#ff0055')
      : (this.player.skinColor || '#00f0ff');

    const bulletId = 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const bullet = new LaserBullet({
      id: bulletId,
      shooterId: myRole,
      x: shotData.x,
      y: shotData.y,
      dirX: shotData.dirX,
      dirY: shotData.dirY,
      speed: 620,
      color: bulletColor
    });

    this.bullets.push(bullet);

    // Efeito de partículas no canhão do drone
    for (let k = 0; k < 14; k++) {
      const ang = Math.atan2(shotData.dirY, shotData.dirX) + (Math.random() - 0.5) * 1.3;
      const spd = 40 + Math.random() * 90;
      this.particles.push(new Particle(shotData.x, shotData.y, bulletColor, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.3, 3));
    }

    if (this.isMultiplayer && this.network.isConnected) {
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

      // Checagem de FASE: Passa de fase ao completar múltiplos de 5000 pontos (5000, 10000, 15000...)
      if (this.score >= this.level * this.pointsPerLevel) {
        this.advanceLevel();
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
    } else if (!this.laserRainActive && (!this.isMultiplayer || this.isHost)) {
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
          this.screenShake = 12;
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

      // No modo Multiplayer: se a bala pertence ao oponente, checa acerto no jogador local
      if (this.isMultiplayer) {
        const myRole = this.isHost ? 'p1' : 'p2';
        if (b.shooterId !== myRole && b.checkCollision(this.player.x, this.player.y, this.player.radius)) {
          // O tiro a laser perfura o escudo e elimina uma vida diretamente!
          const tookHit = this.player.takePiercingDamage(this.particles);
          this.bullets.splice(i, 1);

          if (tookHit) {
            this.screenShake = 16;
            this.updateX1HUD();
            this.network.send({
              type: 'PLAYER_BULLET_HIT',
              bulletId: b.id,
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
          }
          continue;
        }
      }
    }

    // Atualiza Coletáveis (Pickups)
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.update(dt);

      // Se a melhoria Ímã de Energia estiver ativa, atrai os colecionáveis próximos conforme o nível (1 a 10)
      const magnetLvl = this.upgrades.energyMagnet || 0;
      if (magnetLvl > 0) {
        const mDist = Math.hypot(this.player.x - p.x, this.player.y - p.y);
        const magnetRadius = 60 + magnetLvl * 25; // Nv 1: 85px ... Nv 10: 310px
        const magnetSpeed = 130 + magnetLvl * 22;  // Nv 1: 152px/s ... Nv 10: 350px/s
        if (mDist < magnetRadius && mDist > 1) {
          p.x += ((this.player.x - p.x) / mDist) * magnetSpeed * dt;
          p.y += ((this.player.y - p.y) / mDist) * magnetSpeed * dt;
        }
      }

      // Coleta pelo jogador local
      const dist = Math.hypot(this.player.x - p.x, this.player.y - p.y);
      if (dist <= this.player.radius + p.radius) {
        const boostLvl = this.upgrades.creditBoost || 0;
        const creditMult = 1 + boostLvl * 0.15; // +15% de moedas por nível

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
