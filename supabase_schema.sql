-- 1. 채팅 메시지 저장 테이블 생성
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  room_code VARCHAR(10),        -- 방 코드 (예: 7482)
  sender_name VARCHAR(50),      -- 보낸 사람 닉네임 (예: 찬우)
  message TEXT,                 -- 대화 내용
  created_at TIMESTAMPTZ DEFAULT NOW() -- 보낸 시간
);

-- 2. 웹에서 메시지 저장 및 조회가 가능하도록 권한 허용
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert messages" ON messages;
CREATE POLICY "Allow public insert messages" ON messages FOR INSERT TO anon WITH CHECK현재 작성된 클라이언트 코드(`script.js`)의 `sendUserChat` 함수에는 사용자가 메시지를 보낼 때마다 데이터베이스의 `messages` 테이블로 즉시 저장하도록 이미 연동 코드가 작성되어 있습니다.

DROP TABLE IF EXISTS rooms CASCADE;

CREATE TABLE rooms (
  id BIGSERIAL PRIMARY KEY,
  room_code VARCHAR(10) UNIQUE NOT NULL,
  title VARCHAR(100) NOT NULL,
  host_name VARCHAR(50) NOT NULL,
  min_players INT DEFAULT 2,
  max_players INT DEFAULT 8,
  current_players INT DEFAULT 1,
  is_private BOOLEAN DEFAULT FALSE,
  password VARCHAR(10),
  status VARCHAR(20) DEFAULT 'WAITING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE rooms TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';