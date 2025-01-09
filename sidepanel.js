let currentView = 'home';
let allHighlights = [];
let activeColorFilter = null;
let reviewQueue = [];
let currentReviewItem = null;

// Function to format backup timestamp
function formatBackupTime(timestamp) {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Function to update backup timestamp display
async function updateBackupTimestamp() {
    try {
        const { highlights_backup_time } = await chrome.storage.sync.get('highlights_backup_time');
        const timestampElement = document.querySelector('.backup-timestamp');
        if (timestampElement) {
            if (!highlights_backup_time) {
                timestampElement.textContent = 'Last backup: Never';
            } else {
                const date = new Date(highlights_backup_time);
                const formattedTime = date.toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                timestampElement.textContent = `Last backup: ${formattedTime}`;
            }
        }
    } catch (error) {
        console.error('Error getting backup timestamp:', error);
        const timestampElement = document.querySelector('.backup-timestamp');
        if (timestampElement) {
            timestampElement.textContent = 'Last backup: Error';
        }
    }
}

// Update timestamp when page loads
document.addEventListener('DOMContentLoaded', updateBackupTimestamp);

// Update timestamp every minute
setInterval(updateBackupTimestamp, 60 * 1000);

// Listen for backup updates from background script
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.highlights_backup_time) {
        updateBackupTimestamp();
    }
});

// Handle navigation
document.querySelectorAll('.nav-icon').forEach(icon => {
    icon.addEventListener('click', () => {
        const view = icon.dataset.view;
        if (!view) return;
        
        // Update active states
        document.querySelectorAll('.nav-icon').forEach(i => i.classList.remove('active'));
        icon.classList.add('active');
        
        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        
        // Show selected view
        const viewElement = document.getElementById(`${view}-view`);
        if (viewElement) {
            viewElement.classList.add('active');
            currentView = view;
            
            // Initialize view-specific content
            if (view === 'review') {
                prepareReviewQueue();
            } else if (view === 'tags') {
                // Reset color filter to "All Colors" when entering tags view
                activeColorFilter = null;
                document.querySelectorAll('.color-filter').forEach(f => {
                    f.classList.remove('active');
                    if (f.dataset.color === 'all') {
                        f.classList.add('active');
                    }
                });
                displayColorFilteredHighlights();
            } else if (view === 'notes') {
                displayNotesView();
            } else if (view === 'home') {
                displayPagesList();
            }
        }
    });
});

// Handle color filters
document.querySelectorAll('.color-filter').forEach(filter => {
    filter.addEventListener('click', () => {
        // Update active state
        document.querySelectorAll('.color-filter').forEach(f => f.classList.remove('active'));
        filter.classList.add('active');
        
        // Update active color filter
        activeColorFilter = filter.dataset.color === 'all' ? null : filter.dataset.color;
        
        // Display filtered highlights
        displayColorFilteredHighlights();
    });
});

function displayColorFilteredHighlights() {
    const container = document.getElementById('color-filtered-highlights');
    if (!container) return;
    
    const filteredHighlights = activeColorFilter ? 
        allHighlights.filter(h => h.color === activeColorFilter) :
        allHighlights;
    
    container.innerHTML = '';
    
    if (filteredHighlights.length === 0) {
        container.innerHTML = '<div class="no-highlights">No highlights found</div>';
        return;
    }
    
    // Sort highlights by date (newest first)
    filteredHighlights.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Group by page
    const groupedHighlights = filteredHighlights.reduce((acc, highlight) => {
        if (!acc[highlight.url]) {
            acc[highlight.url] = {
                title: highlight.title,
                url: highlight.url,
                highlights: [],
                favicon: `https://www.google.com/s2/favicons?domain=${new URL(highlight.url).hostname}`
            };
        }
        acc[highlight.url].highlights.push(highlight);
        return acc;
    }, {});
    
    Object.values(groupedHighlights).forEach(page => {
        const pageSection = document.createElement('div');
        pageSection.className = 'page-section';
        
        pageSection.innerHTML = `
            <div class="page-info">
                <div class="page-info-header">
                    <img src="${page.favicon}" alt="${page.title}">
                    <a href="${page.url}" class="page-info-title" target="_blank">${page.title}</a>
                </div>
                <div class="page-info-url">${new URL(page.url).hostname}</div>
            </div>
        `;
        
        const highlightsList = document.createElement('div');
        highlightsList.className = 'highlights-list';
        
        page.highlights.forEach(highlight => {
            const entry = document.createElement('div');
            entry.className = 'highlight-entry';
            entry.style.setProperty('--highlight-color', highlight.color || '#ffeb3b');
            
            entry.innerHTML = `
                <div class="entry-text">${highlight.text}</div>
                ${highlight.note ? `
                    <div class="note-section">
                        <div class="saved-note">${highlight.note}</div>
                    </div>
                ` : ''}
                <div class="entry-meta">
                    <span>${formatDate(highlight.timestamp)}</span>
                    <span>${new URL(highlight.url).hostname}</span>
                </div>
            `;
            
            // Add click handler to open the page
            entry.addEventListener('click', (e) => {
                if (!e.target.closest('.note-section')) {
                    chrome.tabs.create({ url: highlight.url });
                }
            });
            
            highlightsList.appendChild(entry);
        });
        
        pageSection.appendChild(highlightsList);
        container.appendChild(pageSection);
    });
}

