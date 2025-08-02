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
  
  static preserveFileExtension(customFilename, originalFilename) {
    if (!customFilename) return originalFilename;
    
    const originalExt = path.extname(originalFilename);
    const customExt = path.extname(customFilename);
    
    // If custom filename already has an extension, use it as-is
    if (customExt) {
      return customFilename;
    }
    
    // If no extension in custom name, append the original extension
    if (originalExt) {
      return customFilename + originalExt;
    }
    
    return customFilename;
  }
  
  static getCurrentTimestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
  }
}

module.exports = FileUtils;