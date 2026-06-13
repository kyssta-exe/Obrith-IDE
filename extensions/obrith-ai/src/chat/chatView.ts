import * as vscode from 'vscode';

export function getChatHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = getNonce();

  return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <title>Obrith AI Chat</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBarSectionHeader-background);
      flex-shrink: 0;
    }

    .header-title {
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .zigma-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      cursor: pointer;
    }

    .zigma-badge.off {
      opacity: 0.5;
    }

    .zigma-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #4ade80;
    }

    .zigma-badge.off .zigma-dot {
      background: var(--vscode-disabledForeground);
    }

    .model-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }

    .model-bar label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .model-bar select {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      padding: 2px 4px;
      font-size: 11px;
      font-family: var(--vscode-font-family);
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      display: flex;
      flex-direction: column;
      max-width: 90%;
      animation: fadeIn 0.2s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message.user {
      align-self: flex-end;
    }

    .message.assistant {
      align-self: flex-start;
    }

    .message-label {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .message.user .message-label {
      text-align: right;
    }

    .message-bubble {
      padding: 10px 14px;
      border-radius: 8px;
      line-height: 1.5;
      font-size: 13px;
      word-wrap: break-word;
      white-space: pre-wrap;
    }

    .message.user .message-bubble {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-bottom-right-radius: 2px;
    }

    .message.assistant .message-bubble {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-bottom-left-radius: 2px;
    }

    .message-bubble code {
      background: rgba(127, 127, 127, 0.2);
      padding: 1px 4px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
    }

    .message-bubble pre {
      background: var(--vscode-textBlockQuote-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 8px 10px;
      margin: 6px 0;
      overflow-x: auto;
      position: relative;
    }

    .message-bubble pre code {
      background: none;
      padding: 0;
      font-size: 12px;
      line-height: 1.4;
    }

    .copy-btn {
      position: absolute;
      top: 4px;
      right: 4px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 10px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .message-bubble pre:hover .copy-btn {
      opacity: 1;
    }

    .task-badge {
      display: inline-block;
      font-size: 9px;
      padding: 1px 6px;
      border-radius: 8px;
      background: rgba(124, 58, 237, 0.2);
      color: #a78bfa;
      margin-top: 4px;
    }

    .streaming-cursor {
      display: inline-block;
      width: 2px;
      height: 14px;
      background: var(--vscode-foreground);
      animation: blink 1s step-end infinite;
      vertical-align: text-bottom;
      margin-left: 1px;
    }

    @keyframes blink {
      50% { opacity: 0; }
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--vscode-descriptionForeground);
      gap: 12px;
      padding: 24px;
      text-align: center;
    }

    .empty-state-icon {
      font-size: 32px;
      opacity: 0.5;
    }

    .empty-state-text {
      font-size: 13px;
      line-height: 1.6;
    }

    .input-area {
      padding: 10px 12px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex-shrink: 0;
    }

    .input-wrapper {
      flex: 1;
      position: relative;
    }

    .input-wrapper textarea {
      width: 100%;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      padding: 8px 10px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      resize: none;
      outline: none;
      min-height: 36px;
      max-height: 150px;
      line-height: 1.4;
    }

    .input-wrapper textarea:focus {
      border-color: var(--vscode-focusBorder);
    }

    .send-btn {
      width: 36px;
      height: 36px;
      border-radius: 6px;
      border: none;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.15s;
    }

    .send-btn:hover {
      opacity: 0.9;
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .send-btn svg {
      width: 16px;
      height: 16px;
    }

    .error-text {
      color: var(--vscode-errorForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="header-title">Obrith AI</span>
    <div class="zigma-badge" id="zigmaBadge" title="Toggle Zigma Mode">
      <span class="zigma-dot"></span>
      <span id="zigmaLabel">Zigma</span>
    </div>
  </div>

  <div class="model-bar">
    <label>Model:</label>
    <select id="modelSelect">
      <option value="">Auto (Zigma)</option>
    </select>
  </div>

  <div class="messages" id="messages">
    <div class="empty-state" id="emptyState">
      <div class="empty-state-icon">⚡</div>
      <div class="empty-state-text">
        Ask me anything about your code.<br>
        <small>Zigma Mode auto-selects the best model for each task.</small>
      </div>
    </div>
  </div>

  <div class="input-area">
    <div class="input-wrapper">
      <textarea id="input" placeholder="Ask about your code..." rows="1"></textarea>
    </div>
    <button class="send-btn" id="sendBtn" title="Send (Enter)">
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path d="M2.5 2.5l11 5.5-11 5.5 1.5-5.5L2.5 2.5z"/>
      </svg>
    </button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    const modelSelect = document.getElementById('modelSelect');
    const zigmaBadge = document.getElementById('zigmaBadge');
    const zigmaLabel = document.getElementById('zigmaLabel');
    const emptyState = document.getElementById('emptyState');

    let zigmaMode = true;
    let isStreaming = false;
    let currentAssistantEl = null;
    let currentContent = '';

    // Auto-resize textarea
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + 'px';
    });

    // Send on Enter (Shift+Enter for newline)
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);

    zigmaBadge.addEventListener('click', () => {
      zigmaMode = !zigmaMode;
      zigmaBadge.classList.toggle('off', !zigmaMode);
      zigmaLabel.textContent = zigmaMode ? 'Zigma' : 'Manual';
      vscode.postMessage({ type: 'toggleZigma', enabled: zigmaMode });
    });

    modelSelect.addEventListener('change', () => {
      vscode.postMessage({ type: 'selectModel', model: modelSelect.value });
    });

    function sendMessage() {
      const text = inputEl.value.trim();
      if (!text || isStreaming) return;

      if (emptyState) {
        emptyState.remove();
      }

      // Add user message
      addMessage('user', text);
      inputEl.value = '';
      inputEl.style.height = 'auto';

      // Start assistant message
      currentContent = '';
      currentAssistantEl = addMessage('assistant', '', true);
      isStreaming = true;
      sendBtn.disabled = true;

      vscode.postMessage({
        type: 'chat',
        message: text,
        model: modelSelect.value || undefined,
      });
    }

    function addMessage(role, content, streaming = false) {
      const msgEl = document.createElement('div');
      msgEl.className = 'message ' + role;

      const labelEl = document.createElement('div');
      labelEl.className = 'message-label';
      labelEl.textContent = role === 'user' ? 'You' : 'AI';
      msgEl.appendChild(labelEl);

      const bubbleEl = document.createElement('div');
      bubbleEl.className = 'message-bubble';
      bubbleEl.innerHTML = content ? formatContent(content) : (streaming ? '<span class="streaming-cursor"></span>' : '');
      msgEl.appendChild(bubbleEl);

      messagesEl.appendChild(msgEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      return bubbleEl;
    }

    function formatContent(text) {
      // Simple markdown: code blocks, inline code, bold
      let html = escapeHtml(text);

      // Code blocks
      html = html.replace(/\`\`\`(\w*)\n([\s\S]*?)\`\`\`/g, (match, lang, code) => {
        return '<pre><code class="language-' + lang + '">' + code.trim() + '</code><button class="copy-btn" onclick="copyCode(this)">Copy</button></pre>';
      });

      // Inline code
      html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');

      // Bold
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

      return html;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function copyCode(btn) {
      const code = btn.parentElement.querySelector('code');
      navigator.clipboard.writeText(code.textContent);
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    }

    // Handle messages from extension
    window.addEventListener('message', (event) => {
      const msg = event.data;

      switch (msg.type) {
        case 'token':
          currentContent += msg.content;
          if (currentAssistantEl) {
            currentAssistantEl.innerHTML = formatContent(currentContent) + '<span class="streaming-cursor"></span>';
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
          break;

        case 'done':
          if (currentAssistantEl) {
            currentAssistantEl.innerHTML = formatContent(currentContent);
            if (msg.taskType) {
              const badge = document.createElement('div');
              badge.className = 'task-badge';
              badge.textContent = msg.taskType;
              currentAssistantEl.parentElement.appendChild(badge);
            }
          }
          currentAssistantEl = null;
          currentContent = '';
          isStreaming = false;
          sendBtn.disabled = false;
          inputEl.focus();
          break;

        case 'error':
          if (currentAssistantEl) {
            currentAssistantEl.innerHTML = '<span class="error-text">' + escapeHtml(msg.content) + '</span>';
          }
          currentAssistantEl = null;
          currentContent = '';
          isStreaming = false;
          sendBtn.disabled = false;
          break;

        case 'providers':
          modelSelect.innerHTML = '<option value="">Auto (Zigma)</option>';
          msg.providers.forEach((p) => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p.charAt(0).toUpperCase() + p.slice(1);
            modelSelect.appendChild(opt);
          });
          break;

        case 'zigmaState':
          zigmaMode = msg.enabled;
          zigmaBadge.classList.toggle('off', !zigmaMode);
          zigmaLabel.textContent = zigmaMode ? 'Zigma' : 'Manual';
          break;
      }
    });

    // Request initial state
    vscode.postMessage({ type: 'init' });
  </script>
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