function displayNotesView() {
    const container = document.getElementById('notes-list');
    if (!container) return;
    
    const highlightsWithNotes = allHighlights.filter(h => h.note);
    
    container.innerHTML = '';
    
    if (highlightsWithNotes.length === 0) {
        container.innerHTML = '<div class="no-highlights">No notes found</div>';
        return;
    }
    
    highlightsWithNotes.forEach(highlight => {
        const entry = document.createElement('div');
        entry.className = 'highlight-entry';
        entry.style.setProperty('--highlight-color', highlight.color || '#ffeb3b');
        
        entry.innerHTML = `
            <div class="entry-text">${highlight.text}</div>
            <div class="note-section">
                <div class="saved-note">${highlight.note}</div>
            </div>
            <div class="entry-meta">
                <span>${formatDate(highlight.timestamp)}</span>
                <span>${new URL(highlight.url).hostname}</span>
            </div>
        `;
        
        // Add click handler to open the page
        entry.addEventListener('click', (e) => {
            if (!e.target.closest('.note-section')) {
                chrome.tabs.create({ url: highlight.url });
            }
        });
        
        container.appendChild(entry);
    });
}

async function loadHighlights() {
    const { highlights = [] } = await chrome.storage.local.get('highlights');
    allHighlights = highlights;
    displayPagesList();
}

function displayPagesList() {
    // Ensure the home view exists and has the correct structure
    const homeView = document.getElementById('home-view');
    if (!homeView) return;
    
    // Clear previous content and ensure search is cleared
    document.getElementById('search').value = '';
    
    // Reset the home view structure
    homeView.innerHTML = `
        <div class="date-section" id="today-section">
            <h3>This month</h3>
            <div id="today-highlights"></div>
        </div>
    `;
    
    const todayHighlights = document.getElementById('today-highlights');
    if (!todayHighlights) return;
    
    // If no highlights exist, show message
    if (!allHighlights || allHighlights.length === 0) {
        todayHighlights.innerHTML = '<div class="no-highlights">No highlights yet</div>';
        return;
    }
    
    // Group highlights by URL and date
    const pageGroups = allHighlights.reduce((acc, highlight) => {
        if (!acc[highlight.url]) {
            acc[highlight.url] = {
                title: highlight.title || new URL(highlight.url).hostname,
                url: highlight.url,
                highlights: [],
                favicon: `https://www.google.com/s2/favicons?domain=${new URL(highlight.url).hostname}`,
                date: new Date(highlight.timestamp)
            };
        }
        acc[highlight.url].highlights.push(highlight);
        return acc;
    }, {});
    
    // Count notes for each page
    Object.values(pageGroups).forEach(page => {
        page.noteCount = page.highlights.filter(h => h.note).length;
    });
    
    // Sort pages by date (newest first)
    const sortedPages = Object.values(pageGroups).sort((a, b) => b.date - a.date);
    
    sortedPages.forEach(page => {
        const pageEntry = document.createElement('div');
        pageEntry.className = 'page-entry';
        
        const highlightCount = page.highlights.length;
        const noteCount = page.noteCount;
        
        pageEntry.innerHTML = `
            <div class="page-entry-title">
                <img src="${page.favicon}" alt="">
                ${page.title}
            </div>
            <div class="page-entry-stats">
                <div class="stat-box">
                    ${highlightCount} <span>Highlight${highlightCount !== 1 ? 's' : ''}</span>
                </div>
                <div class="stat-box">
                    ${noteCount} <span>Note${noteCount !== 1 ? 's' : ''}</span>
                </div>
            </div>
        `;
        
        pageEntry.addEventListener('click', () => {
            showPageHighlights(page);
        });
        
        todayHighlights.appendChild(pageEntry);
    });
    
    // Show/hide the section based on content
    const todaySection = document.getElementById('today-section');
    if (todaySection) {
        todaySection.style.display = todayHighlights.hasChildNodes() ? 'block' : 'none';
    }
}

