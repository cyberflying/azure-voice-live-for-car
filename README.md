# Azure Voice Live - Car Assistant Demo

This is a Javascript (React + Vite) demo for the Azure Voice Live (Realtime API) in a Car Assistant scenario.

## Features

- **Car Assistant Agent**: Configurable AI agent that can control car devices and check status.
- **Tools**:
  - `set_car_feature`: Control lights, windows, music, temperature.
  - `get_car_status`: Check current car status.
  - `use_value_added_service`: Simulate using navigation or entertainment services.
- **Benchmarking**: Tracks latency (simulated/basic) and token usage.
- **Export to Calculator**: Export usage metrics to the VoiceLive Calculator for billing estimation.

## Deployment

### Azure Web App Deployment

This application is configured to deploy to Azure Web App. See [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md) for detailed deployment instructions.

**Quick Deploy Steps:**
1. Configure GitHub Secret `AZURE_WEBAPP_PUBLISH_PROFILE` with your Azure Web App publish profile
2. Push to `main` branch to trigger automatic deployment via GitHub Actions
3. Access your app at `https://hubcar.azurewebsites.net`

### GitHub Pages Deployment

To deploy to GitHub Pages instead:
```bash
npm run deploy:github
```

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run the Application**:
    ```bash
    npm run dev
    ```

3.  **Open in Browser**:
    Open the URL shown in the terminal (usually `http://localhost:5173`).

## Configuration

To use the demo, you need an Azure OpenAI resource with the Realtime API enabled (e.g., `gpt-4o-realtime-preview`).

1.  Enter your **Endpoint** (e.g., `wss://<resource>.openai.azure.com/openai/realtime...`).
2.  Enter your **API Key**.
3.  Click **Connect**.

## Usage

- **Microphone**: Click the microphone icon to start/stop recording (Note: Audio streaming implementation in `realtimeService.js` is a placeholder for the WebSocket audio stream. You may need to implement the specific audio buffer handling for the Realtime API).
- **Tools**: The AI will automatically call tools based on your voice commands (e.g., "Turn on the lights", "What's the temperature?").
- **Calculator**: Click "Export to Calculator" to see the estimated cost based on your session usage.

## Project Structure

- `src/App.jsx`: Main application logic and UI.
- `src/services/realtimeService.js`: WebSocket client for Azure Realtime API.
- `src/tools/carTools.js`: Tool definitions and execution logic.
- `server/index.js`: Express server for Azure Web App hosting.
- `web.config`: IIS configuration for Azure Web App.

