const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://bqwrahmqnmrzrtghawmy.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_-lvbut_R4UxnEcCr5BHfbQ_bP8Yq-7Q";

async function deleteRoomFromDb(roomCode) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rooms?room_code=eq.${roomCode}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
  } catch (e) {}
}

async function updateRoomInDb(roomCode, patch) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rooms?room_code=eq.${roomCode}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(patch)
    });
  } catch (e) {}
}

// [핵심] 3인 이상일 때 직전 턴 파트너를 무조건 피하고, 대기자도 연속으로 쉬지 않도록 로테이션 매칭
function generateRoundPairs(members, lastPairs = {}, metHistory = {}, waitingHistory = []) {
  const n = members.length;
  if (n < 2) return { pairs: [], waitingPlayer: null };

  if (n === 2) {
    const pairId = `pair_1_${Date.now()}`;
    return {
      pairs: [{
        pairId,
        p1: { id: members[0].id, name: members[0].name },
        p2: { id: members[1].id, name: members[1].name }
      }],
      waitingPlayer: null
    };
  }

  let bestPairs = null;
  let bestWaiting = null;
  let bestPenalty = Infinity;

  const playerList = members.slice();
  const lastWaiterId = waitingHistory.length > 0 ? waitingHistory[waitingHistory.length - 1] : null;

  for (let attempt = 0; attempt < 400; attempt++) {
    const shuffled = playerList.slice().sort(() => Math.random() - 0.5);
    let waiting = null;

    if (shuffled.length % 2 !== 0) {
      // 직전 턴에 대기했던 사람은 이번 턴에 무조건 대화에 참여!
      let candidates = shuffled.filter(m => m.id !== lastWaiterId);
      if (candidates.length === 0) candidates = shuffled.slice();

      candidates.sort((a, b) => {
        const aCount = waitingHistory.filter(id => id === a.id).length;
        const bCount = waitingHistory.filter(id => id === b.id).length;
        return aCount - bCount + (Math.random() * 0.4 - 0.2);
      });

      waiting = candidates[0];
      const idx = shuffled.findIndex(m => m.id === waiting.id);
      if (idx > -1) shuffled.splice(idx, 1);
    }

    let penalty = 0;
    const pairs = [];

    if (waiting && waiting.id === lastWaiterId) {
      penalty += 10000;
    }

    for (let i = 0; i < shuffled.length; i += 2) {
      const p1 = shuffled[i];
      const p2 = shuffled[i + 1];

      // 직전 턴에 대화했던 사람과 다시 매칭되면 강력한 페널티
      if (lastPairs[p1.id] === p2.id || lastPairs[p2.id] === p1.id) {
        penalty += 2000;
      }

      const hist1 = metHistory[p1.id] || [];
      const meetCount = hist1.filter(id => id === p2.id).length;
      penalty += meetCount * 25;

      pairs.push({
        pairId: `pair_${Math.floor(i / 2) + 1}_${Date.now()}_${attempt}`,
        p1: { id: p1.id, name: p1.name },
        p2: { id: p2.id, name: p2.name }
      });
    }

    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestPairs = pairs;
      bestWaiting = waiting ? { id: waiting.id, name: waiting.name } : null;
      if (penalty === 0) break;
    }
  }

  return { pairs: bestPairs, waitingPlayer: bestWaiting };
}