function showPageHighlights(page) {
    currentView = 'highlights';
    
    // Hide all views first
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Show the page highlights view
    const pageHighlightsView = document.getElementById('page-highlights-view');
    pageHighlightsView.classList.add('active');
    
    // Set page title
    document.querySelector('.page-title').textContent = page.title;
    
    // Display highlights
    const container = document.getElementById('page-highlights');
    container.innerHTML = '';
    
    // Add page info section
    const pageInfo = document.createElement('div');
    pageInfo.className = 'page-info';
    
    // Try to get page meta image, fallback to favicon
    const pageImage = page.favicon;
    const hostname = new URL(page.url).hostname;
    
    pageInfo.innerHTML = `
        <div class="page-info-header">
            <img src="${pageImage}" alt="${page.title}">
            <a href="${page.url}" class="page-info-title" target="_blank">${page.title}</a>
        </div>
        <div class="page-info-url">${hostname}</div>
        <div class="page-info-stats">
            <div class="page-info-stat">
                <span class="stat-value">${page.highlights.length}</span>
                <span class="stat-label">Highlights</span>
            </div>
            <div class="page-info-stat">
                <span class="stat-value">${page.noteCount || 0}</span>
                <span class="stat-label">Notes</span>
            </div>
            <div class="page-info-stat">
                <span class="stat-value">${formatDate(page.highlights[0].timestamp)}</span>
                <span class="stat-label">Last Updated</span>
            </div>
        </div>
    `;
    
    container.appendChild(pageInfo);
    
    if (page.highlights.length === 0) {
        container.innerHTML += '<div class="no-highlights">No highlights yet</div>';
        return;
    }
    
    // Create highlights container
    const highlightsContainer = document.createElement('div');
    highlightsContainer.className = 'highlights-list';
    
    page.highlights.forEach(highlight => {
        const entry = document.createElement('div');
        entry.className = 'highlight-entry';
        entry.style.setProperty('--highlight-color', highlight.color || '#ffeb3b');
        
        const noteContent = highlight.note ? 
            `<div class="note-section">
                <div class="note-header">
                    <span class="note-label">Note</span>
                    <button class="edit-note">Edit</button>
                </div>
                <div class="saved-note">${highlight.note}</div>
             </div>` :
            `<div class="note-section collapsed">
                <div class="note-header">
                    <span class="note-label">Add a note</span>
                    <button class="save-note hidden">Save</button>
                </div>
                <textarea class="note-input hidden" placeholder="Type your note here..."></textarea>
             </div>`;
        
        entry.innerHTML = `
            <div class="entry-text">${highlight.text}</div>
            ${noteContent}
            <div class="entry-meta">
                <span>${formatDate(highlight.timestamp)}</span>
                <span>${hostname}</span>
            </div>
        `;
        
        // Handle note interactions
        const noteSection = entry.querySelector('.note-section');
        const noteLabel = entry.querySelector('.note-label');
        
        if (!highlight.note) {
            // Handle adding new note
            noteLabel.addEventListener('click', () => {
                noteSection.classList.remove('collapsed');
                const noteInput = noteSection.querySelector('.note-input');
                const saveBtn = noteSection.querySelector('.save-note');
                noteInput.classList.remove('hidden');
                saveBtn.classList.remove('hidden');
            });
            
            const saveBtn = entry.querySelector('.save-note');
            const noteInput = entry.querySelector('.note-input');
            
            saveBtn.addEventListener('click', async () => {
                const noteText = noteInput.value.trim();
                if (!noteText) return;
                
                await saveNote(highlight, noteText);
                noteSection.innerHTML = `
                    <div class="note-header">
                        <span class="note-label">Note</span>
                        <button class="edit-note">Edit</button>
                    </div>
                    <div class="saved-note">${noteText}</div>
                `;
                setupEditNoteHandler(noteSection, highlight);
            });
        } else {
            // Setup edit functionality for existing note
            setupEditNoteHandler(noteSection, highlight);
        }
        
        // Add click handler for navigation
        entry.addEventListener('click', (e) => {
            // Don't navigate if clicking within note section
            if (e.target.closest('.note-section')) return;
            
            // Navigate to the page
            chrome.tabs.create({ url: page.url });
        });
        
        highlightsContainer.appendChild(entry);
    });
    
    container.appendChild(highlightsContainer);
}

async function saveNote(highlight, noteText) {
    highlight.note = noteText;
    const { highlights = [] } = await chrome.storage.local.get('highlights');
    const updatedHighlights = highlights.map(h => 
        h.timestamp === highlight.timestamp && h.url === highlight.url ? 
        { ...h, note: noteText } : h
    );
    
    await chrome.storage.local.set({ highlights: updatedHighlights });
    allHighlights = updatedHighlights;
}

