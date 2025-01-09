let highlightButton = null;

// Add connection state tracking
let isExtensionConnected = true;
let port = null;

// Function to establish connection with background script
function connectToExtension() {
    try {
        port = chrome.runtime.connect({ name: 'highlight-connection' });
        
        port.onDisconnect.addListener(() => {
            console.log('Disconnected from extension, attempting to reconnect...');
            isExtensionConnected = false;
            
            // Try to reconnect after a short delay
            setTimeout(() => {
                connectToExtension();
                // Try to sync any pending highlights after reconnection
                syncPendingHighlights();
            }, 1000);
        });

        port.onMessage.addListener((message) => {
            if (message.type === 'connected') {
                isExtensionConnected = true;
                console.log('Successfully connected to extension');
                // Try to sync any pending highlights immediately after connection
                syncPendingHighlights();
            }
        });

        // Initial sync attempt
        syncPendingHighlights();

    } catch (error) {
        console.error('Failed to connect to extension:', error);
        isExtensionConnected = false;
        // Try to reconnect after a delay
        setTimeout(connectToExtension, 1000);
    }
}

// Initialize connection
connectToExtension();

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
    
    if (!text) return;

    try {
        const range = selection.getRangeAt(0);
        
        // Create highlight object
        const highlightId = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const highlight = {
            id: highlightId,
            text,
            color,
            url: window.location.href,
            website: window.location.hostname,
            timestamp: new Date().toISOString(),
            title: document.title
        };

        // Apply visual highlight first
        const mark = document.createElement('mark');
        mark.className = 'web-highlighter-mark';
        mark.style.backgroundColor = color;
        mark.setAttribute('data-highlight-id', highlightId);
        
        try {
            range.surroundContents(mark);
        } catch (markError) {
            const fragment = range.extractContents();
            mark.appendChild(fragment);
            range.insertNode(mark);
        }
        
        // Clear selection and hide button
        selection.removeAllRanges();
        highlightButton.style.display = 'none';

        // Save the highlight
        const saved = await saveHighlight(highlight);
        if (!saved) {
            // If save failed, store in local storage
            const localHighlights = JSON.parse(localStorage.getItem('page_highlights') || '[]');
            localHighlights.push(highlight);
            localStorage.setItem('page_highlights', JSON.stringify(localHighlights));
            showToast('Highlight saved locally', 'warning');
        }
    } catch (error) {
        console.error('Error creating highlight:', error);
        showToast('Failed to create highlight. Please try again.', 'error');
    }
}

// Update loadSavedHighlights function to handle errors better
async function loadSavedHighlights() {
    try {
        // First try to get highlights from extension
        let highlights = [];
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getHighlights' });
            if (response.success) {
                highlights = response.highlights;
            }
        } catch (error) {
            console.warn('Failed to get highlights from extension, using local storage:', error);
            // Try to get highlights from local storage as fallback
            const localHighlights = localStorage.getItem('page_highlights');
            if (localHighlights) {
                highlights = JSON.parse(localHighlights);
            }
        }

        // Filter highlights for current page
        const pageHighlights = highlights.filter(h => h.url === window.location.href);
        
        // Apply highlights to page
        pageHighlights.forEach(highlight => {
            applyHighlight(highlight);
        });
    } catch (error) {
        console.error('Error loading highlights:', error);
    }
}

// Add helper function to apply highlight
function applyHighlight(highlight) {
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
        try {
            const index = node.textContent.indexOf(highlight.text);
            if (index >= 0) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + highlight.text.length);
                
                const mark = document.createElement('mark');
                mark.className = 'web-highlighter-mark';
                mark.style.backgroundColor = highlight.color;
                mark.setAttribute('data-highlight-id', highlight.id);
                
                range.surroundContents(mark);
            }
        } catch (e) {
            console.warn('Could not highlight text:', e);
        }
    });
}

// Add event listener for text selection
document.addEventListener('mouseup', showHighlightButton);

// Load saved highlights when page loads
loadSavedHighlights();

// Update saveHighlight function with local storage fallback
async function saveHighlight(highlightData) {
    try {
        // Try to save to extension storage first
        const response = await chrome.runtime.sendMessage({
            action: 'saveHighlight',
            highlight: highlightData
        });
        
        if (response.success) {
            showToast('Highlight saved!');
            return true;
        } else {
            throw new Error(response.error || 'Failed to save highlight');
        }
    } catch (error) {
        console.error('Save error:', error);
        
        // Save locally as fallback
        const localKey = `pending_highlights_${window.location.hostname}`;
        let pendingHighlights = JSON.parse(localStorage.getItem(localKey) || '[]');
        pendingHighlights.push(highlightData);
        localStorage.setItem(localKey, JSON.stringify(pendingHighlights));
        
        if (error.message.includes('Extension context invalidated')) {
            showToast('Highlight saved locally. Reconnecting...', 'warning');
            isExtensionConnected = false;
            // Try to reconnect
            connectToExtension();
        } else {
            showToast('Highlight saved locally. Will sync soon.', 'warning');
        }
        return true;
    }
}

// Add function to sync pending highlights
async function syncPendingHighlights() {
    if (!isExtensionConnected) return;

    const localKey = `pending_highlights_${window.location.hostname}`;
    const pendingHighlights = JSON.parse(localStorage.getItem(localKey) || '[]');
    
    if (pendingHighlights.length === 0) return;

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'savePendingHighlights',
            highlights: pendingHighlights
        });

        if (response.success) {
            localStorage.removeItem(localKey);
            showToast(`Synced ${pendingHighlights.length} pending highlights!`);
        }
    } catch (error) {
        console.error('Failed to sync pending highlights:', error);
    }
}

// Try to sync pending highlights periodically
setInterval(syncPendingHighlights, 30000);

// Also try to sync when the page loads
document.addEventListener('DOMContentLoaded', syncPendingHighlights);

// Add a toast notification function if you don't have one
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `ab-highlighter-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}