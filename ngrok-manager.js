const ngrokConfig = require('./ngrokconfig.json');
const config = require('./botconfig.json');
const fs = require('fs').promises;
const path = require('path');

// Check if pyngrok equivalent (ngrok npm package) is available
let ngrok = null;
let NGROK_AVAILABLE = false;

try {
  ngrok = require('ngrok');
  NGROK_AVAILABLE = true;
  console.log('[NGROK] ngrok package loaded successfully');
} catch (error) {
  console.log('[NGROK] ngrok package not available, tunnel features disabled');
}

class NgrokManager {
  constructor() {
    this.tunnel = null;
    this.authToken = ngrokConfig.ngrok.auth_token;
    this.isConnected = false;
    this.port = null;
    this.monitorInterval = null;
    this.baseUrl = ngrokConfig.ngrok.base_url;
    this.enabled = ngrokConfig.ngrok.enabled;
    this.changeUrl = ngrokConfig.ngrok.change_url;
    this.retryAttempts = ngrokConfig.ngrok.retry_attempts;
    this.retryDelay = ngrokConfig.ngrok.retry_delay * 1000;
    this.isReconnecting = false;
    this.lastSuccessfulCheck = Date.now();
    
    // Simplified monitoring - only check every 5 minutes instead of every minute
    this.monitorIntervalMs = 5 * 60 * 1000; // 5 minutes
    this.consecutiveFailures = 0;
    this.maxConsecutiveFailures = 3; // Only reconnect after 3 consecutive failures
  }

  /**
   * Initialize ngrok manager
   */
  async initialize(port) {
    if (!this.enabled) {
      console.log('[NGROK] Ngrok is disabled in configuration');
      return false;
    }

    if (!NGROK_AVAILABLE) {
      console.log('[NGROK] ngrok package not available, skipping tunnel setup');
      return false;
    }

    this.port = port;
    console.log('[NGROK] Initializing ngrok manager...');
    
    const success = await this.startTunnel();
    if (success) {
      this.startMonitoring();
    }
    
    return success;
  }

  /**
   * Start ngrok tunnel with error handling and retries
   */
  async startTunnel(retryCount = 0) {
    if (!NGROK_AVAILABLE || !this.enabled) {
      return false;
    }

    try {
      console.log(`[NGROK] Starting tunnel... (Attempt ${retryCount + 1}/${this.retryAttempts + 1})`);
      
      // Kill any existing ngrok processes first
      try {
        await ngrok.kill();
        await this.sleep(2000); // Wait 2 seconds after killing
      } catch (e) {
        // Ignore errors from kill
      }
      
      // Set auth token
      await ngrok.authtoken(this.authToken);
      console.log('[NGROK] Auth token set successfully');
      
      // Create tunnel with more specific options
      this.tunnel = await ngrok.connect({
        addr: this.port,
        proto: 'http',
        // Don't specify host_header to avoid conflicts
      });
      
      this.isConnected = true;
      this.isReconnecting = false;
      this.consecutiveFailures = 0;
      this.lastSuccessfulCheck = Date.now();
      
      console.log(`[NGROK] ✅ Tunnel created successfully!`);
      console.log(`[NGROK] 🌐 Public URL: ${this.tunnel}`);
      console.log(`[NGROK] 🔗 Local URL: ${this.baseUrl}:${this.port}`);
      
      // Update bot config if changeUrl is enabled
      if (this.changeUrl) {
        await this.updateBotConfig();
      }
      
      return true;
      
    } catch (error) {
      console.error(`[NGROK] ❌ Failed to create tunnel (Attempt ${retryCount + 1}): ${error.message}`);
      
      if (retryCount < this.retryAttempts) {
        console.log(`[NGROK] Retrying in ${this.retryDelay / 1000} seconds...`);
        await this.sleep(this.retryDelay);
        return await this.startTunnel(retryCount + 1);
      }
      
      this.isConnected = false;
      this.isReconnecting = false;
      return false;
    }
  }

