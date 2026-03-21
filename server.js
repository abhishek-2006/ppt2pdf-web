import express from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

// Recreate __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Multer setup
const upload = multer({
  dest: path.join(os.tmpdir(), 'ppt_uploads'),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.ppt' || ext === '.pptx') cb(null, true);
    else cb(new Error('Only .ppt and .pptx files allowed'), false);
  }
});

const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

const generatedFiles = {};

// Detect soffice path
const SOFFICE_CANDIDATES = [
  process.env.SOFFICE_PATH,
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  '/usr/bin/soffice',
  '/usr/bin/libreoffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  'soffice'
].filter(Boolean);

function findSoffice() {
  for (const p of SOFFICE_CANDIDATES) {
    try {
      if (p === 'soffice') return 'soffice';
      if (fs.existsSync(p)) return p;
    } catch (e) {}
  }
  return 'soffice';
}

const SOFFICE_BIN = findSoffice();
console.log('Using soffice binary:', SOFFICE_BIN);

// Sequential conversion helper
function convertWithSoffice(inPath, workdir, timeoutMs = 150000) {
  return new Promise((resolve, reject) => {
    const args = ['--headless', '--invisible', '--convert-to', 'pdf', '--outdir', workdir, inPath];
    const soffice = spawn(SOFFICE_BIN, args, { stdio: 'ignore' });

    const timeout = setTimeout(() => {
      try { soffice.kill(); } catch (e) {}
      reject(new Error('Conversion timeout'));
    }, timeoutMs);

    soffice.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    soffice.on('close', (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
}

// Convert endpoint
app.post('/convert', upload.array('file', 50), async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded.' });

  const workdir = path.join(os.tmpdir(), 'ppt2pdf_' + uuidv4());
  try {
    fs.mkdirSync(workdir, { recursive: true });

    for (const f of files) {
      const inPath = path.join(workdir, f.originalname);
      fs.renameSync(f.path, inPath);
    }

    for (const f of files) {
      const inPath = path.join(workdir, f.originalname);
      await convertWithSoffice(inPath, workdir);
    }

    const pdfFiles = fs.readdirSync(workdir).filter(fn => fn.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      cleanup(workdir);
      return res.status(500).json({ error: 'Conversion failed: no PDF produced.' });
    }

    const filesDir = path.join(os.tmpdir(), 'ppt2pdf_files');
    fs.mkdirSync(filesDir, { recursive: true });
    const id = uuidv4();

    if (pdfFiles.length === 1) {
      const pdfPath = path.join(workdir, pdfFiles[0]);
      const destPath = path.join(filesDir, id + '.pdf');
      fs.copyFileSync(pdfPath, destPath);
      generatedFiles[id] = { path: destPath, downloadName: pdfFiles[0] };
      
      setTimeout(() => { try { fs.unlinkSync(destPath); } catch (e) {} delete generatedFiles[id]; }, 10 * 60 * 1000);
      cleanup(workdir);
      return res.json({ success: true, downloadUrl: `/download/${id}`, filename: pdfFiles[0] });
    }

    const zipPath = path.join(filesDir, id + '.zip');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      generatedFiles[id] = { path: zipPath, downloadName: 'converted-pdfs.zip' };
      setTimeout(() => { try { fs.unlinkSync(zipPath); } catch (e) {} delete generatedFiles[id]; }, 10 * 60 * 1000);
      cleanup(workdir);
      res.json({ success: true, downloadUrl: `/download/${id}`, filename: 'converted-pdfs.zip' });
    });

    archive.pipe(output);
    for (const pdf of pdfFiles) {
      archive.file(path.join(workdir, pdf), { name: pdf });
    }
    archive.finalize();

  } catch (err) {
    cleanup(workdir);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Preview endpoint
app.post('/preview-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const workdir = path.join(os.tmpdir(), 'ppt_preview_pdf_' + uuidv4());
  
  try {
    fs.mkdirSync(workdir, { recursive: true });
    const inPath = path.join(workdir, req.file.originalname);
    fs.renameSync(req.file.path, inPath);

    await convertWithSoffice(inPath, workdir);
    const pdfs = fs.readdirSync(workdir).filter(f => /\.pdf$/i.test(f));

    if (pdfs.length === 0) {
      cleanup(workdir);
      return res.status(500).json({ error: 'Preview failed.' });
    }

    const buf = fs.readFileSync(path.join(workdir, pdfs[0]));
    cleanup(workdir);

    res.setHeader('Content-Type', 'application/pdf');
    res.send(buf);
  } catch (err) {
    cleanup(workdir);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/download/:id', (req, res) => {
  const info = generatedFiles[req.params.id];
  if (!info || !fs.existsSync(info.path)) return res.status(404).send('Expired.');
  res.download(info.path, info.downloadName, () => {
    try { fs.unlinkSync(info.path); } catch (e) {}
    delete generatedFiles[req.params.id];
  });
});

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));

function cleanup(dir) {
  try {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f)));
      fs.rmdirSync(dir);
    }
  } catch (e) {}
}