function setupEditNoteHandler(noteSection, highlight) {
    const editBtn = noteSection.querySelector('.edit-note');
    editBtn.addEventListener('click', () => {
        const currentNote = highlight.note;
        noteSection.innerHTML = `
            <div class="note-header">
                <span class="note-label">Edit note</span>
                <div class="edit-actions">
                    <button class="cancel-edit">Cancel</button>
                    <button class="save-note">Save</button>
                </div>
            </div>
            <textarea class="note-input">${currentNote}</textarea>
        `;
        
        const cancelBtn = noteSection.querySelector('.cancel-edit');
        const saveBtn = noteSection.querySelector('.save-note');
        const noteInput = noteSection.querySelector('.note-input');
        
        cancelBtn.addEventListener('click', () => {
            noteSection.innerHTML = `
                <div class="note-header">
                    <span class="note-label">Note</span>
                    <button class="edit-note">Edit</button>
                </div>
                <div class="saved-note">${currentNote}</div>
            `;
            setupEditNoteHandler(noteSection, highlight);
        });
        
        saveBtn.addEventListener('click', async () => {
            const noteText = noteInput.value.trim();
            if (!noteText) return;
            
            await saveNote(highlight, noteText);
            noteSection.innerHTML = `
                <div class="note-header">
                    <span class="note-label">Note</span>
                    <button class="edit-note">Edit</button>
                </div>
                <div class="saved-note">${noteText}</div>
            `;
            setupEditNoteHandler(noteSection, highlight);
        });
    });
}

// Update search functionality to work across all views
document.getElementById('search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        if (currentView === 'home') {
            displayPagesList();
        } else if (currentView === 'tags') {
            displayColorFilteredHighlights();
        } else if (currentView === 'notes') {
            displayNotesView();
        }
        return;
    }

    // Filter highlights based on search term
    const filteredHighlights = allHighlights.filter(h => 
        h.text.toLowerCase().includes(searchTerm) ||
        h.title.toLowerCase().includes(searchTerm) ||
        (h.note && h.note.toLowerCase().includes(searchTerm))
    );

    if (currentView === 'home') {
        // Update home view with filtered results
        const todayHighlights = document.getElementById('today-highlights');
        if (!todayHighlights) return;
        
        todayHighlights.innerHTML = '';
        
        // Group filtered highlights by URL
        const filteredGroups = filteredHighlights.reduce((acc, highlight) => {
            if (!acc[highlight.url]) {
                acc[highlight.url] = {
                    title: highlight.title,
                    url: highlight.url,
                    highlights: [],
                    favicon: `https://www.google.com/s2/favicons?domain=${new URL(highlight.url).hostname}`,
                    date: new Date(highlight.timestamp),
                    noteCount: 0
                };
            }
            acc[highlight.url].highlights.push(highlight);
            if (highlight.note) {
                acc[highlight.url].noteCount++;
            }
            return acc;
        }, {});

        Object.values(filteredGroups).forEach(page => {
            const pageEntry = document.createElement('div');
            pageEntry.className = 'page-entry';
            
            pageEntry.innerHTML = `
                <div class="page-entry-title">
                    <img src="${page.favicon}" alt="">
                    ${page.title}
                </div>
                <div class="page-entry-stats">
                    <div class="stat-box">
                        ${page.highlights.length} <span>Highlight${page.highlights.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="stat-box">
                        ${page.noteCount} <span>Note${page.noteCount !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            `;
            
            pageEntry.addEventListener('click', () => {
                showPageHighlights(page);
            });
            
            todayHighlights.appendChild(pageEntry);
        });

        const todaySection = document.getElementById('today-section');
        if (todaySection) {
            todaySection.style.display = todayHighlights.hasChildNodes() ? 'block' : 'none';
        }
    } else if (currentView === 'tags') {
        // Update tags view with filtered results while maintaining color filter
        const colorFilteredHighlights = activeColorFilter ? 
            filteredHighlights.filter(h => h.color === activeColorFilter) :
            filteredHighlights;
        
        const container = document.getElementById('color-filtered-highlights');
        if (!container) return;
        
        container.innerHTML = '';
        displayHighlightsList(container, colorFilteredHighlights);
    } else if (currentView === 'notes') {
        // Update notes view with filtered results
        const container = document.getElementById('notes-list');
        if (!container) return;
        
        const highlightsWithNotes = filteredHighlights.filter(h => h.note);
        container.innerHTML = '';
        
        if (highlightsWithNotes.length === 0) {
            container.innerHTML = '<div class="no-highlights">No matching notes found</div>';
            return;
        }
        
        highlightsWithNotes.forEach(highlight => {
            const entry = document.createElement('div');
            entry.className = 'highlight-entry';
            entry.style.setProperty('--highlight-color', highlight.color || '#ffeb3b');
            
            entry.innerHTML = `
                <div class="entry-text">${highlight.text}</div>
                <div class="note-section">
                    <div class="saved-note">${highlight.note}</div>
                </div>
                <div class="entry-meta">
                    <span>${formatDate(highlight.timestamp)}</span>
                    <span>${new URL(highlight.url).hostname}</span>
                </div>
            `;
            
            // Add click handler to open the page
            entry.addEventListener('click', (e) => {
                if (!e.target.closest('.note-section')) {
                    chrome.tabs.create({ url: highlight.url });
                }
            });
            
            container.appendChild(entry);
        });
    }
});

