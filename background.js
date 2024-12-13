// Listen for extension icon click
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleSidePanel') {
        chrome.sidePanel.open({ tabId: sender.tab.id });
    }
    
    if (message.action === 'saveHighlight') {
        chrome.storage.local.get('highlights', (result) => {
            const highlights = result.highlights || [];
            highlights.push(message.highlight);
            chrome.storage.local.set({ highlights });
        });
    }
});

// Set default icon using emoji
function setDefaultIcon() {
  const canvas = new OffscreenCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  
  ctx.font = '80px Arial';
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✨', 64, 64);
  
  // Create icons for different sizes
  const imageData = ctx.getImageData(0, 0, 128, 128);
  
  // Set the extension icon
  chrome.action.setIcon({
    imageData: {
      48: ctx.getImageData(0, 0, 48, 48),
      128: imageData
    }
  });
}

// Set icon when extension loads
setDefaultIcon(); 

chrome.runtime.onInstalled.addListener(() => {
    // Initialize storage
    chrome.storage.local.get('highlights', (result) => {
        if (!result.highlights) {
            chrome.storage.local.set({ highlights: [] });
        }
    });
});