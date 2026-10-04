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

    this.onUserChange = null;

    this.initFirebase();
    this.resetAllRankingScores();
    this.restoreSession();
  }

  // Zera as pontuações do ranking de todos os jogadores (Local e Nuvem)
  async resetAllRankingScores() {
    const resetFlag = 'laser_ranking_reset_v8.0';
    if (!localStorage.getItem(resetFlag)) {
      try {
        console.log('[Database] Zerando pontuações de todos os jogadores no ranking...');
        // 1. Zera cache local de ranking e remove bots mockados
        const cachedRaw = localStorage.getItem(this.leaderboardLocalKey);
        if (cachedRaw) {
          try {
            const list = JSON.parse(cachedRaw);
            if (Array.isArray(list)) {
              const cleaned = list
                .filter(p => p.nickname !== 'CYBER_ACE' && p.nickname !== 'NEON_SHADOW' && p.nickname !== 'HYPER_PULSE' && p.nickname !== 'SOLAR_DRONE')
                .map(p => ({ ...p, highScore: 0 }));
              localStorage.setItem(this.leaderboardLocalKey, JSON.stringify(cleaned));
            }
          } catch (e) {
            localStorage.removeItem(this.leaderboardLocalKey);
          }
        }

        // 2. Zera recorde no localStorage do jogo atual
        localStorage.setItem('laser_reflex_highscore', '0');
        if (this.game) {
          this.game.highScore = 0;
          if (this.game.domHighScore) this.game.domHighScore.textContent = '0';
          if (this.game.domUserHighScoreDisplay) this.game.domUserHighScoreDisplay.textContent = '0';
        }

        // 3. Zera o highScore de todos os perfis locais salvos
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

        // 4. Marca flag de reset concluído
        localStorage.setItem(resetFlag, 'true');
      } catch (err) {
        console.warn('Erro ao zerar scores locais:', err);
      }
    }

    // Se o Firebase estiver ativo, zera também os documentos da coleção ranking e players
    if (this.isCloudEnabled && this.db) {
      try {
        const rankingDocs = await this.db.collection('ranking').get();
        if (!rankingDocs.empty) {
          const batch = this.db.batch();
          rankingDocs.forEach(doc => {
            const data = doc.data();
            if (['CYBER_ACE', 'NEON_SHADOW', 'HYPER_PULSE', 'SOLAR_DRONE'].includes(doc.id)) {
              batch.delete(doc.ref);
            } else if (data.highScore > 0) {
              batch.update(doc.ref, { highScore: 0 });
            }
          });
          await batch.commit();
          console.log('[Database] Ranking zerado no Firebase Firestore!');
        }
      } catch (e) {
        // Ignora silenciosamente se o Firestore ainda estiver sendo habilitado no console
      }
    }
  }

  // Permite zerar manualmente a qualquer momento se desejado
  async zeroAllRankingScores() {
    localStorage.removeItem('laser_ranking_reset_v8.0');
    await this.resetAllRankingScores();
    if (this.game && this.game.renderRankingList) {
      this.game.renderRankingList('score');
    }
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
          userData.lastLogin = Date.now();
          await userRef.update({ lastLogin: userData.lastLogin });

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

    userData.lastLogin = Date.now();
    localStorage.setItem(this.storageKeyPrefix + nickname, JSON.stringify(userData));

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

  // Obter o Ranking Público Global ordenado por Categoria
  async getRanking(category = 'score') {
    // 1. Tenta buscar do Firebase
    if (this.isCloudEnabled && this.db) {
      try {
        const orderField = (category === 'x1') ? 'x1Wins' : 'highScore';
        const snapshot = await this.db.collection('ranking')
          .orderBy(orderField, 'desc')
          .limit(30)
          .get();

        const rankingList = [];
        snapshot.forEach(doc => {
          rankingList.push(doc.data());
        });

        if (rankingList.length > 0) {
          return rankingList;
        }
      } catch (err) {
        console.warn('Erro ao buscar ranking do Firebase, exibindo cache local:', err);
      }
    }

    // 2. Fallback do cache local
    const localList = this.getLocalLeaderboard();
    const sortField = (category === 'x1') ? 'x1Wins' : 'highScore';
    localList.sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0));
    return localList.slice(0, 30);
  }
}

window.DatabaseManager = DatabaseManager;