// Helper function to display highlights list
function displayHighlightsList(container, highlights) {
    if (highlights.length === 0) {
        container.innerHTML = '<div class="no-highlights">No highlights found</div>';
        return;
    }
    
    // Group by page
    const groupedHighlights = highlights.reduce((acc, highlight) => {
        if (!acc[highlight.url]) {
            acc[highlight.url] = {
                title: highlight.title,
                url: highlight.url,
                highlights: [],
                favicon: `https://www.google.com/s2/favicons?domain=${new URL(highlight.url).hostname}`
            };
        }
        acc[highlight.url].highlights.push(highlight);
        return acc;
    }, {});
    
    Object.values(groupedHighlights).forEach(page => {
        const pageSection = document.createElement('div');
        pageSection.className = 'page-section';
        
        pageSection.innerHTML = `
            <div class="page-info">
                <div class="page-info-header">
                    <img src="${page.favicon}" alt="${page.title}">
                    <a href="${page.url}" class="page-info-title" target="_blank">${page.title}</a>
                </div>
                <div class="page-info-url">${new URL(page.url).hostname}</div>
            </div>
        `;
        
        const highlightsList = document.createElement('div');
        highlightsList.className = 'highlights-list';
        
        page.highlights.forEach(highlight => {
            const entry = document.createElement('div');
            entry.className = 'highlight-entry';
            entry.style.setProperty('--highlight-color', highlight.color || '#ffeb3b');
            
            entry.innerHTML = `
                <div class="entry-text">${highlight.text}</div>
                ${highlight.note ? `
                    <div class="note-section">
                        <div class="saved-note">${highlight.note}</div>
                    </div>
                ` : ''}
                <div class="entry-meta">
                    <span>${formatDate(highlight.timestamp)}</span>
                    <span>${new URL(highlight.url).hostname}</span>
                </div>
            `;
            
            // Add click handler to open the page
            entry.addEventListener('click', (e) => {
                if (!e.target.closest('.note-section')) {
                    chrome.tabs.create({ url: highlight.url });
                }
            });
            
            highlightsList.appendChild(entry);
        });
        
        pageSection.appendChild(highlightsList);
        container.appendChild(pageSection);
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', loadHighlights);

function formatDate(date) {
    const now = new Date();
    const inputDate = new Date(date);
    const diff = now - inputDate;
    
    if (diff < 24 * 60 * 60 * 1000) {
        return 'Today';
    } else if (diff < 48 * 60 * 60 * 1000) {
        return 'Yesterday';
    }
    
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
    }).format(inputDate);
}

// Update back button handler
document.querySelector('.back-button').addEventListener('click', () => {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    // Show home view
    document.getElementById('home-view').classList.add('active');
    currentView = 'home';
});

// Add export button handler
document.querySelector('.export-button').addEventListener('click', async () => {
    try {
        const { highlights = [] } = await chrome.storage.local.get('highlights');
        if (highlights.length === 0) {
            alert('No highlights to export');
            return;
        }

        // Create CSV content with headers
        const headers = ['Timestamp', 'Website', 'Title', 'Text', 'Color', 'Note'];
        const rows = [headers];

        // Add data rows
        highlights.forEach(h => {
            rows.push([
                h.timestamp,
                h.website,
                h.title,
                h.text,
                h.color,
                h.note || ''
            ].map(field => `"${String(field).replace(/"/g, '""')}"`));
        });

        // Create and download the CSV file
        const csvContent = rows.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `highlights-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Export error:', error);
        alert('Error exporting highlights');
    }
});

// Add import button handler
document.querySelector('.import-button').addEventListener('click', async () => {
    try {
        // Show loading state
        const importButton = document.querySelector('.import-button');
        const originalContent = importButton.innerHTML;
        importButton.innerHTML = 'Importing...';
        importButton.disabled = true;

        // Request import from background script
        const response = await chrome.runtime.sendMessage({ action: 'importFromNotion' });
        
        if (response.success) {
            // Update local highlights
            allHighlights = response.highlights;
            
            // Refresh current view
            if (currentView === 'home') {
                displayPagesList();
            } else if (currentView === 'tags') {
                displayColorFilteredHighlights();
            } else if (currentView === 'notes') {
                displayNotesView();
            }
            
            alert(`Successfully imported ${response.highlights.length} highlights from Notion!`);
        } else {
            alert('Failed to import highlights from Notion');
        }

        // Restore button state
        importButton.innerHTML = originalContent;
        importButton.disabled = false;
    } catch (error) {
        console.error('Import error:', error);
        alert('Error importing highlights from Notion');
    }
});

// Helper function to ensure valid URL
function ensureValidUrl(urlStr) {
    try {
        // Check if it already starts with http:// or https://
        if (!/^https?:\/\//i.test(urlStr)) {
            urlStr = 'https://' + urlStr;
        }
        new URL(urlStr); // Test if valid URL
        return urlStr;
    } catch (e) {
        // If invalid URL, create a fallback URL
        return `https://${urlStr.replace(/[^a-zA-Z0-9.-]/g, '')}`;
    }
}

document.getElementById('import-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const rows = text.split('\n').map(row => {
            // Handle CSV parsing with potential quoted values containing commas
            const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
            return matches.map(val => val.replace(/^"|"$/g, '').replace(/""/g, '"'));
        });

        // Remove header row and empty rows
        const dataRows = rows.slice(1).filter(row => row.length >= 6);
        
        // Parse CSV data into highlights
        const importedHighlights = dataRows.map(row => {
            const [timestamp, website, title, text, color, note] = row;
            
            // Ensure valid timestamp
            let validTimestamp;
            try {
                validTimestamp = new Date(timestamp).toISOString();
            } catch (e) {
                validTimestamp = new Date().toISOString();
            }

            // Ensure valid website URL
            let validWebsite = website || '';
            try {
                if (validWebsite && !validWebsite.startsWith('http')) {
                    validWebsite = 'https://' + validWebsite;
                }
                new URL(validWebsite); // Test if valid URL
            } catch (e) {
                // If invalid URL, use domain as-is without throwing error
                validWebsite = website || '';
            }

            return {
                id: `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: validTimestamp,
                website: validWebsite,
                title: title || '',
                text: text || '',
                color: color || '#ffeb3b',
                note: note || '',
                url: validWebsite // Use the same validated website URL
            };
        });

        if (importedHighlights.length === 0) {
            alert('No valid highlights found in the CSV file');
            return;
        }

        if (confirm(`Import ${importedHighlights.length} highlights? This will merge with your existing highlights.`)) {
            const { highlights: existingHighlights = [] } = await chrome.storage.local.get('highlights');
            const mergedHighlights = [...existingHighlights];
            
            importedHighlights.forEach(importedHighlight => {
                const isDuplicate = existingHighlights.some(
                    existing => existing.text === importedHighlight.text && 
                              existing.website === importedHighlight.website
                );
                if (!isDuplicate) {
                    mergedHighlights.push(importedHighlight);
                }
            });

            await chrome.storage.local.set({ highlights: mergedHighlights });
            allHighlights = mergedHighlights;
            
            if (currentView === 'home') {
                displayPagesList();
            } else if (currentView === 'tags') {
                displayColorFilteredHighlights();
            } else if (currentView === 'notes') {
                displayNotesView();
            }

            alert(`Successfully imported ${importedHighlights.length} highlights!`);
        }
    } catch (error) {
        console.error('Import error:', error);
        alert('Error importing highlights. Please make sure the CSV file is correctly formatted.');
    }

    event.target.value = '';
});

// Add this near the top of the file with other event listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'backup_updated') {
        updateBackupTimestamp();
    }
});

// Add this function to prepare the review queue
function prepareReviewQueue() {
    // Create a copy of all highlights and shuffle them
    reviewQueue = [...allHighlights].sort(() => Math.random() - 0.5);
    showNextReviewItem();
}

// Function to show the next review item
function showNextReviewItem() {
    if (reviewQueue.length === 0) {
        // If queue is empty, show message
        document.querySelector('.review-card').innerHTML = `
            <div class="highlight-text">No more highlights to review!</div>
            <button onclick="prepareReviewQueue()" class="review-button remember">Start Over</button>
        `;
        document.querySelector('.review-actions').style.display = 'none';
        return;
    }

    currentReviewItem = reviewQueue[0];
    const card = document.querySelector('.review-card');
    
    // Safely get favicon URL
    let faviconUrl = '';
    try {
        const url = new URL(currentReviewItem.url);
        faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}`;
    } catch (e) {
        // Fallback favicon for invalid URLs
        faviconUrl = 'icons/tag.svg'; // or any default icon you have
    }
    
    const noteContent = currentReviewItem.note ? 
        `<div class="note-section">
            <div class="note-header">
                <span class="note-label">Note</span>
                <button class="edit-note">Edit</button>
            </div>
            <div class="saved-note">${currentReviewItem.note}</div>
         </div>` :
        `<div class="note-section collapsed">
            <div class="note-header">
                <span class="note-label">Add a note</span>
                <button class="save-note hidden">Save</button>
            </div>
            <textarea class="note-input hidden" placeholder="Type your note here..."></textarea>
         </div>`;
    
    card.innerHTML = `
        <div class="highlight-text">${currentReviewItem.text}</div>
        ${noteContent}
        <div class="highlight-source">
            <img src="${faviconUrl}" alt="" class="source-favicon">
            <a href="${currentReviewItem.url}" target="_blank" class="source-title">${currentReviewItem.title || 'Untitled'}</a>
        </div>
    `;
    
    // Setup note interaction handlers
    setupNoteHandlers(card);
    
    document.querySelector('.review-actions').style.display = 'flex';
}

// Add this function to handle note interactions
function setupNoteHandlers(card) {
    const noteSection = card.querySelector('.note-section');
    const noteLabel = card.querySelector('.note-label');
    
    if (!currentReviewItem.note) {
        // Handle adding new note
        noteLabel.addEventListener('click', () => {
            noteSection.classList.remove('collapsed');
            const noteInput = noteSection.querySelector('.note-input');
            const saveBtn = noteSection.querySelector('.save-note');
            noteInput.classList.remove('hidden');
            saveBtn.classList.remove('hidden');
        });
        
        const saveBtn = card.querySelector('.save-note');
        const noteInput = card.querySelector('.note-input');
        
        saveBtn.addEventListener('click', async () => {
            const noteText = noteInput.value.trim();
            if (!noteText) return;
            
            await saveNote(currentReviewItem, noteText);
            noteSection.innerHTML = `
                <div class="note-header">
                    <span class="note-label">Note</span>
                    <button class="edit-note">Edit</button>
                </div>
                <div class="saved-note">${noteText}</div>
            `;
            setupEditNoteHandler(noteSection, currentReviewItem);
        });
    } else {
        // Setup edit functionality for existing note
        setupEditNoteHandler(noteSection, currentReviewItem);
    }
}

// Add this function to handle note editing
function setupEditNoteHandler(noteSection, highlight) {
    const editBtn = noteSection.querySelector('.edit-note');
    if (!editBtn) return;
    
    editBtn.addEventListener('click', () => {
        const currentNote = highlight.note;
        noteSection.innerHTML = `
            <div class="note-header">
                <span class="note-label">Edit note</span>
                <div class="edit-actions">
                    <button class="cancel-edit">Cancel</button>
                    <button class="save-note">Save</button>
                </div>
            </div>
            <textarea class="note-input">${currentNote}</textarea>
        `;
        
        const cancelBtn = noteSection.querySelector('.cancel-edit');
        const saveBtn = noteSection.querySelector('.save-note');
        const noteInput = noteSection.querySelector('.note-input');
        
        cancelBtn.addEventListener('click', () => {
            noteSection.innerHTML = `
                <div class="note-header">
                    <span class="note-label">Note</span>
                    <button class="edit-note">Edit</button>
                </div>
                <div class="saved-note">${currentNote}</div>
            `;
            setupEditNoteHandler(noteSection, highlight);
        });
        
        saveBtn.addEventListener('click', async () => {
            const noteText = noteInput.value.trim();
            if (!noteText) return;
            
            await saveNote(highlight, noteText);
            noteSection.innerHTML = `
                <div class="note-header">
                    <span class="note-label">Note</span>
                    <button class="edit-note">Edit</button>
                </div>
                <div class="saved-note">${noteText}</div>
            `;
            setupEditNoteHandler(noteSection, highlight);
        });
    });
}

// Add this function to save notes
async function saveNote(highlight, noteText) {
    highlight.note = noteText;
    const { highlights = [] } = await chrome.storage.local.get('highlights');
    const updatedHighlights = highlights.map(h => 
        h.timestamp === highlight.timestamp && h.url === highlight.url ? 
        { ...h, note: noteText } : h
    );
    
    await chrome.storage.local.set({ highlights: updatedHighlights });
    allHighlights = updatedHighlights;
}

// Add event listeners for review buttons
document.addEventListener('DOMContentLoaded', () => {
    // Remember button
    document.querySelector('.review-button.remember').addEventListener('click', () => {
        if (!currentReviewItem) return;
        
        // Remove the current item from the queue
        reviewQueue.shift();
        showNextReviewItem();
    });

    // Nope button
    document.querySelector('.review-button.nope').addEventListener('click', () => {
        if (!currentReviewItem) return;
        
        // Move current item to a random position in the middle of the queue
        const item = reviewQueue.shift();
        const randomPosition = Math.floor(Math.random() * reviewQueue.length);
        reviewQueue.splice(randomPosition, 0, item);
        showNextReviewItem();
    });
});

// Add these functions to handle color label editing
let colorLabels = {};

// Load color labels
async function loadColorLabels() {
    const result = await chrome.storage.local.get('colorLabels');
    colorLabels = result.colorLabels || {};
    updateColorFilterLabels();
}

// Update color filter labels in the UI
function updateColorFilterLabels() {
    document.querySelectorAll('.color-filter-group').forEach(group => {
        const color = group.dataset.color;
        if (color && colorLabels[color]) {
            const labelElement = group.querySelector('.filter-label');
            if (labelElement) {
                labelElement.textContent = colorLabels[color];
            }
        }
    });
}

// Handle edit label button clicks
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('edit-label-button')) {
        const group = e.target.closest('.color-filter-group');
        const color = group.dataset.color;
        const currentLabel = colorLabels[color] || group.querySelector('.color-filter').textContent;
        
        // Create and show modal
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="edit-label-modal">
                <input type="text" value="${currentLabel}" placeholder="Enter color label">
                <div class="modal-actions">
                    <button class="cancel-edit">Cancel</button>
                    <button class="save-edit">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const input = modal.querySelector('input');
        input.focus();
        input.select();
        
        // Handle modal actions
        modal.addEventListener('click', async (e) => {
            if (e.target.classList.contains('save-edit')) {
                const newLabel = input.value.trim();
                if (newLabel) {
                    colorLabels[color] = newLabel;
                    await chrome.storage.local.set({ colorLabels });
                    updateColorFilterLabels();
                }
                modal.remove();
            } else if (e.target.classList.contains('cancel-edit') || e.target.classList.contains('modal-backdrop')) {
                modal.remove();
            }
        });
        
        // Handle Enter key
        input.addEventListener('keyup', async (e) => {
            if (e.key === 'Enter') {
                const newLabel = input.value.trim();
                if (newLabel) {
                    colorLabels[color] = newLabel;
                    await chrome.storage.local.set({ colorLabels });
                    updateColorFilterLabels();
                }
                modal.remove();
            } else if (e.key === 'Escape') {
                modal.remove();
            }
        });
    }
});

