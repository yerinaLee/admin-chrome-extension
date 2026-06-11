# HappyTuk Admin Tool (GMTool)

CS팀 전용 유저 조회 Chrome 확장 프로그램입니다.  
Google 계정 인증 후 유저 정보, 지갑, 로그인 이력, 게임 블럭 이력을 조회할 수 있습니다.

---

## 주요 기능

- **Google OAuth 로그인** — 내부 Google 계정으로만 인증 가능
- **유저 검색** — UserNo 또는 UserName으로 유저 조회
- **유저 정보 조회** — 상태, 마지막 접속 IP, OTP 여부 확인
- **지갑 정보 조회** — 게임별 eventCoin / tukCoin / 총 잔액
- **로그인 이력 조회** — 로그인 타입, 게임, IP, 일시
- **게임 블럭 이력 조회** — 게임, 처리 어드민, IP, 일시
- **검색 기록** — 최근 검색어 최대 20개 저장 및 빠른 재검색

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 확장 프로그램 | Chrome Extension Manifest V3 |
| 인증 | Google OAuth 2.0 (`chrome.identity`) |
| UI | HTML / CSS / Vanilla JS (Side Panel) |
| 데이터 저장 | `chrome.storage.local` |
| 백엔드 | Spring (Grails) REST API |

---

## 아키텍처

```
Chrome Extension (Side Panel)
        │
        │  Bearer Token (Google OAuth)
        ▼
Spring / Grails API Server
  └─ GET /adminApi/getUserInfo?searchText=&searchType=
```

- 확장 프로그램은 Google OAuth 토큰을 발급받아 API 요청 헤더에 `Authorization: Bearer <token>` 으로 포함합니다.
- 백엔드에서 토큰을 검증하여 내부 계정 여부를 확인한 후 유저 데이터를 반환합니다.
- 401 / 403 응답 시 자동으로 로그아웃 처리됩니다.

---

## 보안

이 도구는 내부 CS팀 전용으로, 다음 3가지 계층에서 접근을 통제합니다.

### 1. 클라이언트 — Chrome Manifest `host_permissions`

`manifest.json`에 허용 도메인이 명시되어 있어, 확장 프로그램이 지정된 서버 외 임의의 주소로 API 요청을 보낼 수 없습니다.

```json
"host_permissions": [
    "http://127.0.0.1:8080/*",
    "https://*.mangot5.com/*"
]
```

### 2. 요청 — Google OAuth 2.0 Bearer Token

모든 API 요청에 Google OAuth 토큰을 포함합니다. 백엔드는 이 토큰으로 **허가된 내부 Google 계정**인지 검증하며, 미인증·만료 토큰 요청은 401/403으로 차단됩니다. 토큰 만료가 감지되면 클라이언트는 자동으로 로그아웃합니다.

### 3. 서버 — Grails 코드 내 IP 화이트리스트 검증

백엔드 Grails 코드에서 요청의 클라이언트 IP를 직접 확인합니다. 허가된 IP 대역(사내망 등)에서 보낸 요청만 처리하며, 그 외 IP는 요청 자체를 거부합니다. OAuth 인증을 통과하더라도 IP 검증을 별도로 통과해야 합니다.

```
요청 흐름:
  ┌──────────────────────────────────────────────┐
  │  Chrome Extension                            │
  │  → host_permissions 도메인만 호출 허용       │
  └──────────────────┬───────────────────────────┘
                     │ Authorization: Bearer <token>
  ┌──────────────────▼───────────────────────────┐
  │  Grails API Server                           │
  │  1) Google OAuth 토큰 유효성 검증            │
  │  2) 허가된 내부 계정 여부 확인               │
  │  3) 클라이언트 IP 화이트리스트 검증          │
  │     → 3단계 모두 통과 시에만 데이터 반환     │
  └──────────────────────────────────────────────┘
```

### 4. 프론트엔드 — XSS 방지

서버에서 받은 문자열을 `innerHTML`에 삽입할 때 `safeText()` 함수로 HTML 특수문자(`<`, `>`)를 이스케이프 처리합니다.

```js
function safeText(str) {
    if (!str) return '-';
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

---

## API 응답 구조

```json
{
  "returnCode": 1,
  "userNo": 12345,
  "userName": "홍길동",
  "userStatus": true,
  "userLastIP": "192.168.0.1",
  "isOtpUser": true,
  "userWalletList": [
    { "gameName": "...", "eventCoin": 0, "tukCoin": 0, "totalBalance": 0, "dateCreated": "..." }
  ],
  "userLoginLogList": [
    { "loginType": "...", "gameName": "...", "remoteAddr": "...", "dateCreated": "..." }
  ],
  "changeBlockList": [
    { "gameName": "...", "adminRegister": "...", "clientIP": "...", "dateCreated": "..." }
  ]
}
```

| returnCode | 의미 |
|------------|------|
| `1` | 정상 |
| `50000` | 유저 없음 |
| 그 외 | 서버 오류 |

---

## 프로젝트 구조

```
adminChrome_v1.1/
├── manifest.json     # 확장 프로그램 설정 (Manifest V3)
├── background.js     # Service Worker — 아이콘 클릭 시 사이드 패널 오픈
├── popup.html        # 사이드 패널 UI
├── popup.js          # 인증 / 검색 / 렌더링 / 검색 기록 로직
├── style.css         # 스타일
└── icons/
    └── icon.png
```

---

## 설치 방법

1. Chrome 브라우저에서 `chrome://extensions` 접속
2. 우측 상단 **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 프로젝트 폴더 선택
5. Chrome 툴바에서 확장 프로그램 아이콘 클릭 → 사이드 패널 오픈

---

## 환경 설정

`popup.js` 상단의 `API_URL` 상수를 환경에 맞게 변경합니다.

```js
// 로컬 개발
const API_URL = "http://127.0.0.1:8080/adminApi/getUserInfo";

// QA 서버
const API_URL = "https://qa-happycode.mangot5.com/adminApi/getUserInfo";
```

---

## 권한

| 권한 | 용도 |
|------|------|
| `identity` | Google OAuth 2.0 인증 |
| `storage` | 검색 기록 로컬 저장 |
| `activeTab` | 현재 탭 정보 접근 |
| `sidePanel` | 사이드 패널 UI 표시 |
| `host_permissions` | API 서버 도메인 요청 허용 |

---

## 주의 사항

- 이 확장 프로그램은 **CS팀 내부 전용**입니다. 허가된 Google 계정만 API 접근이 가능합니다.
- `manifest.json`의 `key` 및 `oauth2.client_id`는 내부 GCP 프로젝트 값입니다. 외부 공개 시 노출되지 않도록 주의하세요.
