// Setup para testes Jest com jsdom
document.body.innerHTML = `
  <div id="welcomeScreen"></div>
  <div id="titleSection"></div>
  <div id="chatArea" class="flex-1 overflow-y-auto"></div>
  <div id="messagesContainer"></div>
  <textarea id="userInput"></textarea>
  <button id="sendButton"></button>
  <button id="newChatBtn"></button>
  <div id="chatHistoryList"></div>
  <button id="modelButton"></button>
  <div id="modelDropdown"></div>
  <span id="modelButtonText"></span>
  <button id="scrollToBottomBtn"></button>
  <button id="debugModeButton"></button>
  <div id="attachedFilesContainer"></div>
`;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;

// Mock hljs
global.hljs = {
  highlightElement: jest.fn(),
  highlightAll: jest.fn()
};
