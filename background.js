chrome.action.onClicked.addListener((tab) => {
    // 아이콘 클릭 시 현재 탭에서 사이드 패널 열기
    chrome.sidePanel.open({ windowId: tab.windowId });
});