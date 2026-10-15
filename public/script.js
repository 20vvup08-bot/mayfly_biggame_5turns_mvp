(function () {
  "use strict";

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // 1. 기본 카드 마스터 덱 20장
  var MASTER_VALUE_FULL = [
    { id: "v01", type: "VALUE", name: "정직", category: "윤리", description: "말과 행동이 일치하는 삶을 가장 소중히 여긴다.", question: "거짓말을 해야만 하는 상황이라면 어떻게 하시겠어요?" },
    { id: "v02", type: "VALUE", name: "도전", category: "성취", description: "새로운 것을 시도하는 데서 삶의 의미를 찾는다.", question: "최근에 도전해본 가장 큰 일은 무엇이었나요?" },
    { id: "v03", type: "VALUE", name: "가족", category: "관계", description: "가까운 사람들과의 유대를 삶의 최우선에 둔다.", question: "가족과 함께한 순간 중 가장 소중한 기억은?" },
    { id: "v04", type: "VALUE", name: "안정", category: "안정", description: "예측 가능하고 변화가 적은 삶을 선호한다.", question: "안정과 변화 중 하나를 골라야 한다면?" },
    { id: "v05", type: "VALUE", name: "자유", category: "자유", description: "누구에게도 얽매이지 않는 선택권을 중시한다.", question: "자유를 가장 크게 느꼈던 순간은 언제였나요?" },
    { id: "v06", type: "VALUE", name: "성장", category: "성장", description: "어제보다 나은 자신이 되는 과정을 즐긴다.", question: "최근 스스로 성장했다고 느낀 순간이 있나요?" },
    { id: "v07", type: "VALUE", name: "신뢰", category: "관계", description: "약속을 지키고 사람을 믿는 관계를 맺는다.", question: "누군가를 완전히 신뢰하게 된 계기가 있다면?" },
    { id: "v08", type: "VALUE", name: "우정", category: "관계", description: "곁을 지켜주는 친구들을 삶의 기둥으로 삼는다.", question: "가장 오래된 친구와의 인연은 어떻게 시작됐나요?" },
    { id: "v09", type: "VALUE", name: "명예", category: "성취", description: "타인에게 인정받고 존중받는 것을 중요하게 여긴다.", question: "인정받고 싶은 순간은 주로 언제인가요?" },
    { id: "v10", type: "VALUE", name: "배움", category: "성장", description: "끊임없이 새로운 지식을 흡수하려 한다.", question: "요즘 가장 배우고 싶은 것은 무엇인가요?" },
    { id: "v11", type: "VALUE", name: "봉사", category: "윤리", description: "타인을 돕는 행위에서 삶의 보람을 느낀다.", question: "누군가를 도왔던 경험 중 기억에 남는 것은?" },
    { id: "v12", type: "VALUE", name: "여유", category: "안정", description: "서두르지 않고 순간을 즐기는 삶을 지향한다.", question: "가장 여유롭다고 느끼는 순간은 언제인가요?" },
    { id: "v13", type: "VALUE", name: "창의", category: "성장", description: "틀에 얽매이지 않는 발상을 가치 있게 여긴다.", question: "틀을 깬 아이디어를 냈던 경험이 있나요?" },
    { id: "v14", type: "VALUE", name: "용기", category: "성취", description: "두려움 앞에서도 행동하는 것을 중요하게 여긴다.", question: "가장 용기를 냈던 선택은 무엇이었나요?" }
  ];

  var MASTER_LIFE_FULL = [
    { id: "l01", type: "LIFE", name: "활력", description: "몸과 마음의 에너지가 넘치는 시간을 상징한다.", effect: "+5년" },
    { id: "l02", type: "LIFE", name: "회복", description: "위기 속에서도 다시 일어서는 힘을 상징한다.", effect: "+5년" },
    { id: "l03", type: "LIFE", name: "지혜", description: "경험에서 얻은 통찰이 삶을 지탱해준다.", effect: "+5년" },
    { id: "l04", type: "LIFE", name: "인연", description: "곁을 지켜주는 사람들이 삶을 길게 늘려준다.", effect: "+5년" },
    { id: "l05", type: "LIFE", name: "절제", description: "무리하지 않는 습관이 오랜 시간을 만든다.", effect: "+5년" },
    { id: "l06", type: "LIFE", name: "평온", description: "마음의 안정이 몸의 수명을 지켜준다.", effect: "+5년" }
  ];

  var VALUE_POOL = (typeof MASTER_VALUE !== "undefined" && Array.isArray(MASTER_VALUE)) ? MASTER_VALUE : MASTER_VALUE_FULL;
  var LIFE_POOL = (typeof MASTER_LIFE !== "undefined" && Array.isArray(MASTER_LIFE)) ? MASTER_LIFE : MASTER_LIFE_FULL;

  // 2. Supabase 클라이언트 초기화
  var SUPABASE_URL = "https://bqwrahmqnmrzrtghawmy.supabase.co";
  var SUPABASE_KEY = "sb_publishable_-lvbut_R4UxnEcCr5BHfbQ_bP8Yq-7Q";
  var supabaseClient = null;

  try {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false }
      });
    }
  } catch (err) {}

  // 3. [핵심 해결] 탭을 복제해서 열더라도 탭마다 100% 고유한 플레이어 ID 보장!
  if (!window.name || !window.name.startsWith("mayfly_tab_")) {
    window.name = "mayfly_tab_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now();
  }
  var SESSION_STORAGE_KEY = "mayfly_session_" + window.name;

  var savedSession = null;
  try {
    var rawSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (rawSession) savedSession = JSON.parse(rawSession);
  } catch (e) {}

  var myId = (savedSession && savedSession.myId) ? savedSession.myId : ("player_" + window.name.replace("mayfly_tab_", ""));

  var state = {
    myId: myId,
    nickname: (savedSession && savedSession.nickname) ? savedSession.nickname : "찬우",
    roomCode: (savedSession && savedSession.roomCode) ? savedSession.roomCode : null,
    roomTitle: (savedSession && savedSession.roomTitle) ? savedSession.roomTitle : "누구나 환영하는 가치관 대화방",
    minPlayers: (savedSession && savedSession.minPlayers) ? savedSession.minPlayers : 2,
    maxPlayers: (savedSession && savedSession.maxPlayers) ? savedSession.maxPlayers : 8,
    isPrivate: false,
    roomPassword: null,
    isHost: (savedSession && typeof savedSession.isHost === "boolean") ? savedSession.isHost : false,
    isReady: (savedSession && typeof savedSession.isReady === "boolean") ? savedSession.isReady : false,
    isSittingOut: (savedSession && typeof savedSession.isSittingOut === "boolean") ? savedSession.isSittingOut : false,
    members: (savedSession && Array.isArray(savedSession.members)) ? savedSession.members : [],
    pairId: (savedSession && savedSession.pairId) ? savedSession.pairId : null,
    partnerId: (savedSession && savedSession.partnerId) ? savedSession.partnerId : null,
    partnerName: (savedSession && savedSession.partnerName) ? savedSession.partnerName : "상대방",
    hand: (savedSession && Array.isArray(savedSession.hand)) ? savedSession.hand : [],
    currentTurn: (savedSession && savedSession.currentTurn) ? savedSession.currentTurn : 1,
    totalTurns: 5,
    currentPhase: (savedSession && typeof savedSession.currentPhase === "number") ? savedSession.currentPhase : 0,
    selectedGiveCardIds: [],
    selectedCardId: null,
    timer: 0,
    timerInterval: null,
    inspectEndTime: (savedSession && savedSession.inspectEndTime) ? savedSession.inspectEndTime : null,
    dialogueEndTime: (savedSession && savedSession.dialogueEndTime) ? savedSession.dialogueEndTime : null,
    mySubmittedCards: null,
    partnerGiveCards: null,
    turnHistory: (savedSession && Array.isArray(savedSession.turnHistory)) ? savedSession.turnHistory : [],
    waitingMode: (savedSession && savedSession.waitingMode) ? savedSession.waitingMode : "ODD_REST"
  };

  function saveSession() {
    if (!state.roomCode) {
      try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch (e) {}
      return;
    }
    try {
      var data = {
        myId: state.myId,
        nickname: state.nickname,
        roomCode: state.roomCode,
        roomTitle: state.roomTitle,
        minPlayers: state.minPlayers,
        maxPlayers: state.maxPlayers,
        isHost: state.isHost,
        isReady: state.isReady,
        isSittingOut: state.isSittingOut,
        currentPhase: state.currentPhase,
        currentTurn: state.currentTurn,
        hand: state.hand,
        pairId: state.pairId,
        partnerId: state.partnerId,
        partnerName: state.partnerName,
        turnHistory: state.turnHistory,
        members: state.members,
        inspectEndTime: state.inspectEndTime,
        dialogueEndTime: state.dialogueEndTime,
        waitingMode: state.waitingMode
      };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem("mayfly_session");
    } catch (e) {}
  }

  var processedMsgIds = new Set();
  var pendingPrivateRoom = null;
  var isCreatingRoomLock = false;
  var activePairTopic = null;

  // [핵심] 기존 대기방(phaseLobbyView)과 완전히 분리된 전용 매칭 대기 페이지(phaseWaitingView) 생성
  function ensureWaitingViewExists() {
    var existing = document.getElementById("phaseWaitingView");
    if (existing) return existing;

    var container = document.querySelector(".stage-container");
    if (!container) return null;

    var view = document.createElement("div");
    view.className = "phase-view";
    view.id = "phaseWaitingView";
    view.innerHTML =
      '<div class="stage-title">' +
        '<span class="turn-badge" id="waitingTurnBadge">1턴</span>' +
        '<span id="waitingHeaderTitle">새로운 상대방 매칭 대기 페이지</span>' +
      '</div>' +
      '<p class="stage-hint" id="waitingHeaderHint">' +
        '다른 참가자들의 대화와 카드 교환이 완료되면 <b>새로운 상대방과 자동으로 1:1 대화방이 시작</b>됩니다.' +
      '</p>' +
      '<div class="match-box" style="max-width: 520px; padding: 36px 24px; text-align: center;">' +
        '<div style="font-size: 52px; margin-bottom: 14px;" id="waitingStatusIcon">⏳</div>' +
        '<div style="font-size: 20px; font-weight: 900; color: var(--ink); margin-bottom: 10px;" id="waitingMainTitle">' +
          '다음 턴 매칭을 기다리고 있습니다' +
        '</div>' +
        '<p style="font-size: 13.5px; color: var(--ink-dim); line-height: 1.7; margin-bottom: 24px;" id="waitingSubDesc">' +
          '현재 진행 중인 다른 참가자들의 카드 교환이 끝나면<br>' +
          '<b style="color:var(--accent-soft);">새로운 상대방과 다음 턴 1:1 대화가 즉시 시작</b>됩니다!' +
        '</p>' +
        '<div style="background: rgba(139, 124, 246, 0.14); border: 1px solid var(--accent); border-radius: 12px; padding: 14px 22px; display: inline-flex; align-items: center; gap: 10px; margin-bottom: 16px;">' +
          '<span style="font-size: 16px;">🔄</span>' +
          '<span style="font-size: 13.5px; font-weight: 800; color: var(--accent-soft);" id="waitingProgressText">' +
            '다른 참가자 대화 및 카드 교환 진행 중...' +
          '</span>' +
        '</div>' +
        '<div style="margin-top: 6px; margin-bottom: 14px;">' +
          '<button type="button" class="btn btn-outline" id="btnForceNextRound" style="font-size: 11.5px; padding: 6px 14px;">' +
            '⚡ 상대방 응답 지연 시 바로 다음 턴 매칭 시작하기' +
          '</button>' +
        '</div>' +
        '<div style="font-size: 12px; color: var(--ink-faint);">' +
          '잠시 기다리는 동안 화면 하단에서 내 카드를 클릭해 질문과 설명을 확인해보세요.' +
        '</div>' +
      '</div>';

    container.appendChild(view);

    var forceBtn = document.getElementById("btnForceNextRound");
    if (forceBtn) {
      forceBtn.addEventListener("click", function () {
        brokerClient.sendRaw({
          action: "COMPLETE_TURN",
          roomCode: state.roomCode,
          playerId: state.myId,
          turn: state.currentTurn,
          forceAdvance: true
        });
      });
    }

    return view;
  }

  function showMatchingWaitPage(mode, targetTurn, readyCount, totalRequired) {
    ensureWaitingViewExists();
    state.waitingMode = mode || "ODD_REST";

    var $waitTurnBadge = document.getElementById("waitingTurnBadge");
    var $waitHeaderTitle = document.getElementById("waitingHeaderTitle");
    var $waitIcon = document.getElementById("waitingStatusIcon");
    var $waitTitle = document.getElementById("waitingMainTitle");
    var $waitDesc = document.getElementById("waitingSubDesc");
    var $waitProgress = document.getElementById("waitingProgressText");

    var turnNum = targetTurn || state.currentTurn || 1;
    if ($waitTurnBadge) $waitTurnBadge.textContent = turnNum + "턴";

    if (state.waitingMode === "ODD_REST") {
      if ($waitHeaderTitle) $waitHeaderTitle.textContent = "매칭을 기다리는 중... (이번 턴 대기 순서)";
      if ($waitIcon) $waitIcon.textContent = "☕";
      if ($waitTitle) $waitTitle.textContent = turnNum + "턴 매칭 대기 페이지";
      if ($waitDesc) {
        $waitDesc.innerHTML =
          "현재 방 인원이 홀수(" + (state.members.length || 3) + "명)여서 이번 턴은 전용 대기 페이지에서 잠시 대기합니다.<br>" +
          "다른 두 참가자의 대화와 카드 교환이 완료되는 즉시,<br>" +
          "<b style='color:var(--accent-soft);'>" + (turnNum + 1) + "턴에 새로운 상대방과 가장 먼저 1:1로 매칭</b>됩니다!";
      }
    } else {
      if ($waitHeaderTitle) $waitHeaderTitle.textContent = "다음 턴 새로운 상대방 매칭 대기 중...";
      if ($waitIcon) $waitIcon.textContent = "🤝";
      if ($waitTitle) $waitTitle.textContent = turnNum + "턴 새로운 상대방 매칭 대기 중";
      if ($waitDesc) {
        $waitDesc.innerHTML =
          "이번 턴 카드 교환이 완료되었습니다!<br>" +
          "다른 참가자들의 교환이 마무리되는 즉시 <b style='color:var(--accent-soft);'>새로운 상대방과 " + turnNum + "턴 대화방이 열립니다.</b>";
      }
    }

    if ($waitProgress) {
      if (readyCount !== undefined && totalRequired !== undefined) {
        $waitProgress.textContent = "현재 카드 교환 완료 인원: " + readyCount + " / " + totalRequired + "명";
      } else {
        $waitProgress.textContent = "다른 참가자들의 대화 및 교환 완료를 기다리는 중...";
      }
    }

    switchView(999, false);
  }

  // 4. WebSocket 메시지 브로커 클라이언트
  class WebSocketMessageBrokerClient {
    constructor() {
      this.socket = null;
      this.connected = false;
      this.subscriptions = new Map();
      this.pendingQueue = [];
      this.initConnection();
    }

    initConnection() {
      var hostname = window.location.hostname || "localhost";
      var port = window.location.port;

      var targetHost = (hostname === "localhost" || hostname === "127.0.0.1") && port && port !== "8080"
        ? (hostname + ":8080")
        : (window.location.host || "localhost:8080");

      var protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      var wsUrl = protocol + "//" + targetHost + "/ws-stomp";

      try {
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ action: "CONNECT" }));
          }
        };

        this.socket.onmessage = (event) => {
          try {
            var data = JSON.parse(event.data);
            this.handleServerMessage(data);
          } catch (e) {}
        };

        this.socket.onerror = () => this.updateStatus(false);
        this.socket.onclose = () => {
          this.connected = false;
          this.updateStatus(false);
          setTimeout(() => this.initConnection(), 3000);
        };
      } catch (e) {
        this.updateStatus(false);
      }
    }

    updateStatus(isOnline, customText) {
      var badge = document.getElementById("netStatusBadge");
      if (!badge) return;
      var dbOk = Boolean(supabaseClient);

      badge.textContent = "";
      badge.style.display = "inline-block";
      badge.style.width = "9px";
      badge.style.height = "9px";
      badge.style.borderRadius = "50%";
      badge.style.padding = "0";
      badge.style.border = "none";

      if (customText) {
        badge.style.background = "#f59e0b";
        badge.style.boxShadow = "0 0 8px rgba(245, 158, 11, 0.8)";
        badge.title = customText;
      } else if (isOnline && dbOk) {
        badge.style.background = "#10b981";
        badge.style.boxShadow = "0 0 10px rgba(16, 185, 129, 0.9)";
        badge.title = "실시간 서버 및 DB 정상 연결됨";
      } else if (isOnline && !dbOk) {
        badge.style.background = "#f97316";
        badge.style.boxShadow = "0 0 8px rgba(249, 115, 22, 0.8)";
        badge.title = "웹소켓 정상 / DB 미연결";
      } else {
        badge.style.background = "#ef4444";
        badge.style.boxShadow = "0 0 10px rgba(239, 68, 68, 0.9)";
        badge.title = "서버 연결 끊김 (재연결 시도 중...)";
      }
    }

    sendRaw(obj) {
      if (this.connected && this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(obj));
        return true;
      }
      this.pendingQueue.push(obj);
      return false;
    }

    handleServerMessage(data) {
      var action = data.action;
      var topic = data.topic;
      var payload = data.payload;

      if (action === "CONNECTED") {
        this.connected = true;
        this.updateStatus(true);
        for (var dest of this.subscriptions.keys()) {
          this.socket.send(JSON.stringify({ action: "SUBSCRIBE", destination: dest }));
        }
        this.socket.send(JSON.stringify({ action: "SUBSCRIBE", destination: "/topic/lobby" }));

        while (this.pendingQueue.length > 0) {
          var queued = this.pendingQueue.shift();
          this.socket.send(JSON.stringify(queued));
        }

        if (state.roomCode) {
          this.socket.send(JSON.stringify({
            action: "RECONNECT",
            roomCode: state.roomCode,
            playerId: state.myId,
            nickname: state.nickname
          }));
        }
      } else if (action === "ERROR") {
        alert(data.message || "오류가 발생했습니다.");
      } else if (action === "ROOM_CREATED") {
        onRoomCreatedSuccess(data.roomCode, data.members, data.title, data.minPlayers, data.maxPlayers);
      } else if (action === "ROOM_JOINED") {
        onRoomJoinedSuccess(data.roomCode, data.members, data.title, data.minPlayers, data.maxPlayers);
      } else if (action === "RECONNECTED") {
        if (data.members) state.members = data.members;
        if (data.title) state.roomTitle = data.title;
        if (data.minPlayers) state.minPlayers = data.minPlayers;
        if (data.maxPlayers) state.maxPlayers = data.maxPlayers;
        if (data.currentTurn) state.currentTurn = data.currentTurn;
        renderMemberList();
        saveSession();
      } else if (topic && payload) {
        var callbacks = this.subscriptions.get(topic);
        if (callbacks) {
          for (var cb of callbacks) cb(payload);
        }
      }
    }

    subscribe(destination, callback) {
      this.subscriptions.set(destination, new Set([callback]));
      this.sendRaw({ action: "SUBSCRIBE", destination: destination });
    }

    unsubscribe(destination) {
      if (this.subscriptions.has(destination)) {
        this.subscriptions.delete(destination);
      }
      this.sendRaw({ action: "UNSUBSCRIBE", destination: destination });
    }

    publish(destination, payload) {
      this.sendRaw({ action: "SEND", destination: destination, payload: payload });
    }
  }

  var brokerClient = new WebSocketMessageBrokerClient();

  brokerClient.subscribe("/topic/lobby", function (data) {
    if (!data) return;
    if (data.type === "ROOM_DELETED") {
      var card = document.querySelector('.room-card[data-code="' + data.roomCode + '"]');
      if (card) card.remove();

      var grid = document.getElementById("roomListGrid");
      if (grid && grid.querySelectorAll(".room-card").length === 0) {
        grid.innerHTML = '<div style="text-align: center; color: var(--ink-faint); padding: 30px 0; font-size: 12.5px;">열려있는 대화방이 없습니다. [👑 방 만들기] 탭에서 새 방을 개설해보세요!</div>';
      }
    } else if (data.type === "ROOM_CREATED" || data.type === "ROOM_UPDATED") {
      if (state.currentPhase === 0 && !state.roomCode) {
        window.loadRoomsFromDb();
      }
    }
  });

  // 5. 로비 탭 전환
  window.switchLobbyTab = function (mode) {
    var pList = document.getElementById("panelRoomList");
    var pCreate = document.getElementById("panelCreateRoom");
    var pJoin = document.getElementById("panelJoinRoom");

    var tList = document.getElementById("tabRoomList");
    var tCreate = document.getElementById("tabCreateRoom");
    var tJoin = document.getElementById("tabDirectJoin");

    if (mode === "list") {
      if (pList) pList.style.display = "block";
      if (pCreate) pCreate.style.display = "none";
      if (pJoin) pJoin.style.display = "none";
      if (tList) tList.className = "btn btn-primary";
      if (tCreate) tCreate.className = "btn btn-outline";
      if (tJoin) tJoin.className = "btn btn-outline";
      window.loadRoomsFromDb();
    } else if (mode === "create") {
      if (pList) pList.style.display = "none";
      if (pCreate) pCreate.style.display = "block";
      if (pJoin) pJoin.style.display = "none";
      if (tList) tList.className = "btn btn-outline";
      if (tCreate) tCreate.className = "btn btn-primary";
      if (tJoin) tJoin.className = "btn btn-outline";
    } else if (mode === "join") {
      if (pList) pList.style.display = "none";
      if (pCreate) pCreate.style.display = "none";
      if (pJoin) pJoin.style.display = "block";
      if (tList) tList.className = "btn btn-outline";
      if (tCreate) tCreate.className = "btn btn-outline";
      if (tJoin) tJoin.className = "btn btn-primary";
    }
  };

  // 6. 방 목록 조회
  window.loadRoomsFromDb = async function () {
    var $grid = document.getElementById("roomListGrid");
    if (!$grid) return;

    var rooms = [];

    if (supabaseClient) {
      try {
        var res = await supabaseClient
          .from("rooms")
          .select("room_code, title, host_name, min_players, max_players, current_players, is_private, status")
          .eq("status", "WAITING")
          .gt("current_players", 0)
          .order("created_at", { ascending: false });

        if (!res.error && Array.isArray(res.data)) {
          rooms = res.data.map(function (r) {
            return {
              room_code: String(r.room_code),
              title: r.title || "가치관 대화방",
              host_name: r.host_name || "방장",
              min_players: r.min_players || 2,
              max_players: r.max_players || 8,
              current_players: r.current_players || 1,
              is_private: Boolean(r.is_private),
              status: r.status || "WAITING"
            };
          });
        }
      } catch (e) {}
    }

    if (rooms.length === 0) {
      $grid.innerHTML = '<div style="text-align: center; color: var(--ink-faint); padding: 30px 0; font-size: 12.5px;">열려있는 대화방이 없습니다. [👑 방 만들기] 탭에서 새 방을 개설해보세요!</div>';
      return;
    }

    $grid.innerHTML = rooms.map(function (r) {
      var safeTitle = escapeHtml(r.title);
      var safeHost = escapeHtml(r.host_name);
      var safeCode = escapeHtml(r.room_code);
      var minP = parseInt(r.min_players, 10) || 2;
      var maxP = parseInt(r.max_players, 10) || 8;
      var curP = parseInt(r.current_players, 10) || 1;
      var isPriv = Boolean(r.is_private);

      return '<div class="room-card" data-code="' + safeCode + '" onclick="window.handleClickRoomItem(\'' + safeCode + '\', ' + isPriv + ', ' + curP + ', ' + maxP + ', \'' + safeTitle + '\', ' + minP + ')">' +
        '<div style="display: flex; align-items: center; gap: 10px;">' +
          '<span style="font-size: 18px;">' + (isPriv ? '🔒' : '🌐') + '</span>' +
          '<div>' +
            '<div style="font-size: 13.5px; font-weight: 800; color: var(--ink);">' + safeTitle + '</div>' +
            '<div style="font-size: 11px; color: var(--ink-dim); margin-top: 2px;">방장: ' + safeHost + ' · 최소 ' + minP + '명 시작</div>' +
          '</div>' +
        '</div>' +
        '<div style="text-align: right;">' +
          '<span style="font-size: 12.5px; font-weight: 800; color: ' + (curP >= maxP ? 'var(--danger)' : 'var(--accent-soft)') + ';">' + curP + ' / ' + maxP + '명</span>' +
          '<div style="font-size: 10px; color: var(--ink-faint); margin-top: 2px;">#' + safeCode + '</div>' +
        '</div>' +
      '</div>';
    }).join("");
  };

  // 7. 방 만들기 실행 함수
  window.handleCreateRoomSubmit = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (isCreatingRoomLock) return;
    isCreatingRoomLock = true;
    setTimeout(function () { isCreatingRoomLock = false; }, 600);

    var nickEl = document.getElementById("nicknameInput");
    state.nickname = (nickEl && nickEl.value && nickEl.value.trim()) ? nickEl.value.trim() : "방장";
    var disp = document.getElementById("myNickDisplay");
    if (disp) disp.textContent = state.nickname;

    var titleEl = document.getElementById("createRoomTitle");
    var title = (titleEl && titleEl.value && titleEl.value.trim()) ? titleEl.value.trim() : (state.nickname + "님의 가치관 대화방");

    var minEl = document.getElementById("createMinPlayers");
    var maxEl = document.getElementById("createMaxPlayers");
    var minP = minEl ? parseInt(minEl.value, 10) : 2;
    var maxP = maxEl ? parseInt(maxEl.value, 10) : 8;
    if (isNaN(minP) || minP < 2) minP = 2;
    if (minP > 15) minP = 15;
    if (isNaN(maxP) || maxP < 2) maxP = 8;
    if (maxP > 15) maxP = 15;

    if (minP > maxP) {
      alert("시작 최소 인원(" + minP + "명)이 최대 정원(" + maxP + "명)보다 클 수 없습니다!");
      isCreatingRoomLock = false;
      return;
    }

    var privEl = document.getElementById("chkIsPrivate");
    var isPriv = privEl ? Boolean(privEl.checked) : false;

    var passEl = document.getElementById("createRoomPassword");
    var pass = (isPriv && passEl && passEl.value) ? passEl.value.trim() : null;

    if (isPriv && (!pass || !/^\d{4}$/.test(pass))) {
      alert("비밀방 비밀번호는 숫자 4자리(예: 1234)로 정확히 입력해주세요!");
      if (passEl) passEl.focus();
      isCreatingRoomLock = false;
      return;
    }

    var roomCode = String(Math.floor(1000 + Math.random() * 9000));
    state.roomTitle = title;
    state.minPlayers = minP;
    state.maxPlayers = maxP;
    state.isPrivate = isPriv;
    state.roomPassword = pass;

    var initialMembers = [
      { id: state.myId, name: state.nickname, isHost: true, isReady: true }
    ];

    onRoomCreatedSuccess(roomCode, initialMembers, title, minP, maxP);

    if (supabaseClient) {
      supabaseClient
        .from("rooms")
        .insert([{
          room_code: roomCode,
          title: title,
          host_name: state.nickname,
          min_players: minP,
          max_players: maxP,
          current_players: 1,
          is_private: isPriv,
          password: pass,
          status: "WAITING"
        }])
        .then(function () {})
        .catch(function () {});
    }

    brokerClient.sendRaw({
      action: "CREATE_ROOM",
      nickname: state.nickname,
      playerId: state.myId,
      roomCode: roomCode,
      title: title,
      minPlayers: minP,
      maxPlayers: maxP,
      isPrivate: isPriv,
      password: pass
    });
  };

  window.handleClickRoomItem = function (code, isPrivate, current, max, title, min) {
    if (current >= max) {
      alert("해당 방은 정원(" + max + "명)이 가득 찼습니다!");
      return;
    }

    state.roomTitle = title || "가치관 대화방";
    state.minPlayers = min || 2;
    state.maxPlayers = max || 8;

    if (isPrivate) {
      pendingPrivateRoom = { code: String(code) };
      var modal = document.getElementById("passwordModal");
      var titleEl = document.getElementById("pwdModalTitle");
      var input = document.getElementById("pwdModalInput");
      if (titleEl) titleEl.textContent = "🔒 '" + escapeHtml(state.roomTitle) + "' 입장";
      if (modal) modal.classList.add("show");
      if (input) {
        input.value = "";
        input.focus();
      }
    } else {
      executeJoinRoom(String(code), null);
    }
  };

  function executeJoinRoom(code, password) {
    var nickEl = document.getElementById("nicknameInput");
    state.nickname = (nickEl && nickEl.value && nickEl.value.trim()) ? nickEl.value.trim() : "참가자";
    var disp = document.getElementById("myNickDisplay");
    if (disp) disp.textContent = state.nickname;

    brokerClient.sendRaw({
      action: "JOIN_ROOM",
      roomCode: code,
      nickname: state.nickname,
      playerId: state.myId,
      payload: { password: password || null }
    });
  }

  function onRoomCreatedSuccess(roomCode, members, title, minPlayers, maxPlayers) {
    state.roomCode = String(roomCode);
    state.isHost = true;
    state.isReady = true;
    state.isSittingOut = false;
    state.currentPhase = 0;
    state.currentTurn = 1;
    state.hand = [];
    state.turnHistory = [];
    if (title) state.roomTitle = title;
    if (minPlayers) state.minPlayers = minPlayers;
    if (maxPlayers) state.maxPlayers = maxPlayers;
    state.members = members || [{ id: state.myId, name: state.nickname, isHost: true, isReady: true }];

    saveSession();
    brokerClient.subscribe("/topic/room/" + state.roomCode, handleRoomTopicMessage);
    openWaitingRoomUi(state.roomCode);
    renderMemberList();
    showToast("방(#" + state.roomCode + ")이 개설되었습니다!");
  }

  function onRoomJoinedSuccess(roomCode, members, title, minPlayers, maxPlayers) {
    state.roomCode = String(roomCode);
    state.isHost = false;
    state.isReady = false;
    state.isSittingOut = false;
    state.currentPhase = 0;
    state.currentTurn = 1;
    state.hand = [];
    state.turnHistory = [];
    if (title) state.roomTitle = title;
    if (minPlayers) state.minPlayers = minPlayers;
    if (maxPlayers) state.maxPlayers = maxPlayers;
    state.members = members || [];

    saveSession();
    brokerClient.subscribe("/topic/room/" + state.roomCode, handleRoomTopicMessage);
    openWaitingRoomUi(state.roomCode);
    renderMemberList();
    showToast("방(#" + state.roomCode + ")에 입장했습니다!");
  }

  // [핵심] 매 턴 매칭 결과 처리 (1:1 대화자 vs 전용 매칭 대기 페이지)
  function handleMatchResult(pairs, waitingPlayer, turn) {
    if (turn) state.currentTurn = turn;
    updateDashboard();

    if (activePairTopic) {
      brokerClient.unsubscribe(activePairTopic);
      activePairTopic = null;
    }

    var $receiveModal = document.getElementById("receiveModal");
    if ($receiveModal) $receiveModal.classList.remove("show");

    var myPair = pairs ? pairs.find(function (p) { return p.p1.id === state.myId || p.p2.id === state.myId; }) : null;

    if (myPair) {
      // 1:1 매칭된 참가자
      state.isSittingOut = false;
      var isP1 = (myPair.p1.id === state.myId);
      var partner = isP1 ? myPair.p2 : myPair.p1;

      state.pairId = myPair.pairId;
      state.partnerId = partner.id;
      state.partnerName = partner.name;

      activePairTopic = "/topic/pair/" + state.roomCode + "_" + myPair.pairId;
      brokerClient.subscribe(activePairTopic, handlePairGameEvent);

      state.selectedGiveCardIds = [];
      state.mySubmittedCards = null;
      state.partnerGiveCards = null;
      state.inspectEndTime = null;
      state.dialogueEndTime = null;

      if (state.hand.length === 0) {
        initHand();
      }

      var peerNameEl = document.getElementById("dialoguePeerName");
      if (peerNameEl) peerNameEl.textContent = state.partnerName;

      var $chatBox = document.getElementById("chatBox");
      if ($chatBox) {
        $chatBox.innerHTML = '<div class="chat-msg system">' + state.currentTurn + '턴: <b>' + escapeHtml(state.partnerName) + '</b> 님과의 1:1 대화방이 연결되었습니다!</div>';
      }

      showToast("🎉 " + state.currentTurn + "턴 매칭 완료! 상대방: '" + escapeHtml(state.partnerName) + "'");
      saveSession();
      switchView(1, false);
    } else {
      // 홀수 인원 대기자 -> 전용 매칭 대기 페이지(999)로 이동!
      state.isSittingOut = true;
      state.pairId = null;
      state.partnerId = null;
      state.partnerName = "매칭 대기 중";

      if (state.hand.length === 0) {
        initHand();
      }

      showMatchingWaitPage("ODD_REST", state.currentTurn);
      showToast("☕ 이번 턴은 매칭 대기 페이지에서 대기하며, 다음 턴에 새 상대와 연결됩니다!");
      saveSession();
    }
  }

  // 방 전체 토픽 이벤트 수신
  function handleRoomTopicMessage(data) {
    if (!data) return;
    var type = data.type;
    var members = data.members;
    var pairs = data.pairs;
    var waitingPlayer = data.waitingPlayer;

    if (type === "MEMBER_LEFT") {
      var leaverId = data.playerId;
      var leaverName = escapeHtml(data.playerName || "상대방");

      var isMyPartner = (state.partnerId && state.partnerId === leaverId);
      if (state.currentPhase >= 1 && (isMyPartner || state.members.length <= 2)) {
        clearInterval(state.timerInterval);
        state.inspectEndTime = null;
        state.dialogueEndTime = null;

        alert("⚠️ 상대방(" + leaverName + ") 님이 방을 나갔습니다.\n대기실로 이동합니다.");

        state.pairId = null;
        state.partnerId = null;
        state.partnerName = "상대방";
        state.selectedGiveCardIds = [];
        state.mySubmittedCards = null;
        state.partnerGiveCards = null;
        state.isSittingOut = false;

        switchView(0, false);
        openWaitingRoomUi(state.roomCode);
        saveSession();
      }

      state.members = state.members.filter(function (m) { return m.id !== leaverId; });
      renderMemberList();
      saveSession();
      return;
    }

    if (type === "ROOM_UPDATE") {
      state.members = members || [];
      if (data.title) state.roomTitle = data.title;
      if (data.minPlayers) state.minPlayers = data.minPlayers;
      if (data.maxPlayers) state.maxPlayers = data.maxPlayers;

      var me = state.members.find(function (m) { return m.id === state.myId; });
      if (me) {
        var prevHost = state.isHost;
        state.isHost = Boolean(me.isHost);
        state.isReady = Boolean(me.isReady);

        if (state.currentPhase === 0) {
          var hostArea = document.getElementById("hostActionArea");
          var guestArea = document.getElementById("guestActionArea");
          if (hostArea) hostArea.style.display = state.isHost ? "block" : "none";
          if (guestArea) guestArea.style.display = !state.isHost ? "block" : "none";
        }

        if (!prevHost && state.isHost) {
          showToast("👑 이전 방장이 퇴장하여 새로운 방장이 되었습니다!");
        }
      }
      renderMemberList();
      saveSession();
    } else if (type === "ROUND_START_WITH_PAIRS" || type === "MATCH_START_WITH_PAIRS") {
      // [핵심] 새 턴 매칭 시작
      handleMatchResult(pairs, waitingPlayer, data.turn);
    } else if (type === "TURN_PROGRESS") {
      if (state.currentPhase === 999) {
        var $waitProgress = document.getElementById("waitingProgressText");
        if ($waitProgress) {
          $waitProgress.textContent = "현재 카드 교환 완료 인원: " + data.readyCount + " / " + data.totalRequired + "명";
        }
      }
    } else if (type === "ALL_TURNS_FINISHED") {
      switchView(4, false);
    }
  }

  function handlePairGameEvent(data) {
    if (!data || data.senderId === state.myId) return;

    if (data.msgId) {
      if (processedMsgIds.has(data.msgId)) return;
      processedMsgIds.add(data.msgId);
    }

    var type = data.type;
    var senderName = escapeHtml(data.senderName);
    var payload = data.payload;

    if (type === "SKIP_INSPECT") {
      clearInterval(state.timerInterval);
      state.inspectEndTime = null;
      switchView(2, false);
      showToast("⚡ " + senderName + " 님이 스킵하여 대화가 시작되었습니다!");
    } else if (type === "SKIP_DIALOGUE") {
      clearInterval(state.timerInterval);
      state.dialogueEndTime = null;
      switchView(3, false);
      showToast("🎁 " + senderName + " 님이 카드 교환 단계로 넘어갔습니다.");
    } else if (type === "CHAT_MSG") {
      appendChatMsg(payload.text, senderName, false);
    } else if (type === "SUBMIT_GIVE_CARDS") {
      state.partnerGiveCards = payload.cards;
      var $peerStatusText = document.getElementById("peerStatusText");
      if ($peerStatusText) {
        $peerStatusText.textContent = "🎁 " + senderName + " 님이 선물을 확정했습니다! (내 선택 대기 중)";
      }
      checkAndFinalizeTrade();
    }
  }

  function publishToPair(type, payload) {
    if (!state.pairId || !state.roomCode) return;
    var msgId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
    brokerClient.publish("/topic/pair/" + state.roomCode + "_" + state.pairId, {
      msgId: msgId,
      type: type,
      senderId: state.myId,
      senderName: state.nickname,
      pairId: state.pairId,
      payload: payload || {}
    });
  }

  // 8. 대기실 명단 렌더링
  function renderMemberList() {
    var $container = document.getElementById("memberListContainer");
    var $memberCountText = document.getElementById("memberCountText");
    var $readySummaryText = document.getElementById("readySummaryText");
    var $hostStartBtn = document.getElementById("btnStartGameMatching");
    var $hostNotice = document.getElementById("hostStatusNotice");

    if (!$container) return;
    var list = state.members;
    if ($memberCountText) $memberCountText.textContent = list.length;

    $container.innerHTML = list.map(function (m) {
      var isMe = m.id === state.myId;
      var badgeHtml = "";
      if (m.isHost) {
        badgeHtml = '<span style="background: rgba(139,124,246,0.2); color: var(--accent-soft); border: 1px solid var(--accent); padding: 2px 7px; border-radius: 999px; font-size: 11px; font-weight: 700;">👑 방장</span>';
      } else if (m.isReady) {
        badgeHtml = '<span style="background: rgba(16,185,129,0.2); color: var(--success); border: 1px solid var(--success); padding: 2px 7px; border-radius: 999px; font-size: 11px; font-weight: 700;">✅ 준비 완료</span>';
      } else {
        badgeHtml = '<span style="background: rgba(245,158,11,0.15); color: var(--warning); border: 1px solid var(--warning); padding: 2px 7px; border-radius: 999px; font-size: 11px; font-weight: 700;">⏳ 준비 대기</span>';
      }

      return '<div style="display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; background: rgba(255,255,255,0.04); border-radius: 10px; border: 1px solid var(--line);">' +
        '<div style="display: flex; align-items: center; gap: 8px;"><span>👤</span><span style="font-weight: 700; font-size: 13px; color: ' + (isMe ? 'var(--accent-soft)' : 'var(--ink)') + ';">' + escapeHtml(m.name) + (isMe ? ' (나)' : '') + '</span></div>' +
        '<div>' + badgeHtml + '</div>' +
        '</div>';
    }).join("");

    var guests = list.filter(function (m) { return !m.isHost; });
    var allGuestsReady = guests.length > 0 && guests.every(function (g) { return g.isReady; });
    var minReq = state.minPlayers || 2;
    var minReached = list.length >= minReq;

    if ($readySummaryText) {
      if (guests.length === 0) {
        $readySummaryText.textContent = "참가자 기다리는 중...";
        $readySummaryText.style.color = "var(--ink-dim)";
      } else if (allGuestsReady && minReached) {
        $readySummaryText.textContent = "전원 준비 완료! 🚀";
        $readySummaryText.style.color = "var(--success)";
      } else {
        var readyCount = guests.filter(function (g) { return g.isReady; }).length;
        $readySummaryText.textContent = "준비 현황 (" + readyCount + "/" + guests.length + ")";
        $readySummaryText.style.color = "var(--warning)";
      }
    }

    if (state.isHost && $hostStartBtn) {
      if (minReached && allGuestsReady) {
        $hostStartBtn.disabled = false;
        $hostStartBtn.className = "btn btn-success";
        $hostStartBtn.textContent = "🚀 게임 시작! (" + list.length + "명 매칭 시작)";
        if ($hostNotice) $hostNotice.textContent = "최소 시작 인원을 충족했고 모든 참가자가 준비를 완료했습니다!";
      } else {
        $hostStartBtn.disabled = true;
        $hostStartBtn.className = "btn btn-primary";
        if (!minReached) {
          $hostStartBtn.textContent = "🔒 최소 시작 인원 부족 (" + list.length + "/" + minReq + "명)";
          if ($hostNotice) $hostNotice.textContent = "방 설정에서 정한 최소 " + minReq + "명 이상 모여야 시작할 수 있습니다.";
        } else {
          $hostStartBtn.textContent = "🔒 참가자 준비 대기 중...";
          if ($hostNotice) $hostNotice.textContent = "방장을 제외한 모든 참가자가 [준비 완료]를 눌러야 합니다.";
        }
      }
    }
  }

  function openWaitingRoomUi(code) {
    var entry = document.getElementById("lobbyEntrySection");
    var wait = document.getElementById("lobbyWaitingRoomSection");
    var waitNotice = document.getElementById("waitingPlayerNotice");
    if (waitNotice) waitNotice.style.display = "none";

    if (entry) entry.style.display = "none";
    if (wait) wait.style.display = "block";

    var titleEl = document.getElementById("waitingRoomTitleDisplay");
    var codeDisp = document.getElementById("roomCodeDisplay");
    var codeBanner = document.getElementById("roomCodeBanner");
    var minMaxTag = document.getElementById("waitingRoomMinMaxTag");

    if (titleEl) titleEl.textContent = "🎮 " + escapeHtml(state.roomTitle || "대기실 로비");
    if (codeDisp) codeDisp.textContent = "#" + code;
    if (codeBanner) codeBanner.textContent = code;
    if (minMaxTag) minMaxTag.textContent = "최소 " + (state.minPlayers || 2) + "명 시작 / 정원 " + (state.maxPlayers || 8) + "명";

    var hostArea = document.getElementById("hostActionArea");
    var guestArea = document.getElementById("guestActionArea");
    if (hostArea) hostArea.style.display = state.isHost ? "block" : "none";
    if (guestArea) guestArea.style.display = !state.isHost ? "block" : "none";
  }

  function pickRandom(arr, n) {
    var copy = arr.slice();
    var res = [];
    for (var i = 0; i < n && copy.length; i++) {
      var idx = Math.floor(Math.random() * copy.length);
      res.push(copy.splice(idx, 1)[0]);
    }
    return res;
  }

  function initHand() {
    var v = pickRandom(VALUE_POOL, 7);
    var l = pickRandom(LIFE_POOL, 3);
    state.hand = v.concat(l).sort(function () { return Math.random() - 0.5; });
    updateDashboard();
    renderHand();
    saveSession();
  }

  function updateDashboard() {
    var lifeCount = state.hand.filter(function (c) { return c.type === "LIFE"; }).length;
    var valueCount = state.hand.filter(function (c) { return c.type === "VALUE"; }).length;
    var expectancy = 70 + 5 * lifeCount;
    var $lifeNum = document.getElementById("lifeNum");
    if ($lifeNum) $lifeNum.textContent = expectancy;

    var $composition = document.getElementById("composition");
    if ($composition) {
      $composition.innerHTML = '<span class="dot value"></span>가치 ' + valueCount + ' · <span class="dot life"></span>생명 ' + lifeCount;
    }

    var $turnDisplay = document.getElementById("turnDisplay");
    if ($turnDisplay) $turnDisplay.textContent = state.currentTurn;
  }

  function switchView(phase, isResume) {
    ensureWaitingViewExists();
    state.currentPhase = phase;
    saveSession();

    var views = [
      document.getElementById("phaseLobbyView"),
      document.getElementById("phase1View"),
      document.getElementById("phase2View"),
      document.getElementById("phase3View"),
      document.getElementById("phase4View"),
      document.getElementById("phaseWaitingView")
    ];
    views.forEach(function (v) { if (v) v.classList.remove("active"); });

    for (var i = 1; i <= 4; i++) {
      var step = document.getElementById("stepIndicator" + i);
      if (step) step.classList.toggle("active", i === phase);
    }

    var $turnBadgeWrap = document.getElementById("turnBadgeWrap");
    var $stepIndicatorWrap = document.getElementById("stepIndicatorWrap");

    if (phase === 0) {
      if (views[0]) views[0].classList.add("active");
      if ($turnBadgeWrap) $turnBadgeWrap.style.display = "none";
      if ($stepIndicatorWrap) $stepIndicatorWrap.style.display = "none";
      window.loadRoomsFromDb();
    } else if (phase === 999) {
      clearInterval(state.timerInterval);
      if (views[5]) views[5].classList.add("active");
      if ($turnBadgeWrap) $turnBadgeWrap.style.display = "inline-flex";
      if ($stepIndicatorWrap) $stepIndicatorWrap.style.display = "flex";
    } else if (phase === 1) {
      if (views[1]) views[1].classList.add("active");
      if ($turnBadgeWrap) $turnBadgeWrap.style.display = "inline-flex";
      if ($stepIndicatorWrap) $stepIndicatorWrap.style.display = "flex";
      var b = document.getElementById("inspectTurnBadge");
      if (b) b.textContent = state.currentTurn + "턴";
      startInspectTimer(Boolean(isResume));
    } else if (phase === 2) {
      if (views[2]) views[2].classList.add("active");
      if ($turnBadgeWrap) $turnBadgeWrap.style.display = "inline-flex";
      if ($stepIndicatorWrap) $stepIndicatorWrap.style.display = "flex";
      var b2 = document.getElementById("dialogueTurnBadge");
      if (b2) b2.textContent = state.currentTurn + "턴";
      startDialogueTimer(Boolean(isResume));

      var valCards = state.hand.filter(function (c) { return c.type === "VALUE"; });
      if (valCards.length) {
        var topic = valCards[(state.currentTurn - 1) % valCards.length];
        var qEl = document.getElementById("topicQuestionText");
        if (qEl) qEl.textContent = '"' + escapeHtml(topic.question) + '" (가치관: ' + escapeHtml(topic.name) + ')';
      }

      setTimeout(function () {
        var $chatInput = document.getElementById("chatInput");
        if ($chatInput) $chatInput.focus();
      }, 100);
    } else if (phase === 3) {
      if (views[3]) views[3].classList.add("active");
      if ($turnBadgeWrap) $turnBadgeWrap.style.display = "inline-flex";
      if ($stepIndicatorWrap) $stepIndicatorWrap.style.display = "flex";
      var b3 = document.getElementById("exchangeTurnBadge");
      if (b3) b3.textContent = state.currentTurn + "턴";
      state.selectedGiveCardIds = [];
      state.mySubmittedCards = null;
      state.partnerGiveCards = null;
      var $peerStatusText = document.getElementById("peerStatusText");
      if ($peerStatusText) $peerStatusText.textContent = "상대방과 실시간 맞교환 대기 중...";
      renderGiveCardsGrid();
    } else if (phase === 4) {
      clearInterval(state.timerInterval);
      if (views[4]) views[4].classList.add("active");
      if ($turnBadgeWrap) $turnBadgeWrap.style.display = "inline-flex";
      if ($stepIndicatorWrap) $stepIndicatorWrap.style.display = "flex";
      renderDebrief();
    }

    renderHand();
  }

  function startInspectTimer(isResume) {
    clearInterval(state.timerInterval);

    if (isResume && state.inspectEndTime) {
      var remaining = Math.max(0, Math.ceil((state.inspectEndTime - Date.now()) / 1000));
      if (remaining <= 0) {
        state.inspectEndTime = null;
        saveSession();
        switchView(2, false);
        return;
      }
      state.timer = remaining;
    } else {
      state.timer = 10;
      state.inspectEndTime = Date.now() + 10000;
      saveSession();
    }

    var $countdownNum = document.getElementById("countdownNum");
    var $matchProgressBar = document.getElementById("matchProgressBar");
    if ($countdownNum) $countdownNum.textContent = state.timer + "초";
    if ($matchProgressBar) $matchProgressBar.style.width = (state.timer / 10 * 100) + "%";

    state.timerInterval = setInterval(function () {
      var remaining = Math.max(0, Math.ceil((state.inspectEndTime - Date.now()) / 1000));
      state.timer = remaining;
      if ($countdownNum) $countdownNum.textContent = state.timer + "초";
      if ($matchProgressBar) $matchProgressBar.style.width = (state.timer / 10 * 100) + "%";

      if (state.timer <= 0) {
        clearInterval(state.timerInterval);
        state.inspectEndTime = null;
        saveSession();
        switchView(2, false);
      }
    }, 500);
  }

  function startDialogueTimer(isResume) {
    clearInterval(state.timerInterval);

    if (isResume && state.dialogueEndTime) {
      var remaining = Math.max(0, Math.ceil((state.dialogueEndTime - Date.now()) / 1000));
      if (remaining <= 0) {
        state.dialogueEndTime = null;
        saveSession();
        switchView(3, false);
        return;
      }
      state.timer = remaining;
    } else {
      state.timer = 60;
      state.dialogueEndTime = Date.now() + 60000;
      saveSession();
    }

    updateDialogueTimerDisplay();

    state.timerInterval = setInterval(function () {
      var remaining = Math.max(0, Math.ceil((state.dialogueEndTime - Date.now()) / 1000));
      state.timer = remaining;
      updateDialogueTimerDisplay();

      if (state.timer <= 0) {
        clearInterval(state.timerInterval);
        state.dialogueEndTime = null;
        saveSession();
        switchView(3, false);
      }
    }, 500);
  }

  function updateDialogueTimerDisplay() {
    var mins = String(Math.floor(state.timer / 60)).padStart(2, "0");
    var secs = String(state.timer % 60).padStart(2, "0");
    var $dialogueTimer = document.getElementById("dialogueTimer");
    if ($dialogueTimer) $dialogueTimer.textContent = "⏱ " + mins + ":" + secs;
  }

  window.sendUserChat = function () {
    var $chatInput = document.getElementById("chatInput");
    if (!$chatInput) return;
    var text = $chatInput.value.trim();
    if (!text) return;

    appendChatMsg(text, state.nickname, true);
    $chatInput.value = "";
    $chatInput.focus();

    if (state.pairId && state.roomCode) {
      publishToPair("CHAT_MSG", { text: text });
    }

    if (supabaseClient) {
      supabaseClient
        .from("messages")
        .insert([{
          room_code: state.roomCode || "lobby",
          sender_name: state.nickname,
          message: text
        }])
        .then(function () {})
        .catch(function () {});
    }
  };

  window.sendPresetMsg = function (presetText) {
    var $chatInput = document.getElementById("chatInput");
    if ($chatInput) {
      $chatInput.value = presetText;
      window.sendUserChat();
    }
  };

  function appendChatMsg(text, sender, isMe) {
    var $chatBox = document.getElementById("chatBox");
    if (!$chatBox) return;
    var msg = document.createElement("div");
    msg.className = "chat-msg " + (isMe ? "me" : "peer");
    if (!isMe) {
      msg.innerHTML = "<b>" + escapeHtml(sender) + "</b>: " + escapeHtml(text);
    } else {
      msg.textContent = text;
    }
    $chatBox.appendChild(msg);
    $chatBox.scrollTop = $chatBox.scrollHeight;
  }

  function renderGiveCardsGrid() {
    var $giveCardsGrid = document.getElementById("giveCardsGrid");
    var $confirmGiveBtn = document.getElementById("confirmGiveBtn");
    if (!$giveCardsGrid || !$confirmGiveBtn) return;

    var count = state.selectedGiveCardIds.length;
    var $giveCountNum = document.getElementById("giveCountNum");
    if ($giveCountNum) $giveCountNum.textContent = count;

    if (count === 0) {
      $giveCardsGrid.innerHTML = '<div class="give-cards-empty">👇 화면 하단 손패에서 <b style="color: var(--accent-soft);">선물할 카드</b>를 클릭하세요. (1장 이상 선택 가능)</div>';
      $confirmGiveBtn.disabled = true;
      $confirmGiveBtn.textContent = "선물할 카드를 손패에서 선택하세요";
      return;
    }

    $giveCardsGrid.innerHTML = state.selectedGiveCardIds.map(function (id) {
      var card = state.hand.find(function (c) { return c.id === id; });
      if (!card) return "";
      var isLife = card.type === "LIFE";
      return '<div class="give-mini-card">' +
        '<button type="button" class="gm-remove" onclick="event.stopPropagation(); removeGiveCard(\'' + card.id + '\')">✕</button>' +
        '<div class="gm-top">' + (isLife ? "생명 카드" : escapeHtml(card.category)) + '</div>' +
        '<div class="gm-name">' + escapeHtml(card.name) + '</div>' +
        '<div class="gm-suit">' + (isLife ? "♥" : "◆") + '</div>' +
        '</div>';
    }).join("");

    $confirmGiveBtn.disabled = false;
    $confirmGiveBtn.textContent = "🎁 선택한 카드 (" + count + "장) 선물 확정하기";
  }

  window.removeGiveCard = function (cardId) {
    if (state.mySubmittedCards) return;
    var idx = state.selectedGiveCardIds.indexOf(cardId);
    if (idx > -1) {
      state.selectedGiveCardIds.splice(idx, 1);
      renderGiveCardsGrid();
      renderHand();
    }
  };

  function checkAndFinalizeTrade() {
    if (state.mySubmittedCards && state.partnerGiveCards) {
      var givenCards = state.mySubmittedCards;
      var receivedCards = state.partnerGiveCards;

      var givenIds = givenCards.map(function (c) { return c.id; });
      state.hand = state.hand.filter(function (c) { return !givenIds.includes(c.id); }).concat(receivedCards);
      updateDashboard();
      renderHand();

      openReceiveModal(receivedCards);

      state.turnHistory.push({
        turn: state.currentTurn,
        partner: state.partnerName,
        gave: givenCards.map(function (c) { return c.name; }).join(", "),
        received: receivedCards.map(function (c) { return c.name; }).join(", ")
      });
      saveSession();
    }
  }

  function openReceiveModal(receivedCards) {
    var card = receivedCards[0];
    var $receiveModal = document.getElementById("receiveModal");
    var peerEl = document.getElementById("receivePeerName");
    var titleEl = document.getElementById("receiveCardTitle");
    var descEl = document.getElementById("receiveCardDesc");

    if (peerEl) peerEl.textContent = state.partnerName;
    if (titleEl) titleEl.textContent = receivedCards.map(function (c) { return c.name; }).join(", ");
    if (descEl) descEl.textContent = card.description;

    var isLife = card.type === "LIFE";
    var $showcase = document.getElementById("receiveCardShowcase");
    if ($showcase) $showcase.className = "receive-card-showcase " + card.type.toLowerCase();

    var rcLabel = document.getElementById("rcLabel");
    var rcName = document.getElementById("rcName");
    var rcCat = document.getElementById("rcCat");
    var rcSuit = document.getElementById("rcSuit");
    if (rcLabel) rcLabel.textContent = isLife ? "생명 카드" : "가치관 카드";
    if (rcName) rcName.textContent = card.name;
    if (rcCat) rcCat.textContent = isLife ? card.effect : card.category;
    if (rcSuit) rcSuit.textContent = isLife ? "♥" : "◆";

    var $lifeEffect = document.getElementById("receiveLifeEffect");
    var $lifeVal = document.getElementById("receiveLifeEffectVal");
    var $curLife = document.getElementById("lifeNum");
    if (isLife && $lifeEffect && $lifeVal) {
      $lifeEffect.style.display = "block";
      $lifeVal.textContent = card.effect + " 연장 (현재: " + ($curLife ? $curLife.textContent : 85) + "세)";
    } else if ($lifeEffect) {
      $lifeEffect.style.display = "none";
    }

    var $btn = document.getElementById("receiveConfirmBtn");
    if ($btn) {
      $btn.disabled = false;
      if (state.currentTurn < state.totalTurns) {
        var isMulti = state.members && state.members.length > 2;
        $btn.textContent = isMulti
          ? "확인하고 새로운 상대방과 " + (state.currentTurn + 1) + "턴 매칭하기 ➔"
          : "확인하고 " + (state.currentTurn + 1) + "턴으로 이동 ➔";
      } else {
        $btn.textContent = "🎉 5턴 최종 완료! 디브리핑 작성하기 ➔";
      }
    }

    if ($receiveModal) $receiveModal.classList.add("show");
  }

  function renderHand() {
    var $hand = document.getElementById("hand");
    if (!$hand) return;
    if (!state.hand.length) {
      $hand.innerHTML = '<div class="empty-state">게임이 시작되면 10장의 카드가 분배됩니다.</div>';
      return;
    }
    var n = state.hand.length;
    var maxSpreadDeg = Math.min(46, n * 4.6);
    var step = n > 1 ? maxSpreadDeg / (n - 1) : 0;
    var startDeg = -maxSpreadDeg / 2;
    var cardWidth = 88;
    var overlapPx = Math.min(54, cardWidth * 0.72);
    var totalWidth = cardWidth + (n - 1) * (cardWidth - overlapPx);
    var startX = -totalWidth / 2 + cardWidth / 2;

    $hand.innerHTML = state.hand.map(function (card, i) {
      var deg = startDeg + step * i;
      var x = startX + i * (cardWidth - overlapPx);
      var arcLift = -Math.pow(Math.abs(i - (n - 1) / 2) / ((n - 1) / 2 || 1), 2) * 24;
      var finalTransform = "translateX(" + x + "px) translateY(" + (-arcLift) + "px) rotate(" + deg + "deg)";
      var isSelected = (state.currentPhase === 3)
        ? state.selectedGiveCardIds.includes(card.id)
        : (card.id === state.selectedCardId);

      return '<div class="card ' + card.type.toLowerCase() + (isSelected ? " selected" : "") + '"' +
             ' data-id="' + card.id + '"' +
             ' style="--final-transform:' + finalTransform + '; transform:' + finalTransform + '; z-index:' + i + ';"' +
             ' onmouseover="this.style.transform=\'translateX(' + x + 'px) translateY(-30px) rotate(0deg) scale(1.08)\'"' +
             ' onmouseout="this.style.transform=\'' + finalTransform + '\'">' +
             '<div class="type-label">' + (card.type === "VALUE" ? "가치관" : "생명") + '</div>' +
             '<div class="name">' + escapeHtml(card.name) + '</div>' +
             '<div class="suit">' + (card.type === "VALUE" ? "◆" : "♥") + '</div>' +
             '</div>';
    }).join("");

    $hand.querySelectorAll(".card").forEach(function (el) {
      el.addEventListener("click", function () { handleCardClick(el.dataset.id); });
    });
  }

  function handleCardClick(cardId) {
    if (state.currentPhase === 3) {
      if (state.mySubmittedCards) return;
      var idx = state.selectedGiveCardIds.indexOf(cardId);
      if (idx > -1) state.selectedGiveCardIds.splice(idx, 1);
      else state.selectedGiveCardIds.push(cardId);
      renderGiveCardsGrid();
      renderHand();
      return;
    }

    var card = state.hand.find(function (c) { return c.id === cardId; });
    if (!card) return;
    state.selectedCardId = cardId;
    renderHand();

    var isLife = card.type === "LIFE";
    var $detailModal = document.getElementById("detailModal");
    var $detailModalBody = document.getElementById("detailModalBody");
    if ($detailModalBody) {
      $detailModalBody.innerHTML = '<button type="button" class="modal-close" id="detailClose2">✕</button>' +
        '<div class="cd-head" style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">' +
        '<span style="font-size:11px; font-weight:800; padding:3px 8px; border-radius:999px; background:' + (isLife ? 'rgba(239,139,92,0.2)' : 'rgba(47,191,166,0.2)') + '; color:' + (isLife ? 'var(--life)' : 'var(--value)') + ';">' +
        (isLife ? "생명 카드" : "가치관 카드") + '</span>' +
        (!isLife ? '<span style="font-size:11.5px; color:var(--ink-dim); margin-left:auto;">' + escapeHtml(card.category) + '</span>' : '') +
        '</div>' +
        '<div style="font-size:20px; font-weight:900; margin-bottom:6px;">' + escapeHtml(card.name) + '</div>' +
        '<p style="color:var(--ink-dim); font-size:13px; line-height:1.6; margin-bottom:14px;">' + escapeHtml(card.description) + '</p>' +
        '<div style="background:rgba(255,255,255,0.04); padding:10px 12px; border-radius:10px; font-size:12.5px;">' +
        (isLife
          ? '<span style="color:var(--ink-faint);">기대수명 효과: </span><b style="color:var(--accent-soft); font-size:14px;">' + escapeHtml(card.effect) + '</b>'
          : '<span style="color:var(--ink-faint);">대화 질문: </span><br><b>“' + escapeHtml(card.question) + '”</b>') +
        '</div>';
      if ($detailModal) $detailModal.classList.add("show");
      var closeBtn = document.getElementById("detailClose2");
      if (closeBtn) closeBtn.addEventListener("click", function () { $detailModal.classList.remove("show"); });
    }
  }

  function renderDebrief() {
    var lifeCards = state.hand.filter(function (c) { return c.type === "LIFE"; });
    var valCards = state.hand.filter(function (c) { return c.type === "VALUE"; });
    var lifeCount = lifeCards.length;
    var valueCount = valCards.length;
    var finalLife = 70 + 5 * lifeCount;

    var $finalLifeExp = document.getElementById("finalLifeExp");
    var $finalValueCount = document.getElementById("finalValueCount");
    var $finalLifeCount = document.getElementById("finalLifeCount");
    var $finalHandCountText = document.getElementById("finalHandCountText");

    if ($finalLifeExp) $finalLifeExp.textContent = finalLife + "세";
    if ($finalValueCount) $finalValueCount.textContent = valueCount + "종";
    if ($finalLifeCount) $finalLifeCount.textContent = lifeCount + "장";
    if ($finalHandCountText) $finalHandCountText.textContent = state.hand.length;

    var categoryCounts = { "관계": 0, "성취": 0, "안정": 0, "윤리": 0, "성장": 0, "자유": 0 };
    valCards.forEach(function (c) {
      if (categoryCounts.hasOwnProperty(c.category)) {
        categoryCounts[c.category]++;
      }
    });

    updatePersonaArchetype(categoryCounts);
    drawRadarChart("radarChartCanvas", categoryCounts);
    renderFinalHandCards();
    renderInfographicTimeline();
    renderLifeDilemmaFeedback(lifeCount);
  }

  function updatePersonaArchetype(catCounts) {
    var sortedCats = Object.entries(catCounts).sort(function (a, b) { return b[1] - a[1]; });
    var topCat = sortedCats[0][0];
    var topCount = sortedCats[0][1];

    var tag = "🌟 조화로운 탐색가";
    var title = '"균형과 깊이를 품은 삶의 항해자"';
    var desc = "다양한 삶의 가치관을 고루 지켜내며, 타인과의 대화 속에서 균형 잡힌 시각을 유지했습니다.";

    if (topCount >= 2) {
      if (topCat === "성취" || topCat === "성장") {
        tag = "🔥 열정의 개척자";
        title = '"어제보다 나은 내일을 만드는 성장형 리더"';
        desc = "새로운 가능성에 끊임없이 도전하고 배우는 과정에서 삶의 가장 뜨거운 의미를 발견하는 사람입니다.";
      } else if (topCat === "관계") {
        tag = "💖 유대의 수호자";
        title = '"사람과 신뢰를 가장 귀하게 여기는 온기"';
        desc = "주변 사람들과의 진실한 마음과 약속을 소중히 지키며, 함께하는 연대 속에서 행복을 꽃피우는 사람입니다.";
      } else if (topCat === "안정") {
        tag = "🛡️ 평온의 안식처";
        title = '"흔들림 없이 단단한 일상을 가꾸는 현자"';
        desc = "급격한 변화 속에서도 자신만의 고요와 여유를 잃지 않고, 삶의 든든한 기반을 다지는 사람입니다.";
      } else if (topCat === "윤리") {
        tag = "⚖️ 정의로운 양심";
        title = '"말과 행동의 일치를 추구하는 정직한 등대"';
        desc = "타인을 배려하고 올바른 도덕적 기준을 묵묵히 지켜내며 세상에 선한 영향력을 전하는 사람입니다.";
      } else if (topCat === "자유") {
        tag = "🕊️ 바람의 영혼";
        title = '"틀에 얽매이지 않고 주체적인 길을 걷는 자유인"';
        desc = "스스로 선택한 삶의 길을 주도적으로 걸어가며, 온전한 나다움을 잃지 않는 사람입니다.";
      }
    }

    var $pTag = document.getElementById("personaTag");
    var $pTitle = document.getElementById("personaTitle");
    var $pDesc = document.getElementById("personaDesc");
    if ($pTag) $pTag.textContent = tag;
    if ($pTitle) $pTitle.textContent = title;
    if ($pDesc) $pDesc.textContent = desc;
  }

  function drawRadarChart(canvasId, categoryCounts) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var width = canvas.width;
    var height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    var categories = ["관계", "성취", "안정", "윤리", "성장", "자유"];
    var values = categories.map(function (cat) { return categoryCounts[cat] || 0; });
    var maxVal = Math.max(3, Math.max.apply(null, values));
    var centerX = width / 2;
    var centerY = height / 2;
    var radius = Math.min(centerX, centerY) - 32;
    var totalSides = categories.length;

    for (var level = 1; level <= 3; level++) {
      var r = (radius / 3) * level;
      ctx.beginPath();
      for (var i = 0; i < totalSides; i++) {
        var angle = (Math.PI * 2 / totalSides) * i - Math.PI / 2;
        var x = centerX + r * Math.cos(angle);
        var y = centerY + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (var i2 = 0; i2 < totalSides; i2++) {
      var angle2 = (Math.PI * 2 / totalSides) * i2 - Math.PI / 2;
      var x2 = centerX + radius * Math.cos(angle2);
      var y2 = centerY + radius * Math.sin(angle2);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.stroke();

      var labelX = centerX + (radius + 18) * Math.cos(angle2);
      var labelY = centerY + (radius + 16) * Math.sin(angle2);
      ctx.fillStyle = "#9aa3ba";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(categories[i2], labelX, labelY);
    }

    ctx.beginPath();
    for (var i3 = 0; i3 < totalSides; i3++) {
      var val = values[i3];
      var rData = (val / maxVal) * radius;
      var angleData = (Math.PI * 2 / totalSides) * i3 - Math.PI / 2;
      var xData = centerX + rData * Math.cos(angleData);
      var yData = centerY + rData * Math.sin(angleData);
      if (i3 === 0) ctx.moveTo(xData, yData);
      else ctx.lineTo(xData, yData);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(47, 191, 166, 0.35)";
    ctx.fill();
    ctx.strokeStyle = "#2fbfa6";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    for (var i4 = 0; i4 < totalSides; i4++) {
      var val2 = values[i4];
      var rDot = (val2 / maxVal) * radius;
      var angleDot = (Math.PI * 2 / totalSides) * i4 - Math.PI / 2;
      var xDot = centerX + rDot * Math.cos(angleDot);
      var yDot = centerY + rDot * Math.sin(angleDot);
      ctx.beginPath();
      ctx.arc(xDot, yDot, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#a99bff";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function renderFinalHandCards() {
    var $container = document.getElementById("finalCardsDeck");
    if (!$container) return;

    $container.innerHTML = state.hand.map(function (card) {
      var isLife = card.type === "LIFE";
      return '<div class="final-card-chip ' + (isLife ? 'life' : 'value') + '" title="' + escapeHtml(card.description) + '">' +
        '<span>' + (isLife ? '♥' : '◆') + '</span>' +
        '<span>' + escapeHtml(card.name) + '</span>' +
        '<span class="chip-cat">' + escapeHtml(isLife ? card.effect : card.category) + '</span>' +
        '</div>';
    }).join("");
  }

  function renderInfographicTimeline() {
    var $timeline = document.getElementById("infographicTimeline");
    if (!$timeline) return;

    if (!state.turnHistory.length) {
      $timeline.innerHTML = '<div style="color:var(--ink-faint); font-size:12px; text-align:center; padding:12px;">교환 기록이 없습니다.</div>';
      return;
    }

    $timeline.innerHTML = state.turnHistory.map(function (h) {
      return '<div class="timeline-story-row">' +
        '<div class="story-left"><span class="story-round-tag">' + h.turn + '턴</span><span class="story-peer-name">👤 ' + escapeHtml(h.partner) + '</span></div>' +
        '<div class="story-exchange-flow">' +
        '<span class="pill-gave">내가 줌: ' + escapeHtml(h.gave) + '</span>' +
        '<span style="color:var(--ink-faint); font-weight:900;">➔</span>' +
        '<span class="pill-received">받음: ' + escapeHtml(h.received) + '</span>' +
        '</div></div>';
    }).join("");
  }

  function renderLifeDilemmaFeedback(lifeCount) {
    var $title = document.getElementById("dilemmaTitle");
    var $text = document.getElementById("dilemmaText");
    if (!$title || !$text) return;

    if (lifeCount >= 4) {
      $title.textContent = "⚖️ [긴 호흡의 안정을 선택한 삶]";
      $text.textContent = "생명 카드 4장 이상을 보유하며, 세상을 더 오래 살아가며 긴 시간 속에서 의미를 찾고자 하는 '장수와 안정' 성향을 보였습니다.";
    } else if (lifeCount <= 2) {
      $title.textContent = "⚖️ [수명보다 가치의 깊이를 선택한 삶]";
      $text.textContent = "생명 카드를 기꺼이 내어주고 8개 이상의 다채로운 가치관을 수집했습니다. 시간의 길이보다 '어떻게 살 것인가'에 집중한 뜨거운 선택이었습니다.";
    } else {
      $title.textContent = "⚖️ [황금비율: 가치 7 · 생명 3의 조화]";
      $text.textContent = "적절한 수명(85세)과 균형 잡힌 가치관 7종을 유지하며, 현실의 지속 가능성과 이상의 의미를 모두 조화롭게 챙긴 중용의 삶입니다.";
    }
  }

  function showToast(msg) {
    var $successMsg = document.getElementById("successMsg");
    var $successBanner = document.getElementById("successBanner");
    if ($successMsg && $successBanner) {
      $successMsg.textContent = msg;
      $successBanner.classList.add("show");
      setTimeout(function () { $successBanner.classList.remove("show"); }, 3500);
    }
  }

  function on(id, event, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  // 11. UI 이벤트 바인딩
  function initializeApp() {
    ensureWaitingViewExists();

    on("tabRoomList", "click", function () { window.switchLobbyTab("list"); });
    on("tabCreateRoom", "click", function () { window.switchLobbyTab("create"); });
    on("tabDirectJoin", "click", function () { window.switchLobbyTab("join"); });
    on("btnShowCreateTab", "click", function () { window.switchLobbyTab("create"); });
    on("btnShowJoinTab", "click", function () { window.switchLobbyTab("join"); });
    on("btnRefreshRooms", "click", function () { window.loadRoomsFromDb(); });

    var chkPrivate = document.getElementById("chkIsPrivate");
    if (chkPrivate) {
      chkPrivate.addEventListener("change", function () {
        var wrap = document.getElementById("privatePassWrap");
        if (wrap) wrap.style.display = this.checked ? "block" : "none";
      });
    }

    on("btnCreateRoomSubmit", "click", window.handleCreateRoomSubmit);

    var $joinCodeInput = document.getElementById("joinRoomCodeInput");
    if ($joinCodeInput) {
      $joinCodeInput.addEventListener("input", function () {
        this.value = this.value.replace(/[^0-9]/g, "").slice(0, 4);
      });
    }

    on("btnJoinRoomSubmit", "click", function () {
      var inputCode = $joinCodeInput ? $joinCodeInput.value.trim() : "";
      if (!inputCode || inputCode.length !== 4 || !/^\d{4}$/.test(inputCode)) {
        alert("입장할 방 코드는 숫자 4자리로 정확히 입력해주세요!");
        if ($joinCodeInput) $joinCodeInput.focus();
        return;
      }
      executeJoinRoom(inputCode, null);
    });

    on("btnCancelPassword", "click", function () {
      pendingPrivateRoom = null;
      var modal = document.getElementById("passwordModal");
      if (modal) modal.classList.remove("show");
    });

    on("btnConfirmPassword", "click", function () {
      var input = document.getElementById("pwdModalInput");
      var val = input ? input.value.trim() : "";
      if (!pendingPrivateRoom) return;

      var code = pendingPrivateRoom.code;
      pendingPrivateRoom = null;
      var modal = document.getElementById("passwordModal");
      if (modal) modal.classList.remove("show");

      executeJoinRoom(code, val);
    });

    on("btnToggleReady", "click", function () {
      state.isReady = !state.isReady;
      var $btn = document.getElementById("btnToggleReady");
      if ($btn) {
        if (state.isReady) {
          $btn.className = "btn btn-danger";
          $btn.textContent = "취소 (준비 해제)";
          showToast("준비 완료! 방장의 시작을 기다립니다.");
        } else {
          $btn.className = "btn btn-success";
          $btn.textContent = "✋ 준비 완료 (Ready)";
          showToast("준비가 해제되었습니다.");
        }
      }

      var me = state.members.find(function (m) { return m.id === state.myId; });
      if (me) me.isReady = state.isReady;
      renderMemberList();
      saveSession();

      brokerClient.sendRaw({
        action: "TOGGLE_READY",
        roomCode: state.roomCode,
        playerId: state.myId,
        isReady: state.isReady
      });
    });

    on("btnStartGameMatching", "click", function () {
      brokerClient.sendRaw({
        action: "START_GAME",
        roomCode: state.roomCode,
        playerId: state.myId
      });
    });

    on("btnCopyRoomCode", "click", function () {
      if (state.roomCode && navigator.clipboard) {
        navigator.clipboard.writeText(state.roomCode).then(function () {
          showToast("방 코드 (#" + state.roomCode + ")가 복사되었습니다!");
        });
      }
    });

    on("btnLeaveRoom", "click", async function () {
      var codeToLeave = state.roomCode;
      var myIdToLeave = state.myId;
      var nickToLeave = state.nickname;
      var isSolo = state.members.length <= 1;

      clearSession();

      if (codeToLeave && isSolo) {
        if (supabaseClient) {
          try {
            await supabaseClient.from("rooms").delete().eq("room_code", codeToLeave);
          } catch (e) {}
        }
      }

      if (codeToLeave) {
        brokerClient.sendRaw({
          action: "LEAVE_ROOM",
          roomCode: codeToLeave,
          playerId: myIdToLeave,
          nickname: nickToLeave
        });
      }

      state.roomCode = null;
      state.isHost = false;
      state.isReady = false;
      state.isSittingOut = false;
      state.members = [];
      state.pairId = null;
      state.partnerId = null;
      state.inspectEndTime = null;
      state.dialogueEndTime = null;

      var waitSec = document.getElementById("lobbyWaitingRoomSection");
      var entrySec = document.getElementById("lobbyEntrySection");
      if (waitSec) waitSec.style.display = "none";
      if (entrySec) entrySec.style.display = "block";

      switchView(0, false);
      window.switchLobbyTab("list");
      window.loadRoomsFromDb();
      showToast("대기실에서 퇴장했습니다.");
    });

    on("btnTestDebriefDirect", "click", function () {
      if (!state.hand.length) initHand();
      if (!state.turnHistory.length) {
        state.turnHistory = [
          { turn: 1, partner: "민지", gave: "도전", received: "평온 (+5년)" },
          { turn: 2, partner: "준호", gave: "여유", received: "성장" },
          { turn: 3, partner: "소연", gave: "배움", received: "신뢰" },
          { turn: 4, partner: "태양", gave: "용기", received: "활력 (+5년)" },
          { turn: 5, partner: "하은", gave: "명예", received: "정직" }
        ];
      }
      switchView(4, false);
      showToast("🧪 디브리핑 화면으로 즉시 이동했습니다!");
    });

    on("btnSkipInspect", "click", function () {
      publishToPair("SKIP_INSPECT", {});
      clearInterval(state.timerInterval);
      state.inspectEndTime = null;
      switchView(2, false);
    });

    on("btnGoToTrade", "click", function () {
      publishToPair("SKIP_DIALOGUE", {});
      clearInterval(state.timerInterval);
      state.dialogueEndTime = null;
      switchView(3, false);
    });

    on("chatSendBtn", "click", window.sendUserChat);

    var $chatInput = document.getElementById("chatInput");
    if ($chatInput) {
      $chatInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.isComposing) {
          e.preventDefault();
          window.sendUserChat();
        }
      });
    }

    on("confirmGiveBtn", "click", function () {
      if (state.selectedGiveCardIds.length === 0) return;
      var cardsToSend = state.hand.filter(function (c) { return state.selectedGiveCardIds.includes(c.id); });
      state.mySubmittedCards = cardsToSend;

      publishToPair("SUBMIT_GIVE_CARDS", { cards: cardsToSend });
      var btn = document.getElementById("confirmGiveBtn");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "✅ 선물 확정 완료! 상대방 대기 중...";
      }

      checkAndFinalizeTrade();
    });

    // [핵심] 카드 수령 확인 모달에서 '다음 턴으로' 클릭 시
    on("receiveConfirmBtn", "click", function () {
      var $receiveModal = document.getElementById("receiveModal");
      if ($receiveModal) $receiveModal.classList.remove("show");

      if (state.currentTurn >= state.totalTurns) {
        switchView(4, false);
        return;
      }

      // 전용 매칭 대기 페이지(999)로 이동하여 다른 참가자 완료 대기
      showMatchingWaitPage("NEXT_TURN", state.currentTurn + 1);

      // 서버에 이번 턴 교환 완료 전송 -> 두 사람 모두 누르는 즉시 서버가 새 상대방과 2턴을 시작!
      brokerClient.sendRaw({
        action: "COMPLETE_TURN",
        roomCode: state.roomCode,
        playerId: state.myId,
        turn: state.currentTurn
      });
    });

    on("btnRestartGame", "click", function () {
      clearSession();
      location.reload();
    });

    on("downloadReportBtn", "click", function () {
      var life = document.getElementById("finalLifeExp") ? document.getElementById("finalLifeExp").textContent : "85세";
      var values = state.hand.filter(function (c) { return c.type === "VALUE"; }).map(function (c) { return c.name + "(" + c.category + ")"; }).join(", ");
      var persona = document.getElementById("personaTitle") ? document.getElementById("personaTitle").textContent : "";
      var tag = document.getElementById("personaTag") ? document.getElementById("personaTag").textContent : "";

      var q1 = document.getElementById("reflectQ1") ? document.getElementById("reflectQ1").value.trim() : "";
      var q2 = document.getElementById("reflectQ2") ? document.getElementById("reflectQ2").value.trim() : "";
      var q3 = document.getElementById("reflectQ3") ? document.getElementById("reflectQ3").value.trim() : "";

      var historyText = state.turnHistory.map(function (h) {
        return "* " + h.turn + "턴 (" + h.partner + " 님): [" + h.gave + "] 선물 ➔ [" + h.received + "] 수령";
      }).join("\n");

      var content = "========================================================\n" +
        "🃏 메이플라이 빅게임 · 인생 가치관 디브리핑 리포트\n" +
        "========================================================\n" +
        "- 플레이어: " + state.nickname + "\n" +
        "- 나의 인생 유형: " + tag + " " + persona + "\n" +
        "- 최종 기대수명: " + life + "\n" +
        "- 수집한 핵심 가치관: " + values + "\n\n" +
        "[📜 5턴 실시간 교환 여정 기록]\n" +
        historyText + "\n\n" +
        "--------------------------------------------------------\n" +
        "✍️ 나를 찾는 3문 3답 성찰 질문 답변\n" +
        "--------------------------------------------------------\n" +
        "Q1. 끝까지 지켜내고 싶었던 나만의 핵심 가치관은 무엇이었나요?\n" +
        "답변: " + (q1 || "(작성 내용 없음)") + "\n\n" +
        "Q2. 상대방과의 대화 및 카드 교환 중 가장 인상 깊었던 순간은?\n" +
        "답변: " + (q2 || "(작성 내용 없음)") + "\n\n" +
        "Q3. 앞으로의 일상에서 이 가치관들을 어떻게 실천하고 싶나요?\n" +
        "답변: " + (q3 || "(작성 내용 없음)") + "\n" +
        "========================================================\n" +
        "발급일시: " + new Date().toLocaleString("ko-KR") + "\n";

      if (supabaseClient) {
        supabaseClient
          .from("debriefings")
          .insert([{
            nickname: state.nickname,
            room_code: state.roomCode || "practice",
            persona_tag: tag,
            persona_title: persona,
            final_life: parseInt(life, 10) || 85,
            final_deck: state.hand,
            trade_history: state.turnHistory,
            q1_answer: q1,
            q2_answer: q2,
            q3_answer: q3,
            reflection_text: "Q1: " + q1 + " | Q2: " + q2 + " | Q3: " + q3
          }])
          .then(function () {})
          .catch(function () {});
      }

      var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "가치관_디브리핑_" + state.nickname + ".txt";
      a.click();
      showToast("성찰 리포트가 저장되었습니다! ✨");
    });

    on("detailClose", "click", function () {
      var $detailModal = document.getElementById("detailModal");
      if ($detailModal) $detailModal.classList.remove("show");
    });

    // 새로고침(F5) 시 세션 복원
    if (savedSession && savedSession.roomCode) {
      var nickInput = document.getElementById("nicknameInput");
      if (nickInput) nickInput.value = state.nickname;
      var nickDisp = document.getElementById("myNickDisplay");
      if (nickDisp) nickDisp.textContent = state.nickname;

      brokerClient.subscribe("/topic/room/" + state.roomCode, handleRoomTopicMessage);
      if (state.pairId) {
        activePairTopic = "/topic/pair/" + state.roomCode + "_" + state.pairId;
        brokerClient.subscribe(activePairTopic, handlePairGameEvent);
      }

      if (state.currentPhase === 0) {
        openWaitingRoomUi(state.roomCode);
        renderMemberList();
      } else if (state.currentPhase === 999 || state.isSittingOut) {
        showMatchingWaitPage(state.waitingMode, state.currentTurn);
      } else {
        switchView(state.currentPhase, true);
        if (state.partnerName) {
          var pNameEl = document.getElementById("dialoguePeerName");
          if (pNameEl) pNameEl.textContent = state.partnerName;
        }
      }
    } else {
      switchView(0, false);
    }

    console.log("🚀 [메이플라이 빅게임] v4.0 초기화 완료! (내 고유 ID: " + state.myId + ")");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
  } else {
    initializeApp();
  }
})();