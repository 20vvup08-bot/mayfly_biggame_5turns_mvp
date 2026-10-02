const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

// 1. Static Web Server (HTML, CSS, JS)
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  let filePath = path.join(__dirname, 'public', reqPath === '/' ? 'index.html' : reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(content, 'utf-8');
    }
  });
});

// 2. 방(Room) 관리 및 Pub/Sub 메시지 브로커
// rooms: { [roomCode]: { code, hostId, status, members: [ { id, name, isHost, isReady } ] } }
const rooms = new Map();
const clientMeta = new Map(); // ws -> { playerId, nickname, roomCode }

const broker = {
  topics: new Map(), // destination -> Set<ws>

  subscribe(topic, client) {
    if (!this.topics.has(topic)) {
      this.topics.set(topic, new Set());
    }
    this.topics.get(topic).add(client);
  },

  unsubscribe(topic, client) {
    if (this.topics.has(topic)) {
      this.topics.get(topic).delete(client);
      if (this.topics.get(topic).size === 0) {
        this.topics.delete(topic);
      }
    }
  },

  unsubscribeAll(client) {
    for (const [topic, set] of this.topics.entries()) {
      set.delete(client);
      if (set.size === 0) this.topics.delete(topic);
    }
  },

  publish(topic, payload) {
    if (!this.topics.has(topic)) return;
    const msg = JSON.stringify({
      topic,
      payload,
      timestamp: Date.now()
    });
    for (const client of this.topics.get(topic)) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }
};

const wss = new WebSocket.Server({ server, path: '/ws-stomp' });

function sendWs(ws, action, data = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action, ...data }));
  }
}