  /**
   * Update bot configuration with new tunnel URL
   */
  async updateBotConfig() {
    try {
      if (!this.tunnel) {
        console.log('[NGROK] No tunnel URL to update');
        return false;
      }

      // Read current config
      const configPath = path.join(__dirname, 'botconfig.json');
      const currentConfig = require(configPath);
      
      // Update server domain only if it's different
      const oldDomain = currentConfig.server.domain;
      if (oldDomain !== this.tunnel) {
        currentConfig.server.domain = this.tunnel;
        
        // Write updated config
        await fs.writeFile(configPath, JSON.stringify(currentConfig, null, 2));
        
        console.log(`[NGROK] 📄 Bot config updated!`);
        console.log(`[NGROK] Old domain: ${oldDomain}`);
        console.log(`[NGROK] New domain: ${this.tunnel}`);
        
        // Clear require cache to reload the config
        delete require.cache[require.resolve('./botconfig.json')];
        
        // Update the config object in memory
        config.server.domain = this.tunnel;
      }
      
      return true;
    } catch (error) {
      console.error(`[NGROK] Failed to update bot config: ${error.message}`);
      return false;
    }
  }

  /**
   * Start monitoring tunnel in background with less frequent checks
   */
  startMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    console.log(`[NGROK] 👁️ Starting tunnel monitoring (5 minute intervals)`);
    
