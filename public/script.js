(function () {
  "use strict";

  // =========================================================
  // 1. WebSocket & 메시지 브로커 클라이언트
  // =========================================================
  class WebSocketMessageBrokerClient {
    constructor() {
      this.socket = null;
      this.connected = false;
      this.subscriptions = new Map();
      this.initConnection();
    }

    initConnection() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws-stomp`;

      try {
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          this.sendRaw({ action: "CONNECT" });
        };

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
          } catch (e) {
            console.error("[Broker] Parse error:", e);
          }
        };

        this.socket.onerror = () => {
          this.updateStatus(false);
        };

        this.socket.onclose = () => {
          this.connected = false;
          this.updateStatus(false);
          setTimeout(() => this.initConnection(), 3000);
        };
      } catch (e) {
        this.updateStatus(false);
      }
    }

    updateStatus(isOnline) {
      const badge = document.getElementById("netStatusBadge");
      if (badge) {
        if (isOnline) {
          badge.textContent = "WebSocket 연결됨 🟢";
          badge.style.color = "#2fbfa6";
        } else {
          badge.textContent = "서버 재연결 중 🔴";
          badge.style.color = "#ef4444";
        }
      }
    }

    sendRaw(obj) {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(obj));
      }
    }

    handleServerMessage(data) {
      const { action, topic, payload } = data;

      if (action === "CONNECTED") {
        this.connected = true;
        this.updateStatus(true);
        for (const dest of this.subscriptions.keys()) {
          this.sendRaw({ action: "SUBSCRIBE", destination: dest });
        }
      } else if (action === "ERROR") {
        alert(data.message || "오류가 발생했습니다.");
      } else if (action === "ROOM_CREATED") {
        onRoomCreatedSuccess(data.roomCode, data.members);
      } else if (action === "ROOM_JOINED") {
        onRoomJoinedSuccess(data.roomCode, data.members);
      } else if (topic && payload) {
        const callbacks = this.subscriptions.get(topic);
        if (callbacks) {
          for (const cb of callbacks) cb(payload);
        }
      }
    }

    subscribe(destination, callback) {
      if (!this.subscriptions.has(destination)) {
        this.subscriptions.set(destination, new Set());
      }
      this.subscriptions.get(destination).add(callback);
      this.sendRaw({ action: "SUBSCRIBE", destination });
    }

    unsubscribe(destination) {
      this.subscriptions.delete(destination);
      this.sendRaw({ action: "UNSUBSCRIBE", destination });
    }

    publish(destination, payload) {
      this.sendRaw({ action: "SEND", destination, payload });
    }
  }

  const brokerClient = new WebSocketMessageBrokerClient();
  const myId = "player_" + Math.random().toString(36).substring(2, 9);

  // =========================================================
  // 2. 상태 관리 (State)
  // =========================================================
  const state = {
    myId: myId,
    nickname: "참가자",
    roomCode: null,
    isHost: false,
    isReady: false,
    isSittingOut: false,
    members: [],

    // 1:1 매칭
    pairId: null,
    partnerId: null,
    partnerName: "상대방",

    // 인게임
    hand: [],
    currentTurn: 1,
    totalTurns: 5,
    currentPhase: 0,
    selectedGiveCardIds: [],
    selectedCardId: null,
    timer: 0,
    timerInterval: null,
    mySubmittedCards: null,
    partnerGiveCards: null,
    turnHistory: []
  };

  const processedMsgIds = new Set();

  // =========================================================
  // 3. 방 생성 & 입장 응답
  // =========================================================
  function onRoomCreatedSuccess(roomCode, members) {
    state.roomCode = roomCode;
    state.isHost = true;
    state.isReady = true;
    state.members = members;

    brokerClient.subscribe(`/topic/room/${roomCode}`, handleRoomTopicMessage);
    openWaitingRoomUi(roomCode);
    renderMemberList();
    showToast(`방(#${roomCode})이 개설되었습니다! 코드를 공유하세요.`);
  }

  function onRoomJoinedSuccess(roomCode, members) {
    state.roomCode = roomCode;
    state.isHost = false;
    state.isReady = false;
    state.members = members;

    brokerClient.subscribe(`/topic/room/${roomCode}`, handleRoomTopicMessage);
    openWaitingRoomUi(roomCode);
    renderMemberList();
    showToast(`방(#${roomCode})에 입장했습니다!`);
  }

  // =========================================================
  // 4. 대기실 토픽 수신
  // =========================================================
  function handleRoomTopicMessage(data) {
    if (!data) return;
    const { type, members, pairs, waitingPlayer } = data;

    if (type === "ROOM_UPDATE") {
      state.members = members || [];
      const me = state.members.find(m => m.id === state.myId);
      if (me) {
        state.isHost = me.isHost;
        state.isReady = me.isReady;
        document.getElementById("hostActionArea").style.display = state.isHost ? "block" : "none";
        document.getElementById("guestActionArea").style.display = state.isHost ? "none" : "block";
      }
      renderMemberList();
    } else if (type === "MATCH_START_WITH_PAIRS") {
      handleMatchResult(pairs, waitingPlayer);
    }
  }

  function handleMatchResult(pairs, waitingPlayer) {
    const myPair = pairs.find(p => p.p1.id === state.myId || p.p2.id === state.myId);

    if (myPair) {
      state.isSittingOut = false;
      const isP1 = (myPair.p1.id === state.myId);
      const partner = isP1 ? myPair.p2 : myPair.p1;

      state.pairId = myPair.pairId;
      state.partnerId = partner.id;
      state.partnerName = partner.name;

      document.getElementById("dialoguePeerName").textContent = state.partnerName;
      showToast(`🎉 1:1 매칭 완료! 상대방: '${state.partnerName}'`);

      const pairTopic = `/topic/pair/${state.roomCode}_${myPair.pairId}`;
      brokerClient.subscribe(pairTopic, handlePairGameEvent);

      initHand();
      state.currentTurn = 1;
      switchView(1);
    } else if (waitingPlayer && waitingPlayer.id === state.myId) {
      state.isSittingOut = true;
      document.getElementById("waitingPlayerNotice").style.display = "block";
      document.getElementById("guestActionArea").style.display = "none";
      if (document.getElementById("hostActionArea")) {
        document.getElementById("hostActionArea").style.display = "none";
      }
      showToast("참가 인원이 홀수여서 이번 턴은 대기석에 배정되었습니다.");
    }
  }

  // =========================================================
  // 5. 1:1 전용 토픽 이벤트 처리
  // =========================================================
  function handlePairGameEvent(data) {
    if (!data || data.senderId === state.myId) return;

    if (data.msgId) {
      if (processedMsgIds.has(data.msgId)) return;
      processedMsgIds.add(data.msgId);
      if (processedMsgIds.size > 200) {
        const oldest = processedMsgIds.values().next().value;
        processedMsgIds.delete(oldest);
      }
    }

    const { type, senderName, payload } = data;

    if (type === "SKIP_INSPECT") {
      clearInterval(state.timerInterval);
      switchView(2);
      showToast(`⚡ ${senderName} 님이 스킵하여 대화가 시작되었습니다!`);
    } else if (type === "SKIP_DIALOGUE") {
      clearInterval(state.timerInterval);
      switchView(3);
      showToast(`🎁 ${senderName} 님이 카드 교환 단계로 넘어갔습니다.`);
    } else if (type === "CHAT_MSG") {
      appendChatMsg(payload.text, senderName, false);
    } else if (type === "SUBMIT_GIVE_CARDS") {
      state.partnerGiveCards = payload.cards;
      const $peerStatusText = document.getElementById("peerStatusText");
      if ($peerStatusText) {
        $peerStatusText.textContent = `🎁 ${senderName} 님이 선물을 확정했습니다! (내 선택 대기 중)`;
      }
      checkAndFinalizeTrade();
    } else if (type === "ADVANCE_NEXT_TURN") {
      const $receiveModal = document.getElementById("receiveModal");
      if ($receiveModal) $receiveModal.classList.remove("show");
      state.currentTurn = payload.turn;
      if (state.currentTurn <= state.totalTurns) {
        switchView(1);
      } else {
        switchView(4);
      }
    }
  }

  function publishToPair(type, payload = {}) {
    if (!state.pairId || !state.roomCode) return;
    const msgId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
    const data = {
      msgId,
      type,
      senderId: state.myId,
      senderName: state.nickname,
      pairId: state.pairId,
      payload
    };
    brokerClient.publish(`/topic/pair/${state.roomCode}_${state.pairId}`, data);
  }

  // =========================================================
  // 6. 대기실 명단 UI
  // =========================================================
  function renderMemberList() {
    const $container = document.getElementById("memberListContainer");
    const $memberCountText = document.getElementById("memberCountText");
    const $readySummaryText = document.getElementById("readySummaryText");
    const $hostStartBtn = document.getElementById("btnStartGameMatching");
    const $hostNotice = document.getElementById("hostStatusNotice");

    if (!$container) return;
    const list = state.members;
    if ($memberCountText) $memberCountText.textContent = list.length;

    $container.innerHTML = list.map(m => {
      const isMe = m.id === state.myId;
      const isHost = m.isHost;
      const isReady = m.isReady;

      let badgeHtml = "";
      if (isHost) {
        badgeHtml = `<span style="background: rgba(139,124,246,0.2); color: var(--accent-soft); border: 1px solid var(--accent); padding: 2px 7px; border-radius: 999px; font-size: 11px; font-weight: 700;">👑 방장</span>`;
      } else if (isReady) {
        badgeHtml = `<span style="background: rgba(16,185,129,0.2); color: var(--success); border: 1px solid var(--success); padding: 2px 7px; border-radius: 999px; font-size: 11px; font-weight: 700;">✅ 준비 완료</span>`;
      } else {
        badgeHtml = `<span style="background: rgba(245,158,11,0.15); color: var(--warning); border: 1px solid var(--warning); padding: 2px 7px; border-radius: 999px; font-size: 11px; font-weight: 700;">⏳ 준비 대기</span>`;
      }

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; background: rgba(255,255,255,0.04); border-radius: 10px; border: 1px solid var(--line);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>👤</span>
            <span style="font-weight: 700; font-size: 13px; color: ${isMe ? 'var(--accent-soft)' : 'var(--ink)'};">
              ${m.name} ${isMe ? '(나)' : ''}
            </span>
          </div>
          <div>${badgeHtml}</div>
        </div>
      `;
    }).join("");

    const guests = list.filter(m => !m.isHost);
    const allGuestsReady = guests.length > 0 && guests.every(g => g.isReady);

    if ($readySummaryText) {
      if (guests.length === 0) {
        $readySummaryText.textContent = "참가자 기다리는 중...";
        $readySummaryText.style.color = "var(--ink-dim)";
      } else if (allGuestsReady) {
        $readySummaryText.textContent = "전원 준비 완료! 🚀";
        $readySummaryText.style.color = "var(--success)";
      } else {
        const readyCount = guests.filter(g => g.isReady).length;
        $readySummaryText.textContent = `준비 현황 (${readyCount}/${guests.length})`;
        $readySummaryText.style.color = "var(--warning)";
      }
    }

    if (state.isHost && $hostStartBtn) {
      if (guests.length > 0 && allGuestsReady) {
        $hostStartBtn.disabled = false;
        $hostStartBtn.className = "btn btn-success";
        $hostStartBtn.textContent = `🚀 게임 시작! (1:1 매칭 시작하기)`;
      } else {
        $hostStartBtn.disabled = true;
        $hostStartBtn.className = "btn btn-primary";
        $hostStartBtn.textContent = `🔒 참가자 준비 대기 중...`;
      }
    }
  }

  // =========================================================
  // 7. 대기실 조작 핸들러
  // =========================================================
  document.getElementById("btnCreateRoomSubmit").addEventListener("click", () => {
    state.nickname = document.getElementById("nicknameInput").value.trim() || "방장";
    document.getElementById("myNickDisplay").textContent = state.nickname;

    brokerClient.sendRaw({
      action: "CREATE_ROOM",
      nickname: state.nickname,
      playerId: state.myId
    });
  });

  document.getElementById("btnJoinRoomSubmit").addEventListener("click", () => {
    state.nickname = document.getElementById("nicknameInput").value.trim() || "참가자";
    document.getElementById("myNickDisplay").textContent = state.nickname;

    const inputCode = document.getElementById("joinRoomCodeInput").value.trim();
    if (!inputCode) {
      alert("입장할 방 코드 4자리를 입력해주세요!");
      return;
    }

    brokerClient.sendRaw({
      action: "JOIN_ROOM",
      roomCode: inputCode,
      nickname: state.nickname,
      playerId: state.myId
    });
  });

  function openWaitingRoomUi(code) {
    document.getElementById("lobbyEntrySection").style.display = "none";
    document.getElementById("lobbyWaitingRoomSection").style.display = "block";

    document.getElementById("roomCodeDisplay").textContent = `#${code}`;
    document.getElementById("roomCodeBanner").textContent = code;

    if (state.isHost) {
      document.getElementById("hostActionArea").style.display = "block";
      document.getElementById("guestActionArea").style.display = "none";
    } else {
      document.getElementById("hostActionArea").style.display = "none";
      document.getElementById("guestActionArea").style.display = "block";
    }
  }

  document.getElementById("btnToggleReady").addEventListener("click", () => {
    state.isReady = !state.isReady;
    const $btn = document.getElementById("btnToggleReady");

    if (state.isReady) {
      $btn.className = "btn btn-danger";
      $btn.textContent = "취소 (준비 해제)";
      showToast("준비 완료! 방장의 시작을 기다립니다.");
    } else {
      $btn.className = "btn btn-success";
      $btn.textContent = "✋ 준비 완료 (Ready)";
      showToast("준비가 해제되었습니다.");
    }

    brokerClient.sendRaw({
      action: "TOGGLE_READY",
      roomCode: state.roomCode,
      playerId: state.myId,
      isReady: state.isReady
    });
  });

  document.getElementById("btnStartGameMatching").addEventListener("click", () => {
    brokerClient.sendRaw({
      action: "START_GAME",
      roomCode: state.roomCode,
      playerId: state.myId
    });
  });

  document.getElementById("btnCopyRoomCode").addEventListener("click", () => {
    navigator.clipboard.writeText(state.roomCode).then(() => {
      showToast(`방 코드 (#${state.roomCode})가 복사되었습니다!`);
    });
  });

  document.getElementById("btnLeaveRoom").addEventListener("click", () => {
    location.reload();
  });

  document.getElementById("btnShowCreateTab").addEventListener("click", () => {
    document.getElementById("panelCreateRoom").style.display = "block";
    document.getElementById("panelJoinRoom").style.display = "none";
    document.getElementById("btnShowCreateTab").className = "btn btn-primary";
    document.getElementById("btnShowJoinTab").className = "btn btn-outline";
  });

  document.getElementById("btnShowJoinTab").addEventListener("click", () => {
    document.getElementById("panelCreateRoom").style.display = "none";
    document.getElementById("panelJoinRoom").style.display = "block";
    document.getElementById("btnShowCreateTab").className = "btn btn-outline";
    document.getElementById("btnShowJoinTab").className = "btn btn-primary";
  });

  document.getElementById("btnOpenSecondTab").addEventListener("click", () => {
    window.open(window.location.href, "_blank");
  });

  // =========================================================
  // 8. 카드 덱 & 뷰 전환
  // =========================================================
  function pickRandom(arr, n) {
    const copy = arr.slice();
    const res = [];
    for (let i = 0; i < n && copy.length; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      res.push(copy.splice(idx, 1)[0]);
    }
    return res;
  }

  function initHand() {
    const v = pickRandom(MASTER_VALUE, 7);
    const l = pickRandom(MASTER_LIFE, 3);
    state.hand = v.concat(l).sort(() => Math.random() - 0.5);
    updateDashboard();
    renderHand();
  }

  function updateDashboard() {
    const lifeCount = state.hand.filter(c => c.type === "LIFE").length;
    const valueCount = state.hand.filter(c => c.type === "VALUE").length;
    const expectancy = 70 + 5 * lifeCount;
    const $lifeNum = document.getElementById("lifeNum");
    if ($lifeNum) $lifeNum.textContent = expectancy;

    const $composition = document.getElementById("composition");
    if ($composition) {
      $composition.innerHTML = `<span class="dot value"></span>가치 ${valueCount} · <span class="dot life"></span>생명 ${lifeCount}`;
    }

    const $turnDisplay = document.getElementById("turnDisplay");
    if ($turnDisplay) $turnDisplay.textContent = state.currentTurn;
  }

  function switchView(phase) {
    state.currentPhase = phase;
    const views = [
      document.getElementById("phaseLobbyView"),
      document.getElementById("phase1View"),
      document.getElementById("phase2View"),
      document.getElementById("phase3View"),
      document.getElementById("phase4View")
    ];
    views.forEach(v => { if (v) v.classList.remove("active"); });

    for (let i = 1; i <= 4; i++) {
      const step = document.getElementById(`stepIndicator${i}`);
      if (step) step.classList.toggle("active", i === phase);
    }

    const $turnBadgeWrap = document.getElementById("turnBadgeWrap");
    const $stepIndicatorWrap = document.getElementById("stepIndicatorWrap");

    if (phase === 0) {
      if (views[0]) views[0].classList.add("active");
      if ($turnBadgeWrap) $turnBadgeWrap.style.display = "none";
      if ($stepIndicatorWrap) $stepIndicatorWrap.style.display = "none";
    } else if (phase === 1) {
      if (views[1]) views[1].classList.add("active");
      if ($turnBadgeWrap) $turnBadgeWrap.style.display = "inline-flex";
      if ($stepIndicatorWrap) $stepIndicatorWrap.style.display = "flex";
      const b = document.getElementById("inspectTurnBadge");
      if (b) b.textContent = `${state.currentTurn}턴`;
      startInspectTimer();
    } else if (phase === 2) {
      if (views[2]) views[2].classList.add("active");
      if ($turnBadgeWrap) $turnBadgeWrap.style.display = "inline-flex";
      if ($stepIndicatorWrap) $stepIndicatorWrap.style.display = "flex";
      const b = document.getElementById("dialogueTurnBadge");
      if (b) b.textContent = `${state.currentTurn}턴`;
      startDialogueTimer();

      const valCards = state.hand.filter(c => c.type === "VALUE");
      if (valCards.length) {
        const topic = valCards[(state.currentTurn - 1) % valCards.length];
        const qEl = document.getElementById("topicQuestionText");
        if (qEl) qEl.textContent = `"${topic.question}" (가치관: ${topic.name})`;
      }

      // 채팅창 입력에 포커스
      setTimeout(() => {
        const $chatInput = document.getElementById("chatInput");
        if ($chatInput) $chatInput.focus();
      }, 100);
    } else if (phase === 3) {
      if (views[3]) views[3].classList.add("active");
      if ($turnBadgeWrap) $turnBadgeWrap.style.display = "inline-flex";
      if ($stepIndicatorWrap) $stepIndicatorWrap.style.display = "flex";
      const b = document.getElementById("exchangeTurnBadge");
      if (b) b.textContent = `${state.currentTurn}턴`;
      state.selectedGiveCardIds = [];
      state.mySubmittedCards = null;
      state.partnerGiveCards = null;
      renderGiveCardsGrid();
    } else if (phase === 4) {
      if (views[4]) views[4].classList.add("active");
      if ($turnBadgeWrap) $turnBadgeWrap.style.display = "inline-flex";
      if ($stepIndicatorWrap) $stepIndicatorWrap.style.display = "flex";
      renderDebrief();
    }

    renderHand();
  }

  // =========================================================
  // 9. 타이머
  // =========================================================
  function startInspectTimer() {
    clearInterval(state.timerInterval);
    state.timer = 10;
    const $countdownNum = document.getElementById("countdownNum");
    const $matchProgressBar = document.getElementById("matchProgressBar");
    if ($countdownNum) $countdownNum.textContent = `${state.timer}초`;
    if ($matchProgressBar) $matchProgressBar.style.width = "100%";

    state.timerInterval = setInterval(() => {
      state.timer--;
      if ($countdownNum) $countdownNum.textContent = `${state.timer}초`;
      if ($matchProgressBar) $matchProgressBar.style.width = `${(state.timer / 10) * 100}%`;
      if (state.timer <= 0) {
        clearInterval(state.timerInterval);
        switchView(2);
      }
    }, 1000);
  }

  function startDialogueTimer() {
    clearInterval(state.timerInterval);
    state.timer = 60;
    updateDialogueTimerDisplay();

    state.timerInterval = setInterval(() => {
      state.timer--;
      updateDialogueTimerDisplay();
      if (state.timer <= 0) {
        clearInterval(state.timerInterval);
        switchView(3);
      }
    }, 1000);
  }

  function updateDialogueTimerDisplay() {
    const mins = String(Math.floor(state.timer / 60)).padStart(2, "0");
    const secs = String(state.timer % 60).padStart(2, "0");
    const $dialogueTimer = document.getElementById("dialogueTimer");
    if ($dialogueTimer) $dialogueTimer.textContent = `⏱ ${mins}:${secs}`;
  }

  // =========================================================
  // 10. 실시간 채팅 기능 (완벽 입력 & 전송 보장)
  // =========================================================
  window.sendUserChat = function () {
    const $chatInput = document.getElementById("chatInput");
    if (!$chatInput) return;
    const text = $chatInput.value.trim();
    if (!text) return;

    // 1) 내 메시지 화면에 추가
    appendChatMsg(text, state.nickname, true);
    $chatInput.value = "";
    $chatInput.focus();

    // 2) 실제 1:1 매칭 상대에게 브로커 전송
    if (state.pairId && state.roomCode) {
      publishToPair("CHAT_MSG", { text });
    } else {
      // [테스트 모드일 때] 1초 후 가상 상대방("지우")의 자동 답장
      setTimeout(() => {
        const dummyReplies = [
          "정말 공감되는 말씀이에요!",
          "저도 그 가치관이 삶에서 가장 중요하다고 생각해요.",
          "대화 나눠보니 저에게 꼭 필요한 생각 같아요. 카드 교환해봐요!",
          "말씀을 듣고 보니 새로운 시각이 열리네요 :)"
        ];
        const reply = dummyReplies[Math.floor(Math.random() * dummyReplies.length)];
        appendChatMsg(reply, state.partnerName || "지우", false);
      }, 1000);
    }
  };

  window.sendPresetMsg = function (presetText) {
    const $chatInput = document.getElementById("chatInput");
    if ($chatInput) $chatInput.value = presetText;
    window.sendUserChat();
  };

  function appendChatMsg(text, sender, isMe) {
    const $chatBox = document.getElementById("chatBox");
    if (!$chatBox) return;
    const msg = document.createElement("div");
    msg.className = `chat-msg ${isMe ? "me" : "peer"}`;
    if (!isMe) {
      msg.innerHTML = `<b>${sender}</b>: ${text}`;
    } else {
      msg.textContent = text;
    }
    $chatBox.appendChild(msg);
    $chatBox.scrollTop = $chatBox.scrollHeight;
  }

  // 채팅 인풋 엔터 키 이벤트 (한글 IME 중복 방지)
  const $chatInput = document.getElementById("chatInput");
  if ($chatInput) {
    $chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        window.sendUserChat();
      }
    });
  }

  const $chatSendBtn = document.getElementById("chatSendBtn");
  if ($chatSendBtn) {
    $chatSendBtn.addEventListener("click", window.sendUserChat);
  }

  // =========================================================
  // 11. 카드 맞교환
  // =========================================================
  function renderGiveCardsGrid() {
    const $giveCardsGrid = document.getElementById("giveCardsGrid");
    const $confirmGiveBtn = document.getElementById("confirmGiveBtn");
    if (!$giveCardsGrid || !$confirmGiveBtn) return;

    const count = state.selectedGiveCardIds.length;
    const $giveCountNum = document.getElementById("giveCountNum");
    if ($giveCountNum) $giveCountNum.textContent = count;

    if (count === 0) {
      $giveCardsGrid.innerHTML = `
        <div class="give-cards-empty">
          👇 화면 하단 손패에서 <b style="color: var(--accent-soft);">선물할 카드</b>를 클릭하세요. (1장 이상 선택 가능)
        </div>
      `;
      $confirmGiveBtn.disabled = true;
      $confirmGiveBtn.textContent = "선물할 카드를 손패에서 선택하세요";
      return;
    }

    $giveCardsGrid.innerHTML = state.selectedGiveCardIds.map(id => {
      const card = state.hand.find(c => c.id === id);
      if (!card) return "";
      const isLife = card.type === "LIFE";
      return `
        <div class="give-mini-card">
          <button class="gm-remove" onclick="event.stopPropagation(); removeGiveCard('${card.id}')">✕</button>
          <div class="gm-top">${isLife ? "생명 카드" : card.category}</div>
          <div class="gm-name">${card.name}</div>
          <div class="gm-suit">${isLife ? "♥" : "◆"}</div>
        </div>
      `;
    }).join("");

    $confirmGiveBtn.disabled = false;
    $confirmGiveBtn.textContent = `🎁 선택한 카드 (${count}장) 선물 확정하기`;
  }

  window.removeGiveCard = function (cardId) {
    if (state.mySubmittedCards) return;
    const idx = state.selectedGiveCardIds.indexOf(cardId);
    if (idx > -1) {
      state.selectedGiveCardIds.splice(idx, 1);
      renderGiveCardsGrid();
      renderHand();
    }
  };

  function checkAndFinalizeTrade() {
    if (state.mySubmittedCards && state.partnerGiveCards) {
      const givenCards = state.mySubmittedCards;
      const receivedCards = state.partnerGiveCards;

      const givenIds = givenCards.map(c => c.id);
      state.hand = state.hand.filter(c => !givenIds.includes(c.id)).concat(receivedCards);
      updateDashboard();
      renderHand();

      openReceiveModal(receivedCards);

      state.turnHistory.push({
        turn: state.currentTurn,
        partner: state.partnerName,
        gave: givenCards.map(c => c.name).join(", "),
        received: receivedCards.map(c => c.name).join(", ")
      });
    }
  }

  function openReceiveModal(receivedCards) {
    const card = receivedCards[0];
    const $receiveModal = document.getElementById("receiveModal");
    document.getElementById("receivePeerName").textContent = state.partnerName;
    document.getElementById("receiveCardTitle").textContent = receivedCards.map(c => c.name).join(", ");
    document.getElementById("receiveCardDesc").textContent = card.description;

    const isLife = card.type === "LIFE";
    const $showcase = document.getElementById("receiveCardShowcase");
    if ($showcase) $showcase.className = `receive-card-showcase ${card.type.toLowerCase()}`;
    document.getElementById("rcLabel").textContent = isLife ? "생명 카드" : "가치관 카드";
    document.getElementById("rcName").textContent = card.name;
    document.getElementById("rcCat").textContent = isLife ? card.effect : card.category;
    document.getElementById("rcSuit").textContent = isLife ? "♥" : "◆";

    const $lifeEffect = document.getElementById("receiveLifeEffect");
    if (isLife) {
      $lifeEffect.style.display = "block";
      document.getElementById("receiveLifeEffectVal").textContent = `${card.effect} 연장 (현재: ${document.getElementById("lifeNum").textContent}세)`;
    } else {
      $lifeEffect.style.display = "none";
    }

    const $btn = document.getElementById("receiveConfirmBtn");
    if ($btn) {
      $btn.disabled = false;
      if (state.currentTurn < state.totalTurns) {
        $btn.textContent = `확인하고 ${state.currentTurn + 1}턴으로 이동 ➔`;
      } else {
        $btn.textContent = `🎉 5턴 최종 완료! 디브리핑 작성하기 ➔`;
      }
    }

    if ($receiveModal) $receiveModal.classList.add("show");
  }

  // =========================================================
  // 12. 손패 렌더링
  // =========================================================
  function renderHand() {
    const $hand = document.getElementById("hand");
    if (!$hand) return;
    if (!state.hand.length) {
      $hand.innerHTML = `<div class="empty-state">게임이 시작되면 10장의 카드가 분배됩니다.</div>`;
      return;
    }
    const n = state.hand.length;
    const maxSpreadDeg = Math.min(46, n * 4.6);
    const step = n > 1 ? maxSpreadDeg / (n - 1) : 0;
    const startDeg = -maxSpreadDeg / 2;
    const cardWidth = 88;
    const overlapPx = Math.min(54, cardWidth * 0.72);
    const totalWidth = cardWidth + (n - 1) * (cardWidth - overlapPx);
    const startX = -totalWidth / 2 + cardWidth / 2;

    $hand.innerHTML = state.hand.map((card, i) => {
      const deg = startDeg + step * i;
      const x = startX + i * (cardWidth - overlapPx);
      const arcLift = -Math.pow(Math.abs(i - (n - 1) / 2) / ((n - 1) / 2 || 1), 2) * 24;
      const finalTransform = `translateX(${x}px) translateY(${-arcLift}px) rotate(${deg}deg)`;
      const isSelected = (state.currentPhase === 3)
        ? state.selectedGiveCardIds.includes(card.id)
        : (card.id === state.selectedCardId);

      return `
        <div class="card ${card.type.toLowerCase()} ${isSelected ? "selected" : ""}"
             data-id="${card.id}"
             style="--final-transform:${finalTransform}; transform:${finalTransform}; z-index:${i};"
             onmouseover="this.style.transform='translateX(${x}px) translateY(-30px) rotate(0deg) scale(1.08)'"
             onmouseout="this.style.transform='${finalTransform}'">
          <div class="type-label">${card.type === "VALUE" ? "가치관" : "생명"}</div>
          <div class="name">${card.name}</div>
          <div class="suit">${card.type === "VALUE" ? "◆" : "♥"}</div>
        </div>`;
    }).join("");

    $hand.querySelectorAll(".card").forEach(el => {
      el.addEventListener("click", () => handleCardClick(el.dataset.id));
    });
  }

  function handleCardClick(cardId) {
    if (state.currentPhase === 3) {
      if (state.mySubmittedCards) return;
      const idx = state.selectedGiveCardIds.indexOf(cardId);
      if (idx > -1) state.selectedGiveCardIds.splice(idx, 1);
      else state.selectedGiveCardIds.push(cardId);
      renderGiveCardsGrid();
      renderHand();
      return;
    }

    const card = state.hand.find(c => c.id === cardId);
    if (!card) return;
    state.selectedCardId = cardId;
    renderHand();

    const isLife = card.type === "LIFE";
    const $detailModal = document.getElementById("detailModal");
    const $detailModalBody = document.getElementById("detailModalBody");
    if ($detailModalBody) {
      $detailModalBody.innerHTML = `
        <button class="modal-close" id="detailClose2">✕</button>
        <div class="cd-head" style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
          <span style="font-size:11px; font-weight:800; padding:3px 8px; border-radius:999px; background:${isLife ? 'rgba(239,139,92,0.2)' : 'rgba(47,191,166,0.2)'}; color:${isLife ? 'var(--life)' : 'var(--value)'};">
            ${isLife ? "생명 카드" : "가치관 카드"}
          </span>
          ${!isLife ? `<span style="font-size:11.5px; color:var(--ink-dim); margin-left:auto;">${card.category}</span>` : ""}
        </div>
        <div style="font-size:20px; font-weight:900; margin-bottom:6px;">${card.name}</div>
        <p style="color:var(--ink-dim); font-size:13px; line-height:1.6; margin-bottom:14px;">${card.description}</p>
        <div style="background:rgba(255,255,255,0.04); padding:10px 12px; border-radius:10px; font-size:12.5px;">
          ${isLife
            ? `<span style="color:var(--ink-faint);">기대수명 효과: </span><b style="color:var(--accent-soft); font-size:14px;">${card.effect}</b>`
            : `<span style="color:var(--ink-faint);">대화 질문: </span><br><b>“${card.question}”</b>`}
        </div>`;
      if ($detailModal) $detailModal.classList.add("show");
      document.getElementById("detailClose2").addEventListener("click", () => $detailModal.classList.remove("show"));
    }
  }

  // =========================================================
  // 13. [고도화] 디브리핑 화면 렌더링 (기능 1, 2, 3 구현)
  // =========================================================
  function renderDebrief() {
    const lifeCards = state.hand.filter(c => c.type === "LIFE");
    const valCards = state.hand.filter(c => c.type === "VALUE");
    const lifeCount = lifeCards.length;
    const valueCount = valCards.length;
    const finalLife = 70 + 5 * lifeCount;

    const $finalLifeExp = document.getElementById("finalLifeExp");
    const $finalValueCount = document.getElementById("finalValueCount");
    const $finalLifeCount = document.getElementById("finalLifeCount");
    const $finalHandCountText = document.getElementById("finalHandCountText");

    if ($finalLifeExp) $finalLifeExp.textContent = `${finalLife}세`;
    if ($finalValueCount) $finalValueCount.textContent = `${valueCount}종`;
    if ($finalLifeCount) $finalLifeCount.textContent = `${lifeCount}장`;
    if ($finalHandCountText) $finalHandCountText.textContent = state.hand.length;

    const categoryCounts = { "관계": 0, "성취": 0, "안정": 0, "윤리": 0, "성장": 0, "자유": 0 };
    valCards.forEach(c => {
      if (categoryCounts.hasOwnProperty(c.category)) {
        categoryCounts[c.category]++;
      }
    });

    // 기능 1: 인생 유형 칭호 & 레이더 차트 & 카드 컬렉션
    updatePersonaArchetype(categoryCounts);
    drawRadarChart("radarChartCanvas", categoryCounts);
    renderFinalHandCards();

    // 기능 2: 5턴 스토리 인포그래픽 & 딜레마 피드백
    renderInfographicTimeline();
    renderLifeDilemmaFeedback(lifeCount, valueCount);
  }

  function updatePersonaArchetype(catCounts) {
    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    const topCat = sortedCats[0][0];
    const topCount = sortedCats[0][1];

    let tag = "🌟 조화로운 탐색가";
    let title = '"균형과 깊이를 품은 삶의 항해자"';
    let desc = "다양한 삶의 가치관을 고루 지켜내며, 타인과의 대화 속에서 균형 잡힌 시각을 유지했습니다.";

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

    const $pTag = document.getElementById("personaTag");
    const $pTitle = document.getElementById("personaTitle");
    const $pDesc = document.getElementById("personaDesc");
    if ($pTag) $pTag.textContent = tag;
    if ($pTitle) $pTitle.textContent = title;
    if ($pDesc) $pDesc.textContent = desc;
  }

  function drawRadarChart(canvasId, categoryCounts) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const categories = ["관계", "성취", "안정", "윤리", "성장", "자유"];
    const values = categories.map(cat => categoryCounts[cat] || 0);
    const maxVal = Math.max(3, ...values);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 32;
    const totalSides = categories.length;

    // 배경 그리드
    for (let level = 1; level <= 3; level++) {
      const r = (radius / 3) * level;
      ctx.beginPath();
      for (let i = 0; i < totalSides; i++) {
        const angle = (Math.PI * 2 / totalSides) * i - Math.PI / 2;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 축 선 & 텍스트
    for (let i = 0; i < totalSides; i++) {
      const angle = (Math.PI * 2 / totalSides) * i - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.stroke();

      const labelX = centerX + (radius + 18) * Math.cos(angle);
      const labelY = centerY + (radius + 16) * Math.sin(angle);
      ctx.fillStyle = "#9aa3ba";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(categories[i], labelX, labelY);
    }

    // 데이터 영역
    ctx.beginPath();
    for (let i = 0; i < totalSides; i++) {
      const val = values[i];
      const r = (val / maxVal) * radius;
      const angle = (Math.PI * 2 / totalSides) * i - Math.PI / 2;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(47, 191, 166, 0.35)";
    ctx.fill();
    ctx.strokeStyle = "#2fbfa6";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    for (let i = 0; i < totalSides; i++) {
      const val = values[i];
      const r = (val / maxVal) * radius;
      const angle = (Math.PI * 2 / totalSides) * i - Math.PI / 2;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#a99bff";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function renderFinalHandCards() {
    const $container = document.getElementById("finalCardsDeck");
    if (!$container) return;

    $container.innerHTML = state.hand.map(card => {
      const isLife = card.type === "LIFE";
      return `
        <div class="final-card-chip ${isLife ? 'life' : 'value'}" title="${card.description}">
          <span>${isLife ? '♥' : '◆'}</span>
          <span>${card.name}</span>
          <span class="chip-cat">${isLife ? card.effect : card.category}</span>
        </div>
      `;
    }).join("");
  }

  function renderInfographicTimeline() {
    const $timeline = document.getElementById("infographicTimeline");
    if (!$timeline) return;

    if (!state.turnHistory.length) {
      $timeline.innerHTML = `<div style="color:var(--ink-faint); font-size:12px; text-align:center; padding:12px;">교환 기록이 없습니다.</div>`;
      return;
    }

    $timeline.innerHTML = state.turnHistory.map(h => `
      <div class="timeline-story-row">
        <div class="story-left">
          <span class="story-round-tag">${h.turn}턴</span>
          <span class="story-peer-name">👤 ${h.partner}</span>
        </div>
        <div class="story-exchange-flow">
          <span class="pill-gave">내가 줌: ${h.gave}</span>
          <span style="color:var(--ink-faint); font-weight:900;">➔</span>
          <span class="pill-received">받음: ${h.received}</span>
        </div>
      </div>
    `).join("");
  }

  function renderLifeDilemmaFeedback(lifeCount, valueCount) {
    const $title = document.getElementById("dilemmaTitle");
    const $text = document.getElementById("dilemmaText");
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
    const $successMsg = document.getElementById("successMsg");
    const $successBanner = document.getElementById("successBanner");
    if ($successMsg && $successBanner) {
      $successMsg.textContent = msg;
      $successBanner.classList.add("show");
      setTimeout(() => $successBanner.classList.remove("show"), 3500);
    }
  }

  // =========================================================
  // 14. 바로가기 및 버튼 이벤트 바인딩
  // =========================================================
  // [1] 디브리핑 테스트 바로가기 버튼
  const $btnTestDebriefDirect = document.getElementById("btnTestDebriefDirect");
  if ($btnTestDebriefDirect) {
    $btnTestDebriefDirect.addEventListener("click", () => {
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
      switchView(4);
      showToast("🧪 디브리핑 화면으로 즉시 이동했습니다!");
    });
  }

  // [2] 1:1 대화/채팅 테스트 바로가기 버튼
  const $btnTestChatDirect = document.getElementById("btnTestChatDirect");
  if ($btnTestChatDirect) {
    $btnTestChatDirect.addEventListener("click", () => {
      if (!state.hand.length) initHand();
      state.partnerName = "지우";
      state.currentTurn = 1;
      document.getElementById("dialoguePeerName").textContent = state.partnerName;
      switchView(2);
      showToast("💬 1:1 대화/채팅 테스트 화면으로 이동했습니다!");
    });
  }

  // 인게임 버튼들
  const $btnSkipInspect = document.getElementById("btnSkipInspect");
  if ($btnSkipInspect) {
    $btnSkipInspect.addEventListener("click", () => {
      publishToPair("SKIP_INSPECT", {});
      clearInterval(state.timerInterval);
      switchView(2);
    });
  }

  const $btnGoToTrade = document.getElementById("btnGoToTrade");
  if ($btnGoToTrade) {
    $btnGoToTrade.addEventListener("click", () => {
      publishToPair("SKIP_DIALOGUE", {});
      clearInterval(state.timerInterval);
      switchView(3);
    });
  }

  const $confirmGiveBtn = document.getElementById("confirmGiveBtn");
  if ($confirmGiveBtn) {
    $confirmGiveBtn.addEventListener("click", () => {
      if (state.selectedGiveCardIds.length === 0) return;
      const cardsToSend = state.hand.filter(c => state.selectedGiveCardIds.includes(c.id));
      state.mySubmittedCards = cardsToSend;

      publishToPair("SUBMIT_GIVE_CARDS", { cards: cardsToSend });
      $confirmGiveBtn.disabled = true;
      $confirmGiveBtn.textContent = "✅ 선물 확정 완료! 상대방 대기 중...";

      checkAndFinalizeTrade();
    });
  }

  const $rcConfirm = document.getElementById("receiveConfirmBtn");
  if ($rcConfirm) {
    $rcConfirm.addEventListener("click", () => {
      const $receiveModal = document.getElementById("receiveModal");
      if ($receiveModal) $receiveModal.classList.remove("show");

      state.currentTurn++;
      publishToPair("ADVANCE_NEXT_TURN", { turn: state.currentTurn });

      if (state.currentTurn <= state.totalTurns) {
        switchView(1);
      } else {
        switchView(4);
      }
    });
  }

  const $btnRestartGame = document.getElementById("btnRestartGame");
  if ($btnRestartGame) {
    $btnRestartGame.addEventListener("click", () => {
      location.reload();
    });
  }

  const $dlBtn = document.getElementById("downloadReportBtn");
  if ($dlBtn) {
    $dlBtn.addEventListener("click", () => {
      const life = document.getElementById("finalLifeExp") ? document.getElementById("finalLifeExp").textContent : "85세";
      const values = state.hand.filter(c => c.type === "VALUE").map(c => `${c.name}(${c.category})`).join(", ");
      const persona = document.getElementById("personaTitle") ? document.getElementById("personaTitle").textContent : "";
      const tag = document.getElementById("personaTag") ? document.getElementById("personaTag").textContent : "";

      const q1 = document.getElementById("reflectQ1") ? document.getElementById("reflectQ1").value.trim() : "";
      const q2 = document.getElementById("reflectQ2") ? document.getElementById("reflectQ2").value.trim() : "";
      const q3 = document.getElementById("reflectQ3") ? document.getElementById("reflectQ3").value.trim() : "";

      const content = `========================================================
🃏 메이플라이 빅게임 · 인생 가치관 디브리핑 리포트
========================================================
- 플레이어: ${state.nickname}
- 나의 인생 유형: ${tag} ${persona}
- 최종 기대수명: ${life}
- 수집한 핵심 가치관: ${values}

[📜 5턴 실시간 교환 여정 기록]
${state.turnHistory.map(h => `* ${h.turn}턴 (${h.partner} 님): [${h.gave}] 선물 ➔ [${h.received}] 수령`).join('\n')}

--------------------------------------------------------
✍️ 나를 찾는 3문 3답 성찰 질문 답변
--------------------------------------------------------
Q1. 끝까지 지켜내고 싶었던 나만의 핵심 가치관은 무엇이었나요?
답변: ${q1 || '(작성 내용 없음)'}

Q2. 상대방과의 대화 및 카드 교환 중 가장 인상 깊었던 순간은?
답변: ${q2 || '(작성 내용 없음)'}

Q3. 앞으로의 일상에서 이 가치관들을 어떻게 실천하고 싶나요?
답변: ${q3 || '(작성 내용 없음)'}
========================================================
발급일시: ${new Date().toLocaleString('ko-KR')}
`;
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `가치관_디브리핑_${state.nickname}.txt`;
      a.click();
      showToast("성찰 리포트가 저장되었습니다!");
    });
  }

  const $detailClose = document.getElementById("detailClose");
  if ($detailClose) {
    $detailClose.addEventListener("click", () => {
      const $detailModal = document.getElementById("detailModal");
      if ($detailModal) $detailModal.classList.remove("show");
    });
  }

  // 앱 시작
  switchView(0);
})();
