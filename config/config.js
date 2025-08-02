const path = require('path');
const fs = require('fs');
const { networkInterfaces } = require('os');


let secrets = {};
const secretsPath = path.join(__dirname, 'secrets.json');
if (fs.existsSync(secretsPath)) {
  try {
    secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
  } catch (error) {
    console.warn('⚠️  Warning: Could not load secrets.json:', error.message);
  }
} else {
  console.warn('⚠️  Warning: secrets.json not found. Jellyfin integration will be disabled.');
}

const config = {
  // Server settings
  port: 3000,
  host: '0.0.0.0',
  
  // Download settings
  downloadFolder: 'C:/Users/samee/source/Content', 
  maxConcurrentDownloads: 3,
  
  // Jellyfin integration settings
  jellyfin: {
    enabled: !!(secrets.jellyfinApiKey && secrets.jellyfinServerUrl),
    serverUrl: secrets.jellyfinServerUrl || 'http://localhost:8096',
    apiKey: secrets.jellyfinApiKey || null,
    // Optional: Specific library IDs to refresh (leave empty to refresh all)
    libraryIds: secrets.jellyfinLibraryIds || []
  },
  
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
