import { SplashScreen } from '@capacitor/splash-screen';
import { Camera, CameraResultType } from '@capacitor/camera';

// Backend API base URL.
// For on-device testing over USB, use "localhost" together with:
//   adb reverse tcp:5000 tcp:5000
// which forwards the phone's localhost:5000 to this laptop's backend.
// (If testing over Wi-Fi instead, set this to your laptop's LAN IP, e.g.
//  http://192.168.1.17:5000, and ensure the phone can reach it.)
const API_BASE = 'http://localhost:5000';

// State Management
const state = {
   currentTab: 'search',
   searchResults: [],
   savedArticles: {},
   searchHistory: [],
   myFiles: {},
   currentArticle: null,
   currentFile: null,
   pendingFile: null,
   isOnline: navigator.onLine,
   user: null,
   token: localStorage.getItem('auth_token') || null,
};

// Elements
const els = {
   tabSearch: document.getElementById('tab-search'),
   tabSaved: document.getElementById('tab-saved'),
   tabFiles: document.getElementById('tab-files'),
   viewSearch: document.getElementById('view-search'),
   viewSaved: document.getElementById('view-saved'),
   viewFiles: document.getElementById('view-files'),
   searchForm: document.getElementById('search-form'),
   searchInput: document.getElementById('search-input'),
   resultsList: document.getElementById('results-list'),
   savedList: document.getElementById('saved-list'),
   filesList: document.getElementById('files-list'),
   historyContainer: document.getElementById('history-container'),
   connectionStatus: document.getElementById('connection-status'),
   articleModal: document.getElementById('article-modal'),
   modalClose: document.getElementById('modal-close'),
   modalTitle: document.getElementById('modal-title'),
   modalCover: document.getElementById('modal-cover'),
   modalChangeCover: document.getElementById('modal-change-cover'),
   modalSaveBtn: document.getElementById('modal-save-btn'),
   uploadZone: document.getElementById('upload-zone'),
   fileInput: document.getElementById('file-input'),
   uploadBrowseBtn: document.getElementById('upload-browse-btn'),
   fileFormContainer: document.getElementById('file-form-container'),
   fileFormIcon: document.getElementById('file-form-icon'),
   fileFormName: document.getElementById('file-form-name'),
   fileFormSize: document.getElementById('file-form-size'),
   fileFormCancel: document.getElementById('file-form-cancel'),
   fileTitleInput: document.getElementById('file-title-input'),
   fileAddBtn: document.getElementById('file-add-btn'),
   fileModal: document.getElementById('file-modal'),
   fileModalClose: document.getElementById('file-modal-close'),
   fileModalTitle: document.getElementById('file-modal-title'),
   fileModalMeta: document.getElementById('file-modal-meta'),
   fileModalContent: document.getElementById('file-modal-content'),
   fileModalBadge: document.getElementById('file-modal-badge'),
   fileModalDelete: document.getElementById('file-modal-delete'),
   authModal: document.getElementById('auth-modal'),
   authForm: document.getElementById('auth-form'),
   authName: document.getElementById('auth-name'),
   authEmail: document.getElementById('auth-email'),
   authPassword: document.getElementById('auth-password'),
   authSubmit: document.getElementById('auth-submit'),
   authError: document.getElementById('auth-error'),
   authSwitchText: document.getElementById('auth-switch-text'),
   authSwitchBtn: document.getElementById('auth-switch-btn'),
   authClose: document.getElementById('auth-close'),
   authBtn: document.getElementById('auth-btn'),
   registerFields: document.getElementById('register-fields'),
   authTitle: document.getElementById('auth-title'),
};

// Initialize Application
async function init() {
   try {
     await SplashScreen.hide();
   } catch (e) {
     console.log('Splashscreen not available in browser');
   }

   bindEvents();
   
   if (state.token) {
     await loadUserData();
   }
   
   updateOnlineStatus();
   renderSavedArticles();
   renderSearchHistory();
   renderMyFiles();
}

