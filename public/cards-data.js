// 마스터 카드 덱 및 게임 규칙 파라미터

const MASTER_VALUE = [
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

const MASTER_LIFE = [
  { id: "l01", type: "LIFE", name: "활력", description: "몸과 마음의 에너지가 넘치는 시간을 상징한다.", effect: "+5년" },
  { id: "l02", type: "LIFE", name: "회복", description: "위기 속에서도 다시 일어서는 힘을 상징한다.", effect: "+5년" },
  { id: "l03", type: "LIFE", name: "지혜", description: "경험에서 얻은 통찰이 삶을 지탱해준다.", effect: "+5년" },
  { id: "l04", type: "LIFE", name: "인연", description: "곁을 지켜주는 사람들이 삶을 길게 늘려준다.", effect: "+5년" },
  { id: "l05", type: "LIFE", name: "절제", description: "무리하지 않는 습관이 오랜 시간을 만든다.", effect: "+5년" },
  { id: "l06", type: "LIFE", name: "평온", description: "마음의 안정이 몸의 수명을 지켜준다.", effect: "+5년" }
];

// 게임 규칙 파라미터 (쉽게 변경 가능)
const BASE_LIFE_EXPECTANCY = 70;      // 기본 기대수명 (70세)
const YEARS_PER_LIFE_CARD = 5;       // 생명 카드 1장당 추가 수명 (+5년)
const CARD_INSPECT_SECONDS = 10;     // [요구사항] 대화 전 카드 확인 시간 (10초)
const TOTAL_TURNS = 5;               // [요구사항] 총 진행 턴 수 (임시 5턴)
const DIALOGUE_SECONDS = 60;         // 1:1 대화 제한 시간 (기본 60초)
