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
    this.resetAllRankingScores();
    this.restoreSession();
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
    const nickname = user ? user.nickname : (localStorage.getItem('laser_guest_nickname') || 'PILOTO_ANONIMO');

    const matchEntry = {
      nickname: nickname,
      isRegistered: !!user,
      mode: matchData.mode || 'solo',
      score: Math.floor(matchData.score || 0),
      level: matchData.level || 1,
      survivalTime: matchData.survivalTime || 0,
      isWinner: !!matchData.isWinner,
      creditsEarned: matchData.creditsEarned || 0,
      timestamp: now,
      date: dateFormatted
    };

    console.log(`[Database] Gravando resultado da partida no banco de dados para ${nickname}:`, matchEntry);

    // 1. Grava o resultado na coleção 'matches' (Histórico Geral de Partidas no Firebase)
    if (this.isCloudEnabled && this.db) {
      try {
        await this.db.collection('matches').add(matchEntry);
        console.log('[Database] Partida registrada na coleção "matches" do Firebase!');
      } catch (e) {
        console.warn('[Database] Erro ao gravar partida no Firebase:', e.message);
      }
    }

    // 2. Se o jogador tiver conta criada, atualiza os dados do piloto e o ranking
    if (user) {
      user.matchesPlayed = (user.matchesPlayed || 0) + 1;

      if (matchData.mode === 'solo') {
        const matchScore = Math.floor(matchData.score || 0);
        if (matchScore > (user.highScore || 0)) {
          user.highScore = matchScore;
        }
        if ((matchData.level || 1) > (user.maxLevel || 1)) {
          user.maxLevel = matchData.level;
        }
      } else if (matchData.mode === 'x1' && matchData.isWinner) {
        user.x1Wins = (user.x1Wins || 0) + 1;
      }

      if (this.game && this.game.credits !== undefined) {
        user.credits = this.game.credits;
      }
      user.updatedAt = now;

      // Salva no perfil do jogador (Local e Nuvem)
      try {
        localStorage.setItem(this.storageKeyPrefix + user.nickname, JSON.stringify(user));
      } catch (e) {}

      if (this.isCloudEnabled && this.db) {
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
          console.warn('[Database] Erro ao atualizar jogador após partida no Firebase:', e.message);
        }
      }

      // 3. Atualiza o Ranking no Banco de Dados para refletir a nova pontuação
      await this.syncToLeaderboard(user);

      if (this.onUserChange) this.onUserChange(user);
    } else {
      // Piloto anônimo jogando solo
      if (matchData.mode === 'solo' && matchData.score > (this.game.highScore || 0)) {
        this.game.highScore = matchData.score;
        localStorage.setItem('laser_reflex_highscore', this.game.highScore);
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

  // Validação de Apelido (Nickname)
  sanitizeNickname(nickname) {
    return (nickname || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 12);
  }

  // Cadastrar novo jogador
  async register(nicknameRaw, pin) {
    const nickname = this.sanitizeNickname(nicknameRaw);
    if (!nickname || nickname.length < 3) {
      throw new Error('O apelido deve ter entre 3 e 12 caracteres (apenas letras, números e _)!');
    }
    if (!pin || pin.length < 4) {
      throw new Error('A senha/PIN deve ter pelo menos 4 caracteres!');
    }

    const pinHash = await this.hashPin(pin);

    // 1. Tenta verificar e salvar no Firebase se ativo
    if (this.isCloudEnabled && this.db) {
      try {
        const userRef = this.db.collection('players').doc(nickname);
        const doc = await userRef.get();
        if (doc.exists) {
          throw new Error('Este apelido já está em uso! Escolha outro.');
        }

        const newPlayer = {
          nickname: nickname,
          pinHash: pinHash,
          highScore: this.game.highScore || 0,
          maxLevel: this.game.level || 1,
          credits: this.game.credits || 0,
          x1Wins: this.game.x1Wins || 0,
          matchesPlayed: 0,
          unlockedSkins: this.game.ownedSkins || ['cyan'],
          equippedSkin: this.game.equippedSkin || 'cyan',
          createdAt: Date.now(),
          lastLogin: Date.now()
        };

        await userRef.set(newPlayer);
        await this.syncToLeaderboard(newPlayer);
        await this.recordLogin(newPlayer, 'register');

        this.setCurrentUser(newPlayer);
        return newPlayer;
      } catch (err) {
        if (err.message.includes('já está em uso')) throw err;
        console.warn('Erro ao salvar no Firebase, registrando localmente:', err);
      }
    }

    // 2. Registro Local (armazenamento persistente do navegador)
    const localExisting = localStorage.getItem(this.storageKeyPrefix + nickname);
    if (localExisting) {
      throw new Error('Este apelido já está em uso neste dispositivo! Escolha outro.');
    }

    const newPlayer = {
      nickname: nickname,
      pinHash: pinHash,
      highScore: this.game.highScore || 0,
      maxLevel: this.game.level || 1,
      credits: this.game.credits || 0,
      x1Wins: this.game.x1Wins || 0,
      matchesPlayed: 0,
      unlockedSkins: this.game.ownedSkins || ['cyan'],
      equippedSkin: this.game.equippedSkin || 'cyan',
      createdAt: Date.now(),
      lastLogin: Date.now()
    };

    localStorage.setItem(this.storageKeyPrefix + nickname, JSON.stringify(newPlayer));
    this.updateLocalLeaderboard(newPlayer);
    await this.recordLogin(newPlayer, 'register');
    this.setCurrentUser(newPlayer);
    return newPlayer;
  }

  // Fazer Login com Apelido e Senha/PIN
  async login(nicknameRaw, pin) {
    const nickname = this.sanitizeNickname(nicknameRaw);
    if (!nickname) {
      throw new Error('Informe seu apelido!');
    }
    if (!pin) {
      throw new Error('Informe sua senha/PIN!');
    }

    const pinHash = await this.hashPin(pin);

    // 1. Tenta no Firebase
    if (this.isCloudEnabled && this.db) {
      try {
        const userRef = this.db.collection('players').doc(nickname);
        const doc = await userRef.get();
        if (doc.exists) {
          const userData = doc.data();
          if (userData.pinHash !== pinHash) {
            throw new Error('Senha/PIN incorreto para este jogador!');
          }
          await this.recordLogin(userData, 'login');

          this.setCurrentUser(userData);
          this.applyUserDataToGame(userData);
          return userData;
        } else {
          throw new Error('Jogador não encontrado com este apelido.');
        }
      } catch (err) {
        if (err.message.includes('Senha/PIN') || err.message.includes('não encontrado')) {
          throw err;
        }
        console.warn('Erro ao autenticar no Firebase, verificando local:', err);
      }
    }

    // 2. Fallback Local
    const localData = localStorage.getItem(this.storageKeyPrefix + nickname);
    if (!localData) {
      throw new Error('Jogador não encontrado com este apelido.');
    }

    const userData = JSON.parse(localData);
    if (userData.pinHash !== pinHash) {
      throw new Error('Senha/PIN incorreto para este jogador!');
    }

    await this.recordLogin(userData, 'login');

    this.setCurrentUser(userData);
    this.applyUserDataToGame(userData);
    return userData;
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

  // Restaura sessão anterior salva
  async restoreSession() {
    try {
      const sessionRaw = localStorage.getItem(this.sessionKey);
      if (!sessionRaw) return;

      const session = JSON.parse(sessionRaw);
      if (!session || !session.nickname) return;

      // Busca dados locais ou na nuvem
      const localData = localStorage.getItem(this.storageKeyPrefix + session.nickname);
      if (localData) {
        const user = JSON.parse(localData);
        if (user.pinHash === session.pinHash) {
          this.setCurrentUser(user);
          this.applyUserDataToGame(user);
          this.recordLogin(user, 'session_restore');
        }
      }

      // Se Firebase ativo, busca a versão mais fresca
      if (this.isCloudEnabled && this.db) {
        const doc = await this.db.collection('players').doc(session.nickname).get();
        if (doc.exists) {
          const user = doc.data();
          if (user.pinHash === session.pinHash) {
            this.setCurrentUser(user);
            this.applyUserDataToGame(user);
            this.recordLogin(user, 'session_restore');
          }
        }
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
    if (!this.isCloudEnabled || !this.db || !player || !player.nickname) return;
    try {
      await this.db.collection('ranking').doc(player.nickname).set({
        nickname: player.nickname,
        highScore: player.highScore || 0,
        maxLevel: player.maxLevel || 1,
        x1Wins: player.x1Wins || 0,
        equippedSkin: player.equippedSkin || 'default',
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {
      console.warn('Erro ao atualizar ranking no Firebase:', e);
    }
  }

  // Atualiza cache de ranking local
  updateLocalLeaderboard(player) {
    try {
      let list = this.getLocalLeaderboard();
      const idx = list.findIndex(p => p.nickname === player.nickname);
      const entry = {
        nickname: player.nickname,
        highScore: player.highScore || 0,
        maxLevel: player.maxLevel || 1,
        x1Wins: player.x1Wins || 0,
        equippedSkin: player.equippedSkin || 'default',
        updatedAt: Date.now()
      };

      if (idx >= 0) {
        list[idx] = entry;
      } else {
        list.push(entry);
      }

      localStorage.setItem(this.leaderboardLocalKey, JSON.stringify(list));
    } catch (e) {}
  }

  getLocalLeaderboard() {
    try {
      const data = localStorage.getItem(this.leaderboardLocalKey);
      if (data) {
        const parsed = JSON.parse(data);
        // Filtra para remover qualquer jogador de teste antigo (como CYBER_ACE, NEON_SHADOW)
        const clean = Array.isArray(parsed) ? parsed.filter(p => p.nickname !== 'CYBER_ACE' && p.nickname !== 'NEON_SHADOW' && p.nickname !== 'HYPER_PULSE' && p.nickname !== 'SOLAR_DRONE') : [];
        if (clean.length !== parsed.length) {
          localStorage.setItem(this.leaderboardLocalKey, JSON.stringify(clean));
        }
        return clean;
      }
    } catch (e) {}

    return [];
  }

  // Obter o Ranking Público Global ordenado por Categoria diretamente do Banco de Dados
  async getRanking(category = 'score') {
    const orderField = (category === 'x1') ? 'x1Wins' : 'highScore';

    // 1. Tenta buscar DIRETAMENTE do Firebase Firestore (Banco de Dados em Nuvem)
    if (this.isCloudEnabled && this.db) {
      try {
        const snapshot = await this.db.collection('ranking')
          .orderBy(orderField, 'desc')
          .limit(30)
          .get();

        const rankingList = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          if (!['CYBER_ACE', 'NEON_SHADOW', 'HYPER_PULSE', 'SOLAR_DRONE'].includes(data.nickname)) {
            rankingList.push(data);
          }
        });

        // O ranking reflete fielmente os dados cadastrados no banco
        console.log(`[Database] Ranking carregado diretamente do Firestore (${rankingList.length} pilotos).`);
        this.lastRankingSource = 'cloud';
        return rankingList;
      } catch (err) {
        console.warn('[Database] Firestore em nuvem inacessível, exibindo banco local:', err.message);
      }
    }

    // 2. Fallback do Banco Local
    this.lastRankingSource = 'local';
    const localList = this.getLocalLeaderboard();
    const sortField = (category === 'x1') ? 'x1Wins' : 'highScore';
    localList.sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0));
    return localList.slice(0, 30);
  }
}

window.DatabaseManager = DatabaseManager;