function startOrAdvanceRound(roomCode, room, isFirstTurn) {
  if (isFirstTurn) {
    room.status = 'PLAYING';
    room.currentTurn = 1;
    room.lastPairs = {};
    room.metHistory = {};
    room.waitingHistory = [];
    room.turnReady = new Set();
  } else {
    room.turnReady.clear();
    room.currentTurn = (room.currentTurn || 1) + 1;
  }

  if (room.currentTurn > (room.totalTurns || 5)) {
    room.status = 'FINISHED';
    broker.publish(`/topic/room/${roomCode}`, {
      type: 'ALL_TURNS_FINISHED'
    });
    return;
  }

  const { pairs, waitingPlayer } = generateRoundPairs(
    room.members,
    room.lastPairs,
    room.metHistory,
    room.waitingHistory
  );

  room.currentPairs = pairs;
  room.currentWaiting = waitingPlayer;

  if (waitingPlayer) {
    room.waitingHistory.push(waitingPlayer.id);
  }

  room.lastPairs = {};
  for (const pair of pairs) {
    room.lastPairs[pair.p1.id] = pair.p2.id;
    room.lastPairs[pair.p2.id] = pair.p1.id;
    if (!room.metHistory[pair.p1.id]) room.metHistory[pair.p1.id] = [];
    if (!room.metHistory[pair.p2.id]) room.metHistory[pair.p2.id] = [];
    room.metHistory[pair.p1.id].push(pair.p2.id);
    room.metHistory[pair.p2.id].push(pair.p1.id);
  }

  console.log(`🔄 [매칭 완료] #${roomCode} -> ${room.currentTurn}턴 시작! (페어: ${pairs.map(p => p.p1.name + '↔' + p.p2.name).join(', ')}, 대기: ${waitingPlayer ? waitingPlayer.name : '없음'})`);

  broker.publish(`/topic/room/${roomCode}`, {
    type: 'ROUND_START_WITH_PAIRS',
    turn: room.currentTurn,
    pairs,
    waitingPlayer
  });
}

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];

  if (reqPath === '/favicon.ico') {
    res.writeHead(204, { 'Content-Type': 'image/x-icon' });
    res.end();
    return;
  }

  let targetFile = reqPath === '/' ? 'index.html' : reqPath.substring(1);

  let rootPath = path.join(__dirname, targetFile);
  let publicPath = path.join(__dirname, 'public', targetFile);
  let filePath = fs.existsSync(rootPath) ? rootPath : publicPath;

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
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + targetFile);
    } else {
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      });
      res.end(content, 'utf-8');
    }
  });
});

const rooms = new Map();
const clientMeta = new Map();
const disconnectTimers = new Map();

const broker = {
  topics: new Map(),

  subscribe(topic, client) {
    if (!this.topics.has(topic)) this.topics.set(topic, new Set());
    this.topics.get(topic).add(client);
  },

  unsubscribe(topic, client) {
    if (this.topics.has(topic)) {
      this.topics.get(topic).delete(client);
      if (this.topics.get(topic).size === 0) this.topics.delete(topic);
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
    const msg = JSON.stringify({ topic, payload, timestamp: Date.now() });
    for (const client of this.topics.get(topic)) {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    }
  }
};

const wss = new WebSocket.Server({ server, path: '/ws-stomp' });

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(heartbeatInterval));

function sendWs(ws, action, data = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action, ...data }));
  }
}

