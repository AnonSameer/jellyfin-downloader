class JellyfinDownloaderApp {
    constructor() {
        this.form = document.getElementById('downloadForm');
        this.statusDiv = document.getElementById('status');
        this.downloadsDiv = document.getElementById('downloads');
        this.downloadsList = document.getElementById('downloadsList');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.jellyfinSection = document.getElementById('jellyfinSection');
        this.urlInput = document.getElementById('url');
        this.filenameInput = document.getElementById('filename');
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
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
        this.refreshBtn.addEventListener('click', () => this.handleJellyfinRefresh());
        
        // Clear status on input
        this.urlInput.addEventListener('input', () => this.clearStatus());
        this.filenameInput.addEventListener('input', () => this.clearStatus());
        
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
            const response = await fetch('/downloads');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const downloads = await response.json();
            this.renderDownloads(downloads);
            
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
        const isActive = !download.status.includes('Failed');
        const spinner = isActive ? '<div class="progress-spinner"></div>' : '';
        
        return `
            <div class="download-item">
                <div class="download-name">${this.escapeHtml(download.filename)}</div>
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