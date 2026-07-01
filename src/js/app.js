import { SplashScreen } from '@capacitor/splash-screen';
import { Camera, CameraResultType } from '@capacitor/camera';

// State Management
const state = {
  currentTab: 'search', // 'search' or 'saved'
  searchResults: [],
  savedArticles: JSON.parse(localStorage.getItem('saved_articles') || '{}'),
  searchHistory: JSON.parse(localStorage.getItem('search_history') || '[]'),
  currentArticle: null,
  isOnline: navigator.onLine,
};

// Elements
const els = {
  tabSearch: document.getElementById('tab-search'),
  tabSaved: document.getElementById('tab-saved'),
  viewSearch: document.getElementById('view-search'),
  viewSaved: document.getElementById('view-saved'),
  searchForm: document.getElementById('search-form'),
  searchInput: document.getElementById('search-input'),
  resultsList: document.getElementById('results-list'),
  savedList: document.getElementById('saved-list'),
  historyContainer: document.getElementById('history-container'),
  connectionStatus: document.getElementById('connection-status'),
  articleModal: document.getElementById('article-modal'),
  modalClose: document.getElementById('modal-close'),
  modalTitle: document.getElementById('modal-title'),
  modalCover: document.getElementById('modal-cover'),
  modalChangeCover: document.getElementById('modal-change-cover'),
  modalContent: document.getElementById('modal-content'),
  modalSaveBtn: document.getElementById('modal-save-btn'),
};

// Initialize Application
async function init() {
  // Hide native splash screen
  try {
    await SplashScreen.hide();
  } catch (e) {
    console.log('Splashscreen not available in browser');
  }

  // Bind Events
  bindEvents();
  
  // Render Initial Views
  updateOnlineStatus();
  renderSavedArticles();
  renderSearchHistory();
}

// Bind event listeners
function bindEvents() {
  // Tab Switching
  els.tabSearch.addEventListener('click', () => switchTab('search'));
  els.tabSaved.addEventListener('click', () => switchTab('saved'));

  // Search Action
  els.searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = els.searchInput.value.trim();
    if (query) {
      await performSearch(query);
    }
  });

  // Connection listeners
  window.addEventListener('online', () => {
    state.isOnline = true;
    updateOnlineStatus();
  });
  window.addEventListener('offline', () => {
    state.isOnline = false;
    updateOnlineStatus();
  });

  // Modal actions
  els.modalClose.addEventListener('click', closeModal);
  els.modalSaveBtn.addEventListener('click', toggleSaveCurrentArticle);
  els.modalChangeCover.addEventListener('click', changeCurrentArticleCover);

  // Close modal on click outside content
  els.articleModal.addEventListener('click', (e) => {
    if (e.target === els.articleModal) {
      closeModal();
    }
  });
}

// Switch tabs between search and saved articles
function switchTab(tabName) {
  state.currentTab = tabName;
  if (tabName === 'search') {
    els.tabSearch.classList.add('active');
    els.tabSaved.classList.remove('active');
    els.viewSearch.classList.add('active');
    els.viewSaved.classList.remove('active');
  } else {
    els.tabSearch.classList.remove('active');
    els.tabSaved.classList.add('active');
    els.viewSearch.classList.remove('active');
    els.viewSaved.classList.add('active');
    renderSavedArticles();
  }
}

// Update the connection status UI
function updateOnlineStatus() {
  state.isOnline = navigator.onLine;
  if (state.isOnline) {
    els.connectionStatus.innerHTML = '<span class="status-dot online"></span><span>Online</span>';
    els.searchInput.disabled = false;
    els.searchInput.placeholder = "Search Wikipedia...";
  } else {
    els.connectionStatus.innerHTML = '<span class="status-dot offline"></span><span>Offline</span>';
    els.searchInput.disabled = true;
    els.searchInput.placeholder = "No connection...";
  }
}

