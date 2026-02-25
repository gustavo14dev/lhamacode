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
const localStorageMock = (function() {
    let store = {};
    return {
        getItem: function(key) {
            return store[key] || null;
        },
        setItem: function(key, value) {
            store[key] = value.toString();
        },
        removeItem: function(key) {
            delete store[key];
        },
        clear: function() {
            store = {};
        }
    };
})();
Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

// Mock scrollTo
window.HTMLElement.prototype.scrollTo = jest.fn();

// Mock hljs
global.hljs = {
  highlightElement: jest.fn(),
  highlightAll: jest.fn()
};
