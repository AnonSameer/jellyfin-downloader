class JellyfinDownloaderApp {
    constructor() {
        this.form = document.getElementById('downloadForm');
        this.searchForm = document.getElementById('searchForm');
        this.statusDiv = document.getElementById('status');
        this.downloadsDiv = document.getElementById('downloads');
        this.downloadsList = document.getElementById('downloadsList');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.searchBtn = document.getElementById('searchBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.jellyfinSection = document.getElementById('jellyfinSection');
        this.urlInput = document.getElementById('url');
        this.filenameInput = document.getElementById('filename');
        this.searchQueryInput = document.getElementById('searchQuery');
        this.contentTypeSelect = document.getElementById('contentType');
        this.searchResults = document.getElementById('searchResults');
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupTabs();
        this.startPeriodicUpdates();
        this.updateDownloads();
        this.checkJellyfinStatus();
        
        // Auto-focus URL input on desktop
        if (window.innerWidth > 768) {
            this.urlInput.focus();
        }
    }
    
    setupEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.searchForm.addEventListener('submit', (e) => this.handleSearch(e));
        this.refreshBtn.addEventListener('click', () => this.handleJellyfinRefresh());
        
        // Clear status on input
        this.urlInput.addEventListener('input', () => this.clearStatus());
        this.filenameInput.addEventListener('input', () => this.clearStatus());
        this.searchQueryInput.addEventListener('input', () => this.clearStatus());
        
        // Handle paste event
        this.urlInput.addEventListener('paste', () => {
            // Small delay to let paste complete
            setTimeout(() => this.validateUrl(), 100);
        });
        
        // Handle visibility change to pause/resume updates
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseUpdates();
            } else {
                this.resumeUpdates();
            }
        });
    }
    
    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                
                // Update button states
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update content visibility
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `${targetTab}-tab`) {
                        content.classList.add('active');
                    }
                });
                
                // Clear status when switching tabs
                this.clearStatus();
                this.clearSearchResults();
            });
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const url = this.urlInput.value.trim();
        const filename = this.filenameInput.value.trim();
        
        if (!this.validateUrl(url)) {
            this.showStatus('Please enter a valid URL', 'error');
            return;
        }
        
        this.setLoading(true);
        
        try {
            const response = await fetch('/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url, filename: filename || null })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showStatus(result.message, 'success');
                this.clearForm();
                this.updateDownloads();
                
                // Haptic feedback on mobile
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            } else {
                this.showStatus(result.error, 'error');
            }
        } catch (error) {
            console.error('Network error:', error);
            this.showStatus('Network error: Unable to connect to server', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async handleSearch(e) {
        e.preventDefault();
        
        const query = this.searchQueryInput.value.trim();
        const contentType = this.contentTypeSelect.value;
        
        if (!query) {
            this.showStatus('Please enter a movie or TV show name', 'error');
            return;
        }
        
        this.setSearchLoading(true);
        this.clearSearchResults();
        
        try {
            const response = await fetch('/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query, contentType })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.displaySearchResults(result.results);
                if (result.results.length === 0) {
                    this.showNoResults();
                }
            } else {
                this.showStatus('Search failed: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showStatus('Search failed: Unable to connect to server', 'error');
        } finally {
            this.setSearchLoading(false);
        }
    }
    
    setSearchLoading(isLoading) {
        this.searchBtn.disabled = isLoading;
        
        if (isLoading) {
            this.searchBtn.innerHTML = `
                <div class="progress-spinner"></div>
                <span class="btn-text">Searching...</span>
            `;
            this.searchResults.innerHTML = '<div class="search-loading">Searching for content...</div>';
        } else {
            this.searchBtn.innerHTML = `
                <span class="btn-icon">🔍</span>
                <span class="btn-text">Search</span>
            `;
        }
    }
    
    displaySearchResults(results) {
        if (!results || results.length === 0) {
            this.showNoResults();
            return;
        }
        
        this.searchResults.innerHTML = results.map((result, index) => `
            <div class="search-result-item">
                <div class="result-header">
                    <div>
                        <div class="result-title">${this.escapeHtml(result.title)}</div>
                        <div class="result-info">
                            ${result.quality ? `<span class="result-badge quality">${result.quality}</span>` : ''}
                            ${result.size ? `<span class="result-badge size">${result.size}</span>` : ''}
                            ${result.seeders ? `<span class="result-badge seeders">${result.seeders} seeders</span>` : ''}
                            ${result.category ? `<span class="result-badge">${result.category}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="result-actions">
                    <button class="download-torrent-btn" data-index="${index}">
                        <span>📥</span>
                        Download
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add click handlers after HTML is inserted
        this.searchResults.querySelectorAll('.download-torrent-btn').forEach((btn, index) => {
            btn.addEventListener('click', async () => {
                const result = results[index];
                
                // Show immediate feedback
                btn.disabled = true;
                btn.innerHTML = `
                    <div class="progress-spinner"></div>
                    <span>Starting...</span>
                `;
                
                try {
                    const success = await this.downloadTorrent(result.magnetLink || result.downloadLink, result.title);
                    
                    if (success) {
                        // Clear ALL search results after successful download
                        this.searchResults.innerHTML = `
                            <div class="download-success">
                                <div class="success-icon">✅</div>
                                <div class="success-title">Download Started!</div>
                                <div class="success-subtitle">Check downloads below for progress</div>
                                <button class="new-search-btn" onclick="window.jellyfinApp.clearSearchAndFocus()">
                                    <span>🔍</span>
                                    Search for something else
                                </button>
                            </div>
                        `;
                    } else {
                        // Reset button on failure
                        btn.disabled = false;
                        btn.innerHTML = `
                            <span>📥</span>
                            Download
                        `;
                    }
                } catch (error) {
                    // Reset button on error
                    btn.disabled = false;
                    btn.innerHTML = `
                        <span>📥</span>
                        Download
                    `;
                }
            });
        });
    }
    
    showNoResults() {
        this.searchResults.innerHTML = `
            <div class="no-results">
                <div>No results found</div>
                <div style="font-size: 14px; margin-top: 10px;">Try different keywords or check your search settings</div>
            </div>
        `;
    }
    
    clearSearchResults() {
        this.searchResults.innerHTML = '';
    }
    
    clearSearchAndFocus() {
        // Clear search results
        this.clearSearchResults();
        
        // Clear search input
        this.searchQueryInput.value = '';
        
        // Focus on search input for next query
        this.searchQueryInput.focus();
        
        // Clear any status messages
        this.clearStatus();
    }
    
    async downloadTorrent(magnetLink, title) {
        if (!magnetLink) {
            this.showStatus('No download link available', 'error');
            return false;
        }
        
        try {
            const response = await fetch('/torrent/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    magnetLink, 
                    title: title 
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showStatus(`✅ Started downloading: ${title}`, 'success');
                
                // Update downloads immediately to show new torrent
                this.updateDownloads();
                
                // Haptic feedback on mobile
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
                
                return true;
            } else {
                this.showStatus('Download failed: ' + result.error, 'error');
                return false;
            }
        } catch (error) {
            console.error('Torrent download error:', error);
            this.showStatus('Download failed: Unable to connect to server', 'error');
            return false;
        }
    }

    async checkJellyfinStatus() {
        try {
            const response = await fetch('/jellyfin/status');
            const status = await response.json();
            
            if (status.enabled) {
                this.jellyfinSection.style.display = 'block';
            }
        } catch (error) {
            console.error('Failed to check Jellyfin status:', error);
        }
    }
    
    async handleJellyfinRefresh() {
        this.setRefreshLoading(true);
        
        try {
            const response = await fetch('/jellyfin/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showStatus('✅ Jellyfin library refresh started!', 'success');
                
                // Haptic feedback on mobile
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            } else {
                this.showStatus('❌ ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Jellyfin refresh error:', error);
            this.showStatus('❌ Failed to refresh Jellyfin library', 'error');
        } finally {
            this.setRefreshLoading(false);
        }
    }
    
    validateUrl(url = null) {
        const urlToCheck = url || this.urlInput.value.trim();
        
        if (!urlToCheck) return false;
        
        try {
            const parsedUrl = new URL(urlToCheck);
            return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
        } catch {
            return false;
        }
    }
    
    setLoading(isLoading) {
        this.downloadBtn.disabled = isLoading;
        
        if (isLoading) {
            this.downloadBtn.innerHTML = `
                <div class="progress-spinner"></div>
                <span class="btn-text">Starting Download...</span>
            `;
        } else {
            this.downloadBtn.innerHTML = `
                <span class="btn-icon">⬇️</span>
                <span class="btn-text">Start Download</span>
            `;
        }
    }

    setRefreshLoading(isLoading) {
        this.refreshBtn.disabled = isLoading;
        
        if (isLoading) {
            this.refreshBtn.innerHTML = `
                <div class="progress-spinner"></div>
                <span class="btn-text">Refreshing...</span>
            `;
        } else {
            this.refreshBtn.innerHTML = `
                <span class="btn-icon">🔄</span>
                <span class="btn-text">Refresh Jellyfin Library</span>
            `;
        }
    }
    
    showStatus(message, type) {
        this.statusDiv.innerHTML = `<div class="status ${type}">${this.escapeHtml(message)}</div>`;
        
        // Auto-clear status after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => this.clearStatus(), 5000);
        }
        
        // Scroll status into view on mobile
        if (window.innerWidth <= 768) {
            this.statusDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    clearStatus() {
        this.statusDiv.innerHTML = '';
    }
    
    clearForm() {
        this.urlInput.value = '';
        this.filenameInput.value = '';
    }
    
    async updateDownloads() {
        try {
            // Get both direct downloads and torrents
            const [downloadsResponse, torrentsResponse] = await Promise.all([
                fetch('/downloads'),
                fetch('/torrents')
            ]);
            
            const downloads = downloadsResponse.ok ? await downloadsResponse.json() : [];
            const torrents = torrentsResponse.ok ? await torrentsResponse.json() : [];
            
            // Combine both types of downloads
            const allDownloads = [
                ...downloads.map(d => ({...d, type: 'direct'})),
                ...torrents.map(t => ({
                    filename: t.name,
                    status: `${t.state} - ${t.progress}% (${t.downloadSpeed})`,
                    progress: t.progress,
                    type: 'torrent'
                }))
            ];
            
            this.renderDownloads(allDownloads);
            
        } catch (error) {
            console.error('Failed to update downloads:', error);
            // Don't show error to user for background updates
        }
    }
    
    renderDownloads(downloads) {
        if (downloads.length > 0) {
            this.downloadsDiv.style.display = 'block';
            this.downloadsList.innerHTML = downloads.map(download => 
                this.renderDownloadItem(download)
            ).join('');
        } else {
            this.downloadsDiv.style.display = 'none';
        }
    }
    
    renderDownloadItem(download) {
        const isActive = !download.status.includes('Failed') && !download.status.includes('completed');
        const isCompleted = download.status.includes('completed') || download.progress === 100;
        const spinner = isActive && !isCompleted ? '<div class="progress-spinner"></div>' : '';
        const icon = isCompleted ? '✅' : (download.type === 'torrent' ? '🧲' : '📥');
        
        return `
            <div class="download-item ${download.type}">
                <div class="download-name">
                    ${icon} ${this.escapeHtml(download.filename)}
                </div>
                <div class="download-progress">
                    ${spinner}
                    ${this.escapeHtml(download.status)}
                </div>
            </div>
        `;
    }
    
    startPeriodicUpdates() {
        // Update every 2 seconds
        this.updateInterval = setInterval(() => {
            if (!document.hidden) {
                this.updateDownloads();
            }
        }, 2000);
    }
    
    pauseUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    resumeUpdates() {
        if (!this.updateInterval) {
            this.startPeriodicUpdates();
            this.updateDownloads(); // Immediate update
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Cleanup method
    destroy() {
        this.pauseUpdates();
        
        // Remove event listeners
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.jellyfinApp = new JellyfinDownloaderApp();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.jellyfinApp) {
        window.jellyfinApp.destroy();
    }
});