// Perform search against Wikipedia API
async function performSearch(query) {
  if (!state.isOnline) {
    showToast("You are offline. Search is not available.");
    return;
  }

  showLoader(true, 'Searching Wikipedia...');
  addToHistory(query);

  try {
    // Wikipedia API call to search pages and get extracts + pageimages
    const url = `https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&generator=search&gsrnamespace=0&gsrlimit=12&prop=pageimages|extracts&pilimit=max&exintro&explaintext&exchars=240&exlimit=max&gsrsearch=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    els.resultsList.innerHTML = '';
    
    if (data.query && data.query.pages) {
      state.searchResults = Object.values(data.query.pages).sort((a, b) => a.index - b.index);
      renderSearchResults(state.searchResults);
    } else {
      els.resultsList.innerHTML = `
        <div class="empty-state">
          <p>No results found for "${query}"</p>
        </div>`;
    }
  } catch (error) {
    console.error("Search failed", error);
    showToast("Error searching Wikipedia. Please try again.");
  } finally {
    showLoader(false);
  }
}

// Render search results
function renderSearchResults(pages) {
  els.resultsList.innerHTML = pages.map(page => {
    const thumbUrl = page.thumbnail ? page.thumbnail.source : null;
    const thumbnailHtml = thumbUrl 
      ? `<div class="result-img" style="background-image: url('${thumbUrl}')"></div>`
      : `<div class="result-img-placeholder"><i class="icon-book">📖</i></div>`;
      
    return `
      <div class="result-card" data-pageid="${page.pageid}">
        ${thumbnailHtml}
        <div class="result-info">
          <h3>${page.title}</h3>
          <p>${page.extract || 'No preview available.'}</p>
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers to result cards
  els.resultsList.querySelectorAll('.result-card').forEach(card => {
    card.addEventListener('click', () => {
      const pageid = card.dataset.pageid;
      const page = state.searchResults.find(p => p.pageid == pageid);
      if (page) {
        openArticle(page.title, pageid);
      }
    });
  });
}

// Fetch full article contents (or read from cache if offline/saved)
async function openArticle(title, pageid) {
  const isSaved = !!state.savedArticles[title];
  
  if (isSaved) {
    // Load from local storage
    const localData = state.savedArticles[title];
    displayArticle(localData);
  } else {
    if (!state.isOnline) {
      showToast("Cannot fetch full article while offline.");
      return;
    }
    
    showLoader(true, 'Loading article...');
    try {
      // Fetch full content HTML from Wikipedia API Parse action
      const url = `https://en.wikipedia.org/w/api.php?action=parse&origin=*&format=json&page=${encodeURIComponent(title)}&prop=text&mobileformat=1&disableeditsection=1`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.parse && data.parse.text) {
        const pageSource = state.searchResults.find(p => p.pageid == pageid) || {};
        const articleData = {
          title: title,
          pageid: pageid,
          html: cleanWikiHtml(data.parse.text['*']),
          summary: pageSource.extract || '',
          coverPhoto: pageSource.thumbnail ? pageSource.thumbnail.source : null,
          savedAt: new Date().toISOString()
        };
        displayArticle(articleData);
      } else {
        showToast("Could not retrieve article content.");
      }
    } catch (error) {
      console.error("Failed to load article", error);
      showToast("Failed to load article.");
    } finally {
      showLoader(false);
    }
  }
}

// Clean Wikipedia HTML links to make them secure and disable links that navigate away
function cleanWikiHtml(html) {
  // Replace links pointing to wikipedia pages with custom data attributes or disable them
  let cleaned = html.replace(/href="\/wiki\/([^"]+)"/g, 'href="#" class="wiki-link" data-title="$1"');
  cleaned = cleaned.replace(/href="\/\/en\.wikipedia\.org\/wiki\/([^"]+)"/g, 'href="#" class="wiki-link" data-title="$1"');
  cleaned = cleaned.replace(/href="http[^"]+"/g, 'target="_blank"');
  return cleaned;
}

// Display article in modal
function displayArticle(articleData) {
  state.currentArticle = articleData;
  els.modalTitle.textContent = articleData.title;
  els.modalContent.innerHTML = articleData.html;
  
  // Set up cover photo
  if (articleData.coverPhoto) {
    els.modalCover.style.display = 'block';
    els.modalCover.style.backgroundImage = `url('${articleData.coverPhoto}')`;
    els.modalChangeCover.innerHTML = '📷 Change Cover';
  } else {
    els.modalCover.style.display = 'none';
    els.modalChangeCover.innerHTML = '📷 Add Cover';
  }
  
  // Adjust Save Button
  const isSaved = !!state.savedArticles[articleData.title];
  updateSaveButtonUI(isSaved);
  
  // Bind article internal wiki links
  els.modalContent.querySelectorAll('.wiki-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const nextTitle = decodeURIComponent(link.dataset.title.replace(/_/g, ' '));
      openArticle(nextTitle, null);
    });
  });
  
  // Show Modal
  els.articleModal.classList.add('active');
  document.body.style.overflow = 'hidden'; // Lock background scroll
}

// Close Modal
function closeModal() {
  els.articleModal.classList.remove('active');
  document.body.style.overflow = '';
  state.currentArticle = null;
}

