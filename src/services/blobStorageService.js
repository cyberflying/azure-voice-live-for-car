/**
 * Azure Blob Storage Service
 * Uploads audio files to Azure Blob Storage via server-side API with Managed Identity
 */

export class BlobStorageService {
  constructor() {
    this.storageAccount = '';
    this.containerName = '';
    this.isServerInitialized = false;
  }

  /**
   * Update storage configuration and initialize server-side blob service
   */
  async updateConfig(storageAccount, containerName) {
    this.storageAccount = storageAccount;
    this.containerName = containerName;
    this.isServerInitialized = false;
    
    if (storageAccount && containerName) {
      try {
        const response = await fetch('/api/blob/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ storageAccount, containerName })
        });
        
        const result = await response.json();
        this.isServerInitialized = result.success;
        
        if (!result.success) {
          console.error('Failed to initialize blob service:', result.error);
        }
      } catch (error) {
        console.error('Failed to initialize blob service:', error);
        this.isServerInitialized = false;
      }
    }
  }

  /**
   * Check if storage is configured
   */
  isConfigured() {
    return !!(this.storageAccount && this.containerName);
  }

  /**
   * Check if server-side blob service is initialized
   */
  isReady() {
    return this.isServerInitialized;
  }

  /**
   * Upload a blob to Azure Storage via server API (uses Managed Identity)
   * @param {Blob} blob - The blob to upload
   * @param {string} filename - The filename for the blob
   * @returns {Promise<{success: boolean, url?: string, error?: string}>}
   */
  async uploadBlob(blob, filename) {
    if (!this.isConfigured()) {
      return { 
        success: false, 
        error: 'Azure Storage not configured. Please provide Storage Account and Container Name.' 
      };
    }

    try {
      // Convert Blob to ArrayBuffer for transmission
      const arrayBuffer = await blob.arrayBuffer();
      
      const response = await fetch(`/api/blob/upload/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': blob.type || 'audio/wav'
        },
        body: arrayBuffer
      });

      const result = await response.json();
      
      if (result.success) {
        return { 
          success: true, 
          url: result.url,
          filename: filename
        };
      } else {
        return { 
          success: false, 
          error: result.error || 'Upload failed' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Upload error: ${error.message}` 
      };
    }
  }
}

// Singleton instance
export const blobStorageService = new BlobStorageService();
