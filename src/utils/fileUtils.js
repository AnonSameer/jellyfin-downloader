const fs = require('fs');
const path = require('path');

class FileUtils {
  static ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
  
  static formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
  
  static getFilenameFromUrl(url) {
    try {
      const parsedUrl = new URL(url);
      return path.basename(parsedUrl.pathname) || 'download';
    } catch (error) {
      return 'download';
    }
  }
  
  static sanitizeFilename(filename) {
    // Remove or replace invalid characters for cross-platform compatibility
    return filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
  }
}

module.exports = FileUtils;