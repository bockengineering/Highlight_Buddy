function formatDate(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inputDate = new Date(date);
  
  if (inputDate >= today) {
    return 'Today';
  }
  
  return new Intl.DateTimeFormat('en-US', { 
    year: 'numeric',
    month: 'long'
  }).format(inputDate);
}

async function displayHighlights() {
  const { highlights = [] } = await chrome.storage.local.get('highlights');
  const container = document.getElementById('highlights-list');
  container.innerHTML = '';
  
  if (highlights.length === 0) {
    container.innerHTML = '<div class="no-highlights">No highlights yet</div>';
    return;
  }
  
  // Group highlights by month
  const grouped = highlights.reduce((acc, highlight) => {
    const monthYear = formatDate(highlight.timestamp);
    if (!acc[monthYear]) {
      acc[monthYear] = [];
    }
    acc[monthYear].push(highlight);
    return acc;
  }, {});
  
  // Sort months with "Today" first, then by date descending
  const sortedMonths = Object.keys(grouped).sort((a, b) => {
    if (a === 'Today') return -1;
    if (b === 'Today') return 1;
    return new Date(b) - new Date(a);
  });
  
  // Sort highlights within each month by timestamp (newest first)
  sortedMonths.forEach(month => {
    grouped[month].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const monthSection = document.createElement('div');
    monthSection.className = 'month-section';
    
    const monthHeader = document.createElement('div');
    monthHeader.className = 'month-header';
    monthHeader.textContent = month;
    monthSection.appendChild(monthHeader);
    
    grouped[month].forEach(highlight => {
      const entry = document.createElement('div');
      entry.className = 'highlight-entry';
      entry.setAttribute('data-highlight-id', highlight.id);
      
      // Make entries clickable to open the original page
      entry.addEventListener('click', () => {
        chrome.tabs.create({ url: highlight.url });
      });
      
      const content = document.createElement('div');
      content.className = 'entry-content';
      
      const title = document.createElement('div');
      title.className = 'entry-title';
      title.textContent = highlight.title || new URL(highlight.url).hostname;
      
      const text = document.createElement('div');
      text.className = 'entry-text';
      text.textContent = highlight.text;
      
      content.appendChild(title);
      content.appendChild(text);
      
      entry.appendChild(content);
      monthSection.appendChild(entry);
    });
    
    container.appendChild(monthSection);
  });
}

// Search functionality
const searchBar = document.querySelector('.search-bar');
searchBar.addEventListener('input', displayHighlights);

document.addEventListener('DOMContentLoaded', displayHighlights); 