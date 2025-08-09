const express = require('express');
const path = require('path');
const config = require('../config/config');
const DownloadService = require('./services/downloadService');
const JellyfinService = require('./services/jellyfinService');
const SearchService = require('./services/searchService'); 
const TorrentService = require('./services/torrentService');
const createDownloadRoutes = require('./routes/downloadRoutes');
const FileUtils = require('./utils/fileUtils');

class JellyfinDownloaderServer {
  constructor() {
    this.app = express();
    this.downloadService = new DownloadService(
      config.downloadFolder, 
      config.maxConcurrentDownloads
    );
    this.jellyfinService = new JellyfinService(config);
    this.searchService = new SearchService(config);
    this.torrentService = new TorrentService(config);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }
  
  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, '../public')));
    
    // Request logging middleware
    this.app.use((req, res, next) => {
      if (req.path !== '/downloads' && req.path !== '/torrents') { // Don't log polling requests
        console.log(`🌐 [${FileUtils.getCurrentTimestamp()}] ${req.method} ${req.path} - ${req.ip || req.connection.remoteAddress}`);
      }
      next();
    });
  }
  
  setupRoutes() {
    // Serve main page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });
    
    this.app.use('/api', createDownloadRoutes(
      this.downloadService, 
      this.jellyfinService, 
      this.searchService, 
      this.torrentService
    ));
    
    this.app.use('/', createDownloadRoutes(
      this.downloadService, 
      this.jellyfinService, 
      this.searchService, 
      this.torrentService
    ));
  }
   
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      console.log(`❓ [${FileUtils.getCurrentTimestamp()}] 404 - Path not found: ${req.path}`);
      res.status(404).json({ error: 'Not found' });
    });
    
    // Error handler
    this.app.use((error, req, res, next) => {
      console.error(`💥 [${FileUtils.getCurrentTimestamp()}] Server error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  start() {
    this.server = this.app.listen(config.port, config.host, () => {
      const localIP = config.getLocalIP();

      console.log('🚀 Jellyfin Downloader Server Started!');
      console.log('=' .repeat(60));
      console.log(`📱 Phone Access: http://${localIP}:${config.port}`);
      console.log(`💻 Local Access: http://localhost:${config.port}`);
      console.log(`📁 Download Folder: ${config.downloadFolder}`);
      console.log(`⚡ Max Concurrent Downloads: ${config.maxConcurrentDownloads}`);
      console.log(`🔗 Jellyfin Integration: ${this.jellyfinService.isEnabled() ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`🔍 Search Integration: ${this.searchService.isEnabled() ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`🧲 Torrent Integration: ${this.torrentService.isEnabled() ? '✅ Enabled' : '❌ Disabled'}`);
      console.log('=' .repeat(60));
      console.log(`🕐 Server started at: ${FileUtils.getCurrentTimestamp()}`);
      console.log('');
      console.log('⚠️  IMPORTANT: Update paths in config/config.js and add secrets.json');
      console.log('📲 Bookmark the phone access URL on your mobile device');
      
      if (!this.searchService.isEnabled()) {
        console.log('🔍 To enable search: Install Jackett and add API details to secrets.json');
      }
      if (!this.torrentService.isEnabled()) {
        console.log('🧲 To enable torrents: Install qBittorrent and add credentials to secrets.json');
      }
      
      console.log('');
      console.log('📊 Server Logs:');
      console.log('─'.repeat(40));
    });
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log(`\n🛑 [${FileUtils.getCurrentTimestamp()}] Shutting down gracefully...`);
      this.server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });
  }
}

// Start the server
const server = new JellyfinDownloaderServer();
server.start();