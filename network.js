/**
 * NetworkManager - Gerenciador Multiplayer Local e P2P para Laser Reflex (X1)
 * Utiliza PeerJS (WebRTC DataChannel) com fallback automático via BroadcastChannel
 * para testes instantâneos na mesma máquina ou rede local.
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
  }

  fireConnected() {
    if (this.hasFiredConnected) return;
    this.hasFiredConnected = true;
    this.isConnected = true;
    if (this.onConnected) this.onConnected();
  }

  // Gera um código de sala amigável de 4 a 6 caracteres alfanuméricos legíveis
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

  // Cria uma sala como HOST
  createRoom(onReady) {
    this.isHost = true;
    this.isConnected = false;
    this.hasFiredConnected = false;
    this.roomCode = this.generateRoomCode();
    const peerId = this.peerPrefix + this.roomCode.toLowerCase();

    // Notifica o jogo imediatamente com código e link para exibição instantânea
    if (onReady) onReady(this.roomCode, this.getShareableLink(this.roomCode));

    // Fallback local instantâneo via BroadcastChannel (para testes na mesma máquina/abas)
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        if (this.broadcast) this.broadcast.close();
        this.broadcast = new BroadcastChannel('laser_chan_' + this.roomCode.toLowerCase());
        this.broadcast.onmessage = (e) => {
          this.handleIncomingData(e.data, 'broadcast');
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel aviso:', e);
    }

    // Inicializa PeerJS para conexão WebRTC
    try {
      if (typeof Peer !== 'undefined') {
        if (this.peer) this.peer.destroy();
        this.peer = new Peer(peerId, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });

        this.peer.on('open', (id) => {
          console.log('[Multiplayer Host] Sala criada com ID:', id, 'Código:', this.roomCode);
          if (onReady) onReady(this.roomCode, this.getShareableLink(this.roomCode));
        });

        this.peer.on('connection', (conn) => {
          console.log('[Multiplayer Host] Oponente conectou via WebRTC!');
          this.setupConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.warn('[Multiplayer Host] Aviso PeerJS:', err);
          // Mesmo com aviso de signaling, o BroadcastChannel continua funcionando localmente
          if (onReady && !this.isConnected) {
            onReady(this.roomCode, this.getShareableLink(this.roomCode));
          }
        });
      } else {
        if (onReady) onReady(this.roomCode, this.getShareableLink(this.roomCode));
      }
    } catch (err) {
      console.warn('Erro ao inicializar Peer host:', err);
      if (onReady) onReady(this.roomCode, this.getShareableLink(this.roomCode));
    }
  }

  // Entra em uma sala existente como CLIENT
  joinRoom(code, onConnecting, onError) {
    this.isHost = false;
    this.isConnected = false;
    this.hasFiredConnected = false;
    this.roomCode = code.toUpperCase().trim();
    const targetPeerId = this.peerPrefix + this.roomCode.toLowerCase();

    if (onConnecting) onConnecting(this.roomCode);

    // Conecta via BroadcastChannel se estiver na mesma máquina/navegador
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        if (this.broadcast) this.broadcast.close();
        this.broadcast = new BroadcastChannel('laser_chan_' + this.roomCode.toLowerCase());
        this.broadcast.onmessage = (e) => {
          this.handleIncomingData(e.data, 'broadcast');
        };

        // Envia ping de conexão local
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

    // Conecta via WebRTC PeerJS
    try {
      if (typeof Peer !== 'undefined') {
        if (this.peer) this.peer.destroy();
        this.peer = new Peer({
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });

        this.peer.on('open', () => {
          console.log('[Multiplayer Client] Conectando ao host:', targetPeerId);
          const conn = this.peer.connect(targetPeerId, { reliable: true });
          this.setupConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.warn('[Multiplayer Client] Erro de conexão:', err);
          if (onError && !this.isConnected) {
            onError('Não foi possível encontrar a sala com este código.');
          }
        });
      }
    } catch (err) {
      console.warn('Erro ao inicializar Peer client:', err);
      if (onError && !this.isConnected) {
        onError('Erro ao iniciar conexão multiplayer.');
      }
    }
  }

  // Configura a conexão WebRTC DataChannel
  setupConnection(conn) {
    this.connection = conn;

    conn.on('open', () => {
      console.log('[Multiplayer] Canal de dados aberto com sucesso!');
      this.isConnected = true;

      // Envia Handshake inicial
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
      console.log('[Multiplayer] Conexão fechada.');
      this.isConnected = false;
      this.hasFiredConnected = false;
      if (this.onDisconnected) this.onDisconnected();
    });

    conn.on('error', (err) => {
      console.warn('[Multiplayer] Erro no canal:', err);
    });
  }

  // Envia dados para o oponente (tenta WebRTC e também BroadcastChannel)
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
