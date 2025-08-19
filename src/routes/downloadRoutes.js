const express = require('express');
const FileUtils = require('../utils/fileUtils');
const router = express.Router();

function createDownloadRoutes(downloadService, jellyfinService, searchService, torrentService) {
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
  
  // Search for content
  router.post('/search', async (req, res) => {
    const { query, contentType } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    try {
      if (!searchService.isEnabled()) {
        return res.status(503).json({ 
          error: 'Search service is not configured. Check your Jackett settings in secrets.json.' 
        });
      }
      
      const results = await searchService.searchContent(query, contentType);
      res.json(results);
      
    } catch (error) {
      console.error(`❌ [${FileUtils.getCurrentTimestamp()}] Search request failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Download torrent
  router.post('/torrent/download', async (req, res) => {
    const { magnetLink, title } = req.body;
    
    if (!magnetLink) {
      return res.status(400).json({ error: 'Magnet link is required' });
    }
    
    try {
      if (!torrentService.isEnabled()) {
        return res.status(503).json({ 
          error: 'Torrent service is not configured. Check your qBittorrent settings in secrets.json.' 
        });
      }
      
      const result = await torrentService.addTorrent(magnetLink, title);
      res.json(result);
      
    } catch (error) {
      console.error(`❌ [${FileUtils.getCurrentTimestamp()}] Torrent download failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get torrent list
  router.get('/torrents', async (req, res) => {
    try {
      if (!torrentService.isEnabled()) {
        return res.json([]);
      }
      
      const torrents = await torrentService.getTorrentList();
      res.json(torrents);
      
    } catch (error) {
      console.error(`❌ [${FileUtils.getCurrentTimestamp()}] Failed to get torrents: ${error.message}`);
      res.status(500).json({ error: error.message });
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
  
  // Get service status
  router.get('/status', (req, res) => {
    res.json({
      jellyfin: jellyfinService.isEnabled(),
      search: searchService.isEnabled(),
      torrent: torrentService.isEnabled()
    });
  });
  
  return router;
}

module.exports = createDownloadRoutes;