// Bind event listeners
function bindEvents() {
  // Tab Switching
  els.tabSearch.addEventListener('click', () => switchTab('search'));
  els.tabSaved.addEventListener('click', () => switchTab('saved'));
  els.tabFiles.addEventListener('click', () => switchTab('files'));

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

  // ── File Upload Events ──
  // Click on zone (or the button inside it) triggers file input
  els.uploadZone.addEventListener('click', (e) => {
    els.fileInput.click();
  });
  els.uploadBrowseBtn.addEventListener('click', () => els.fileInput.click());

  // Drag & Drop
  els.uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.uploadZone.classList.add('drag-over');
  });
  els.uploadZone.addEventListener('dragleave', () => els.uploadZone.classList.remove('drag-over'));
  els.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  });

  // File input change
  els.fileInput.addEventListener('change', () => {
    const file = els.fileInput.files[0];
    if (file) handleFileSelected(file);
  });

  // Cancel adding file
  els.fileFormCancel.addEventListener('click', cancelFileForm);

  // Add file to My Files
  els.fileAddBtn.addEventListener('click', addFileToLibrary);
  els.fileTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addFileToLibrary();
  });

  // File Viewer Modal
  els.fileModalClose.addEventListener('click', closeFileModal);
  els.fileModal.addEventListener('click', (e) => {
    if (e.target === els.fileModal) closeFileModal();
  });
els.fileModalDelete.addEventListener('click', deleteCurrentFile);
   
   // Auth events
   els.authBtn.addEventListener('click', openAuthModal);
   els.authClose.addEventListener('click', closeAuthModal);
   els.authForm.addEventListener('submit', handleAuthSubmit);
   els.authSwitchBtn.addEventListener('click', toggleAuthMode);
   els.authModal.addEventListener('click', (e) => {
     if (e.target === els.authModal) closeAuthModal();
   });
 }

