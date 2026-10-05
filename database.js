/**
 * DatabaseManager - Sistema de Contas, Perfis Individuais e Ranking Público Global
 * Suporta Firebase Firestore (Google Cloud) para sincronização em nuvem em tempo real,
 * com persistência local e fallback automático seguro.
 */

// =========================================================================
// CONFIGURAÇÃO DO FIREBASE (BANCO DE DADOS EM NUVEM)
// =========================================================================
// Para conectar ao seu banco de dados oficial do Firebase:
// 1. Acesse https://console.firebase.google.com/
// 2. Crie um projeto gratuito ("laser-reflex")
// 3. Adicione um App Web (</>) e ative o Firestore Database (em Modo de Teste)
// 4. Cole as credenciais abaixo:
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAtCIfPr_vuyJnHAQYNLZzpEr_yTuH8VJs",
  authDomain: "lazer-reflex.firebaseapp.com",
  projectId: "lazer-reflex",
  storageBucket: "lazer-reflex.firebasestorage.app",
  messagingSenderId: "766268517114",
  appId: "1:766268517114:web:cbdae60ef9016d63697743",
  measurementId: "G-Q4DCQM8H5P"
};

// =========================================================================
// RANKING GLOBAL OFICIAL DE PILOTOS (LIGA MUNDIAL LASER REFLEX)
// =========================================================================
const DEFAULT_GLOBAL_LEADERBOARD = [
  { nickname: 'VORTEX_PILOT', highScore: 48950, maxLevel: 10, x1Wins: 18, sansTime: 53.0, sansVictories: 3, equippedSkin: 'gold', updatedAt: 1728000000000 },
  { nickname: 'NEON_GHOST', highScore: 43200, maxLevel: 9, x1Wins: 14, sansTime: 49.5, sansVictories: 1, equippedSkin: 'cyan', updatedAt: 1728001000000 },
  { nickname: 'CYBER_VIPER', highScore: 37600, maxLevel: 8, x1Wins: 11, sansTime: 42.8, sansVictories: 0, equippedSkin: 'purple', updatedAt: 1728002000000 },
  { nickname: 'QUANTUM_BLAZE', highScore: 31400, maxLevel: 7, x1Wins: 9, sansTime: 36.2, sansVictories: 0, equippedSkin: 'crimson', updatedAt: 1728003000000 },
  { nickname: 'HYPER_PULSE', highScore: 26800, maxLevel: 6, x1Wins: 8, sansTime: 30.5, sansVictories: 0, equippedSkin: 'emerald', updatedAt: 1728004000000 },
  { nickname: 'SHADOW_CORE', highScore: 21500, maxLevel: 5, x1Wins: 6, sansTime: 24.1, sansVictories: 0, equippedSkin: 'purple', updatedAt: 1728005000000 },
  { nickname: 'SOLAR_STRIKE', highScore: 16900, maxLevel: 4, x1Wins: 4, sansTime: 18.7, sansVictories: 0, equippedSkin: 'gold', updatedAt: 1728006000000 },
  { nickname: 'CHRONO_REFLEX', highScore: 12400, maxLevel: 3, x1Wins: 3, sansTime: 14.3, sansVictories: 0, equippedSkin: 'cyan', updatedAt: 1728007000000 },
  { nickname: 'TITAN_AERO', highScore: 8300, maxLevel: 2, x1Wins: 2, sansTime: 9.8, sansVictories: 0, equippedSkin: 'emerald', updatedAt: 1728008000000 },
  { nickname: 'NEXUS_DRONE', highScore: 4600, maxLevel: 1, x1Wins: 1, sansTime: 5.2, sansVictories: 0, equippedSkin: 'crimson', updatedAt: 1728009000000 }
];

class DatabaseManager {
  constructor(game) {
    this.game = game;
    this.isCloudEnabled = false;
    this.db = null;
    this.currentUser = null;
    this.storageKeyPrefix = 'laser_player_';
    this.sessionKey = 'laser_active_session';
    this.leaderboardLocalKey = 'laser_global_leaderboard_cache';
    this.lastRankingSource = 'local';

    this.onUserChange = null;

    this.initFirebase();
    this.restoreSession();
    this.ensureGlobalPilotsInLeaderboard();
    this.ensureCurrentPlayerInLeaderboard();
  }

  // Gera ou recupera apelido persistente para convidados (jogadores sem conta criada)
  getGuestNickname() {
    let nick = localStorage.getItem('laser_guest_nickname');
    if (!nick) {
      nick = 'PILOTO_' + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem('laser_guest_nickname', nick);
    }
    return nick;
  }

  // Garante que o ranking global contenha os pilotos rivais e o jogador atual
  ensureGlobalPilotsInLeaderboard() {
    try {
      const list = this.getLocalLeaderboard();
      const hasSansData = list && list.some(p => (p.sansTime || 0) > 0);
      // Se houver menos de 5 pilotos ou faltar os recordes do Sam, recarrega a base completa
      if (!list || list.length < 5 || !hasSansData) {
        localStorage.removeItem(this.leaderboardLocalKey);
        this.getLocalLeaderboard();
      }
    } catch (e) {}
  }

  // Garante que o piloto atual (com conta ou convidado) tenha seu recorde salvo no ranking local
  ensureCurrentPlayerInLeaderboard() {
    try {
      if (this.currentUser) {
        if ((this.currentUser.highScore || 0) > 0 || (this.currentUser.x1Wins || 0) > 0 || (this.currentUser.sansTime || 0) > 0) {
          this.updateLocalLeaderboard(this.currentUser);
        }
      } else {
        const localHs = parseInt(localStorage.getItem('laser_reflex_highscore') || '0', 10);
        const guestHs = parseInt(localStorage.getItem('laser_guest_highscore') || '0', 10);
        const guestSansTime = parseFloat(localStorage.getItem('laser_guest_sanstime') || '0');
        const guestSansVictories = parseInt(localStorage.getItem('laser_guest_sansvictories') || '0', 10);
        const bestHs = Math.max(localHs, guestHs);
        if (bestHs > 0 || guestSansTime > 0) {
          const guestNick = this.getGuestNickname();
          this.updateLocalLeaderboard({
            nickname: guestNick,
            highScore: bestHs,
            maxLevel: parseInt(localStorage.getItem('laser_guest_maxlevel') || '1', 10),
            x1Wins: parseInt(localStorage.getItem('laser_guest_x1wins') || '0', 10),
            sansTime: guestSansTime,
            sansVictories: guestSansVictories,
            equippedSkin: (this.game && this.game.equippedSkin) || localStorage.getItem('laser_reflex_skin') || 'cyan',
            updatedAt: Date.now()
          });
        }
      }
    } catch (e) {}
  }

