let isActive = false;
let panel = null;
let highlightedElements = [];

// 监听来自背景脚本的切换事件
document.addEventListener('toggle-xpath-helper', function() {
  if (isActive) {
    hideXPathHelper();
  } else {
    showXPathHelper();
  }
  isActive = !isActive;
});

// 监听来自背景脚本的关闭事件
document.addEventListener('close-xpath-helper', function() {
  if (isActive) {
    hideXPathHelper();
    isActive = false;
  }
});

// 显示XPath助手面板
function showXPathHelper() {
  // 创建面板
  panel = document.createElement('div');
  panel.id = 'xpath-helper-panel';
  panel.innerHTML = `
    <div class="xpath-helper-header">
      <span>XPath Helper</span>
      <button id="xpath-helper-close">×</button>
    </div>
    <div class="xpath-helper-content">
      <div class="xpath-helper-input-group">
        <input type="text" id="xpath-expression" placeholder="输入XPath表达式...">
      </div>
      <div class="xpath-helper-results">
        <div id="xpath-matches">匹配: 0</div>
        <div id="xpath-result"></div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // 添加事件监听器 - 使用直接函数而不是引用
  document.getElementById('xpath-helper-close').addEventListener('click', function() {
    hideXPathHelper();
    isActive = false;
    // 通知背景脚本状态已更改
    try {
      chrome.runtime.sendMessage({ action: 'xpathHelperClosed' });
    } catch (e) {
      console.error('无法发送消息到背景脚本:', e);
    }
  });
  
  // 实时评估XPath表达式
  const xpathInput = document.getElementById('xpath-expression');
  xpathInput.addEventListener('input', debounce(evaluateXPath, 300));
}

// 隐藏XPath助手面板
function hideXPathHelper() {
  if (panel) {
    panel.remove();
    panel = null;
  }
  clearHighlights();
}

// 评估XPath表达式
function evaluateXPath() {
  clearHighlights();
  
  const expression = document.getElementById('xpath-expression').value;
  if (!expression) return;
  
  try {
    const result = document.evaluate(
      expression,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    
    const matchCount = result.snapshotLength;
    document.getElementById('xpath-matches').textContent = `匹配: ${matchCount}`;
    
    const resultContainer = document.getElementById('xpath-result');
    resultContainer.innerHTML = '';
    
    if (matchCount > 0) {
      for (let i = 0; i < matchCount; i++) {
        const node = result.snapshotItem(i);
        highlightElement(node);
        
        // 添加结果到结果面板
        const resultItem = document.createElement('div');
        resultItem.classList.add('xpath-result-item');
        
        if (node.nodeType === Node.ELEMENT_NODE) {
          resultItem.textContent = getElementDescription(node);
        } else if (node.nodeType === Node.TEXT_NODE) {
          resultItem.textContent = `文本: "${node.textContent.trim().substring(0, 50)}${node.textContent.trim().length > 50 ? '...' : ''}"`;
        } else {
          resultItem.textContent = `节点类型: ${node.nodeType}`;
        }
        
        resultContainer.appendChild(resultItem);
      }
    } else {
      resultContainer.textContent = '没有匹配的节点';
    }
  } catch (error) {
    document.getElementById('xpath-matches').textContent = '错误';
    document.getElementById('xpath-result').textContent = error.message;
  }
}

// 获取元素的描述
function getElementDescription(element) {
  let description = element.tagName.toLowerCase();
  
  if (element.id) {
    description += `#${element.id}`;
  }
  
  if (element.className && typeof element.className === 'string') {
    description += `.${element.className.replace(/\s+/g, '.')}`;
  }
  
  return description;
}

// 高亮显示元素
function highlightElement(element) {
  if (element.nodeType !== Node.ELEMENT_NODE) return;
  
  const originalStyles = {
    outline: element.style.outline,
    backgroundColor: element.style.backgroundColor
  };
  
  element.style.outline = '2px solid red';
  element.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
  
  highlightedElements.push({
    element: element,
    originalStyles: originalStyles
  });
}

// 清除所有高亮
function clearHighlights() {
  highlightedElements.forEach(item => {
    item.element.style.outline = item.originalStyles.outline;
    item.element.style.backgroundColor = item.originalStyles.backgroundColor;
  });
  
  highlightedElements = [];
}

// 添加防抖函数，避免频繁执行评估
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}