// Azure Blob Storage service using Managed Identity
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

class BlobService {
  constructor() {
    this.blobServiceClient = null;
    this.containerClient = null;
  }

  /**
   * Initialize the Blob Service with Managed Identity
   * @param {string} storageAccount - Storage account name
   * @param {string} containerName - Container name
   */
  initialize(storageAccount, containerName) {
    if (!storageAccount || !containerName) {
      throw new Error('Storage account and container name are required');
    }

    const accountUrl = `https://${storageAccount}.blob.core.windows.net`;
    
    // Use DefaultAzureCredential which supports:
    // - Managed Identity (in Azure Web App)
    // - Azure CLI credentials (for local development)
    // - Environment variables
    // - Visual Studio Code credentials
    const credential = new DefaultAzureCredential();
    
    this.blobServiceClient = new BlobServiceClient(accountUrl, credential);
    this.containerClient = this.blobServiceClient.getContainerClient(containerName);
    
    console.log(`Blob service initialized for ${accountUrl}/${containerName}`);
  }

  /**
   * Upload a buffer to blob storage
   * @param {Buffer} buffer - File buffer
   * @param {string} blobName - Name of the blob
   * @param {string} contentType - MIME type
   * @returns {Promise<{success: boolean, url?: string, error?: string}>}
   */
  async uploadBlob(buffer, blobName, contentType = 'audio/wav') {
    if (!this.containerClient) {
      return { success: false, error: 'Blob service not initialized' };
    }

    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      
      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: contentType
        }
      });

      return {
        success: true,
        url: blockBlobClient.url
      };
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized() {
    return this.containerClient !== null;
  }
}

export default new BlobService();
