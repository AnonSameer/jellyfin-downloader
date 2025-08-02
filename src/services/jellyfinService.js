const https = require('https');
const http = require('http');
const FileUtils = require('../utils/fileUtils');

class JellyfinService {
  constructor(config) {
    this.enabled = config.jellyfin.enabled;
    this.serverUrl = config.jellyfin.serverUrl;
    this.apiKey = config.jellyfin.apiKey;
    this.libraryIds = config.jellyfin.libraryIds || [];
    
    if (this.enabled) {
      console.log(`🔗 Jellyfin integration enabled`);
      console.log(`   Server: ${this.serverUrl}`);
      console.log(`   API Key: ${this.apiKey ? '***configured***' : 'NOT SET'}`);
    } else {
      console.log(`❌ Jellyfin integration disabled - missing API key or server URL`);
    }
  }
  
  isEnabled() {
    return !!(this.enabled && this.apiKey && this.serverUrl);
  }
  
  async refreshLibrary() {
    if (!this.isEnabled()) {
      throw new Error('Jellyfin integration is not properly configured');
    }
    
    try {
      console.log(`🔄 [${FileUtils.getCurrentTimestamp()}] Requesting Jellyfin library refresh`);
      
      if (this.libraryIds.length > 0) {
        // Refresh specific libraries
        const promises = this.libraryIds.map(libraryId => 
          this._makeRequest(`/Library/Refresh?libraryId=${libraryId}`, 'POST')
        );
        await Promise.all(promises);
        console.log(`✅ [${FileUtils.getCurrentTimestamp()}] Jellyfin library refresh completed for ${this.libraryIds.length} libraries`);
      } else {
        // Refresh all libraries
        await this._makeRequest('/Library/Refresh', 'POST');
        console.log(`✅ [${FileUtils.getCurrentTimestamp()}] Jellyfin library refresh completed (all libraries)`);
      }
      
      return { success: true, message: 'Library refresh initiated' };
      
    } catch (error) {
      console.error(`❌ [${FileUtils.getCurrentTimestamp()}] Jellyfin refresh failed: ${error.message}`);
      throw new Error(`Failed to refresh Jellyfin library: ${error.message}`);
    }
  }
  
  async _makeRequest(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.serverUrl);
      const client = url.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'X-Emby-Token': this.apiKey,
          'Content-Type': 'application/json'
        }
      };
      
      if (data) {
        const postData = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }
      
      const req = client.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = responseData ? JSON.parse(responseData) : {};
              resolve(parsed);
            } catch (error) {
              resolve(responseData); // Return raw response if not JSON
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
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
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }
}

module.exports = JellyfinService;