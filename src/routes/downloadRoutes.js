const express = require('express');
const FileUtils = require('../utils/fileUtils');
const router = express.Router();

function createDownloadRoutes(downloadService, jellyfinService) {
  // Start download
  router.post('/download', async (req, res) => {
    const { url, filename } = req.body;
    
    if (!url) {
      console.log(`⚠️  [${FileUtils.getCurrentTimestamp()}] Download request rejected: No URL provided`);
      return res.status(400).json({ error: 'URL is required' });
    }
    
    try {
      // Validate URL
      new URL(url);
      
      if (!downloadService.canStartNewDownload()) {
        console.log(`⚠️  [${FileUtils.getCurrentTimestamp()}] Download request rejected: Max concurrent downloads reached`);
        return res.status(429).json({ 
          error: `Maximum concurrent downloads reached (${downloadService.maxConcurrentDownloads})` 
        });
      }
      
      console.log(`📝 [${FileUtils.getCurrentTimestamp()}] New download request received`);
      console.log(`   Client IP: ${req.ip || req.connection.remoteAddress}`);
      
      const result = await downloadService.startDownload(url, filename);
      res.json(result);
      
    } catch (error) {
      console.error(`❌ [${FileUtils.getCurrentTimestamp()}] Download request failed: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });
  
  // Get active downloads
  router.get('/downloads', (req, res) => {
    const downloads = downloadService.getActiveDownloads();
    res.json(downloads);
  });
  
  // Refresh Jellyfin library
  router.post('/jellyfin/refresh', async (req, res) => {
    try {
      if (!jellyfinService.isEnabled()) {
        return res.status(503).json({ 
          error: 'Jellyfin integration is not configured. Check your secrets.json file.' 
        });
      }
      
      const result = await jellyfinService.refreshLibrary();
      res.json(result);
      
    } catch (error) {
      console.error(`❌ [${FileUtils.getCurrentTimestamp()}] Jellyfin refresh request failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get Jellyfin status
  router.get('/jellyfin/status', (req, res) => {
    res.json({
      enabled: jellyfinService.isEnabled(),
      serverUrl: jellyfinService.isEnabled() ? jellyfinService.serverUrl : null
    });
  });
  
  return router;
}

module.exports = createDownloadRoutes;