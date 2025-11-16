# ppt2pdf-web

Convert PowerPoint (PPT/PPTX) presentations to PDF via a minimal web interface.

**Developer:** Abhishek Shah

**Status:** Minimal web utility — quick local deployment and Docker support.

**Contents**
- `server.js` — Node.js server that hosts the web UI and handles conversion requests.
- `public/` — Static web assets (HTML, CSS, JavaScript).
- `Dockerfile` — Build a container image for the app.

**Features**
- Simple web UI to upload PPT/PPTX files and receive a PDF.
- Lightweight Node.js backend.

Prerequisites
- Node.js (v14+ recommended)
- npm (comes with Node.js)
- Docker (optional, for containerized runs)

Download & install Node.js

- Official downloads: https://nodejs.org/
- Quick verification after install (open a terminal / PowerShell):

```powershell
node -v
npm -v
```

Platform notes:
- **Windows**: Download the Windows installer (MSI) from the Node.js website and run it. Alternatively install `nvm-windows` for multiple Node versions: https://github.com/coreybutler/nvm-windows
- **macOS**: Download the macOS installer from the Node.js website, or use Homebrew: `brew install node`.
- **Linux**: Use your distro package manager or the NodeSource installers; example for Debian/Ubuntu:

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Other useful links
- Docker: https://www.docker.com/get-started
- LibreOffice (if needed for conversions): https://www.libreoffice.org/download/download/

Quick start (local)

1. Install dependencies:

```powershell
npm install
```

2. Start the server:

```powershell
# If a start script exists:
npm start
# Or directly:
node server.js
```

3. Open the app in your browser at `http://localhost:3000` (confirm port in `server.js`).

Running with Docker

1. Build the image:

```powershell
docker build -t ppt2pdf-web .
```

2. Run the container (example mapping port 3000):

```powershell
docker run -p 3000:3000 ppt2pdf-web
```

3. Open `http://localhost:3000` in your browser.

Usage
- Open the web UI and upload a `.ppt` or `.pptx` file.
- The app will convert and provide a downloadable PDF.
- If conversion requires additional binaries (LibreOffice/headless or unoconv), follow prompts or consult `server.js` for integration notes.

Development
- Edit static files in `public/`.
- Edit server logic in `server.js`.
- Restart the Node server after code changes.

Troubleshooting
- If the app doesn't start, check Node version and run `node server.js` to see errors.
- If file conversions fail, verify any external converters are installed and accessible to the server process.

Contributing
- Open an issue or a PR with clear descriptions and tests where applicable.

License
- MIT

Contact
- Developer: Abhishek Shah — shahabhishek409@gmail.com
