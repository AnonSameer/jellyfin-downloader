const path = require('path');
const { networkInterfaces } = require('os');


const config = {
  // Server settings
  port: 3000,
  host: '0.0.0.0',
  
  // Download settings
  downloadFolder: 'C:/Users/samee/source/Content', 
  maxConcurrentDownloads: 3,
  
  // UI settings
  appName: 'Jellyfin Downloader',
  
  // Helper function to get local IP
  getLocalIP() {
    const nets = networkInterfaces();
    
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    return 'localhost';
  }
};

module.exports = config;
