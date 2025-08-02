const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const FileUtils = require('../utils/fileUtils');

class DownloadService {
  constructor(downloadFolder, maxConcurrentDownloads = 3) {
    this.downloadFolder = downloadFolder;
    this.maxConcurrentDownloads = maxConcurrentDownloads;
    this.activeDownloads = new Map();
    
    // Ensure download folder exists
    FileUtils.ensureDirectoryExists(this.downloadFolder);
    
    console.log(`📁 Download service initialized`);
    console.log(`   Folder: ${this.downloadFolder}`);
    console.log(`   Max concurrent: ${this.maxConcurrentDownloads}`);
  }
  
  canStartNewDownload() {
    return this.activeDownloads.size < this.maxConcurrentDownloads;
  }
  
  getActiveDownloads() {
    return Array.from(this.activeDownloads.entries()).map(([id, info]) => ({
      id,
      ...info
    }));
  }
  
  async startDownload(url, customFilename = null) {
    if (!this.canStartNewDownload()) {
      throw new Error('Maximum concurrent downloads reached');
    }
    
    const parsedUrl = new URL(url);
    const originalFilename = FileUtils.getFilenameFromUrl(url);
    
    // Preserve file extension when using custom filename
    let finalFilename = FileUtils.preserveFileExtension(customFilename, originalFilename);
    finalFilename = FileUtils.sanitizeFilename(finalFilename);
    
    const downloadId = Date.now().toString();
    const filePath = path.join(this.downloadFolder, finalFilename);
    
    // Check if file already exists
    if (fs.existsSync(filePath)) {
      const timestamp = Date.now();
      const ext = path.extname(finalFilename);
      const nameWithoutExt = path.basename(finalFilename, ext);
      finalFilename = `${nameWithoutExt}_${timestamp}${ext}`;
    }
    
    // Server-side logging
    console.log(`\n🔄 [${FileUtils.getCurrentTimestamp()}] Download started`);
    console.log(`   URL: ${url}`);
    console.log(`   File: ${finalFilename}`);
    if (customFilename) {
      console.log(`   Custom name: ${customFilename} → ${finalFilename}`);
    }
    
    // Add to active downloads
    this.activeDownloads.set(downloadId, {
      filename: finalFilename,
      status: 'Starting...',
      progress: 0,
      url: url
    });
    
    // Start download asynchronously
    this._downloadFile(url, path.join(this.downloadFolder, finalFilename), downloadId)
      .then(() => {
        console.log(`✅ [${FileUtils.getCurrentTimestamp()}] Download completed: ${finalFilename}`);
        this.activeDownloads.delete(downloadId);
      })
      .catch((error) => {
        console.error(`❌ [${FileUtils.getCurrentTimestamp()}] Download failed: ${finalFilename}`);
        console.error(`   Error: ${error.message}`);
        
        this.activeDownloads.set(downloadId, {
          filename: finalFilename,
          status: 'Failed: ' + error.message,
          progress: 0,
          url: url
        });
        
        // Remove failed download after 30 seconds
        setTimeout(() => {
          this.activeDownloads.delete(downloadId);
        }, 30000);
      });
    
    return {
      downloadId,
      filename: finalFilename,
      message: `Download started: ${finalFilename}`
    };
  }
  
  async _downloadFile(url, filePath, downloadId) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(filePath);
      let downloadedBytes = 0;
      let totalBytes = 0;
      let lastLogTime = 0;
      
      const request = client.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          file.close();
          fs.unlinkSync(filePath);
          console.log(`🔄 Following redirect for: ${path.basename(filePath)}`);
          return this._downloadFile(response.headers.location, filePath, downloadId)
            .then(resolve)
            .catch(reject);
        }
        
        if (response.statusCode !== 200) {
          file.close();
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        }
        
        totalBytes = parseInt(response.headers['content-length'] || '0');
        
        response.pipe(file);
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          this._updateProgress(downloadId, downloadedBytes, totalBytes);
        });
        
        file.on('finish', () => {
          file.close();
          const finalSize = fs.statSync(filePath).size;
          console.log(`💾 Saved: ${FileUtils.formatBytes(finalSize)} - ${filePath}`);
          resolve();
        });
      });
      
      request.on('error', (error) => {
        file.close();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(error);
      });
      
      file.on('error', (error) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        reject(error);
      });
      
      // Handle request timeout
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }
  
  _updateProgress(downloadId, downloadedBytes, totalBytes) {
    if (!this.activeDownloads.has(downloadId)) return;
    
    const progress = totalBytes > 0 ? 
      Math.round((downloadedBytes / totalBytes) * 100) : 0;
    
    const status = totalBytes > 0 ? 
      `Downloading... ${progress}% (${FileUtils.formatBytes(downloadedBytes)}/${FileUtils.formatBytes(totalBytes)})` :
      `Downloading... ${FileUtils.formatBytes(downloadedBytes)}`;
    
    this.activeDownloads.set(downloadId, {
      ...this.activeDownloads.get(downloadId),
      status,
      progress
    });
  }
}

module.exports = DownloadService;