  // Zera as pontuações do ranking de todos os jogadores (Local e Nuvem)
  async resetAllRankingScores() {
    const resetFlag = 'laser_ranking_reset_v9.0';
    if (!localStorage.getItem(resetFlag)) {
      try {
        console.log('[Database] Zerando pontuações de todos os jogadores no banco e ranking...');
        // 1. Zera recorde local no navegador
        localStorage.setItem('laser_reflex_highscore', '0');
        if (this.game) {
          this.game.highScore = 0;
          if (this.game.domHighScore) this.game.domHighScore.textContent = '0';
          if (this.game.domUserHighScoreDisplay) this.game.domUserHighScoreDisplay.textContent = '0';
        }

        // 2. Zera as pontuações em todos os perfis salvos localmente
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(this.storageKeyPrefix)) {
            try {
              const uData = JSON.parse(localStorage.getItem(key));
              if (uData) {
                uData.highScore = 0;
                localStorage.setItem(key, JSON.stringify(uData));
              }
            } catch (e) {}
          }
        }

        // 3. Zera o cache do ranking local e remove bots mockados
        const cachedRaw = localStorage.getItem(this.leaderboardLocalKey);
        if (cachedRaw) {
          try {
            const list = JSON.parse(cachedRaw);
            if (Array.isArray(list)) {
              const cleaned = list
                .filter(p => !['CYBER_ACE', 'NEON_SHADOW', 'HYPER_PULSE', 'SOLAR_DRONE'].includes(p.nickname))
                .map(p => ({ ...p, highScore: 0 }));
              localStorage.setItem(this.leaderboardLocalKey, JSON.stringify(cleaned));
            }
          } catch (e) {
            localStorage.removeItem(this.leaderboardLocalKey);
          }
        }

        if (this.currentUser) {
          this.currentUser.highScore = 0;
        }

        localStorage.setItem(resetFlag, 'true');
        console.log('[Database] Todas as pontuações locais foram zeradas com sucesso!');
      } catch (err) {
        console.warn('Erro ao zerar scores locais:', err);
      }
    }

    // Se o Firebase estiver ativo, zera também os documentos das coleções ranking e players
    if (this.isCloudEnabled && this.db) {
      try {
        const rankingDocs = await this.db.collection('ranking').get();
        if (!rankingDocs.empty) {
          const batch = this.db.batch();
          rankingDocs.forEach(doc => {
            if (['CYBER_ACE', 'NEON_SHADOW', 'HYPER_PULSE', 'SOLAR_DRONE'].includes(doc.id)) {
              batch.delete(doc.ref);
            } else {
              batch.update(doc.ref, { highScore: 0, updatedAt: Date.now() });
            }
          });
          await batch.commit();
          console.log('[Database] Ranking zerado no Firebase Firestore!');
        }

        const playersDocs = await this.db.collection('players').get();
        if (!playersDocs.empty) {
          const batchP = this.db.batch();
          playersDocs.forEach(doc => {
            batchP.update(doc.ref, { highScore: 0, updatedAt: Date.now() });
          });
          await batchP.commit();
          console.log('[Database] Pontuações de perfis zeradas no Firebase Firestore!');
        }
      } catch (e) {
        // Ignora caso o Firestore ainda não esteja ativo no console
      }
    }
  }

  // Permite zerar manualmente a qualquer momento se desejado
  async zeroAllRankingScores() {
    localStorage.removeItem('laser_ranking_reset_v9.0');
    localStorage.removeItem(this.leaderboardLocalKey);
    await this.resetAllRankingScores();
    if (this.game && this.game.renderRankingList) {
      this.game.renderRankingList(this.game.currentRankingCategory || 'score');
    }
    return true;
  }

  // Registra o Login do Jogador no Banco de Dados (Nuvem e Local)
  async recordLogin(user, type = 'login') {
    if (!user || !user.nickname) return;

    const now = Date.now();
    const dateFormatted = new Date().toLocaleString('pt-BR');
    const isoDate = new Date().toISOString();

    user.lastLogin = now;
    user.lastLoginFormatted = dateFormatted;
    user.loginCount = (user.loginCount || 0) + 1;

    // 1. Atualiza no Perfil Local (LocalStorage)
    try {
      localStorage.setItem(this.storageKeyPrefix + user.nickname, JSON.stringify(user));
    } catch (e) {}

    // 2. Registra no Firebase Firestore (Nuvem)
    if (this.isCloudEnabled && this.db) {
      try {
        const userRef = this.db.collection('players').doc(user.nickname);
        await userRef.set({
          lastLogin: now,
          lastLoginFormatted: dateFormatted,
          loginCount: user.loginCount,
          lastLoginType: type,
          updatedAt: now
        }, { merge: true });

        // Adiciona registro na coleção dedicada de histórico de logins
        await this.db.collection('logins').add({
          nickname: user.nickname,
          type: type,
          timestamp: now,
          date: dateFormatted,
          isoDate: isoDate,
          userAgent: (navigator.userAgent || '').slice(0, 150)
        });

        console.log(`[Database] Login de ${user.nickname} (${type}) registrado com sucesso no banco de dados!`);
      } catch (err) {
        console.warn('[Database] Não foi possível registrar login na nuvem (Firestore em standby):', err.message);
      }
    }
  }

  // Registra o Resultado da Partida no Banco de Dados e Atualiza o Ranking
  async recordMatchResult(matchData) {
    const now = Date.now();
    const dateFormatted = new Date().toLocaleString('pt-BR');
    const user = this.currentUser;
    const matchScore = Math.floor(matchData.score || 0);
    const matchLevel = Math.max(1, Math.floor(matchData.level || 1));
    const nickname = user ? user.nickname : this.getGuestNickname();

    const matchEntry = {
      nickname: nickname,
      isRegistered: !!user,
      mode: matchData.mode || 'solo',
      score: matchScore,
      level: matchLevel,
      survivalTime: matchData.survivalTime || 0,
      isWinner: !!matchData.isWinner,
      creditsEarned: matchData.creditsEarned || 0,
      timestamp: now,
      date: dateFormatted
    };

    console.log(`[Database] Gravando resultado da partida para ${nickname}:`, matchEntry);

    let rankingEntry = null;

    if (user) {
      user.matchesPlayed = (user.matchesPlayed || 0) + 1;

      if (matchData.mode === 'solo') {
        if (matchScore > (user.highScore || 0)) {
          user.highScore = matchScore;
        }
        if (matchLevel > (user.maxLevel || 1)) {
          user.maxLevel = matchLevel;
        }
      } else if (matchData.mode === 'x1' && matchData.isWinner) {
        user.x1Wins = (user.x1Wins || 0) + 1;
      }

      if (matchData.sansTime !== undefined && matchData.sansTime > 0) {
        user.sansTime = Math.max(user.sansTime || 0, matchData.sansTime);
        if (matchData.sansVictory) {
          user.sansVictories = (user.sansVictories || 0) + 1;
        }
      }

      if (this.game && this.game.credits !== undefined) {
        user.credits = this.game.credits;
      }
      user.updatedAt = now;

      try {
        localStorage.setItem(this.storageKeyPrefix + user.nickname, JSON.stringify(user));
      } catch (e) {}

      rankingEntry = {
        nickname: user.nickname,
        highScore: user.highScore || 0,
        maxLevel: user.maxLevel || 1,
        x1Wins: user.x1Wins || 0,
        sansTime: user.sansTime || 0,
        sansVictories: user.sansVictories || 0,
        equippedSkin: user.equippedSkin || 'cyan',
        updatedAt: now
      };
    } else {
      // Piloto Convidado (jogando sem cadastro inicial)
      let guestScore = parseInt(localStorage.getItem('laser_guest_highscore') || '0', 10);
      let guestLevel = parseInt(localStorage.getItem('laser_guest_maxlevel') || '1', 10);
      let guestX1Wins = parseInt(localStorage.getItem('laser_guest_x1wins') || '0', 10);
      let guestSansTime = parseFloat(localStorage.getItem('laser_guest_sanstime') || '0');
      let guestSansVictories = parseInt(localStorage.getItem('laser_guest_sansvictories') || '0', 10);

      if (matchData.mode === 'solo') {
        if (matchScore > guestScore) {
          guestScore = matchScore;
          localStorage.setItem('laser_guest_highscore', guestScore);
        }
        if (matchLevel > guestLevel) {
          guestLevel = matchLevel;
          localStorage.setItem('laser_guest_maxlevel', guestLevel);
        }
        if (matchScore > (this.game.highScore || 0)) {
          this.game.highScore = matchScore;
          localStorage.setItem('laser_reflex_highscore', this.game.highScore);
        }
      } else if (matchData.mode === 'x1' && matchData.isWinner) {
        guestX1Wins += 1;
        localStorage.setItem('laser_guest_x1wins', guestX1Wins);
      }

      if (matchData.sansTime !== undefined && matchData.sansTime > 0) {
        if (matchData.sansTime > guestSansTime) {
          guestSansTime = matchData.sansTime;
          localStorage.setItem('laser_guest_sanstime', guestSansTime.toString());
        }
        if (matchData.sansVictory) {
          guestSansVictories += 1;
          localStorage.setItem('laser_guest_sansvictories', guestSansVictories.toString());
        }
      }

      rankingEntry = {
        nickname: nickname,
        highScore: Math.max(guestScore, matchScore),
        maxLevel: Math.max(guestLevel, matchLevel),
        x1Wins: guestX1Wins,
        sansTime: guestSansTime,
        sansVictories: guestSansVictories,
        equippedSkin: (this.game && this.game.equippedSkin) || localStorage.getItem('laser_reflex_skin') || 'cyan',
        updatedAt: now
      };
    }

    // 1. Atualização SÍNCRONA e IMEDIATA do ranking local (garante exibição sem depender de rede)
    if (rankingEntry) {
      this.updateLocalLeaderboard(rankingEntry);
    }

    if (this.onUserChange && user) {
      this.onUserChange(user);
    }

    // 2. Gravação no Firebase Firestore (Nuvem) em background
    if (this.isCloudEnabled && this.db) {
      try {
        await this.db.collection('matches').add(matchEntry);
      } catch (e) {
        console.warn('[Database] Firestore matches pendente:', e.message);
      }

      if (user) {
        try {
          await this.db.collection('players').doc(user.nickname).set({
            highScore: user.highScore || 0,
            maxLevel: user.maxLevel || 1,
            x1Wins: user.x1Wins || 0,
            matchesPlayed: user.matchesPlayed || 0,
            credits: user.credits || 0,
            lastMatchAt: now,
            lastMatchDate: dateFormatted,
            updatedAt: now
          }, { merge: true });
        } catch (e) {
          console.warn('[Database] Firestore player pendente:', e.message);
        }
      }

      if (rankingEntry) {
        try {
          await this.syncToLeaderboard(rankingEntry);
        } catch (e) {
          console.warn('[Database] Firestore ranking sync pendente:', e.message);
        }
      }
    }

    return matchEntry;
  }

  // Inicializa o Firebase se a biblioteca e credenciais estiverem disponíveis
  initFirebase() {
    try {
      if (typeof firebase !== 'undefined' && FIREBASE_CONFIG.projectId) {
        if (!firebase.apps.length) {
          firebase.initializeApp(FIREBASE_CONFIG);
        }
        this.db = firebase.firestore();
        this.isCloudEnabled = true;
        console.log('[Database] Conectado ao Firebase Firestore com sucesso!');
      } else {
        console.log('[Database] Modo Local / Standby ativo (Firebase aguardando chaves de projeto).');
      }
    } catch (e) {
      console.warn('[Database] Erro ao inicializar Firebase:', e);
      this.isCloudEnabled = false;
    }
  }

  // Função utilitária para hash de PIN/Senha seguro usando Web Crypto API
  async hashPin(pin) {
    try {
      if (window.crypto && window.crypto.subtle) {
        const msgBuffer = new TextEncoder().encode('laser_salt_' + pin.trim());
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {
      console.warn('Crypto subtle indisponível, usando fallback:', e);
    }
    // Fallback simples
    let hash = 0;
    const str = 'laser_salt_' + pin.trim();
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash);
  }

  // Hash simples para fallback e compatibilidade
  simpleHash(str) {
    let hash = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash);
  }

  // Verificação universal de Senha/PIN com proteção da Senha Mestra (8398)
  async verifyPin(inputPin, storedHash, storedUser = null) {
    if (!inputPin) return false;
    const clean = String(inputPin).trim();

    // 1. Senha Mestra do Administrador (8398) sempre libera o acesso para o dono do jogo
    if (clean === '8398') {
      console.log('[Database] Acesso autenticado via Senha Mestra de Administrador (8398)!');
      return true;
    }

    // 2. Senha pura salva diretamente em campo legado
    if (storedUser) {
      if (storedUser.pin && String(storedUser.pin).trim() === clean) return true;
      if (storedUser.password && String(storedUser.password).trim() === clean) return true;
    }

    if (!storedHash) return true;

    // 3. Comparação de texto puro
    if (storedHash === clean) return true;

    // 4. Hash SHA-256 padrão
    try {
      const hash = await this.hashPin(clean);
      if (hash === storedHash) return true;
    } catch (e) {}

    // 5. Hash fallback simples
    const fallback = this.simpleHash('laser_salt_' + clean);
    if (fallback === storedHash) return true;

    return false;
  }

  // Busca jogador localmente de forma tolerante (exata, case-insensitive, sessão ou convidado)
  findLocalPlayer(nicknameRaw) {
    const raw = String(nicknameRaw || '').trim();
    if (!raw) return null;
    const clean = this.sanitizeNickname(raw);

    // 1. Busca exata com prefixo
    let exact = localStorage.getItem(this.storageKeyPrefix + clean);
    if (exact) {
      try { return JSON.parse(exact); } catch (e) {}
    }

    // 2. Busca case-insensitive em todas as chaves salvas no navegador
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.storageKeyPrefix)) {
        try {
          const u = JSON.parse(localStorage.getItem(key));
          if (u && u.nickname) {
            const uNick = String(u.nickname).trim().toUpperCase();
            if (uNick === raw.toUpperCase() || uNick === clean || this.sanitizeNickname(u.nickname) === clean) {
              return u;
            }
          }
        } catch (e) {}
      }
    }

    // 3. Verifica se o apelido está na sessão ativa salva
    try {
      const sessionRaw = localStorage.getItem(this.sessionKey);
      if (sessionRaw) {
        const sess = JSON.parse(sessionRaw);
        if (sess && sess.nickname) {
          const sNick = String(sess.nickname).trim().toUpperCase();
          if (sNick === raw.toUpperCase() || sNick === clean || this.sanitizeNickname(sess.nickname) === clean) {
            const recovered = {
              nickname: sess.nickname,
              pinHash: sess.pinHash || '',
              highScore: parseInt(localStorage.getItem('laser_reflex_highscore') || '0', 10),
              maxLevel: 1,
              credits: parseInt(localStorage.getItem('laser_reflex_credits') || '0', 10),
              x1Wins: parseInt(localStorage.getItem('laser_reflex_x1_wins') || '0', 10),
              equippedSkin: localStorage.getItem('laser_reflex_skin') || 'cyan',
              unlockedSkins: ['cyan'],
              createdAt: Date.now(),
              lastLogin: Date.now()
            };
            localStorage.setItem(this.storageKeyPrefix + sess.nickname, JSON.stringify(recovered));
            return recovered;
          }
        }
      }
    } catch (e) {}

    // 4. Verifica se corresponde ao apelido de convidado existente
    const guestNick = localStorage.getItem('laser_guest_nickname');
    if (guestNick && (guestNick.toUpperCase() === raw.toUpperCase() || this.sanitizeNickname(guestNick) === clean)) {
      const guestPlayer = {
        nickname: guestNick,
        pinHash: '',
        highScore: parseInt(localStorage.getItem('laser_guest_highscore') || localStorage.getItem('laser_reflex_highscore') || '0', 10),
        maxLevel: parseInt(localStorage.getItem('laser_guest_maxlevel') || '1', 10),
        credits: parseInt(localStorage.getItem('laser_reflex_credits') || '0', 10),
        x1Wins: parseInt(localStorage.getItem('laser_guest_x1wins') || '0', 10),
        equippedSkin: localStorage.getItem('laser_reflex_skin') || 'cyan',
        unlockedSkins: ['cyan'],
        createdAt: Date.now(),
        lastLogin: Date.now()
      };
      localStorage.setItem(this.storageKeyPrefix + guestNick, JSON.stringify(guestPlayer));
      return guestPlayer;
    }

    // 5. Verifica se o jogador existe no histórico do ranking local
    try {
      const lbRaw = localStorage.getItem(this.leaderboardLocalKey);
      if (lbRaw) {
        const lb = JSON.parse(lbRaw);
        if (Array.isArray(lb)) {
          const match = lb.find(p => p && p.nickname && (p.nickname.toUpperCase() === raw.toUpperCase() || this.sanitizeNickname(p.nickname) === clean));
          if (match) {
            const recovered = {
              nickname: match.nickname,
              pinHash: '',
              highScore: match.highScore || parseInt(localStorage.getItem('laser_reflex_highscore') || '0', 10),
              maxLevel: match.maxLevel || 1,
              credits: parseInt(localStorage.getItem('laser_reflex_credits') || '0', 10),
              x1Wins: match.x1Wins || 0,
              equippedSkin: match.equippedSkin || 'cyan',
              unlockedSkins: ['cyan'],
              createdAt: Date.now(),
              lastLogin: Date.now()
            };
            localStorage.setItem(this.storageKeyPrefix + match.nickname, JSON.stringify(recovered));
            return recovered;
          }
        }
      }
    } catch (e) {}

    return null;
  }

  // Lista todos os apelidos de pilotos com contas salvas neste dispositivo
  getSavedNicknames() {
    const list = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.storageKeyPrefix)) {
        try {
          const u = JSON.parse(localStorage.getItem(key));
          if (u && u.nickname && !list.includes(u.nickname)) {
            list.push(u.nickname);
          }
        } catch (e) {}
      }
    }

    // Se houver apelido salvo na sessão
    try {
      const sessionRaw = localStorage.getItem(this.sessionKey);
      if (sessionRaw) {
        const sess = JSON.parse(sessionRaw);
        if (sess && sess.nickname && !list.includes(sess.nickname)) {
          list.push(sess.nickname);
        }
      }
    } catch (e) {}

    // Convidado deste dispositivo
    const guestNick = localStorage.getItem('laser_guest_nickname');
    if (guestNick && !list.includes(guestNick)) {
      list.push(guestNick);
    }

    // Histórico do ranking local
    try {
      const lbRaw = localStorage.getItem(this.leaderboardLocalKey);
      if (lbRaw) {
        const lb = JSON.parse(lbRaw);
        if (Array.isArray(lb)) {
          lb.forEach(p => {
            if (p && p.nickname && !list.includes(p.nickname) && !['CYBER_ACE', 'NEON_SHADOW', 'HYPER_PULSE', 'SOLAR_DRONE'].includes(p.nickname)) {
              list.push(p.nickname);
            }
          });
        }
      }
    } catch (e) {}

    return list;
  }

  // Validação de Apelido (Nickname)
  sanitizeNickname(nickname) {
    if (!nickname) return '';
    try {
      // Normaliza acentuações (ex: "João" -> "Joao")
      const normalized = String(nickname).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalized.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 12);
    } catch (e) {
      return String(nickname).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 12);
    }
  }

  // Cadastrar novo jogador
  async register(nicknameRaw, pin) {
    const rawClean = (nicknameRaw || '').trim();
    const cleanPin = String(pin || '').trim();
    let nickname = this.sanitizeNickname(rawClean);

    if (!nickname || nickname.length < 2) {
      if (cleanPin === '8398') {
        nickname = 'PILOTO_8398';
      } else {
        throw new Error('O apelido deve ter pelo menos 2 caracteres (apenas letras, números e _)!');
      }
    }
    if (!cleanPin || cleanPin.length < 4) {
      throw new Error('A senha/PIN deve ter pelo menos 4 caracteres!');
    }

    // Se o jogador já existir neste dispositivo:
    const localExisting = this.findLocalPlayer(nickname) || this.findLocalPlayer(rawClean);
    if (localExisting) {
      // Se a senha informada for correta ou a senha mestra (8398), faz login imediatamente!
      const isValid = await this.verifyPin(cleanPin, localExisting.pinHash, localExisting);
      if (isValid) {
        this.updateLocalLeaderboard(localExisting);
        this.setCurrentUser(localExisting);
        this.applyUserDataToGame(localExisting);
        this.recordLogin(localExisting, 'login').catch(() => {});
        return localExisting;
      }
      throw new Error(`O piloto "${nickname}" já existe! Se você é o dono da conta, use a aba ENTRAR ou a Senha Mestra (8398).`);
    }

    const pinHash = await this.hashPin(cleanPin);

    // Herda pontuação e conquistas obtidas como convidado
    const inheritedScore = Math.max(
      this.game.highScore || 0,
      parseInt(localStorage.getItem('laser_guest_highscore') || '0', 10),
      parseInt(localStorage.getItem('laser_reflex_highscore') || '0', 10)
    );
    const inheritedLevel = Math.max(
      this.game.level || 1,
      parseInt(localStorage.getItem('laser_guest_maxlevel') || '1', 10)
    );
    const inheritedX1 = Math.max(
      this.game.x1Wins || 0,
      parseInt(localStorage.getItem('laser_guest_x1wins') || '0', 10)
    );
    const inheritedSansTime = Math.max(
      parseFloat((this.game.sansTimer || 0).toFixed(1)),
      parseFloat(localStorage.getItem('laser_guest_sanstime') || '0')
    );
    const inheritedSansVictories = parseInt(localStorage.getItem('laser_guest_sansvictories') || '0', 10);

    const newPlayer = {
      nickname: nickname,
      pinHash: pinHash,
      highScore: inheritedScore,
      maxLevel: inheritedLevel,
      credits: this.game.credits || 0,
      x1Wins: inheritedX1,
      sansTime: inheritedSansTime,
      sansVictories: inheritedSansVictories,
      matchesPlayed: parseInt(localStorage.getItem('laser_guest_matches') || '0', 10),
      unlockedSkins: this.game.ownedSkins || ['cyan'],
      equippedSkin: this.game.equippedSkin || 'cyan',
      createdAt: Date.now(),
      lastLogin: Date.now()
    };

    // 1. Salva localmente IMEDIATAMENTE (Garante que nunca falha ou trava)
    localStorage.setItem(this.storageKeyPrefix + nickname, JSON.stringify(newPlayer));
    this.updateLocalLeaderboard(newPlayer);
    this.setCurrentUser(newPlayer);

    // Remove convidado temporário do ranking para dar lugar ao nome oficial
    const guestNick = localStorage.getItem('laser_guest_nickname');
    if (guestNick) {
      try {
        let list = this.getLocalLeaderboard();
        list = list.filter(p => p.nickname !== guestNick);
        localStorage.setItem(this.leaderboardLocalKey, JSON.stringify(list));
      } catch (e) {}
    }

    // 2. Tenta sincronizar em nuvem no Firebase em segundo plano com timeout
    if (this.isCloudEnabled && this.db) {
      (async () => {
        try {
          const userRef = this.db.collection('players').doc(nickname);
          await Promise.race([
            userRef.set(newPlayer),
            new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 2500))
          ]);
          await this.syncToLeaderboard(newPlayer);
          await this.recordLogin(newPlayer, 'register');
        } catch (err) {
          console.warn('[Database] Sincronização em nuvem da nova conta em background:', err.message);
        }
      })();
    }

    return newPlayer;
  }

  // Fazer Login com Apelido e Senha/PIN
  async login(nicknameRaw, pin) {
    const rawClean = (nicknameRaw || '').trim();
    const cleanPin = String(pin || '').trim();

    if (!cleanPin) {
      throw new Error('Informe sua senha ou a Senha Mestra (8398)!');
    }

    if (!rawClean) {
      if (cleanPin === '8398') {
        const saved = this.getSavedNicknames();
        const fallbackNick = saved.length > 0 ? saved[0] : 'PILOTO_8398';
        return await this.login(fallbackNick, '8398');
      }
      throw new Error('Informe seu apelido!');
    }

    // 1. TENTA PRIMEIRO NO BANCO LOCAL (Instantâneo em 0ms, sem risco de timeout de rede)
    const localUser = this.findLocalPlayer(rawClean);
    if (localUser) {
      const isValid = await this.verifyPin(cleanPin, localUser.pinHash, localUser);
      if (!isValid) {
        throw new Error('Senha/PIN incorreto para este jogador! (Se esqueceu, utilize a Senha Mestra: 8398)');
      }

      this.updateLocalLeaderboard(localUser);
      this.setCurrentUser(localUser);
      this.applyUserDataToGame(localUser);

      // Em segundo plano, registra o login na nuvem se disponível
      this.recordLogin(localUser, 'login').catch(() => {});

      return localUser;
    }

    // Se o usuário digitou a Senha Mestra (8398), cria a conta e conecta na hora!
    if (cleanPin === '8398') {
      console.log(`[Database] Criando e autenticando conta "${rawClean}" via Senha Mestra 8398!`);
      const masterUser = await this.register(rawClean, '8398');
      return masterUser;
    }

    // 2. SE NÃO ACHOU NO LOCAL, TENTA NO FIREBASE (NUVEM) COM TIMEOUT DE 2.5s
    if (this.isCloudEnabled && this.db) {
      try {
        const nicknameSan = this.sanitizeNickname(rawClean);
        const userRef = this.db.collection('players').doc(nicknameSan);

        const doc = await Promise.race([
          userRef.get(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_CLOUD')), 2500))
        ]);

        if (doc && doc.exists) {
          const userData = doc.data();
          const isValid = await this.verifyPin(cleanPin, userData.pinHash, userData);
          if (!isValid) {
            throw new Error('Senha/PIN incorreto para este jogador! (Se esqueceu, utilize a Senha Mestra: 8398)');
          }

          // Salva cópia local no dispositivo para próximos logins instantâneos
          try {
            localStorage.setItem(this.storageKeyPrefix + userData.nickname, JSON.stringify(userData));
            this.updateLocalLeaderboard(userData);
          } catch(e) {}

          this.setCurrentUser(userData);
          this.applyUserDataToGame(userData);
          this.recordLogin(userData, 'login').catch(() => {});
          return userData;
        }
      } catch (err) {
        if (err.message && err.message.includes('Senha/PIN')) throw err;
        console.warn('[Database] Busca na nuvem falhou ou expirou:', err.message);
      }
    }

    // 3. Se não achou no local nem na nuvem:
    // Se o usuário digitou uma senha válida (mínimo 4 caracteres), cadastra e conecta na hora!
    // Garante que o jogador nunca seja barrado com erro de "não encontrado".
    if (cleanPin.length >= 4) {
      console.log(`[Database] Jogador "${rawClean}" não encontrado no dispositivo. Criando e conectando com o PIN informado!`);
      const autoUser = await this.register(rawClean, cleanPin);
      return autoUser;
    }

    // Se o PIN for muito curto
    throw new Error(`A senha deve ter pelo menos 4 caracteres para entrar com o piloto "${rawClean}".`);
  }

  // Desconectar (Logout)
  logout() {
    this.currentUser = null;
    localStorage.removeItem(this.sessionKey);
    if (this.onUserChange) this.onUserChange(null);
  }

  // Define usuário atual e salva sessão local
  setCurrentUser(user) {
    this.currentUser = user;
    try {
      localStorage.setItem(this.sessionKey, JSON.stringify({
        nickname: user.nickname,
        pinHash: user.pinHash
      }));
    } catch (e) {}

    if (this.onUserChange) this.onUserChange(user);
  }

  // Restaura sessão anterior salva (Garante que nunca desconecte ao atualizar a página)
  async restoreSession() {
    try {
      const sessionRaw = localStorage.getItem(this.sessionKey);
      if (!sessionRaw) return;

      const session = JSON.parse(sessionRaw);
      if (!session || !session.nickname) return;

      let user = this.findLocalPlayer(session.nickname);
      if (!user && session.nickname) {
        user = {
          nickname: session.nickname,
          pinHash: session.pinHash || '',
          highScore: parseInt(localStorage.getItem('laser_reflex_highscore') || '0', 10),
          maxLevel: parseInt(localStorage.getItem('laser_reflex_maxlevel') || '1', 10),
          credits: parseInt(localStorage.getItem('laser_reflex_credits') || '0', 10),
          x1Wins: parseInt(localStorage.getItem('laser_reflex_x1_wins') || '0', 10),
          unlockedSkins: ['cyan'],
          equippedSkin: 'cyan',
          createdAt: Date.now(),
          lastLogin: Date.now()
        };
        try {
          localStorage.setItem(this.storageKeyPrefix + session.nickname, JSON.stringify(user));
        } catch (e) {}
      }

      if (user) {
        console.log(`[Database] Sessão ativa restaurada para ${user.nickname}`);
        this.setCurrentUser(user);
        this.applyUserDataToGame(user);
        this.recordLogin(user, 'session_restore').catch(() => {});
      }
    } catch (e) {
      console.warn('Erro ao restaurar sessão:', e);
    }
  }

  // Aplica dados do perfil logado nas variáveis do jogo
  applyUserDataToGame(user) {
    if (!user) return;
    if (user.credits !== undefined) {
      this.game.credits = user.credits;
      localStorage.setItem('laser_reflex_credits', user.credits);
    }
    if (user.highScore !== undefined && user.highScore > (this.game.highScore || 0)) {
      this.game.highScore = user.highScore;
      localStorage.setItem('laser_reflex_highscore', user.highScore);
    }
    const skins = user.unlockedSkins || user.ownedSkins || ['cyan'];
    this.game.ownedSkins = Array.isArray(skins) ? skins : ['cyan'];
    localStorage.setItem('laser_reflex_owned_skins', JSON.stringify(this.game.ownedSkins));

    if (user.equippedSkin) {
      this.game.equippedSkin = user.equippedSkin;
      localStorage.setItem('laser_reflex_skin', user.equippedSkin);
      if (this.game.player && typeof SKINS !== 'undefined' && SKINS[user.equippedSkin]) {
        this.game.player.skinColor = SKINS[user.equippedSkin].color;
      }
    }
    if (this.game.updateHUD) this.game.updateHUD();
    if (this.game.renderShopUI) this.game.renderShopUI();
  }

  // Salva o progresso do jogador (Recorde, Créditos, Vitórias, Skins)
  async saveProgress(partialData = {}) {
    if (!this.currentUser) return;

    // Atualiza objeto em memória
    Object.assign(this.currentUser, partialData);

    // Garante sincronia com o estado do jogo
    if (this.game.credits !== undefined) this.currentUser.credits = this.game.credits;
    if (this.game.highScore !== undefined && this.game.highScore > this.currentUser.highScore) {
      this.currentUser.highScore = this.game.highScore;
    }
    if (this.game.unlockedSkins) this.currentUser.unlockedSkins = this.game.unlockedSkins;
    if (this.game.equippedSkin) this.currentUser.equippedSkin = this.game.equippedSkin;

    // Salva Localmente
    try {
      localStorage.setItem(this.storageKeyPrefix + this.currentUser.nickname, JSON.stringify(this.currentUser));
      this.updateLocalLeaderboard(this.currentUser);
    } catch (e) {}

    // Salva no Firebase
    if (this.isCloudEnabled && this.db) {
      try {
        const ref = this.db.collection('players').doc(this.currentUser.nickname);
        await ref.update({
          credits: this.currentUser.credits,
          highScore: this.currentUser.highScore,
          maxLevel: this.currentUser.maxLevel || 1,
          x1Wins: this.currentUser.x1Wins || 0,
          matchesPlayed: this.currentUser.matchesPlayed || 0,
          unlockedSkins: this.currentUser.unlockedSkins,
          equippedSkin: this.currentUser.equippedSkin,
          updatedAt: Date.now()
        });
        await this.syncToLeaderboard(this.currentUser);
      } catch (err) {
        console.warn('Erro ao sincronizar progresso com Firebase:', err);
      }
    }

    if (this.onUserChange) this.onUserChange(this.currentUser);
  }

  // Sincroniza dados com a coleção pública de Ranking no Firebase
  async syncToLeaderboard(player) {
    if (!player || !player.nickname) return;
    // Sempre garante que o cache local esteja atualizado primeiro
    this.updateLocalLeaderboard(player);

    if (!this.isCloudEnabled || !this.db) return;
    try {
      await this.db.collection('ranking').doc(player.nickname).set({
        nickname: player.nickname,
        highScore: Math.floor(player.highScore || 0),
        maxLevel: Math.max(1, Math.floor(player.maxLevel || 1)),
        x1Wins: Math.floor(player.x1Wins || 0),
        equippedSkin: player.equippedSkin || 'cyan',
        updatedAt: player.updatedAt || Date.now()
      }, { merge: true });
    } catch (e) {
      console.warn('[Database] Erro ao sincronizar ranking no Firestore:', e.message);
    }
  }

  // Atualiza cache de ranking local
  updateLocalLeaderboard(player) {
    if (!player || !player.nickname) return;
    try {
      const list = this.getLocalLeaderboard();
      const pKey = player.nickname.toUpperCase();
      const idx = list.findIndex(p => p.nickname.toUpperCase() === pKey);

      const entry = {
        nickname: player.nickname,
        highScore: Math.floor(player.highScore || 0),
        maxLevel: Math.max(1, Math.floor(player.maxLevel || 1)),
        x1Wins: Math.floor(player.x1Wins || 0),
        sansTime: parseFloat((player.sansTime || 0).toFixed(1)),
        sansVictories: Math.floor(player.sansVictories || 0),
        equippedSkin: player.equippedSkin || 'cyan',
        updatedAt: player.updatedAt || Date.now()
      };

      if (idx >= 0) {
        list[idx].highScore = Math.max(list[idx].highScore || 0, entry.highScore);
        list[idx].maxLevel = Math.max(list[idx].maxLevel || 1, entry.maxLevel);
        list[idx].x1Wins = Math.max(list[idx].x1Wins || 0, entry.x1Wins);
        list[idx].sansTime = Math.max(list[idx].sansTime || 0, entry.sansTime);
        list[idx].sansVictories = Math.max(list[idx].sansVictories || 0, entry.sansVictories);
        list[idx].equippedSkin = entry.equippedSkin;
        list[idx].updatedAt = entry.updatedAt;
      } else {
        list.push(entry);
      }

      localStorage.setItem(this.leaderboardLocalKey, JSON.stringify(list));
      console.log(`[Database] Leaderboard local atualizado para ${player.nickname} (Score: ${entry.highScore}, Sam: ${entry.sansTime}s)`);
    } catch (e) {
      console.warn('Erro ao atualizar leaderboard local:', e);
    }
  }

  getLocalLeaderboard() {
    try {
      const map = new Map();

      // 1. Inicializa o ranking com os pilotos globais rivais
      DEFAULT_GLOBAL_LEADERBOARD.forEach(pilot => {
        map.set(pilot.nickname.toUpperCase(), { ...pilot });
      });

      // 2. Mescla com os dados em cache do navegador se existirem
      const cachedRaw = localStorage.getItem(this.leaderboardLocalKey);
      if (cachedRaw) {
        try {
          const parsed = JSON.parse(cachedRaw);
          if (Array.isArray(parsed)) {
            parsed.forEach(p => {
              if (p && p.nickname) {
                const key = p.nickname.toUpperCase();
                const existing = map.get(key);
                if (existing) {
                  existing.highScore = Math.max(existing.highScore || 0, p.highScore || 0);
                  existing.maxLevel = Math.max(existing.maxLevel || 1, p.maxLevel || 1);
                  existing.x1Wins = Math.max(existing.x1Wins || 0, p.x1Wins || 0);
                  existing.sansTime = Math.max(existing.sansTime || 0, p.sansTime || 0);
                  existing.sansVictories = Math.max(existing.sansVictories || 0, p.sansVictories || 0);
                  existing.equippedSkin = p.equippedSkin || existing.equippedSkin;
                  existing.updatedAt = p.updatedAt || existing.updatedAt;
                } else {
                  map.set(key, {
                    nickname: p.nickname,
                    highScore: Math.floor(p.highScore || 0),
                    maxLevel: Math.max(1, Math.floor(p.maxLevel || 1)),
                    x1Wins: Math.floor(p.x1Wins || 0),
                    sansTime: parseFloat((p.sansTime || 0).toFixed(1)),
                    sansVictories: Math.floor(p.sansVictories || 0),
                    equippedSkin: p.equippedSkin || 'cyan',
                    updatedAt: p.updatedAt || Date.now()
                  });
                }
              }
            });
          }
        } catch (e) {}
      }

      // 3. Garante que todos os perfis registrados localmente estejam na lista
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.storageKeyPrefix)) {
          try {
            const u = JSON.parse(localStorage.getItem(k));
            if (u && u.nickname) {
              const key = u.nickname.toUpperCase();
              const existing = map.get(key);
              const uEntry = {
                nickname: u.nickname,
                highScore: Math.floor(u.highScore || 0),
                maxLevel: Math.max(1, Math.floor(u.maxLevel || 1)),
                x1Wins: Math.floor(u.x1Wins || 0),
                sansTime: parseFloat((u.sansTime || 0).toFixed(1)),
                sansVictories: Math.floor(u.sansVictories || 0),
                equippedSkin: u.equippedSkin || 'cyan',
                updatedAt: u.updatedAt || Date.now()
              };
              if (existing) {
                existing.highScore = Math.max(existing.highScore || 0, uEntry.highScore);
                existing.maxLevel = Math.max(existing.maxLevel || 1, uEntry.maxLevel);
                existing.x1Wins = Math.max(existing.x1Wins || 0, uEntry.x1Wins);
                existing.sansTime = Math.max(existing.sansTime || 0, uEntry.sansTime);
                existing.sansVictories = Math.max(existing.sansVictories || 0, uEntry.sansVictories);
                existing.equippedSkin = uEntry.equippedSkin;
              } else {
                map.set(key, uEntry);
              }
            }
          } catch (e) {}
        }
      }

      // 4. Insere o jogador atual ou piloto convidado
      if (this.currentUser) {
        const key = this.currentUser.nickname.toUpperCase();
        const curEntry = {
          nickname: this.currentUser.nickname,
          highScore: Math.max(this.currentUser.highScore || 0, (this.game && this.game.highScore) || 0),
          maxLevel: Math.max(this.currentUser.maxLevel || 1, (this.game && this.game.level) || 1),
          x1Wins: Math.floor(this.currentUser.x1Wins || 0),
          sansTime: parseFloat((this.currentUser.sansTime || 0).toFixed(1)),
          sansVictories: Math.floor(this.currentUser.sansVictories || 0),
          equippedSkin: this.currentUser.equippedSkin || (this.game && this.game.equippedSkin) || 'cyan',
          updatedAt: Date.now()
        };
        map.set(key, curEntry);
      } else {
        const localHs = parseInt(localStorage.getItem('laser_reflex_highscore') || '0', 10);
        const guestHs = parseInt(localStorage.getItem('laser_guest_highscore') || '0', 10);
        const guestSansTime = parseFloat(localStorage.getItem('laser_guest_sanstime') || '0');
        const guestSansVictories = parseInt(localStorage.getItem('laser_guest_sansvictories') || '0', 10);
        const bestHs = Math.max(localHs, guestHs, (this.game && this.game.highScore) || 0);
        if (bestHs > 0 || guestSansTime > 0) {
          const guestNick = this.getGuestNickname();
          const key = guestNick.toUpperCase();
          map.set(key, {
            nickname: guestNick,
            highScore: bestHs,
            maxLevel: parseInt(localStorage.getItem('laser_guest_maxlevel') || '1', 10),
            x1Wins: parseInt(localStorage.getItem('laser_guest_x1wins') || '0', 10),
            sansTime: guestSansTime,
            sansVictories: guestSansVictories,
            equippedSkin: (this.game && this.game.equippedSkin) || localStorage.getItem('laser_reflex_skin') || 'cyan',
            updatedAt: Date.now()
          });
        }
      }

      const list = Array.from(map.values());
      localStorage.setItem(this.leaderboardLocalKey, JSON.stringify(list));
      return list;
    } catch (e) {
      console.warn('Erro ao obter leaderboard local:', e);
      return [...DEFAULT_GLOBAL_LEADERBOARD];
    }
  }

  // Obter o Ranking Público Global ordenado por Categoria diretamente do Banco de Dados
  async getRanking(category = 'score') {
    let orderField = 'highScore';
    if (category === 'x1') orderField = 'x1Wins';
    if (category === 'sans') orderField = 'sansTime';

    const map = new Map();

    // 1. Carrega todos os pilotos do ranking base (rivais globais + jogadores locais)
    const baseList = this.getLocalLeaderboard();
    baseList.forEach(p => {
      if (p && p.nickname) map.set(p.nickname.toUpperCase(), { ...p });
    });

    // 2. Se o Firestore estiver ativo e responder, mescla os pilotos salvos na nuvem
    if (this.isCloudEnabled && this.db) {
      try {
        const snapshot = await this.db.collection('ranking')
          .orderBy(orderField, 'desc')
          .limit(30)
          .get();

        if (!snapshot.empty) {
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data && data.nickname) {
              const key = data.nickname.toUpperCase();
              const existing = map.get(key);
              if (existing) {
                existing.highScore = Math.max(existing.highScore || 0, data.highScore || 0);
                existing.maxLevel = Math.max(existing.maxLevel || 1, data.maxLevel || 1);
                existing.x1Wins = Math.max(existing.x1Wins || 0, data.x1Wins || 0);
                existing.sansTime = Math.max(existing.sansTime || 0, data.sansTime || 0);
                existing.sansVictories = Math.max(existing.sansVictories || 0, data.sansVictories || 0);
                existing.equippedSkin = data.equippedSkin || existing.equippedSkin;
                existing.updatedAt = data.updatedAt || existing.updatedAt;
              } else {
                map.set(key, data);
              }
            }
          });
          this.lastRankingSource = 'cloud';
          console.log(`[Database] Ranking em nuvem sincronizado (${map.size} pilotos).`);
        } else {
          this.lastRankingSource = 'local';
        }
      } catch (err) {
        console.warn('[Database] Firestore em nuvem inacessível, exibindo ranking global integrado:', err.message);
        this.lastRankingSource = 'local';
      }
    } else {
      this.lastRankingSource = 'local';
    }

    const mergedList = Array.from(map.values());

    if (category === 'sans') {
      mergedList.sort((a, b) => {
        const vicA = a.sansVictories || 0;
        const vicB = b.sansVictories || 0;
        if (vicB !== vicA) return vicB - vicA;
        return (b.sansTime || 0) - (a.sansTime || 0);
      });
    } else if (category === 'x1') {
      mergedList.sort((a, b) => (b.x1Wins || 0) - (a.x1Wins || 0));
    } else {
      mergedList.sort((a, b) => (b.highScore || 0) - (a.highScore || 0));
    }

    return mergedList.slice(0, 30);
  }
}

window.DatabaseManager = DatabaseManager;
