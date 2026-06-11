// 상수: API 주소 (나중에 운영 서버 주소로 변경 필요)
// const API_URL = "http://127.0.0.1:8080/adminApi/getUserInfo";
var prefix = '';
const API_URL   = "/adminApi/getUserInfo";

let userToken = null; // 구글 토큰 저장


/* ========================== 초기화 ========================== */
document.addEventListener('DOMContentLoaded', () => {
    // 1. 초기화: 로그인 상태 체크
    checkLoginStatus();

    // 2. 로그인 버튼 이벤트
    document.getElementById('googleLoginBtn').addEventListener('click', handleLogin);

    // 3. 로그아웃 버튼 이벤트
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // 4. 검색 관련 이벤트
    const searchBtn = document.getElementById('searchBtn');
    const searchText = document.getElementById('searchText');

    searchText.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchBtn.click();
    });

    searchBtn.addEventListener('click', () => {
        const query = searchText.value.trim();
        const type = document.getElementById('searchType').value;

        if (!query) {
            showError("Please enter your search term"); // 검색어를 입력하세요!
            return;
        }
        fetchData(query, type);
        // document.getElementById('searchText').value='';
    });

    // 5. 검색목록 관련
    chrome.storage.local.get(['searchHistory'], (result) => {
        if (result.searchHistory) {
            renderHistoryUI(result.searchHistory);
        }
    });

    // 검색목록 삭제
    document.getElementById('deleteSearchHistoryBtn').addEventListener('click', deleteAllSearchHistory);

});
/* ========================== 초기화 끝 ========================== */




/* ========================== Google 인증(Auth) 로직 ========================== */
// 앱 켜질 때 로그인 여부 확인 (비대화형)
function checkLoginStatus() {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError || !token) {
            showLoginScreen();
        } else {
            userToken = token;
            // 토큰 정보로 이메일 가져오기
            fetchUserInfo(token);
            showMainScreen();
        }
    });
}

// 로그인 버튼 클릭 시 (대화형 팝업)
function handleLogin() {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError || !token) {
            const errorElem = document.getElementById('loginErrorMsg');
            errorElem.textContent = "Login Failed: " + chrome.runtime.lastError.message;
            errorElem.classList.remove('hidden');
            return;
        }
        userToken = token;
        fetchUserInfo(token);
        showMainScreen();
    });
}

// 로그아웃 (토큰 제거)
function handleLogout() {
    if (!userToken) {
        showLoginScreen();
        return;
    }

    // 1. 구글 서버에 토큰 폐기 요청 (Revoke)
    // 이걸 해야 다음에 로그인할 때 계정 선택/승인 창이 다시 뜹니다.
    const revokeUrl = 'https://accounts.google.com/o/oauth2/revoke?token=' + userToken;

    window.fetch(revokeUrl).then(() => {
        // 2. 크롬 브라우저 캐시에서 토큰 삭제
        chrome.identity.removeCachedAuthToken({ token: userToken }, () => {
            // 3. 로컬 변수 및 UI 초기화
            userToken = null;
            document.getElementById('userEmailDisplay').textContent = ''; // 이메일 표시 지우기

            // 입력했던 검색어들도 삭제
            document.getElementById('searchText').value = '';

            // 개별 검색 유저 정보 삭제
            clearTables();
            resultArea.classList.add('hidden');
            errorMsg.classList.add('hidden');

            // 유저검색 히스토리 정보 지우기
            document.getElementById('historyContainer').innerHTML = '';

            // storage에서 유저 검색목록 제거
            deleteAllSearchHistory();

            showLoginScreen();
        });
    }).catch(err => {
        // 네트워크 오류 등으로 revoke가 실패해도, 일단 로컬에선 로그아웃 처리
        console.error("Revoke failed", err);
        userToken = null;
        showLoginScreen();
    });
}

// 구글 API로 이메일 가져와서 화면에 표시 (UI용)
async function fetchUserInfo(token) {
    try {
        const res = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.email) {
            document.getElementById('userEmailDisplay').textContent = data.email;
        }
    } catch (e) {
        console.error("Failed to fetch user info", e);
    }
}
/* ========================== Google 인증(Auth) 로직 끝========================== */






