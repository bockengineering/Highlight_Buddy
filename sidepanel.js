let currentView = 'pages';
let allHighlights = [];

async function loadHighlights() {
    const { highlights = [] } = await chrome.storage.local.get('highlights');
    allHighlights = highlights;
    displayPagesList();
}

function displayPagesList() {
    const todayContainer = document.getElementById('today-highlights');
    const monthlyContainer = document.getElementById('monthly-highlights');
    todayContainer.innerHTML = '';
    monthlyContainer.innerHTML = '';
    
    // Group highlights by URL and date
    const today = new Date().toDateString();
    const pageGroups = allHighlights.reduce((acc, highlight) => {
        if (!acc[highlight.url]) {
            acc[highlight.url] = {
                title: highlight.title,
                url: highlight.url,
                highlights: [],
                favicon: `https://www.google.com/s2/favicons?domain=${new URL(highlight.url).hostname}`,
                date: new Date(highlight.timestamp).toDateString()
            };
        }
        acc[highlight.url].highlights.push(highlight);
        return acc;
    }, {});
    
    Object.values(pageGroups).forEach(page => {
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
                <span>0 Notes</span>
            </div>
        `;
        
        pageEntry.addEventListener('click', () => {
            showPageHighlights(page);
        });
        
        if (page.date === today) {
            todayContainer.appendChild(pageEntry);
        } else {
            monthlyContainer.appendChild(pageEntry);
        }
    });
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
    
    if (page.highlights.length === 0) {
        container.innerHTML = '<div class="no-highlights">No highlights yet</div>';
        return;
    }
    
    page.highlights.forEach(highlight => {
        const entry = document.createElement('div');
        entry.className = 'highlight-entry';
        entry.style.setProperty('--highlight-color', highlight.color || '#ffeb3b');
        
        entry.innerHTML = `
            <div class="entry-text">${highlight.text}</div>
            <div class="entry-meta">
                <span>${formatDate(highlight.timestamp)}</span>
                <span>${new URL(highlight.url).hostname}</span>
            </div>
        `;
        
        entry.addEventListener('click', () => {
            chrome.tabs.create({ url: highlight.url });
        });
        
        container.appendChild(entry);
    });
}

// Back button handler
document.querySelector('.back-button').addEventListener('click', () => {
    currentView = 'pages';
    document.getElementById('page-highlights-view').classList.add('hidden');
    document.getElementById('pages-view').classList.remove('hidden');
});

// Search functionality
document.getElementById('search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    if (currentView === 'pages') {
        const filtered = allHighlights.filter(h => 
            h.text.toLowerCase().includes(searchTerm) ||
            h.title.toLowerCase().includes(searchTerm)
        );
        displayPagesList(filtered);
    }
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