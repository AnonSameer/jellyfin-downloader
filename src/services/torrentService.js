const https = require('https');
const http = require('http');
const FileUtils = require('../utils/fileUtils');

class TorrentService {
  constructor(config) {
    this.enabled = config.torrent.enabled;
    this.qbittorrentUrl = config.torrent.qbittorrentUrl;
    this.username = config.torrent.username;
    this.password = config.torrent.password;
    this.downloadPath = config.torrent.downloadPath || config.downloadFolder;
    this.cookie = null; // Store authentication cookie
    
    if (this.enabled) {
      console.log(`🧲 Torrent service enabled`);
      console.log(`   qBittorrent URL: ${this.qbittorrentUrl}`);
      console.log(`   Username: ${this.username ? '***configured***' : 'NOT SET'}`);
      console.log(`   Download Path: ${this.downloadPath}`);
    } else {
      console.log(`❌ Torrent service disabled - missing qBittorrent configuration`);
    }
  }
  
  isEnabled() {
    return this.enabled && this.qbittorrentUrl && this.username && this.password;
  }
  
  async addTorrent(magnetLink, title) {
    if (!this.isEnabled()) {
      throw new Error('Torrent service is not properly configured');
    }
    
    try {
      console.log(`🧲 [${FileUtils.getCurrentTimestamp()}] Adding torrent: "${title}"`);
      
      // Authenticate if needed
      await this.ensureAuthenticated();
      
      // Add torrent
      const result = await this.addTorrentToClient(magnetLink, title);
      
      console.log(`✅ [${FileUtils.getCurrentTimestamp()}] Torrent added successfully: "${title}"`);
      
      return {
        success: true,
        message: `Torrent added: ${title}`,
        magnetLink,
        title
      };
      
    } catch (error) {
      console.error(`❌ [${FileUtils.getCurrentTimestamp()}] Failed to add torrent "${title}": ${error.message}`);
      throw new Error(`Failed to add torrent: ${error.message}`);
    }
  }
  
  async ensureAuthenticated() {
    if (this.cookie) {
      // Check if current cookie is still valid
      try {
        await this._makeRequest('/api/v2/app/version', 'GET');
        return; // Cookie is still valid
      } catch (error) {
        // Cookie expired, need to re-authenticate
        this.cookie = null;
      }
    }
    
    // Authenticate
    await this.authenticate();
  }
  
  async authenticate() {
    const authData = new URLSearchParams({
      username: this.username,
      password: this.password
    });
    
    try {
      const response = await this._makeRequest('/api/v2/auth/login', 'POST', authData.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded'
      });
      
      // Extract session cookie from response
      if (response.cookie) {
        this.cookie = response.cookie;
      } else {
        throw new Error('Authentication failed - no session cookie received');
      }
      
    } catch (error) {
      throw new Error(`qBittorrent authentication failed: ${error.message}`);
    }
  }
  
  async addTorrentToClient(magnetLink, title) {
    const formData = new URLSearchParams({
      urls: magnetLink,
      savepath: this.downloadPath,
      category: 'jellyfin-downloader',
      rename: this.sanitizeFilename(title)
    });
    
    const result = await this._makeRequest('/api/v2/torrents/add', 'POST', formData.toString(), {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': this.cookie
    });
    
    return result;
  }
  
  async getTorrentList() {
    if (!this.isEnabled()) {
      return [];
    }
    
    try {
      await this.ensureAuthenticated();
      
      const torrents = await this._makeRequest('/api/v2/torrents/info', 'GET', null, {
        'Cookie': this.cookie
      });
      
      return torrents.map(torrent => ({
        hash: torrent.hash,
        name: torrent.name,
        size: FileUtils.formatBytes(torrent.size),
        progress: Math.round(torrent.progress * 100),
        state: torrent.state,
        eta: torrent.eta,
        downloadSpeed: FileUtils.formatBytes(torrent.dlspeed) + '/s',
        uploadSpeed: FileUtils.formatBytes(torrent.upspeed) + '/s',
        seeders: torrent.num_seeds,
        peers: torrent.num_leechs
      }));
      
    } catch (error) {
      console.error(`Failed to get torrent list: ${error.message}`);
      return [];
    }
  }
  
  sanitizeFilename(filename) {
    return filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
  }
  
  async _makeRequest(endpoint, method = 'GET', data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.qbittorrentUrl);
      const client = url.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'User-Agent': 'Jellyfin-Downloader/1.0',
          ...headers
        }
      };
      
      if (data && method === 'POST') {
        options.headers['Content-Length'] = Buffer.byteLength(data);
      }
      
      const req = client.request(options, (res) => {
        let responseData = '';
        
        // Capture cookies from response
        if (res.headers['set-cookie']) {
          const sessionCookie = res.headers['set-cookie']
            .find(cookie => cookie.startsWith('SID='));
          if (sessionCookie) {
            resolve({ cookie: sessionCookie.split(';')[0] });
            return;
          }
        }
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              // Try to parse as JSON, fallback to text
              const parsed = responseData ? JSON.parse(responseData) : {};
              resolve(parsed);
            } catch (error) {
              resolve(responseData); // Return raw response if not JSON
            }
          } else {
            reject(new Error(`qBittorrent returned ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (data && method === 'POST') {
        req.write(data);
      }
      
      req.end();
    });
  }
}

module.exports = TorrentService;