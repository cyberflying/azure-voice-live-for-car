// Express server for Azure Web App with Managed Identity
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import blobService from './blobService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Parse JSON and raw binary data
app.use(express.json());
app.use(express.raw({ type: 'audio/*', limit: '50mb' }));

// Serve static files from the dist folder (Vite build output)
app.use(express.static(path.join(__dirname, '../dist')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    blobServiceInitialized: blobService.isInitialized(),
    timestamp: new Date().toISOString()
  });
});

// Initialize blob service endpoint
app.post('/api/blob/init', (req, res) => {
  try {
    const { storageAccount, containerName } = req.body;
    
    if (!storageAccount || !containerName) {
      return res.status(400).json({ 
        success: false, 
        error: 'storageAccount and containerName are required' 
      });
    }

    blobService.initialize(storageAccount, containerName);
    res.json({ success: true, message: 'Blob service initialized' });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload blob endpoint
app.put('/api/blob/upload/:filename', async (req, res) => {
  try {
    if (!blobService.isInitialized()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Blob service not initialized. Call /api/blob/init first.' 
      });
    }

    const filename = req.params.filename;
    const buffer = req.body;
    const contentType = req.headers['content-type'] || 'audio/wav';

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ success: false, error: 'No file data provided' });
    }

    console.log(`Uploading ${filename} (${buffer.length} bytes)...`);
    const result = await blobService.uploadBlob(buffer, filename, contentType);
    
    if (result.success) {
      console.log(`Upload successful: ${result.url}`);
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Using Managed Identity for Azure Blob Storage access`);
});
