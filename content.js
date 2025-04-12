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
// 在 showXPathHelper 函数中添加刷新按钮
function showXPathHelper() {
  // 创建面板
  panel = document.createElement('div');
  panel.id = 'xpath-helper-panel';
  panel.innerHTML = `
    <div class="xpath-helper-header">
      <div class="xpath-helper-header-section">
        <div class="xpath-helper-header-label">QUERY</div>
        <button class="xpath-helper-refresh">刷新</button>
      </div>
      <div class="xpath-helper-header-section">
        <div class="xpath-helper-header-label">RESULTS</div>
        <div class="xpath-helper-result-count">(0)</div>
      </div>
      <button class="xpath-helper-close">×</button>
    </div>
    <div class="xpath-helper-content">
      <div class="xpath-helper-query-section">
        <textarea id="xpath-expression" placeholder="//div[@class='']"></textarea>
      </div>
      <div class="xpath-helper-results-section">
        <div class="xpath-helper-results">
          <div id="xpath-result"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // 确保面板在最顶层
  panel.style.zIndex = '2147483647';

  // 添加事件监听器
  document.querySelector('.xpath-helper-close').addEventListener('click', function(e) {
    e.stopPropagation(); // 阻止事件冒泡
    hideXPathHelper();
    isActive = false;
    // 通知背景脚本状态已更改
    try {
      chrome.runtime.sendMessage({ action: 'xpathHelperClosed' });
    } catch (e) {
      console.error('无法发送消息到背景脚本:', e);
    }
  });
  
  // 添加刷新按钮事件监听器
  document.querySelector('.xpath-helper-refresh').addEventListener('click', function(e) {
    e.stopPropagation();
    evaluateXPath();
  });
  
  // 防止点击面板时触发页面上的其他事件
  panel.addEventListener('click', function(e) {
    e.stopPropagation();
  });
  
  // 实时评估XPath表达式
  const xpathInput = document.getElementById('xpath-expression');
  xpathInput.addEventListener('input', debounce(evaluateXPath, 300));
  xpathInput.addEventListener('click', function(e) {
    e.stopPropagation(); // 阻止事件冒泡
  });
  
  // 初始聚焦到输入框
  setTimeout(() => {
    xpathInput.focus();
  }, 100);
  
  // 设置定期重新评估，以捕获动态变化的DOM
  startPeriodicEvaluation();
}

// 添加一个定期重新评估的功能
let evaluationInterval = null;

function startPeriodicEvaluation() {
  // 清除可能存在的旧定时器
  if (evaluationInterval) {
    clearInterval(evaluationInterval);
  }
  
  // 每2秒重新评估一次XPath表达式，以捕获动态变化的DOM
  evaluationInterval = setInterval(() => {
    if (isActive && document.getElementById('xpath-expression').value) {
      evaluateXPath();
    }
  }, 2000);
}

function hideXPathHelper() {
  if (panel) {
    panel.remove();
    panel = null;
  }
  clearHighlights();
  
  // 清除定期评估的定时器
  if (evaluationInterval) {
    clearInterval(evaluationInterval);
    evaluationInterval = null;
  }
}

// 修改评估XPath函数，使其能够处理动态内容
function evaluateXPath() {
  clearHighlights();
  
  const expression = document.getElementById('xpath-expression').value;
  if (!expression) {
    document.querySelector('.xpath-helper-result-count').textContent = '(0)';
    document.getElementById('xpath-result').innerHTML = '';
    return;
  }
  
  try {
    // 使用更高级的方法来评估XPath，确保能捕获最新的DOM变化
    const result = document.evaluate(
      expression,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    
    const matchCount = result.snapshotLength;
    document.querySelector('.xpath-helper-result-count').textContent = `(${matchCount})`;
    
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
          // 为结果项添加更详细的信息
          let description = getElementDescription(node);
          
          // 添加文本内容预览（如果有）
          if (node.textContent && node.textContent.trim()) {
            description += ` - "${node.textContent.trim().substring(0, 30)}${node.textContent.trim().length > 30 ? '...' : ''}"`;
          }
          
          resultItem.textContent = description;
          
          // 添加点击事件，点击结果项时滚动到对应元素
          resultItem.addEventListener('click', function() {
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 临时增强高亮效果
            const originalOutline = node.style.outline;
            node.style.outline = '3px solid yellow';
            setTimeout(() => {
              node.style.outline = originalOutline;
            }, 1500);
          });
          resultItem.style.cursor = 'pointer';
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
    document.querySelector('.xpath-helper-result-count').textContent = '(错误)';
    document.getElementById('xpath-result').textContent = error.message;
  }
}

// 改进高亮元素函数，使其更明显
function highlightElement(element) {
  if (element.nodeType !== Node.ELEMENT_NODE) return;
  
  // 保存原始样式
  const originalStyles = {
    outline: element.style.outline,
    outlineOffset: element.style.outlineOffset,
    backgroundColor: element.style.backgroundColor,
    position: element.style.position,
    zIndex: element.style.zIndex,
    transition: element.style.transition
  };
  
  // 应用高亮样式
  element.style.outline = '2px solid red';
  element.style.outlineOffset = '1px';
  element.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
  element.style.transition = 'outline 0.3s, background-color 0.3s';
  
  // 如果元素是相对定位或静态定位，修改为相对定位以确保高亮效果可见
  if (getComputedStyle(element).position === 'static') {
    element.style.position = 'relative';
  }
  
  // 提高元素的 z-index 以确保可见
  const currentZIndex = getComputedStyle(element).zIndex;
  if (currentZIndex === 'auto' || parseInt(currentZIndex) < 1000) {
    element.style.zIndex = '1000';
  }
  
  highlightedElements.push({
    element: element,
    originalStyles: originalStyles
  });
}

// 清除所有高亮
function clearHighlights() {
  highlightedElements.forEach(item => {
    // 恢复原始样式
    item.element.style.outline = item.originalStyles.outline;
    item.element.style.outlineOffset = item.originalStyles.outlineOffset;
    item.element.style.backgroundColor = item.originalStyles.backgroundColor;
    item.element.style.position = item.originalStyles.position;
    item.element.style.zIndex = item.originalStyles.zIndex;
  });
  
  highlightedElements = [];
}

// 隐藏XPath助手面板
function hideXPathHelper() {
  if (panel) {
    panel.remove();
    panel = null;
  }
  clearHighlights();
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