    this.monitorInterval = setInterval(async () => {
      await this.monitorTunnel();
    }, this.monitorIntervalMs);
  }

  /**
   * Simplified monitoring that's less aggressive
   */
  async monitorTunnel() {
    if (!this.enabled || !NGROK_AVAILABLE || this.isReconnecting) {
      return;
    }

    try {
      if (this.isConnected && this.tunnel) {
        // Simple check - try to get API info instead of listing tunnels
        const apiUrl = await ngrok.api.get('api/tunnels');
        
        if (apiUrl && apiUrl.tunnels && Array.isArray(apiUrl.tunnels)) {
          const activeTunnel = apiUrl.tunnels.find(t => t.public_url === this.tunnel);
          
          if (activeTunnel) {
            // Tunnel is active - reset failure counter
            this.consecutiveFailures = 0;
            this.lastSuccessfulCheck = Date.now();
            console.log('[NGROK] ✅ Tunnel verified active');
            return;
          }
        }
        
        // Tunnel not found - increment failure counter
        this.consecutiveFailures++;
        console.log(`[NGROK] ⚠️ Tunnel verification failed (${this.consecutiveFailures}/${this.maxConsecutiveFailures})`);
        
        // Only reconnect after multiple consecutive failures
        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
          console.log('[NGROK] Multiple consecutive failures detected, attempting reconnection...');
          this.isConnected = false;
          await this.restartTunnel();
        }
      }
    } catch (error) {
      this.consecutiveFailures++;
      console.error(`[NGROK] Monitoring error (${this.consecutiveFailures}/${this.maxConsecutiveFailures}): ${error.message}`);
      
      // Only reconnect after multiple failures
      if (this.consecutiveFailures >= this.maxConsecutiveFailures && this.isConnected && !this.isReconnecting) {
        console.log('[NGROK] Multiple monitoring errors, attempting reconnection...');
        this.isConnected = false;
        await this.restartTunnel();
      }
    }
  }

  /**
   * Restart tunnel with better error handling
   */
  async restartTunnel() {
    if (this.isReconnecting) {
      console.log('[NGROK] Reconnection already in progress, skipping...');
      return false;
    }

    this.isReconnecting = true;
    
    try {
      console.log('[NGROK] 🔄 Restarting tunnel...');
      
      // Clean shutdown of existing tunnel
      if (this.tunnel) {
        try {
          await ngrok.disconnect(this.tunnel);
        } catch (e) {
          console.log('[NGROK] Previous tunnel cleanup completed');
        }
      }
      
      // Kill all ngrok processes to ensure clean state
      try {
        await ngrok.kill();
      } catch (e) {
        // Ignore kill errors
      }
      
      // Reset state
      this.tunnel = null;
      this.isConnected = false;
      this.consecutiveFailures = 0;
      
      // Wait longer before creating new tunnel
      await this.sleep(5000);
      
      // Start new tunnel
      const success = await this.startTunnel();
      if (success) {
        console.log('[NGROK] ✅ Tunnel restarted successfully');
      } else {
        console.log('[NGROK] ❌ Failed to restart tunnel');
        this.isReconnecting = false;
      }
      
      return success;
    } catch (error) {
      console.error(`[NGROK] Restart failed: ${error.message}`);
      this.isReconnecting = false;
      return false;
    }
  }

  /**
   * Get current tunnel information
   */
  getTunnelInfo() {
    return {
      isConnected: this.isConnected,
      tunnelUrl: this.tunnel,
      localUrl: this.port ? `${this.baseUrl}:${this.port}` : null,
      enabled: this.enabled,
      isReconnecting: this.isReconnecting,
      consecutiveFailures: this.consecutiveFailures,
      maxFailures: this.maxConsecutiveFailures,
      lastCheck: new Date(this.lastSuccessfulCheck).toISOString(),
      monitorInterval: this.monitorIntervalMs / 1000 + ' seconds'
    };
  }

  /**
   * Stop tunnel and monitoring
   */
  async stop() {
    try {
      console.log('[NGROK] 🛑 Stopping ngrok tunnel...');
      
      // Clear monitoring interval
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = null;
      }
      
      // Disconnect tunnel
      if (this.tunnel && NGROK_AVAILABLE) {
        try {
          await ngrok.disconnect(this.tunnel);
          console.log('[NGROK] Tunnel disconnected');
        } catch (e) {
          console.log('[NGROK] Tunnel disconnect completed with warnings');
        }
      }
      
      // Kill all ngrok processes
      if (NGROK_AVAILABLE) {
        try {
          await ngrok.kill();
          console.log('[NGROK] All ngrok processes terminated');
        } catch (e) {
          console.log('[NGROK] Process cleanup completed');
        }
      }
      
      this.isConnected = false;
      this.tunnel = null;
      this.isReconnecting = false;
      this.consecutiveFailures = 0;
      
      console.log('[NGROK] ✅ Ngrok manager stopped');
      
    } catch (error) {
      console.error(`[NGROK] Error stopping ngrok: ${error.message}`);
    }
  }

  /**
   * Utility function for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Print current status
   */
  printStatus() {
    const info = this.getTunnelInfo();
    console.log('\n[NGROK] === STATUS ===');
    console.log(`[NGROK] Enabled: ${info.enabled}`);
    console.log(`[NGROK] Connected: ${info.isConnected}`);
    console.log(`[NGROK] Reconnecting: ${info.isReconnecting}`);
    console.log(`[NGROK] Consecutive Failures: ${info.consecutiveFailures}/${info.maxFailures}`);
    console.log(`[NGROK] Public URL: ${info.tunnelUrl || 'Not available'}`);
    console.log(`[NGROK] Local URL: ${info.localUrl || 'Not set'}`);
    console.log(`[NGROK] Change URL: ${this.changeUrl}`);
    console.log(`[NGROK] Last Successful Check: ${info.lastCheck}`);
    console.log(`[NGROK] Monitor Interval: ${info.monitorInterval}`);
    console.log('[NGROK] ===============\n');
  }

  /**
   * Force reconnect (for manual use)
   */
  async forceReconnect() {
    console.log('[NGROK] 🔄 Force reconnecting tunnel...');
    this.isConnected = false;
    this.consecutiveFailures = this.maxConsecutiveFailures;
    await this.restartTunnel();
  }

  /**
   * Check if tunnel is healthy without triggering reconnection
   */
  async healthCheck() {
    if (!this.enabled || !NGROK_AVAILABLE || !this.tunnel) {
      return { healthy: false, reason: 'Tunnel not available' };
    }

    try {
      const apiResponse = await ngrok.api.get('api/tunnels');
      if (apiResponse && apiResponse.tunnels) {
        const activeTunnel = apiResponse.tunnels.find(t => t.public_url === this.tunnel);
        return { 
          healthy: !!activeTunnel, 
          reason: activeTunnel ? 'Tunnel active' : 'Tunnel not found in active list' 
        };
      }
      return { healthy: false, reason: 'Unable to get tunnel list' };
    } catch (error) {
      return { healthy: false, reason: error.message };
    }
  }
}

module.exports = NgrokManager;