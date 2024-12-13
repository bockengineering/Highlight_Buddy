let highlightButton = null;

// Create highlight button
function createHighlightButton() {
  if (highlightButton) return; // Don't create if it already exists
  
  highlightButton = document.createElement('div');
  highlightButton.className = 'highlight-button';
  
  // Create the main highlight icon
  const highlightIcon = document.createElement('button');
  highlightIcon.className = 'highlight-icon';
  highlightIcon.innerHTML = `<img src="${chrome.runtime.getURL('icon.svg')}" alt="Highlight">`;
  
  // Create the color palette container
  const colorPalette = document.createElement('div');
  colorPalette.className = 'color-palette';
  
  // Add color options
  const colors = ['#ffeb3b', '#4caf50', '#2196f3', '#9c27b0', '#f44336', '#ff9800'];
  colors.forEach(color => {
    const colorOption = document.createElement('button');
    colorOption.className = 'color-option';
    colorOption.style.backgroundColor = color;
    colorOption.addEventListener('click', (e) => {
      e.stopPropagation();
      handleHighlightClick(color);
    });
    colorPalette.appendChild(colorOption);
  });
  
  highlightButton.appendChild(highlightIcon);
  highlightButton.appendChild(colorPalette);
  document.body.appendChild(highlightButton);
}

// Show highlight button near selection
function showHighlightButton(e) {
  if (!highlightButton) {
    createHighlightButton();
  }
  
  const selection = window.getSelection();
  if (selection.toString().trim().length > 0) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    highlightButton.style.display = 'flex';
    highlightButton.style.position = 'absolute';
    highlightButton.style.top = `${window.scrollY + rect.top - 40}px`;
    highlightButton.style.left = `${window.scrollX + rect.left}px`;
  } else {
    if (highlightButton) {
      highlightButton.style.display = 'none';
    }
  }
}

// Handle highlight button click
async function handleHighlightClick(color = '#ffeb3b') {
  const selection = window.getSelection();
  const text = selection.toString().trim();
  
  if (text) {
    try {
      const range = selection.getRangeAt(0);
      
      // Create highlight object first
      const highlightId = `highlight-${Date.now()}`;
      const highlight = {
        id: highlightId,
        text,
        color,
        url: window.location.href,
        website: window.location.hostname,
        timestamp: new Date().toISOString(),
        title: document.title
      };

      // Try to save the highlight first
      try {
        const result = await chrome.storage.local.get('highlights');
        const highlights = result.highlights || [];
        highlights.push(highlight);
        await chrome.storage.local.set({ highlights });
        
        // If storage successful, apply the highlight to the DOM
        const mark = document.createElement('mark');
        mark.className = 'web-highlighter-mark';
        mark.style.backgroundColor = color;
        mark.setAttribute('data-highlight-id', highlightId);
        
        try {
          // Try surroundContents first
          range.surroundContents(mark);
        } catch (markError) {
          // If surroundContents fails, use a different approach
          const fragment = range.extractContents();
          mark.appendChild(fragment);
          range.insertNode(mark);
        }
        
      } catch (storageError) {
        console.error('Storage error:', storageError);
        chrome.runtime.sendMessage({
          action: 'saveHighlight',
          highlight: highlight
        });
      }
      
      // Clear selection and hide button
      selection.removeAllRanges();
      highlightButton.style.display = 'none';
      
    } catch (error) {
      console.error('Error creating highlight:', error);
    }
  }
}

// Helper function to get XPath of an element
function getXPathForElement(element) {
  if (!element) return '';
  
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  if (element === document.body) {
    return '/html/body';
  }

  let ix = 0;
  let siblings = element.parentNode.childNodes;
  
  for (let i = 0; i < siblings.length; i++) {
    let sibling = siblings[i];
    if (sibling === element) {
      let path = getXPathForElement(element.parentNode);
      let tag = element.tagName.toLowerCase();
      return `${path}/${tag}[${ix + 1}]`;
    }
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
      ix++;
    }
  }
}

// Improved loadSavedHighlights function
async function loadSavedHighlights() {
  try {
    const { highlights = [] } = await chrome.storage.local.get('highlights');
    const pageHighlights = highlights.filter(h => h.url === window.location.href);
    
    pageHighlights.forEach(highlight => {
      const textNodes = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.includes(highlight.text)) {
          textNodes.push(node);
        }
      }
      
      textNodes.forEach(node => {
        const index = node.textContent.indexOf(highlight.text);
        if (index >= 0) {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + highlight.text.length);
          
          const mark = document.createElement('mark');
          mark.className = 'web-highlighter-mark';
          mark.style.backgroundColor = highlight.color || '#ffeb3b';
          mark.setAttribute('data-highlight-id', highlight.id);
          try {
            range.surroundContents(mark);
          } catch (e) {
            console.warn('Could not highlight text:', e);
          }
        }
      });
    });
  } catch (error) {
    console.error('Error loading highlights:', error);
  }
}

// Initialize
document.addEventListener('mouseup', showHighlightButton);
window.addEventListener('load', () => {
    createHighlightButton();
    createSidePanelButton();
    loadSavedHighlights();
});

// Add this to your existing content.js
function createSidePanelButton() {
    const button = document.createElement('button');
    button.className = 'side-panel-button';
    button.innerHTML = `<img src="${chrome.runtime.getURL('icon.svg')}" alt="Show Highlights">`;
    button.title = 'Show Highlights';
    button.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'toggleSidePanel' });
    });
    document.body.appendChild(button);
}