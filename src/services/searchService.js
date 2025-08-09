const https = require('https');
const http = require('http');
const FileUtils = require('../utils/fileUtils');

class SearchService {
  constructor(config) {
    this.enabled = config.search.enabled;
    this.jackettUrl = config.search.jackettUrl;
    this.jackettApiKey = config.search.jackettApiKey;
    this.indexers = config.search.indexers || ['all']; // Default to all indexers
    
    if (this.enabled) {
      console.log(`🔍 Search service enabled`);
      console.log(`   Jackett URL: ${this.jackettUrl}`);
      console.log(`   API Key: ${this.jackettApiKey ? '***configured***' : 'NOT SET'}`);
    } else {
      console.log(`❌ Search service disabled - missing Jackett configuration`);
    }
  }
  
  isEnabled() {
    return this.enabled && this.jackettUrl && this.jackettApiKey;
  }
  
  async searchContent(query, contentType = 'all') {
    if (!this.isEnabled()) {
      throw new Error('Search service is not properly configured');
    }
    
    try {
      console.log(`🔍 [${FileUtils.getCurrentTimestamp()}] Searching for: "${query}" (${contentType})`);
      
      // Build Jackett search URL
      const searchUrl = this.buildSearchUrl(query, contentType);
      const results = await this._makeRequest(searchUrl);
      
      // Parse and format results
      const formattedResults = this.formatResults(results);
      
      console.log(`📊 [${FileUtils.getCurrentTimestamp()}] Found ${formattedResults.length} results for "${query}"`);
      
      return {
        query,
        contentType,
        results: formattedResults
      };
      
    } catch (error) {
      console.error(`❌ [${FileUtils.getCurrentTimestamp()}] Search failed for "${query}": ${error.message}`);
      throw new Error(`Search failed: ${error.message}`);
    }
  }
  
  buildSearchUrl(query, contentType) {
    const baseUrl = `${this.jackettUrl}/api/v2.0/indexers/all/results`;
    const params = new URLSearchParams({
      apikey: this.jackettApiKey,
      Query: query,
      Category: this.getCategoryFilter(contentType)
    });
    
    return `${baseUrl}?${params.toString()}`;
  }
  
  getCategoryFilter(contentType) {
    switch (contentType) {
      case 'movies':
        return '2000'; // Movies category
      case 'tv':
        return '5000'; // TV category
      case 'all':
      default:
        return ''; // All categories
    }
  }
  
  formatResults(jackettResults) {
    if (!jackettResults || !jackettResults.Results) {
      return [];
    }
    
    return jackettResults.Results
      .slice(0, 20) // Limit to top 20 results
      .map(result => ({
        title: result.Title || 'Unknown Title',
        size: this.formatSize(result.Size),
        quality: this.extractQuality(result.Title),
        seeders: result.Seeders || 0,
        peers: result.Peers || 0,
        category: result.CategoryDesc || result.Category,
        indexer: result.Tracker || 'Unknown',
        magnetLink: result.MagnetUri,
        downloadLink: result.Link,
        publishDate: result.PublishDate,
        imdbId: result.Imdb,
        rating:   null
      }))
      .filter(result => result.magnetLink || result.downloadLink) // Only include results with download links
      .sort((a, b) => {
        // Sort by seeders (descending), then by quality preference
        if (b.seeders !== a.seeders) {
          return b.seeders - a.seeders;
        }
        return this.getQualityScore(b.quality) - this.getQualityScore(a.quality);
      });
  }
  
  formatSize(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    return FileUtils.formatBytes(bytes);
  }
  
  extractQuality(title) {
    const qualityRegex = /(2160p|4K|1080p|720p|480p|HDTV|BluRay|WEBRip|DVDRip|CAM|TS)/i;
    const match = title.match(qualityRegex);
    return match ? match[1].toUpperCase() : 'Unknown';
  }
  
  getQualityScore(quality) {
    const scores = {
      '2160p': 100, '4K': 100,
      '1080p': 80,
      '720p': 60,
      '480p': 40,
      'HDTV': 30,
      'DVDRip': 20,
      'CAM': 10,
      'TS': 5
    };
    return scores[quality] || 0;
  }
  
  async _makeRequest(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      
      const request = client.get(url, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (error) {
              reject(new Error('Invalid JSON response from Jackett'));
            }
          } else {
            reject(new Error(`Jackett returned ${response.statusCode}: ${response.statusMessage}`));
          }
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.setTimeout(15000, () => {
        request.destroy();
        reject(new Error('Search request timeout'));
      });
    });
  }
}

module.exports = SearchService;