// Update Save Button state
function updateSaveButtonUI(isSaved) {
  if (isSaved) {
    els.modalSaveBtn.innerHTML = '🗑 Remove Offline';
    els.modalSaveBtn.classList.add('saved');
  } else {
    els.modalSaveBtn.innerHTML = '💾 Save Offline';
    els.modalSaveBtn.classList.remove('saved');
  }
}

// Toggle local save state
function toggleSaveCurrentArticle() {
  if (!state.currentArticle) return;
  
  const title = state.currentArticle.title;
  const isSaved = !!state.savedArticles[title];
  
  if (isSaved) {
    delete state.savedArticles[title];
    showToast(`Removed "${title}" from offline storage`);
  } else {
    state.savedArticles[title] = {
      ...state.currentArticle,
      savedAt: new Date().toISOString()
    };
    showToast(`Saved "${title}" offline!`);
  }
  
  localStorage.setItem('saved_articles', JSON.stringify(state.savedArticles));
  updateSaveButtonUI(!isSaved);
  renderSavedArticles();
}

// Use native camera plugin to change cover photo
async function changeCurrentArticleCover() {
  if (!state.currentArticle) return;
  
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.Uri
    });
    
    // Update current article object
    state.currentArticle.coverPhoto = image.webPath;
    
    // Set UI cover photo
    els.modalCover.style.display = 'block';
    els.modalCover.style.backgroundImage = `url('${image.webPath}')`;
    els.modalChangeCover.innerHTML = '📷 Change Cover';
    
    // If already saved, update local storage cache too
    const title = state.currentArticle.title;
    if (state.savedArticles[title]) {
      state.savedArticles[title].coverPhoto = image.webPath;
      localStorage.setItem('saved_articles', JSON.stringify(state.savedArticles));
      renderSavedArticles();
    }
    
    showToast("Cover photo updated!");
  } catch (error) {
    console.error("Camera error", error);
    // Silent fail if user cancels
  }
}

// Render saved articles tab
function renderSavedArticles() {
  const articles = Object.values(state.savedArticles).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  
  if (articles.length === 0) {
    els.savedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <p>No saved articles yet.</p>
        <p class="sub-p">Search for articles and click "Save Offline" to read them here without internet connection.</p>
      </div>`;
    return;
  }
  
  els.savedList.innerHTML = articles.map(art => {
    const coverHtml = art.coverPhoto
      ? `<div class="saved-img" style="background-image: url('${art.coverPhoto}')"></div>`
      : `<div class="saved-img-placeholder">📖</div>`;
      
    return `
      <div class="saved-card" data-title="${art.title}">
        ${coverHtml}
        <div class="saved-info">
          <h3>${art.title}</h3>
          <p>${art.summary || 'Click to read article content.'}</p>
          <span class="saved-date">Saved: ${new Date(art.savedAt).toLocaleDateString()}</span>
        </div>
      </div>
    `;
  }).join('');
  
  // Bind click events
  els.savedList.querySelectorAll('.saved-card').forEach(card => {
    card.addEventListener('click', () => {
      const title = card.dataset.title;
      openArticle(title, null);
    });
  });
}

// Handle Search History
function addToHistory(query) {
  state.searchHistory = state.searchHistory.filter(q => q.toLowerCase() !== query.toLowerCase());
  state.searchHistory.unshift(query);
  // Cap history at 5 items
  if (state.searchHistory.length > 5) {
    state.searchHistory.pop();
  }
  localStorage.setItem('search_history', JSON.stringify(state.searchHistory));
  renderSearchHistory();
}

function renderSearchHistory() {
  if (state.searchHistory.length === 0) {
    els.historyContainer.innerHTML = '';
    return;
  }
  
  els.historyContainer.innerHTML = `
    <div class="history-title">Recent Searches</div>
    <div class="history-tags">
      ${state.searchHistory.map(q => `<span class="history-tag">${q}</span>`).join('')}
    </div>
  `;
  
  els.historyContainer.querySelectorAll('.history-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      els.searchInput.value = tag.textContent;
      performSearch(tag.textContent);
    });
  });
}

// Utility UI Helpers
function showLoader(show, message = 'Loading...') {
  let loader = document.getElementById('loader');
  if (!loader && show) {
    loader = document.createElement('div');
    loader.id = 'loader';
    loader.className = 'loader-overlay';
    loader.innerHTML = `<div class="spinner"></div><span class="loader-text">${message}</span>`;
    document.querySelector('.app-container').appendChild(loader);
  } else if (loader && !show) {
    loader.remove();
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Fade in
  setTimeout(() => toast.classList.add('visible'), 50);
  
  // Fade out and remove
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Run App
window.addEventListener('DOMContentLoaded', init);
