const express = require('express');
const path = require('path');
const config = require('../config/config');
const DownloadService = require('./services/downloadService');
const createDownloadRoutes = require('./routes/downloadRoutes');
const FileUtils = require('./utils/fileUtils');

class JellyfinDownloaderServer {
  constructor() {
    this.app = express();
    this.downloadService = new DownloadService(
      config.downloadFolder, 
      config.maxConcurrentDownloads
    );
    
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
      if (req.path !== '/downloads') { // Don't log polling requests
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
    
    // API routes
    this.app.use('/api', createDownloadRoutes(this.downloadService));
    
    // Legacy routes (for backward compatibility)
    this.app.use('/', createDownloadRoutes(this.downloadService));
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
      console.log('=' .repeat(60));
      console.log(`🕐 Server started at: ${FileUtils.getCurrentTimestamp()}`);
      console.log('');
      console.log('⚠️  IMPORTANT: Make sure to update the download folder path in config/config.js');
      console.log('📲 Bookmark the phone access URL on your mobile device');
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