// 跟踪扩展状态
let activeTabId = null;
let isHelperActive = false;

// 监听扩展图标点击
chrome.action.onClicked.addListener((tab) => {
  // 检查是否是可访问的页面
  if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:')) {
    if (activeTabId === tab.id && isHelperActive) {
      // 如果已经激活，则关闭
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: closeXPathHelper
      });
      isHelperActive = false;
      activeTabId = null;
    } else {
      // 否则打开
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: toggleXPathHelper
      });
      isHelperActive = true;
      activeTabId = tab.id;
    }
  } else {
    // 对于受限制的页面，显示一个通知
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon48.png',
        title: 'XPath Helper',
        message: '无法在浏览器内部页面上运行 XPath Helper'
      });
    }
  }
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'xpathHelperClosed' && sender.tab) {
    if (sender.tab.id === activeTabId) {
      isHelperActive = false;
      activeTabId = null;
    }
  }
});

// 当标签页关闭或刷新时，重置状态
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    isHelperActive = false;
    activeTabId = null;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === activeTabId && changeInfo.status === 'loading') {
    isHelperActive = false;
    activeTabId = null;
  }
});

// 这些函数会被注入到页面中执行
function toggleXPathHelper() {
  const event = new CustomEvent('toggle-xpath-helper');
  document.dispatchEvent(event);
}

function closeXPathHelper() {
  const event = new CustomEvent('close-xpath-helper');
  document.dispatchEvent(event);
}