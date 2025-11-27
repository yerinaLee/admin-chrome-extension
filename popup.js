// 상수: API 주소 (나중에 운영 서버 주소로 변경 필요)
const API_URL = "http://localhost:8080/adminApi/getUserInfo";

document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const searchText = document.getElementById('searchText');
    const searchType = document.getElementById('searchType');

    // 엔터키 쳐도 검색되게 하기
    searchText.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchBtn.click();
    });

    searchBtn.addEventListener('click', () => {
        const query = searchText.value.trim();
        const type = searchType.value;

        if (!query) {
            showError("Please enter your search term"); // 검색어 입력해주세요
            return;
        }

        fetchData(query, type);
    });
});

async function fetchData(query, type) {
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
        const url = `${API_URL}?searchText=${encodeURIComponent(query)}&searchType=${type}`;

        // 로컬 테스트용: 토큰이 필요하면 headers에 Authorization 추가
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
                // 'Authorization': 'Bearer ...' // 인터셉터 켜져있으면 필요
            }
        });

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
    } finally {
        loading.classList.add('hidden');
    }
}

function renderData(data) {
    // 1. 기본 정보 바인딩 (보안: innerHTML 대신 textContent 사용)
    document.getElementById('resUserNo').textContent = data.userNo;
    document.getElementById('resUserName').textContent = data.userName;
    document.getElementById('resUserStatus').textContent = data.userStatus ? "Active" : "Block";
    document.getElementById('resUserLastIP').textContent = data.userLastIP || "-";
    document.getElementById('resOtp').textContent = data.isOtpUser;

    // 스타일링: 상태가 false(Block)면 빨간색 표시
    const statusElem = document.getElementById('resUserStatus');
    statusElem.style.color = data.userStatus ? "green" : "red";
    statusElem.style.fontWeight = "bold";

    // 2. 지갑 리스트 렌더링
    const walletBody = document.getElementById('walletBody');
    if (data.userWalletList && data.userWalletList.length > 0) {
        data.userWalletList.forEach(w => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${safeText(w.gameName)}</td>
                <td>${w.eventCoin?.toLocaleString()}</td>
                <td>${w.tukCoin?.toLocaleString()}</td>
                <td>${w.totalBalance?.toLocaleString()}</td>
                <td>${safeText(w.dateCreated)}</td>
                `;
            walletBody.appendChild(row);
        });
    } else {
        walletBody.innerHTML = '<tr><td colspan="4" style="text-align:center">No data</td></tr>';
    }

    // 3. 로그인 로그 렌더링
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

    // 4. Game Block 로그 렌더링
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

    // 결과 영역 보이기
    document.getElementById('resultArea').classList.remove('hidden');
}

// 유틸: 테이블 초기화
function clearTables() {
    document.getElementById('walletBody').innerHTML = '';
    document.getElementById('loginBody').innerHTML = '';
    document.getElementById('blockBody').innerHTML = '';
}

// 유틸: 에러 표시
function showError(msg) {
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
}

// 유틸: XSS 방지를 위한 텍스트 처리 (null/undefined 방어 포함)
function safeText(str) {
    if (!str) return '-';
    // HTML 태그가 들어와도 텍스트로 렌더링되게 처리하는 것이 좋음
    // 여기서는 간단히 문자열 변환만 하지만, innerHTML에 넣을 땐 주의 필요
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}