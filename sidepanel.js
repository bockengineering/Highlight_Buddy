let currentView = 'home';
let allHighlights = [];
let activeColorFilter = null;

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
            if (view === 'tags') {
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
        
        container.appendChild(entry);
    });
}

async function loadHighlights() {
    const { highlights = [] } = await chrome.storage.local.get('highlights');
    allHighlights = highlights;
    displayPagesList();
}

function displayPagesList() {
    const todayContainer = document.getElementById('today-highlights');
    if (!todayContainer) return;
    
    // Clear previous content and ensure search is cleared
    document.getElementById('search').value = '';
    
    // Preserve existing views and update only the home view content
    const homeView = document.getElementById('home-view');
    if (homeView) {
        homeView.innerHTML = `
            <div class="date-section" id="today-section">
                <h3>This month</h3>
                <div id="today-highlights"></div>
            </div>
        `;
    }
    
    // Group highlights by URL and date
    const pageGroups = allHighlights.reduce((acc, highlight) => {
        if (!acc[highlight.url]) {
            acc[highlight.url] = {
                title: highlight.title,
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
    
    // Get the highlights container after potential DOM update
    const todayHighlights = document.getElementById('today-highlights');
    if (!todayHighlights) return;
    
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

// Update search functionality to preserve views
document.getElementById('search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        displayPagesList();
        return;
    }
    // ... rest of the search function code ...
});

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
document.querySelector('.export-button').addEventListener('click', exportHighlights);

function exportHighlights() {
    // Create CSV content
    const csvRows = [
        // Header row
        ['Date', 'Website', 'Title', 'Text', 'Color', 'Note']
    ];
    
    // Add data rows
    allHighlights.forEach(highlight => {
        csvRows.push([
            new Date(highlight.timestamp).toLocaleString(),
            highlight.website,
            highlight.title,
            highlight.text,
            highlight.color || '#ffeb3b',
            highlight.note || ''
        ]);
    });
    
    // Convert to CSV string
    const csvContent = csvRows.map(row => 
        row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `highlights-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}