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
        (async () => {
            try {
                const highlights = await loadAllHighlights();
                highlights.push(message.highlight);
                await saveHighlightsToStorage(highlights);
                
                // Notify sidepanel to refresh
                chrome.runtime.sendMessage({
                    action: 'highlightsUpdated',
                    highlights: highlights
                });
                
                sendResponse({ success: true });
            } catch (error) {
                console.error('Storage error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (message.action === 'getHighlights') {
        (async () => {
            try {
                const highlights = await loadAllHighlights();
                sendResponse({ success: true, highlights });
            } catch (error) {
                console.error('Error getting highlights:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    if (message.action === 'savePendingHighlights') {
        (async () => {
            try {
                const highlights = await loadAllHighlights();
                highlights.push(...message.highlights);
                await saveHighlightsToStorage(highlights);
                sendResponse({ success: true });
            } catch (error) {
                console.error('Storage error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
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

// Backup highlights to chrome.storage.sync
async function backupHighlights() {
    try {
        const { highlights = [] } = await chrome.storage.local.get('highlights');
        await chrome.storage.sync.set({
            highlights_backup: highlights,
            highlights_backup_time: Date.now()
        });
        
        // Notify all sidepanels about the backup update
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
            chrome.runtime.sendMessage({
                action: 'backup_updated',
                timestamp: Date.now()
            });
        });
    } catch (error) {
        console.error('Error backing up highlights:', error);
    }
}

// Restore highlights from sync storage if needed
async function restoreHighlightsIfNeeded() {
    try {
        const { highlights = [] } = await chrome.storage.local.get('highlights');
        
        // If storage is empty, try to restore from backup
        if (!highlights || highlights.length === 0) {
            const { highlights_backup } = await chrome.storage.sync.get('highlights_backup');
            if (highlights_backup && highlights_backup.length > 0) {
                await chrome.storage.local.set({ highlights: highlights_backup });
                console.log('Restored highlights from backup');
            } else {
                // Initialize empty highlights array if no backup exists
                await chrome.storage.local.set({ highlights: [] });
            }
        }
    } catch (error) {
        console.error('Error restoring highlights:', error);
    }
}

// Add reconnection handling
let isExtensionValid = true;

chrome.runtime.onInstalled.addListener(() => {
    isExtensionValid = true;
    // Initialize storage and restore highlights if needed
    restoreHighlightsIfNeeded();
    
    // Initialize default color labels if they don't exist
    chrome.storage.local.get('colorLabels', (result) => {
        if (!result.colorLabels) {
            const defaultColorLabels = {
                '#ffeb3b': 'Yellow',
                '#4caf50': 'Green',
                '#2196f3': 'Blue',
                '#9c27b0': 'Purple',
                '#f44336': 'Red',
                '#ff9800': 'Orange'
            };
            chrome.storage.local.set({ colorLabels: defaultColorLabels });
        }
    });
});

// Create periodic backups (every 5 minutes)
setInterval(backupHighlights, 5 * 60 * 1000);

// Add Notion API configuration
const NOTION_API_KEY = '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';
const NOTION_DATABASE_ID = '175d90c26114804791e6dd89dd01131b';
const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// Add a URL validation helper function
function sanitizeUrl(urlStr) {
    if (!urlStr) return '';
    
    try {
        // Check if it's already a valid URL
        new URL(urlStr);
        return urlStr;
    } catch (e) {
        // Try adding https:// if it's missing
        try {
            const withHttps = `https://${urlStr}`;
            new URL(withHttps);
            return withHttps;
        } catch (e2) {
            // If still invalid, return empty string
            return '';
        }
    }
}

// Function to sync highlights with Notion
async function syncWithNotion(highlights) {
    try {
        // Get existing Notion pages in the database
        const existingPages = await getNotionPages();
        
        // Create a map of existing highlights by text and URL to avoid duplicates
        const existingHighlights = new Map();
        existingPages.forEach(page => {
            const text = page.properties.Text?.rich_text[0]?.text?.content;
            const url = page.properties.Website?.url;
            if (text && url) {
                existingHighlights.set(`${text}-${url}`, true);
            }
        });
        
        // Filter out highlights that already exist in Notion
        const newHighlights = highlights.filter(highlight => {
            const key = `${highlight.text}-${highlight.url}`;
            return !existingHighlights.has(key);
        });

        console.log(`Found ${newHighlights.length} new highlights to sync`);
        
        // Process each new highlight
        for (const highlight of newHighlights) {
            const websiteUrl = sanitizeUrl(highlight.url);
            
            const pageData = {
                parent: { database_id: NOTION_DATABASE_ID },
                properties: {
                    Date: {
                        date: { start: highlight.timestamp }
                    },
                    Website: {
                        url: websiteUrl || null
                    },
                    Title: {
                        title: [{ text: { content: highlight.title || 'Untitled' } }]
                    },
                    Text: {
                        rich_text: [{ text: { content: highlight.text || '' } }]
                    },
                    Color: {
                        rich_text: [{ text: { content: highlight.color || '#ffeb3b' } }]
                    },
                    Note: {
                        rich_text: [{ text: { content: highlight.note || '' } }]
                    }
                }
            };

            // Create new page
            await createNotionPage(pageData);
        }

        return true;
    } catch (error) {
        console.error('Notion sync error:', error);
        return false;
    }
}

// Function to get existing pages from Notion database
async function getNotionPages() {
    try {
        const url = `${NOTION_API_URL}/databases/${NOTION_DATABASE_ID}/query`;
        console.log('Fetching from Notion URL:', url);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Notion-Version': NOTION_VERSION,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                page_size: 100,
                sorts: [
                    {
                        property: 'Date',
                        direction: 'descending'
                    }
                ]
            })
        });

        const responseData = await response.json();
        
        if (!response.ok) {
            console.error('Notion API Error Full Details:', JSON.stringify(responseData, null, 2));
            throw new Error(`Notion API error: ${responseData.message || response.statusText}`);
        }

        console.log('Successfully fetched Notion pages:', responseData.results.length);
        return responseData.results;
    } catch (error) {
        console.error('Error in getNotionPages:', {
            message: error.message,
            stack: error.stack,
            error: error
        });
        throw error;
    }
}

// Function to create a new page in Notion
async function createNotionPage(pageData) {
    try {
        console.log('Creating Notion page with data:', JSON.stringify(pageData, null, 2));
        
        const response = await fetch(`${NOTION_API_URL}/pages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Notion-Version': NOTION_VERSION,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pageData)
        });

        const responseData = await response.json();
        
        if (!response.ok) {
            console.error('Create Page Error Full Details:', JSON.stringify(responseData, null, 2));
            throw new Error(`Failed to create Notion page: ${responseData.message || response.statusText}`);
        }

        console.log('Successfully created Notion page');
        return responseData;
    } catch (error) {
        console.error('Error in createNotionPage:', {
            message: error.message,
            stack: error.stack,
            error: error
        });
        throw error;
    }
}

// Function to update an existing page in Notion
async function updateNotionPage(pageId, pageData) {
    const response = await fetch(`${NOTION_API_URL}/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(pageData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to update Notion page: ${error.message || response.statusText}`);
    }

    return response.json();
}

// Listen for storage changes to trigger Notion sync
chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.highlights) {
        const highlights = changes.highlights.newValue;
        await syncWithNotion(highlights);
    }
});

// Handle backup request from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'backupToNotion') {
        chrome.storage.local.get('highlights', async (result) => {
            const success = await syncWithNotion(result.highlights || []);
            sendResponse({ success });
        });
        return true;
    }
});

// Function to import highlights from Notion
async function importFromNotion() {
    try {
        // Get all pages from Notion database
        const pages = await getNotionPages();
        
        // Get existing highlights
        const existingHighlights = await loadAllHighlights();
        
        // Create a map of existing highlights to avoid duplicates
        const existingMap = new Map();
        existingHighlights.forEach(h => {
            const key = `${h.text}-${h.url}`;
            existingMap.set(key, true);
        });
        
        // Convert Notion pages to highlights format and filter out duplicates
        const newHighlights = pages
            .map(page => {
                const websiteUrl = sanitizeUrl(page.properties.Website?.url);
                
                return {
                    id: `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: page.properties.Date?.date?.start || new Date().toISOString(),
                    url: websiteUrl,
                    title: page.properties.Title?.title[0]?.text?.content || 'Untitled',
                    text: page.properties.Text?.rich_text[0]?.text?.content || '',
                    color: page.properties.Color?.rich_text[0]?.text?.content || '#ffeb3b',
                    note: page.properties.Note?.rich_text[0]?.text?.content || '',
                    website: new URL(websiteUrl || 'https://example.com').hostname
                };
            })
            .filter(highlight => {
                const key = `${highlight.text}-${highlight.url}`;
                return !existingMap.has(key) && highlight.text; // Only keep new, valid highlights
            });

        console.log(`Found ${newHighlights.length} new highlights to import`);

        // Merge existing and new highlights
        const mergedHighlights = [...existingHighlights, ...newHighlights];

        // Save merged highlights
        await saveHighlightsToStorage(mergedHighlights);

        return { 
            success: true, 
            highlights: mergedHighlights,
            newCount: newHighlights.length 
        };
    } catch (error) {
        console.error('Error importing from Notion:', error);
        return { success: false, error: error.message };
    }
}

// Update message listener to handle import request
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'backupToNotion') {
        chrome.storage.local.get('highlights', async (result) => {
            const success = await syncWithNotion(result.highlights || []);
            sendResponse({ success });
        });
        return true;
    }
    
    if (message.action === 'importFromNotion') {
        importFromNotion().then(sendResponse);
        return true;
    }
});

// Add periodic Notion sync (every 5 minutes)
async function periodicNotionSync() {
    try {
        const { highlights = [] } = await chrome.storage.local.get('highlights');
        await syncWithNotion(highlights);
        console.log('Periodic Notion sync completed');
    } catch (error) {
        console.error('Periodic Notion sync failed:', error);
    }
}

// Run Notion sync every 5 minutes
setInterval(periodicNotionSync, 5 * 60 * 1000);

// Also run it when the extension starts
periodicNotionSync();

// Add error handling for storage operations
async function safeStorageOperation(operation) {
    try {
        if (!isExtensionValid) {
            throw new Error('Extension context invalidated');
        }
        return await operation();
    } catch (error) {
        if (error.message.includes('Extension context invalidated')) {
            isExtensionValid = false;
            // Attempt to reload the extension
            chrome.runtime.reload();
            throw new Error('Extension reloading, please try again');
        }
        throw error;
    }
}

// Add constants for storage
const CHUNK_SIZE = 100; // Number of highlights per chunk
const MAX_CHUNKS = 100; // Maximum number of chunks

// Function to get chunk key
function getChunkKey(index) {
    return `highlights_chunk_${index}`;
}

// Function to save highlights with chunking
async function saveHighlightsToStorage(highlights) {
    try {
        // Split highlights into chunks
        const chunks = [];
        for (let i = 0; i < highlights.length; i += CHUNK_SIZE) {
            chunks.push(highlights.slice(i, i + CHUNK_SIZE));
        }

        // Clear existing chunks
        const existingChunks = await chrome.storage.local.get(null);
        const chunkKeys = Object.keys(existingChunks).filter(key => key.startsWith('highlights_chunk_'));
        if (chunkKeys.length > 0) {
            await chrome.storage.local.remove(chunkKeys);
        }

        // Save new chunks
        const savePromises = chunks.map((chunk, index) => {
            return chrome.storage.local.set({ [getChunkKey(index)]: chunk });
        });

        await Promise.all(savePromises);
        
        // Save metadata
        await chrome.storage.local.set({
            highlights_metadata: {
                totalHighlights: highlights.length,
                chunks: chunks.length,
                lastUpdated: Date.now()
            }
        });

        return true;
    } catch (error) {
        console.error('Error saving highlights:', error);
        throw error;
    }
}

// Function to load all highlights
async function loadAllHighlights() {
    try {
        const { highlights_metadata } = await chrome.storage.local.get('highlights_metadata');
        if (!highlights_metadata) return [];

        const chunks = [];
        for (let i = 0; i < highlights_metadata.chunks; i++) {
            const { [getChunkKey(i)]: chunk } = await chrome.storage.local.get(getChunkKey(i));
            if (chunk) chunks.push(...chunk);
        }

        return chunks;
    } catch (error) {
        console.error('Error loading highlights:', error);
        return [];
    }
}

// Add connection handling
chrome.runtime.onConnect.addListener((port) => {
    console.log('New connection established');
    
    // Send connected message
    port.postMessage({ type: 'connected' });
    
    port.onDisconnect.addListener(() => {
        console.log('Port disconnected');
    });
});