// Switch tabs between search, saved articles, and my files
function switchTab(tabName) {
  state.currentTab = tabName;
  [els.tabSearch, els.tabSaved, els.tabFiles].forEach(btn => {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
  });
  [els.viewSearch, els.viewSaved, els.viewFiles].forEach(v => v.classList.remove('active'));

  if (tabName === 'search') {
    els.tabSearch.classList.add('active');
    els.tabSearch.setAttribute('aria-selected', 'true');
    els.viewSearch.classList.add('active');
  } else if (tabName === 'saved') {
    els.tabSaved.classList.add('active');
    els.tabSaved.setAttribute('aria-selected', 'true');
    els.viewSaved.classList.add('active');
    renderSavedArticles();
  } else if (tabName === 'files') {
    els.tabFiles.classList.add('active');
    els.tabFiles.setAttribute('aria-selected', 'true');
    els.viewFiles.classList.add('active');
    renderMyFiles();
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
async function toggleSaveCurrentArticle() {
   if (!state.currentArticle) return;
   
   const title = state.currentArticle.title;
   const isSaved = !!state.savedArticles[title];
   
   if (isSaved) {
     const articleToRemove = state.savedArticles[title];
     delete state.savedArticles[title];
     showToast(`Removed "${title}" from offline storage`);
     if (state.token && articleToRemove._id) {
        await fetch(`${API_BASE}/api/auth/saved-articles/${articleToRemove._id}`, {
         method: 'DELETE',
         headers: { 'Authorization': `Bearer ${state.token}` }
       });
     }
   } else {
     const savedArticle = {
       title: state.currentArticle.title,
       pageid: state.currentArticle.pageid,
       html: state.currentArticle.html,
       summary: state.currentArticle.summary,
       coverPhoto: state.currentArticle.coverPhoto,
       savedAt: new Date().toISOString()
     };
     state.savedArticles[title] = savedArticle;
     showToast(`Saved "${title}" offline!`);
     if (state.token) {
        const res = await fetch(`${API_BASE}/api/auth/saved-articles`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
         body: JSON.stringify(savedArticle)
       });
       const data = await res.json();
       if (data.article) {
         savedArticle._id = data.article._id;
         state.savedArticles[title] = savedArticle;
       }
     }
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

// ═══════════════════════════════════════════
//   MY FILES — File Upload & Reader Feature
// ═══════════════════════════════════════════

// Map file extensions to emoji icons and type labels
const FILE_TYPE_MAP = {
  txt:  { icon: '📄', label: 'TXT',  color: '#0c447c' },
  md:   { icon: '📝', label: 'MD',   color: '#7c3a8c' },
  pdf:  { icon: '📕', label: 'PDF',  color: '#c0392b' },
  doc:  { icon: '📘', label: 'DOC',  color: '#1a5fa0' },
  docx: { icon: '📘', label: 'DOCX', color: '#1a5fa0' },
  csv:  { icon: '📊', label: 'CSV',  color: '#16a34a' },
  json: { icon: '🔧', label: 'JSON', color: '#d97706' },
  xml:  { icon: '🗂',  label: 'XML',  color: '#7c5c3a' },
  html: { icon: '🌐', label: 'HTML', color: '#0c447c' },
  rtf:  { icon: '📃', label: 'RTF',  color: '#555' },
};

function getFileExt(filename) {
  return filename.split('.').pop().toLowerCase();
}

function getFileType(filename) {
  const ext = getFileExt(filename);
  return FILE_TYPE_MAP[ext] || { icon: '📎', label: ext.toUpperCase(), color: '#666' };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Called when user picks a file from the input or drag & drops
function handleFileSelected(file) {
  state.pendingFile = file;
  const type = getFileType(file.name);

  // Show the form, hide the upload zone
  els.uploadZone.style.display = 'none';
  els.fileFormContainer.style.display = 'block';

  // Fill in preview info
  els.fileFormIcon.textContent = type.icon;
  els.fileFormName.textContent = file.name;
  els.fileFormSize.textContent = formatBytes(file.size);

  // Pre-fill title with the filename (without extension)
  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  els.fileTitleInput.value = baseName.charAt(0).toUpperCase() + baseName.slice(1);
  els.fileTitleInput.select();
  els.fileTitleInput.focus();
}

function cancelFileForm() {
  state.pendingFile = null;
  els.fileInput.value = '';
  els.fileFormContainer.style.display = 'none';
  els.uploadZone.style.display = '';
  els.fileTitleInput.value = '';
}

// Read text content from supported file types
function readFileContent(file) {
  return new Promise((resolve) => {
    const ext = getFileExt(file.name);
    const textTypes = ['txt', 'md', 'csv', 'json', 'xml', 'html', 'rtf'];

    if (textTypes.includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ text: e.target.result, binary: false });
      reader.onerror = () => resolve({ text: null, binary: false });
      reader.readAsText(file);
    } else {
      // For PDF, DOCX, etc. — store a note; binary reading needs native plugin
      resolve({ text: null, binary: true });
    }
  });
}

// Format text content for display
function formatTextContent(text, ext) {
  if (ext === 'json') {
    try {
      const parsed = JSON.parse(text);
      return `<pre class="file-preformatted">${JSON.stringify(parsed, null, 2)}</pre>`;
    } catch {
      return `<pre class="file-preformatted">${escapeHtml(text)}</pre>`;
    }
  }
  if (ext === 'html') {
    // Sanitize a bit before render
    const sanitized = text.replace(/<script[\s\S]*?<\/script>/gi, '')
                          .replace(/on\w+="[^"]*"/gi, '');
    return `<div class="file-html-content">${sanitized}</div>`;
  }
  if (ext === 'md') {
    return renderMarkdown(text);
  }
  if (ext === 'csv') {
    return renderCSVAsTable(text);
  }
  // Default: plain text
  return `<pre class="file-preformatted">${escapeHtml(text)}</pre>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Very lightweight Markdown → HTML (headings, bold, italic, code, links, bullets)
function renderMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/\n\n/g, '</p><p>');
  return `<p>${html}</p>`;
}

// Render CSV as an HTML table
function renderCSVAsTable(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return '<p>Empty CSV file.</p>';
  const rows = lines.map(line => line.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
  const headers = rows[0];
  const body = rows.slice(1);
  const theadCells = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const tbodyRows = body.map(r =>
    `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
  ).join('');
  return `<div class="csv-table-wrapper"><table class="csv-table"><thead><tr>${theadCells}</tr></thead><tbody>${tbodyRows}</tbody></table></div>`;
}

// Add the pending file to MyFiles library
async function addFileToLibrary() {
  const file = state.pendingFile;
  if (!file) return;

  const title = els.fileTitleInput.value.trim();
  if (!title) {
    showToast('Please enter a title for the file.');
    els.fileTitleInput.focus();
    return;
  }

  els.fileAddBtn.disabled = true;
  els.fileAddBtn.textContent = 'Reading...';

  const { text, binary } = await readFileContent(file);
  const ext = getFileExt(file.name);
  const type = getFileType(file.name);
  const id = `file_${Date.now()}`;

const fileEntry = {
     id,
     title,
     originalName: file.name,
     ext,
     typeLabel: type.label,
     typeIcon: type.icon,
     typeColor: type.color,
     size: file.size,
     sizeLabel: formatBytes(file.size),
     text: text || null,
     binary,
     addedAt: new Date().toISOString(),
   };

   state.myFiles[id] = fileEntry;
   localStorage.setItem('my_files', JSON.stringify(state.myFiles));
   
   if (state.token) {
      const res = await fetch(`${API_BASE}/api/auth/my-files`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.token}` },
       body: JSON.stringify(fileEntry)
     });
     const data = await res.json();
     if (data.file) {
       fileEntry._id = data.file._id;
       state.myFiles[id] = fileEntry;
       localStorage.setItem('my_files', JSON.stringify(state.myFiles));
     }
   }

  els.fileAddBtn.disabled = false;
  els.fileAddBtn.textContent = 'Add to My Files';

  cancelFileForm();
  renderMyFiles();
  showToast(`"${title}" added to My Files!`);
}

// Render the My Files list
function renderMyFiles() {
  const files = Object.values(state.myFiles).sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

  if (files.length === 0) {
    els.filesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📎</div>
        <h3>No files yet</h3>
        <p class="sub-p">Upload any file from your device. Give it a title and read its contents here — even offline.</p>
      </div>`;
    return;
  }

  els.filesList.innerHTML = files.map(f => `
    <div class="saved-card file-card" data-file-id="${f.id}">
      <div class="saved-img-placeholder" style="background:${f.typeColor}18; color:${f.typeColor}; font-size:1.8rem;">
        ${f.typeIcon}
      </div>
      <div class="saved-info">
        <h3>${f.title}</h3>
        <p>${f.originalName} &nbsp;·&nbsp; ${f.sizeLabel}</p>
        <span class="saved-date file-date">Added: ${new Date(f.addedAt).toLocaleDateString()}</span>
      </div>
      <div class="file-type-badge-card" style="background:${f.typeColor}18; color:${f.typeColor};">${f.typeLabel}</div>
    </div>
  `).join('');

  els.filesList.querySelectorAll('.file-card').forEach(card => {
    card.addEventListener('click', () => {
      const fileId = card.dataset.fileId;
      openFileViewer(fileId);
    });
  });
}

// Open the file viewer modal
function openFileViewer(fileId) {
  const file = state.myFiles[fileId];
  if (!file) return;
  state.currentFile = file;

  els.fileModalTitle.textContent = file.title;
  els.fileModalBadge.textContent = file.typeLabel;
  els.fileModalBadge.style.background = `${file.typeColor}18`;
  els.fileModalBadge.style.color = file.typeColor;
  els.fileModalMeta.textContent = `${file.originalName} · ${file.sizeLabel} · Added ${new Date(file.addedAt).toLocaleDateString()}`;

  if (file.binary) {
    els.fileModalContent.innerHTML = `
      <div class="file-binary-notice">
        <div class="file-binary-icon">${file.typeIcon}</div>
        <h3>${file.typeLabel} File</h3>
        <p>This is a binary file (<strong>${file.originalName}</strong>).</p>
        <p>Full in-app rendering for <strong>${file.typeLabel}</strong> files requires a native plugin. The file is safely stored in your library.</p>
        <p class="file-binary-tip">💡 Tip: For best results, convert PDF/DOCX files to <strong>.txt</strong> or <strong>.md</strong> before uploading to read their full content here.</p>
      </div>`;
  } else if (file.text !== null) {
    els.fileModalContent.innerHTML = formatTextContent(file.text, file.ext);
  } else {
    els.fileModalContent.innerHTML = `<p class="file-read-error">⚠️ Could not read file content.</p>`;
  }

  els.fileModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeFileModal() {
  els.fileModal.classList.remove('active');
  document.body.style.overflow = '';
  state.currentFile = null;
}

function deleteCurrentFile() {
   if (!state.currentFile) return;
   const { _id, id, title } = state.currentFile;
   if (!confirm(`Delete "${title}" from My Files?`)) return;
   delete state.myFiles[id];
   localStorage.setItem('my_files', JSON.stringify(state.myFiles));
   if (state.token && _id) {
      fetch(`${API_BASE}/api/auth/my-files/${_id}`, {
       method: 'DELETE',
       headers: { 'Authorization': `Bearer ${state.token}` }
     });
   }
   closeFileModal();
   renderMyFiles();
   showToast(`"${title}" deleted.`);
 }

// Auth functions
let isRegisterMode = false;

function openAuthModal() {
   if (state.user) {
     // Show profile/logout
     if (confirm(`Logged in as ${state.user.name}. Logout?`)) {
       logout();
     }
     return;
   }
   isRegisterMode = false;
   updateAuthUI();
   els.authModal.classList.add('active');
   document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
   els.authModal.classList.remove('active');
   document.body.style.overflow = '';
   els.authForm.reset();
   els.authError.style.display = 'none';
}

function toggleAuthMode() {
   isRegisterMode = !isRegisterMode;
   updateAuthUI();
}

function updateAuthUI() {
   els.authTitle.textContent = isRegisterMode ? 'Register' : 'Login';
   els.authSubmit.textContent = isRegisterMode ? 'Register' : 'Login';
   els.authSwitchText.textContent = isRegisterMode ? 'Already have an account?' : "Don't have an account?";
   els.authSwitchBtn.textContent = isRegisterMode ? 'Login' : 'Register';
   els.registerFields.style.display = isRegisterMode ? 'block' : 'none';
}

async function handleAuthSubmit(e) {
   e.preventDefault();
   const email = els.authEmail.value.trim();
   const password = els.authPassword.value.trim();
   
   const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
   const body = isRegisterMode 
     ? { name: els.authName.value.trim(), email, password }
     : { email, password };
   
   try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(body)
     });
     
     const data = await res.json();
     if (!res.ok) throw new Error(data.message);
     
     state.token = data.token;
     state.user = data.user;
     localStorage.setItem('auth_token', data.token);
     closeAuthModal();
     showToast(`Welcome${isRegisterMode ? '' : ' back'}, ${data.user.name}!`);
     await loadUserData();
   } catch (err) {
     els.authError.textContent = err.message;
     els.authError.style.display = 'block';
   }
}

async function loadUserData() {
   if (!state.token) return;
   
   const [articlesRes, filesRes] = await Promise.all([
      fetch(`${API_BASE}/api/auth/saved-articles`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
      }),
      fetch(`${API_BASE}/api/auth/my-files`, {
       headers: { 'Authorization': `Bearer ${state.token}` }
     })
   ]);
   
   const articlesData = await articlesRes.json();
   const filesData = await filesRes.json();
   
   state.savedArticles = {};
   articlesData.articles?.forEach(a => {
     state.savedArticles[a.title] = { ...a, _id: a._id || a.id };
   });
   
   state.myFiles = {};
   filesData.files?.forEach(f => {
     state.myFiles[f.id] = { ...f, _id: f._id || f.id };
   });
   
   localStorage.setItem('saved_articles', JSON.stringify(state.savedArticles));
   localStorage.setItem('my_files', JSON.stringify(state.myFiles));
 }

function logout() {
   state.token = null;
   state.user = null;
   localStorage.removeItem('auth_token');
   state.savedArticles = {};
   state.myFiles = {};
   showToast('Logged out');
}

// Run App
window.addEventListener('DOMContentLoaded', init);