// Load color labels when the page loads
document.addEventListener('DOMContentLoaded', loadColorLabels);

// Update the click handler for color filters
document.addEventListener('click', e => {
    const colorFilter = e.target.closest('.color-filter');
    if (colorFilter) {
        const group = colorFilter.closest('.color-filter-group');
        if (group) {
            // Remove active class from all filters
            document.querySelectorAll('.color-filter').forEach(f => f.classList.remove('active'));
            colorFilter.classList.add('active');
            
            // Update active color filter
            activeColorFilter = group.dataset.color;
            
            // Display filtered highlights
            displayColorFilteredHighlights();
        } else if (colorFilter.dataset.color === 'all') {
            // Handle "All Colors" button
            document.querySelectorAll('.color-filter').forEach(f => f.classList.remove('active'));
            colorFilter.classList.add('active');
            activeColorFilter = null;
            displayColorFilteredHighlights();
        }
    }
});

// Update import button handlers
document.querySelector('.import-file-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
});

document.querySelector('.import-notion-btn').addEventListener('click', async () => {
    try {
        // Show loading state
        const importButton = document.querySelector('.import-notion-btn');
        const originalContent = importButton.innerHTML;
        importButton.innerHTML = 'Importing...';
        importButton.disabled = true;

        // Request import from background script
        const response = await chrome.runtime.sendMessage({ action: 'importFromNotion' });
        
        if (response.success) {
            // Update local highlights
            allHighlights = response.highlights;
            
            // Refresh current view
            if (currentView === 'home') {
                displayPagesList();
            } else if (currentView === 'tags') {
                displayColorFilteredHighlights();
            } else if (currentView === 'notes') {
                displayNotesView();
            }
            
            alert(`Successfully imported ${response.newCount} new highlights from Notion!`);
        } else {
            alert('Failed to import highlights from Notion');
        }

        // Restore button state
        importButton.innerHTML = originalContent;
        importButton.disabled = false;
    } catch (error) {
        console.error('Import error:', error);
        alert('Error importing highlights from Notion');
    }
});

// Add backup button handler
document.querySelector('.backup-button').addEventListener('click', async () => {
    try {
        const backupButton = document.querySelector('.backup-button');
        const originalContent = backupButton.innerHTML;
        backupButton.innerHTML = '<span class="loading">Backing up...</span>';
        backupButton.disabled = true;

        const response = await chrome.runtime.sendMessage({ action: 'backupToNotion' });
        
        if (response.success) {
            alert('Successfully backed up highlights to Notion!');
        } else {
            alert('Failed to backup highlights to Notion');
        }

        backupButton.innerHTML = originalContent;
        backupButton.disabled = false;
    } catch (error) {
        console.error('Backup error:', error);
        alert('Error backing up highlights to Notion');
    }
});

// Add listener for highlights updates
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'highlightsUpdated') {
        // Update the highlights array
        allHighlights = message.highlights;
        
        // Refresh current view
        if (currentView === 'home') {
            displayPagesList();
        } else if (currentView === 'tags') {
            displayColorFilteredHighlights();
        } else if (currentView === 'notes') {
            displayNotesView();
        }
    }
});