function handlePlayerLeave(playerId, nickname, roomCode) {
  if (!roomCode || !rooms.has(roomCode)) return;
  const room = rooms.get(roomCode);
  const wasHost = (room.hostId === playerId);

  room.members = room.members.filter(m => m.id !== playerId);
  if (room.turnReady) room.turnReady.delete(playerId);

  broker.publish(`/topic/room/${roomCode}`, {
    type: 'MEMBER_LEFT',
    roomCode: roomCode,
    playerId: playerId,
    playerName: nickname,
    remainingCount: room.members.length
  });

  if (room.members.length === 0) {
    rooms.delete(roomCode);
    deleteRoomFromDb(roomCode);
    broker.publish('/topic/lobby', { type: 'ROOM_DELETED', roomCode });
  } else {
    if (wasHost) {
      room.members[0].isHost = true;
      room.members[0].isReady = true;
      room.hostId = room.members[0].id;
    }

    if (room.status === 'PLAYING' && room.members.length < 2) {
      room.status = 'WAITING';
    }

    updateRoomInDb(roomCode, {
      host_name: room.members[0].name,
      current_players: room.members.length,
      status: room.status
    });

    broker.publish(`/topic/room/${roomCode}`, {
      type: 'ROOM_UPDATE',
      roomCode: roomCode,
      title: room.title,
      hostId: room.hostId,
      minPlayers: room.minPlayers,
      maxPlayers: room.maxPlayers,
      members: room.members,
      status: room.status,
      wasHostChanged: wasHost
    });

    broker.publish('/topic/lobby', {
      type: 'ROOM_UPDATED',
      roomCode: roomCode,
      current_players: room.members.length,
      host_name: room.members[0].name
    });
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      const { action, destination, payload, roomCode, nickname, playerId, isReady } = data;

      switch (action) {
        case 'CONNECT':
          sendWs(ws, 'CONNECTED', { server: 'Mayfly-MessageBroker/4.0' });
          break;

        case 'CREATE_ROOM': {
          let code = String(data.roomCode || '').trim();
          if (!code) {
            do {
              code = String(Math.floor(1000 + Math.random() * 9000));
            } while (rooms.has(code));
          }

          if (rooms.has(code)) {
            const existing = rooms.get(code);
            existing.hostId = playerId;
            existing.members.forEach(m => { m.isHost = false; });
            const hostM = existing.members.find(m => m.id === playerId);
            if (hostM) {
              hostM.isHost = true;
              hostM.isReady = true;
            } else {
              existing.members.unshift({ id: playerId, name: nickname || '방장', isHost: true, isReady: true });
            }
            clientMeta.set(ws, { playerId, nickname, roomCode: code });
            broker.subscribe(`/topic/room/${code}`, ws);
            sendWs(ws, 'ROOM_CREATED', {
              roomCode: code,
              title: existing.title,
              minPlayers: existing.minPlayers,
              maxPlayers: existing.maxPlayers,
              members: existing.members
            });
            break;
          }

          const newRoom = {
            code,
            title: data.title || '가치관 대화방',
            minPlayers: parseInt(data.minPlayers) || 2,
            maxPlayers: parseInt(data.maxPlayers) || 8,
            isPrivate: Boolean(data.isPrivate),
            password: data.password ? String(data.password).trim() : null,
            hostId: playerId,
            status: 'WAITING',
            currentTurn: 1,
            totalTurns: 5,
            lastPairs: {},
            metHistory: {},
            waitingHistory: [],
            turnReady: new Set(),
            currentPairs: [],
            currentWaiting: null,
            members: [
              { id: playerId, name: nickname || '방장', isHost: true, isReady: true }
            ]
          };

          rooms.set(code, newRoom);
          clientMeta.set(ws, { playerId, nickname, roomCode: code });
          broker.subscribe(`/topic/room/${code}`, ws);

          sendWs(ws, 'ROOM_CREATED', {
            roomCode: code,
            title: newRoom.title,
            minPlayers: newRoom.minPlayers,
            maxPlayers: newRoom.maxPlayers,
            members: newRoom.members
          });

          broker.publish('/topic/lobby', {
            type: 'ROOM_CREATED',
            roomCode: code,
            title: newRoom.title,
            host_name: nickname || '방장',
            min_players: newRoom.minPlayers,
            max_players: newRoom.maxPlayers,
            current_players: 1,
            is_private: newRoom.isPrivate,
            status: 'WAITING'
          });
          break;
        }

        case 'JOIN_ROOM': {
          const targetCode = String(roomCode || '').trim();
          let room = rooms.get(targetCode);

          if (!room) {
            try {
              const res = await fetch(`${SUPABASE_URL}/rest/v1/rooms?room_code=eq.${targetCode}`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
              });
              const dbData = await res.json();
              if (Array.isArray(dbData) && dbData.length > 0 && dbData[0].status === 'WAITING') {
                const dbRoom = dbData[0];
                room = {
                  code: targetCode,
                  title: dbRoom.title || '가치관 대화방',
                  minPlayers: parseInt(dbRoom.min_players) || 2,
                  maxPlayers: parseInt(dbRoom.max_players) || 8,
                  isPrivate: Boolean(dbRoom.is_private),
                  password: dbRoom.password ? String(dbRoom.password).trim() : null,
                  hostId: playerId,
                  status: 'WAITING',
                  currentTurn: 1,
                  totalTurns: 5,
                  lastPairs: {},
                  metHistory: {},
                  waitingHistory: [],
                  turnReady: new Set(),
                  currentPairs: [],
                  currentWaiting: null,
                  members: []
                };
                rooms.set(targetCode, room);
              }
            } catch (e) {}
          }

          if (!room) {
            deleteRoomFromDb(targetCode);
            broker.publish('/topic/lobby', { type: 'ROOM_DELETED', roomCode: targetCode });
            sendWs(ws, 'ERROR', { message: `해당 방(#${targetCode})은 이미 닫혀 삭제되었습니다.` });
            return;
          }

          if (room.status !== 'WAITING') {
            sendWs(ws, 'ERROR', { message: '이미 게임이 진행 중인 방입니다.' });
            return;
          }

          if (room.isPrivate) {
            const inputPass = payload && payload.password ? String(payload.password).trim() : '';
            if (inputPass !== String(room.password).trim()) {
              sendWs(ws, 'ERROR', { message: '비밀번호가 일치하지 않습니다.' });
              return;
            }
          }

          if (room.members.length >= room.maxPlayers) {
            sendWs(ws, 'ERROR', { message: `방 정원(${room.maxPlayers}명)이 가득 찼습니다.` });
            return;
          }

          const existingIdx = room.members.findIndex(m => m.id === playerId);
          if (existingIdx >= 0) {
            room.members[existingIdx].name = nickname;
          } else {
            const isFirst = room.members.length === 0;
            room.members.push({
              id: playerId,
              name: nickname || '참가자',
              isHost: isFirst,
              isReady: isFirst
            });
            if (isFirst) room.hostId = playerId;
          }

          clientMeta.set(ws, { playerId, nickname, roomCode: targetCode });
          const topic = `/topic/room/${targetCode}`;
          broker.subscribe(topic, ws);

          updateRoomInDb(targetCode, { current_players: room.members.length });

          sendWs(ws, 'ROOM_JOINED', {
            roomCode: targetCode,
            title: room.title,
            minPlayers: room.minPlayers,
            maxPlayers: room.maxPlayers,
            members: room.members
          });

          broker.publish(topic, {
            type: 'ROOM_UPDATE',
            roomCode: targetCode,
            title: room.title,
            hostId: room.hostId,
            minPlayers: room.minPlayers,
            maxPlayers: room.maxPlayers,
            members: room.members
          });

          broker.publish('/topic/lobby', {
            type: 'ROOM_UPDATED',
            roomCode: targetCode,
            current_players: room.members.length
          });
          break;
        }

        case 'RECONNECT': {
          const targetCode = String(roomCode || '').trim();
          if (disconnectTimers.has(playerId)) {
            clearTimeout(disconnectTimers.get(playerId));
            disconnectTimers.delete(playerId);
          }

          if (rooms.has(targetCode)) {
            const room = rooms.get(targetCode);
            clientMeta.set(ws, { playerId, nickname, roomCode: targetCode });
            broker.subscribe(`/topic/room/${targetCode}`, ws);

            const existing = room.members.find(m => m.id === playerId);
            if (!existing) {
              room.members.push({
                id: playerId,
                name: nickname || '참가자',
                isHost: (room.hostId === playerId),
                isReady: true
              });
            } else {
              existing.name = nickname || existing.name;
            }

            sendWs(ws, 'RECONNECTED', {
              roomCode: targetCode,
              title: room.title,
              minPlayers: room.minPlayers,
              maxPlayers: room.maxPlayers,
              hostId: room.hostId,
              status: room.status,
              currentTurn: room.currentTurn,
              members: room.members
            });
          }
          break;
        }

        case 'LEAVE_ROOM': {
          if (disconnectTimers.has(playerId)) {
            clearTimeout(disconnectTimers.get(playerId));
            disconnectTimers.delete(playerId);
          }
          handlePlayerLeave(playerId, nickname, roomCode);
          clientMeta.delete(ws);
          break;
        }

        case 'TOGGLE_READY': {
          const room = rooms.get(roomCode);
          if (!room) return;
          const member = room.members.find(m => m.id === playerId);
          if (member) {
            member.isReady = Boolean(isReady);
            broker.publish(`/topic/room/${roomCode}`, {
              type: 'ROOM_UPDATE',
              roomCode: roomCode,
              title: room.title,
              hostId: room.hostId,
              minPlayers: room.minPlayers,
              maxPlayers: room.maxPlayers,
              members: room.members
            });
          }
          break;
        }

        case 'START_GAME': {
          const room = rooms.get(roomCode);
          if (!room) return;
          updateRoomInDb(roomCode, { status: 'PLAYING' });
          broker.publish('/topic/lobby', { type: 'ROOM_DELETED', roomCode });
          startOrAdvanceRound(roomCode, room, true);
          break;
        }

        // [핵심] 플레이어가 카드 교환을 마치고 다음 턴 확인을 눌렀을 때
        case 'COMPLETE_TURN': {
          const room = rooms.get(roomCode);
          if (!room) return;

          // 중복 전송이거나 이미 다음 턴으로 넘어간 경우 무시
          if (data.turn && Number(data.turn) < room.currentTurn) {
            return;
          }

          if (!room.turnReady) room.turnReady = new Set();
          room.turnReady.add(playerId);

          // 이번 턴에 1:1 대화에 참여했던 플레이어 수 (짝수 인원, 예: 3명 중 2명)
          const expectedCount = room.currentPairs && room.currentPairs.length > 0
            ? room.currentPairs.length * 2
            : Math.max(2, room.members.length - (room.members.length % 2));

          const readyCount = room.turnReady.size;

          console.log(`⏳ [턴 완료 체크] #${roomCode} (${room.currentTurn}턴): ${readyCount} / ${expectedCount}명 완료 (눌러준 ID: ${playerId})`);

          broker.publish(`/topic/room/${roomCode}`, {
            type: 'TURN_PROGRESS',
            turn: room.currentTurn,
            readyCount,
            totalRequired: expectedCount
          });

          // 대화자들이 모두 눌렀거나 강제 진행 플래그가 오면 즉시 다음 턴 매칭 시작!
          if (readyCount >= expectedCount || data.forceAdvance) {
            startOrAdvanceRound(roomCode, room, false);
          }
          break;
        }

        case 'SUBSCRIBE':
          if (destination) broker.subscribe(destination, ws);
          break;

        case 'UNSUBSCRIBE':
          if (destination) broker.unsubscribe(destination, ws);
          break;

        case 'SEND':
          if (destination) broker.publish(destination, payload);
          break;
      }
    } catch (e) {
      console.error('[Broker] 에러:', e);
    }
  });

  ws.on('close', () => {
    const meta = clientMeta.get(ws);
    if (meta && meta.roomCode && rooms.has(meta.roomCode)) {
      const { playerId, nickname, roomCode } = meta;
      const timer = setTimeout(() => {
        disconnectTimers.delete(playerId);
        handlePlayerLeave(playerId, nickname, roomCode);
      }, 7000);
      disconnectTimers.set(playerId, timer);
    }
    broker.unsubscribeAll(ws);
    clientMeta.delete(ws);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 메이플라이 서버 구동 완료: http://localhost:${PORT}`);
});