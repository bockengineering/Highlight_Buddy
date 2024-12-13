let currentView = 'pages';
let allHighlights = [];

async function loadHighlights() {
    const { highlights = [] } = await chrome.storage.local.get('highlights');
    allHighlights = highlights;
    displayPagesList();
}

function displayPagesList() {
    const todayContainer = document.getElementById('today-highlights');
    if (!todayContainer) return; // Guard against null container
    
    todayContainer.innerHTML = '';
    
    // Group highlights by URL and date
    const today = new Date().toDateString();
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
    
    // Clear previous content and ensure search is cleared
    document.getElementById('search').value = '';
    
    document.querySelector('.highlights-container').innerHTML = `
        <div id="pages-view" class="view">
            <div class="date-section" id="today-section">
                <h3>Today</h3>
                <div id="today-highlights"></div>
            </div>
        </div>
        <div id="page-highlights-view" class="view hidden">
            <div class="page-header">
                <button class="back-button">Back</button>
                <h2 class="page-title"></h2>
            </div>
            <div id="page-highlights" class="highlights-list"></div>
        </div>
    `;
    
    // Add back button listener after creating the element
    document.querySelector('.back-button').addEventListener('click', () => {
        document.getElementById('page-highlights-view').classList.add('hidden');
        document.getElementById('pages-view').classList.remove('hidden');
    });
    
    // Re-get containers after recreating the DOM
    const todaySection = document.getElementById('today-section');
    const todayHighlights = document.getElementById('today-highlights');
    
    if (!todayHighlights) return; // Guard against null container
    
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
                <span>${highlightCount} Highlight${highlightCount !== 1 ? 's' : ''}</span>
                <span>${noteCount} Note${noteCount !== 1 ? 's' : ''}</span>
            </div>
        `;
        
        pageEntry.addEventListener('click', () => {
            showPageHighlights(page);
        });
        
        // Add all entries to today's section for now
        todayHighlights.appendChild(pageEntry);
    });
    
    // Only show Today section if there are highlights
    if (todaySection && !todayHighlights.hasChildNodes()) {
        todaySection.style.display = 'none';
    } else if (todaySection) {
        todaySection.style.display = 'block';
    }
}

function showPageHighlights(page) {
    currentView = 'highlights';
    document.getElementById('pages-view').classList.add('hidden');
    document.getElementById('page-highlights-view').classList.remove('hidden');
    
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

// Update search functionality to search through highlight text and notes
document.getElementById('search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        // Reconstruct the entire view when search is cleared
        document.querySelector('.highlights-container').innerHTML = `
            <div id="pages-view" class="view">
                <div class="date-section" id="today-section">
                    <h3>Today</h3>
                    <div id="today-highlights"></div>
                </div>
            </div>
            <div id="page-highlights-view" class="view hidden">
                <div class="page-header">
                    <button class="back-button">Back</button>
                    <h2 class="page-title"></h2>
                </div>
                <div id="page-highlights" class="highlights-list"></div>
            </div>
        `;
        
        // Add back button listener
        document.querySelector('.back-button').addEventListener('click', () => {
            document.getElementById('page-highlights-view').classList.add('hidden');
            document.getElementById('pages-view').classList.remove('hidden');
        });
        
        displayPagesList();
        return;
    }

    // Filter highlights that match the search term in text, title, or notes
    const filteredHighlights = allHighlights.filter(h => 
        h.text.toLowerCase().includes(searchTerm) ||
        h.title.toLowerCase().includes(searchTerm) ||
        (h.note && h.note.toLowerCase().includes(searchTerm))
    );

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
        // Count notes for this page
        if (highlight.note) {
            acc[highlight.url].noteCount++;
        }
        return acc;
    }, {});

    // Update the display with filtered results
    const todaySection = document.getElementById('today-section');
    const todayHighlights = document.getElementById('today-highlights');
    todayHighlights.innerHTML = '';
    
    Object.values(filteredGroups).forEach(page => {
        const pageEntry = document.createElement('div');
        pageEntry.className = 'page-entry';
        
        const highlightCount = page.highlights.length;
        
        pageEntry.innerHTML = `
            <div class="page-entry-title">
                <img src="${page.favicon}" alt="">
                ${page.title}
            </div>
            <div class="page-entry-stats">
                <span>${highlightCount} Highlight${highlightCount !== 1 ? 's' : ''}</span>
                <span>${page.noteCount} Note${page.noteCount !== 1 ? 's' : ''}</span>
            </div>
        `;
        
        pageEntry.addEventListener('click', () => {
            showPageHighlights(page);
        });
        
        todayHighlights.appendChild(pageEntry);
    });

    // Show/hide the today section based on results
    todaySection.style.display = todayHighlights.hasChildNodes() ? 'block' : 'none';
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