wss.on('connection', (ws, req) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[WebSocket] 연결 성공 (IP: ${clientIp})`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      const { action, destination, payload, roomCode, nickname, playerId, isReady } = data;

      switch (action) {
        case 'CONNECT':
          sendWs(ws, 'CONNECTED', { server: 'Mayfly-MessageBroker/2.0' });
          break;

        // 1) 방 개설 요청
        case 'CREATE_ROOM': {
          let code;
          do {
            code = String(Math.floor(1000 + Math.random() * 9000));
          } while (rooms.has(code));

          const newRoom = {
            code,
            hostId: playerId,
            status: 'WAITING',
            members: [
              { id: playerId, name: nickname || '방장', isHost: true, isReady: true }
            ]
          };

          rooms.set(code, newRoom);
          clientMeta.set(ws, { playerId, nickname, roomCode: code });

          // 대기실 토픽 자동 구독
          const topic = `/topic/room/${code}`;
          broker.subscribe(topic, ws);

          console.log(`[방 생성] 방 코드: #${code} (방장: ${nickname})`);
          sendWs(ws, 'ROOM_CREATED', {
            roomCode: code,
            members: newRoom.members
          });
          break;
        }

        // 2) 방 참여 요청 (코드 유효성 검사 필수!)
        case 'JOIN_ROOM': {
          const targetCode = String(roomCode || '').trim();

          // 방 존재 여부 검사
          if (!rooms.has(targetCode)) {
            sendWs(ws, 'ERROR', {
              message: `존재하지 않는 방 코드(#${targetCode})입니다. 코드를 다시 확인해주세요!`
            });
            return;
          }

          const room = rooms.get(targetCode);

          if (room.status !== 'WAITING') {
            sendWs(ws, 'ERROR', {
              message: '이미 게임이 시작되어 입장할 수 없는 방입니다.'
            });
            return;
          }

          // 이미 같은 ID가 들어있는지 검사 (중복 방지)
          const existingIdx = room.members.findIndex(m => m.id === playerId);
          if (existingIdx >= 0) {
            room.members[existingIdx].name = nickname;
          } else {
            room.members.push({
              id: playerId,
              name: nickname || '참가자',
              isHost: false,
              isReady: false
            });
          }

          clientMeta.set(ws, { playerId, nickname, roomCode: targetCode });

          // 대기실 토픽 구독
          const topic = `/topic/room/${targetCode}`;
          broker.subscribe(topic, ws);

          console.log(`[방 입장] #${targetCode} (입장자: ${nickname}, 현재 인원: ${room.members.length}명)`);

          // 입장자에게 성공 알림
          sendWs(ws, 'ROOM_JOINED', {
            roomCode: targetCode,
            members: room.members
          });

          // 방 전체 인원에게 명단 갱신 브로드캐스트
          broker.publish(topic, {
            type: 'ROOM_UPDATE',
            members: room.members
          });
          break;
        }

        // 3) 준비 완료 토글
        case 'TOGGLE_READY': {
          const room = rooms.get(roomCode);
          if (!room) return;

          const member = room.members.find(m => m.id === playerId);
          if (member) {
            member.isReady = Boolean(isReady);
            console.log(`[준비 상태 변경] #${roomCode} ${member.name} -> ${member.isReady ? '준비완료' : '준비해제'}`);
            broker.publish(`/topic/room/${roomCode}`, {
              type: 'ROOM_UPDATE',
              members: room.members
            });
          }
          break;
        }

        // 4) 게임 시작 (1:1 매칭 & 홀수 1명 대기석 분리)
        case 'START_GAME': {
          const room = rooms.get(roomCode);
          if (!room) return;
          if (room.hostId !== playerId) {
            sendWs(ws, 'ERROR', { message: '방장만 게임을 시작할 수 있습니다.' });
            return;
          }

          const shuffled = room.members.slice().sort(() => Math.random() - 0.5);
          const pairs = [];
          let waitingPlayer = null;

          for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
              const pairId = `pair_${Math.floor(i / 2) + 1}_${Date.now()}`;
              pairs.push({
                pairId,
                p1: { id: shuffled[i].id, name: shuffled[i].name },
                p2: { id: shuffled[i + 1].id, name: shuffled[i + 1].name }
              });
            } else {
              waitingPlayer = { id: shuffled[i].id, name: shuffled[i].name };
            }
          }

          room.status = 'PLAYING';
          console.log(`[게임 시작] #${roomCode} (페어: ${pairs.length}쌍, 대기자: ${waitingPlayer ? waitingPlayer.name : '없음'})`);

          broker.publish(`/topic/room/${roomCode}`, {
            type: 'MATCH_START_WITH_PAIRS',
            pairs,
            waitingPlayer
          });
          break;
        }

        // 5) Pub/Sub 토픽 구독 및 메시지 발행 (채팅, 카드 교환 등)
        case 'SUBSCRIBE':
          if (destination) {
            broker.subscribe(destination, ws);
          }
          break;

        case 'UNSUBSCRIBE':
          if (destination) {
            broker.unsubscribe(destination, ws);
          }
          break;

        case 'SEND':
          if (destination) {
            broker.publish(destination, payload);
          }
          break;

        default:
          break;
      }
    } catch (e) {
      console.error('[Broker] 메시지 처리 에러:', e);
    }
  });

  // 연결 종료 시 방 퇴장 처리
  ws.on('close', () => {
    const meta = clientMeta.get(ws);
    if (meta && meta.roomCode && rooms.has(meta.roomCode)) {
      const room = rooms.get(meta.roomCode);
      room.members = room.members.filter(m => m.id !== meta.playerId);

      console.log(`[퇴장] #${meta.roomCode} ${meta.nickname} 접속 종료 (남은 인원: ${room.members.length}명)`);

      if (room.members.length === 0) {
        rooms.delete(meta.roomCode);
        console.log(`[방 삭제] #${meta.roomCode} 빈 방 삭제됨`);
      } else {
        // 방장이 나간 경우 다음 사람에게 방장 위임
        if (room.hostId === meta.playerId && room.members.length > 0) {
          room.members[0].isHost = true;
          room.members[0].isReady = true;
          room.hostId = room.members[0].id;
          console.log(`[방장 위임] #${meta.roomCode} 새 방장: ${room.members[0].name}`);
        }

        broker.publish(`/topic/room/${meta.roomCode}`, {
          type: 'ROOM_UPDATE',
          members: room.members
        });
      }
    }
    broker.unsubscribeAll(ws);
    clientMeta.delete(ws);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================================');
  console.log(`🃏 메이플라이 웹소켓 & 메시지 브로커 서버 구동 완료!`);
  console.log(`🌐 로컬 웹 접속: http://localhost:${PORT}`);
  console.log(`🔗 포트 공유 / 외부 접속 가능 (0.0.0.0 바인딩 완료)`);
  console.log(`📡 웹소켓 엔드포인트: /ws-stomp (HTTP/HTTPS 자동 호환)`);
  console.log('========================================================');
});