/* ========================== user 정보 조회 로직 ========================== */

async function fetchData(query, type) {

    addSearchHistory(query, type)

    const loading = document.getElementById('loading');
    const resultArea = document.getElementById('resultArea');
    const errorMsg = document.getElementById('errorMsg');

    // 초기화
    loading.classList.remove('hidden');
    resultArea.classList.add('hidden');
    errorMsg.classList.add('hidden');
    clearTables();

    try {
        // API 호출 (GET 방식)
        var env = document.getElementById("chooseEnv").value;
        if(env == 'LIVE') {
            prefix = "https://off.mangot5.com"
        } else {
            prefix = "https://qa-happycode.mangot5.com"
        }

        const url = `${prefix}${API_URL}?searchText=${encodeURIComponent(query)}&searchType=${type}`;

        // 로컬 테스트용: 토큰이 필요하면 headers에 Authorization 추가
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}` // 구글 토큰을 헤더에 실어서 백엔드로 전송
            }
        });

        // 401, 403 : 인증에러
        if (response.status === 401 || response.status === 403) {
            const errData = await response.json();
            throw new Error(errData.msg || "Access Denied (Unauthorized)");
        }

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();

        // 서버 로직상의 에러 체크 (returnCode)
        if (data.returnCode == 50000) {
            throw new Error("not found user");
        } else if (data.returnCode !== 1) {
            throw new Error("error. please try again");
        }

        renderData(data);

    } catch (error) {
        showError(error.message);

        // 토큰 만료 에러인 경우 로그아웃 처리
        if (error.message.includes("Invalid Token")) {
            handleLogout();
        }
    } finally {
        loading.classList.add('hidden');
    }
}

function renderData(data) {
    // 1. 기본 정보 바인딩
    document.getElementById('resUserNo').textContent = data.userNo || data.user?.id || '-';
    document.getElementById('resUserName').textContent = data.userName || data.user?.username || '-';

    // 데이터 구조에 따라 data.userStatus 또는 data.user.status 확인
    const statusText = (data.userStatus || data.user?.status) ? "Active" : "Block";
    document.getElementById('resUserStatus').textContent = statusText;

    document.getElementById('resUserLastIP').textContent = data.userLastIP || data.user?.lastIp || "-";
    document.getElementById('resOtp').textContent = data.isOtpUser;

    const statusElem = document.getElementById('resUserStatus');
    statusElem.style.color = (statusText === "Active") ? "green" : "red";
    statusElem.style.fontWeight = "bold";

    // 2. Wallet
    const walletBody = document.getElementById('walletBody');
    if (data.userWalletList && data.userWalletList.length > 0) {
        data.userWalletList.forEach(w => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${safeText(w.gameName)}</td>
                <td>${(w.eventCoin || 0).toLocaleString()}</td>
                <td>${(w.tukCoin || 0).toLocaleString()}</td>
                <td>${(w.totalBalance || 0).toLocaleString()}</td>
                <td>${safeText(w.dateCreated)}</td>
            `;
            walletBody.appendChild(row);
        });
    } else {
        walletBody.innerHTML = '<tr><td colspan="5" style="text-align:center">No data</td></tr>';
    }

    // 3. Login Log
    const loginBody = document.getElementById('loginBody');
    if (data.userLoginLogList && data.userLoginLogList.length > 0) {
        data.userLoginLogList.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${safeText(log.loginType)}</td>
                <td>${safeText(log.gameName)}</td>
                <td>${safeText(log.remoteAddr)}</td>
                <td>${safeText(log.dateCreated)}</td>
            `;
            loginBody.appendChild(row);
        });
    } else {
        loginBody.innerHTML = '<tr><td colspan="4" style="text-align:center">No data</td></tr>';
    }

    // 4. Block Log
    const blockBody = document.getElementById('blockBody');
    if (data.changeBlockList && data.changeBlockList.length > 0) {
        data.changeBlockList.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${safeText(log.gameName)}</td>
                <td>${safeText(log.adminRegister)}</td>
                <td>${safeText(log.clientIP)}</td>
                <td>${safeText(log.dateCreated)}</td>
            `;
            blockBody.appendChild(row);
        });
    } else {
        blockBody.innerHTML = '<tr><td colspan="4" style="text-align:center">No data</td></tr>';
    }

    resultArea.classList.remove('hidden');
}

