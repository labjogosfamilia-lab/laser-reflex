/**
 * NetworkManager - Gerenciador Multiplayer Global e P2P para Laser Reflex (X1)
 * Utiliza WebRTC (PeerJS) com STUN e TURN (OpenRelay / Metered) para conexão
 * entre jogadores em redes diferentes (4G/5G, CGNAT, diferentes Wi-Fis e provedores),
 * com reconexão automática, retry com backoff e fallback local via BroadcastChannel.
 */
class NetworkManager {
  constructor(game) {
    this.game = game;
    this.peer = null;
    this.connection = null;
    this.broadcast = null;
    this.isHost = false;
    this.isConnected = false;
    this.roomCode = null;
    this.peerPrefix = 'laser-reflex-x1-';

    // Callbacks do jogo
    this.onConnected = null;
    this.onDisconnected = null;
    this.onMessage = null;
    this.hasFiredConnected = false;

    // Controle de reconexão e timers
    this.retryTimer = null;
    this.watchdogTimer = null;
    this.iceRestartTimer = null;
  }

  // Configuração global de ICE Servers (STUN + TURN para ultrapassar 4G/CGNAT e firewalls)
  getIceConfig() {
    return {
      iceServers: [
        // Servidores STUN Google oficiais (descoberta rápida de IP público e portas)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },

        // Servidor STUN OpenRelay
        { urls: 'stun:openrelay.metered.ca:80' },

        // Servidores TURN OpenRelay (UDP e TCP portas 80/443 - essenciais para 4G/CGNAT e redes diferentes!)
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turns:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      iceCandidatePoolSize: 10,
      sdpSemantics: 'unified-plan'
    };
  }

  fireConnected() {
    if (this.hasFiredConnected) return;
    this.hasFiredConnected = true;
    this.isConnected = true;
    this.clearAllTimers();
    if (this.onConnected) this.onConnected();
  }

  clearAllTimers() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.iceRestartTimer) {
      clearTimeout(this.iceRestartTimer);
      this.iceRestartTimer = null;
    }
  }

  // Gera um código de sala amigável de 4 caracteres alfanuméricos legíveis
  generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Obtém o link completo compartilhável para a sala
  getShareableLink(code) {
    const base = window.location.href.split('?')[0];
    return `${base}?room=${code}`;
  }

  // Cria uma sala como HOST (com suporte global)
  createRoom(onReady, onStatus) {
    this.disconnect();
    this.isHost = true;
    this.isConnected = false;
    this.hasFiredConnected = false;
    this.roomCode = this.generateRoomCode();
    const peerId = this.peerPrefix + this.roomCode.toLowerCase();

    // Notifica o jogo imediatamente para exibir o código e link na tela
    if (onReady) onReady(this.roomCode, this.getShareableLink(this.roomCode));
    if (onStatus) onStatus('📡 Conectando ao servidor global de salas...');

    // Fallback local instantâneo via BroadcastChannel (mesmo navegador/abas)
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcast = new BroadcastChannel('laser_chan_' + this.roomCode.toLowerCase());
        this.broadcast.onmessage = (e) => {
          this.handleIncomingData(e.data, 'broadcast');
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel aviso:', e);
    }

    // Inicializa PeerJS para WebRTC P2P/TURN Global
    try {
      if (typeof Peer !== 'undefined') {
        const peerOptions = {
          debug: 1,
          pingInterval: 5000,
          config: this.getIceConfig()
        };

        this.peer = new Peer(peerId, peerOptions);

        this.peer.on('open', (id) => {
          console.log('[Multiplayer Host] Sala online no servidor global:', id, 'Código:', this.roomCode);
          if (onReady) onReady(this.roomCode, this.getShareableLink(this.roomCode));
          if (onStatus) onStatus('🟢 Sala online! Aguardando oponente de qualquer lugar...');
        });

        this.peer.on('connection', (conn) => {
          console.log('[Multiplayer Host] Oponente conectando via WebRTC...');
          if (onStatus) onStatus('⚔️ Oponente detectado! Negociando conexão...');
          this.setupConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.warn('[Multiplayer Host] Aviso PeerJS:', err);
          if (err.type === 'unavailable-id') {
            console.warn('[Multiplayer Host] Código de sala ocupado. Gerando outro código...');
            setTimeout(() => {
              if (this.isHost && !this.isConnected) {
                this.createRoom(onReady, onStatus);
              }
            }, 500);
            return;
          }
          if (onStatus && !this.isConnected) {
            onStatus('📡 Sala criada. Aguardando oponente...');
          }
        });

        this.peer.on('disconnected', () => {
          console.log('[Multiplayer Host] Sinalização desconectada. Tentando reconectar...');
          if (this.isHost && !this.isConnected && this.peer && !this.peer.destroyed) {
            try { this.peer.reconnect(); } catch (e) {}
          }
        });
      } else {
        if (onStatus) onStatus('⚠️ Biblioteca de rede não carregada.');
      }
    } catch (err) {
      console.warn('Erro ao inicializar Peer host:', err);
      if (onStatus) onStatus('⚠️ Erro ao registrar sala no servidor.');
    }
  }

  // Entra em uma sala existente como CLIENT (com retentativa automática e TURN)
  joinRoom(code, onConnecting, onError) {
    this.disconnect();
    this.isHost = false;
    this.isConnected = false;
    this.hasFiredConnected = false;
    this.roomCode = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

    if (!this.roomCode) {
      if (onError) onError('Por favor, informe o código da sala!');
      return;
    }

    const targetPeerId = this.peerPrefix + this.roomCode.toLowerCase();
    if (onConnecting) onConnecting(`📡 Conectando ao servidor global...`);

    // Conecta via BroadcastChannel se estiver na mesma máquina/navegador
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcast = new BroadcastChannel('laser_chan_' + this.roomCode.toLowerCase());
        this.broadcast.onmessage = (e) => {
          this.handleIncomingData(e.data, 'broadcast');
        };

        // Ping de conexão local
        setTimeout(() => {
          if (!this.isConnected && this.broadcast) {
            this.broadcast.postMessage({
              type: 'PING_JOIN',
              skin: this.game.equippedSkin,
              color: this.game.player.skinColor
            });
          }
        }, 150);
      }
    } catch (e) {
      console.warn('BroadcastChannel erro no join:', e);
    }

    let attempt = 0;
    const maxAttempts = 6;
    let hasAborted = false;

    const tryConnect = () => {
      if (this.isConnected || hasAborted || !this.peer || this.peer.destroyed) return;
      attempt++;

      if (onConnecting) {
        onConnecting(`📡 Procurando sala ${this.roomCode}... (tentativa ${attempt}/${maxAttempts})`);
      }

      console.log(`[Multiplayer Client] Tentativa ${attempt} conectando a ${targetPeerId}`);

      try {
        const conn = this.peer.connect(targetPeerId, {
          reliable: true,
          serialization: 'json'
        });

        this.setupConnection(conn, () => {
          this.clearAllTimers();
        });

        // Watchdog de 12 segundos por tentativa para caso a rota WebRTC fique pendente
        if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
        this.watchdogTimer = setTimeout(() => {
          if (!this.isConnected && !hasAborted) {
            console.warn('[Multiplayer Client] Tempo esgotado na tentativa. Retentando...');
            if (attempt < maxAttempts) {
              tryConnect();
            } else {
              hasAborted = true;
              this.clearAllTimers();
              if (onError) onError('Tempo esgotado. Verifique se o amigo ainda está com a sala aberta e tente novamente.');
            }
          }
        }, 12000);
      } catch (e) {
        console.warn('Erro ao chamar peer.connect:', e);
      }
    };

    // Conecta via WebRTC PeerJS
    try {
      if (typeof Peer !== 'undefined') {
        const peerOptions = {
          debug: 1,
          pingInterval: 5000,
          config: this.getIceConfig()
        };

        this.peer = new Peer(peerOptions);

        this.peer.on('open', (id) => {
          console.log('[Multiplayer Client] Conectado ao servidor global com ID temporário:', id);
          tryConnect();
        });

        this.peer.on('error', (err) => {
          console.warn('[Multiplayer Client] PeerJS erro:', err);
          if (this.isConnected || hasAborted) return;

          // Se a sala ainda não estiver registrada ou o host estiver terminando de conectar, retenta!
          if (err.type === 'peer-unavailable') {
            if (attempt < maxAttempts) {
              if (onConnecting) {
                onConnecting(`📡 Aguardando oponente responder no servidor global... (${attempt}/${maxAttempts})`);
              }
              if (this.retryTimer) clearTimeout(this.retryTimer);
              this.retryTimer = setTimeout(() => {
                if (!this.isConnected && !hasAborted) {
                  tryConnect();
                }
              }, 1800);
              return;
            } else {
              hasAborted = true;
              this.clearAllTimers();
              if (onError) onError(`Sala "${this.roomCode}" não encontrada. Verifique o código e tente novamente.`);
              return;
            }
          }

          if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
            if (attempt < maxAttempts) {
              if (this.retryTimer) clearTimeout(this.retryTimer);
              this.retryTimer = setTimeout(() => {
                if (!this.isConnected && !hasAborted) {
                  tryConnect();
                }
              }, 2000);
              return;
            }
          }

          this.clearAllTimers();
          if (onError && !this.isConnected) {
            onError(err.message || 'Não foi possível encontrar a sala com este código.');
          }
        });

        this.peer.on('disconnected', () => {
          console.log('[Multiplayer Client] Sinalização desconectada. Tentando reconectar...');
          if (!this.isConnected && !hasAborted && this.peer && !this.peer.destroyed) {
            try { this.peer.reconnect(); } catch (e) {}
          }
        });
      } else {
        if (onError) onError('Biblioteca de rede não encontrada.');
      }
    } catch (err) {
      console.warn('Erro ao inicializar Peer client:', err);
      this.clearAllTimers();
      if (onError && !this.isConnected) {
        onError('Erro ao iniciar conexão multiplayer.');
      }
    }
  }

  // Configura a conexão WebRTC DataChannel e monitora estados de rede
  setupConnection(conn, onOpenCallback) {
    this.connection = conn;

    // Monitora ICE Connection State para garantir travessia de CGNAT / 4G / Wi-Fi
    const setupIceListeners = () => {
      if (conn && conn.peerConnection) {
        conn.peerConnection.addEventListener('iceconnectionstatechange', () => {
          const state = conn.peerConnection.iceConnectionState;
          console.log('[Multiplayer] ICE Connection State:', state);

          if (state === 'connected' || state === 'completed') {
            console.log('[Multiplayer] WebRTC P2P/TURN Conectado com sucesso!');
          } else if (state === 'failed') {
            console.warn('[Multiplayer] ICE falhou. Tentando reiniciar ICE (restartIce)...');
            if (conn.peerConnection.restartIce) {
              try { conn.peerConnection.restartIce(); } catch (e) {}
            }
          }
        });
      }
    };
    setupIceListeners();
    setTimeout(setupIceListeners, 400);

    conn.on('open', () => {
      console.log('[Multiplayer] Canal WebRTC DataChannel aberto com sucesso!');
      if (onOpenCallback) onOpenCallback();
      this.clearAllTimers();
      this.isConnected = true;

      // Envia Handshake inicial com os dados do jogador
      this.send({
        type: 'HANDSHAKE',
        isHost: this.isHost,
        skin: this.game.equippedSkin,
        color: this.game.player.skinColor
      });

      this.fireConnected();
    });

    conn.on('data', (data) => {
      this.handleIncomingData(data, 'webrtc');
    });

    conn.on('close', () => {
      console.log('[Multiplayer] Conexão WebRTC fechada.');
      const wasConnected = this.isConnected;
      this.isConnected = false;
      this.hasFiredConnected = false;
      this.clearAllTimers();
      if (wasConnected && this.onDisconnected) {
        this.onDisconnected();
      }
    });

    conn.on('error', (err) => {
      console.warn('[Multiplayer] Erro no canal de dados WebRTC:', err);
    });
  }

  // Envia dados para o oponente (WebRTC prioritário, BroadcastChannel secundário)
  send(payload) {
    let sent = false;
    if (this.connection && this.connection.open) {
      try {
        this.connection.send(payload);
        sent = true;
      } catch (e) {
        console.warn('Falha no envio WebRTC:', e);
      }
    }

    if (this.broadcast) {
      try {
        this.broadcast.postMessage(payload);
        sent = true;
      } catch (e) {
        console.warn('Falha no envio Broadcast:', e);
      }
    }

    return sent;
  }

  // Trata mensagens recebidas
  handleIncomingData(data, source) {
    if (!data || !data.type) return;

    // Resposta ao PING_JOIN local do BroadcastChannel
    if (data.type === 'PING_JOIN' && this.isHost) {
      this.send({
        type: 'PONG_JOIN',
        hostSkin: this.game.equippedSkin,
        hostColor: this.game.player.skinColor
      });
      this.fireConnected();
      return;
    }

    if (data.type === 'PONG_JOIN' && !this.isHost) {
      this.send({
        type: 'HANDSHAKE',
        isHost: false,
        skin: this.game.equippedSkin,
        color: this.game.player.skinColor
      });
      this.fireConnected();
      return;
    }

    if (data.type === 'HANDSHAKE') {
      this.fireConnected();
    }

    if (this.onMessage) {
      this.onMessage(data);
    }
  }

  disconnect() {
    this.isConnected = false;
    this.hasFiredConnected = false;
    this.clearAllTimers();

    if (this.connection) {
      try { this.connection.close(); } catch (e) {}
      this.connection = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    if (this.broadcast) {
      try { this.broadcast.close(); } catch (e) {}
      this.broadcast = null;
    }
  }
}

window.NetworkManager = NetworkManager;