/* ========================== user 정보 조회 로직 끝 ========================== */




/* ====================== 유저 검색 목록 관련 메서드 ====================== */
function addSearchHistory(query, type) {
    chrome.storage.local.get(['searchHistory'], (result) => {
        let history = result.searchHistory || []; // 검색목록 없으면 빈배열

        // 중복인경우 추가하지않음
        const exist = history.some(
            item => item.query === query && item.type === type
        );

        if (exist) return;

        // 중복제거
        // history = history.filter(item => !(item.query === query && item.type === type));

        // 목록 맨 앞에 추가
        history.unshift({ query, type });

        // 최대 저장목록 : 20
        if (history.length > 20) {
            history.pop();
        }

        chrome.storage.local.set({ searchHistory: history }, () => {
            renderHistoryUI(history); // 검색목록 화면 갱신
        })
    })
}

// 검색목록 제거
function deleteSearchHistory(query, type) {
    chrome.storage.local.get(['searchHistory'], (result) => {
        let history = result.searchHistory || []; // 검색목록 없으면 빈배열

        // 중복제거
        history = history.filter(item => !(item.query === query && item.type === type));

        chrome.storage.local.set({ searchHistory: history }, () => {
            renderHistoryUI(history); // 검색목록 화면 갱신
        })
    })
}

function deleteAllSearchHistory() {
    chrome.storage.local.remove('searchHistory', () => {
        document.getElementById('historyContainer').innerHTML = '';
    })
}

function renderHistoryUI(historyList) {
    const container = document.getElementById('historyContainer');
    container.innerHTML = '';

    if (historyList.length === 0) return;

    historyList.forEach(item => {

        const wrapper = document.createElement('span');
        wrapper.className = 'history-item-wrapper';

        const textBtn = document.createElement('span');
        textBtn.className = 'history-text-item';
        textBtn.textContent = `${item.query}(${item.type === 'id' ? 'ID' : 'Name'})`;
        textBtn.title = 'Click to search again';

        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'delete-history-text-item';
        deleteBtn.textContent = `X`

        // 3. 클릭 이벤트 (fetchData 호출)
        textBtn.addEventListener('click', () => {
            document.getElementById('searchText').value = item.query;
            document.getElementById('searchType').value = item.type;
            fetchData(item.query, item.type);
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSearchHistory(item.query, item.type);
        })

        wrapper.appendChild(textBtn);
        wrapper.appendChild(deleteBtn);


        container.appendChild(wrapper);
    });
}
/* ====================== 유저 검색 목록 관련 메서드 끝 ====================== */






/* ====================== UI 관련 메서드 ====================== */
// 테이블 초기화
function clearTables() {
    document.querySelectorAll('#resultArea td').forEach(td => {
        td.textContent = '';
    });

    document.getElementById('walletBody').innerHTML = '';
    document.getElementById('loginBody').innerHTML = '';
    document.getElementById('blockBody').innerHTML = '';
}

function showLoginScreen() {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('mainSection').classList.add('hidden');
}

function showMainScreen() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('mainSection').classList.remove('hidden');
}
/* ====================== UI 관련 메서드끝 ====================== */






/* ====================== 유틸 ====================== */
// 에러 표시
function showError(msg) {
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
}

// XSS 방지를 위한 텍스트 처리 (null/undefined 방어 포함)
function safeText(str) {
    if (!str) return '-';
    // HTML 태그가 들어와도 텍스트로 렌더링되게 처리하는 것이 좋음
    // 여기서는 간단히 문자열 변환만 하지만, innerHTML에 넣을 땐 주의 필요
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/* ====================== 유틸 끝 ====================== */