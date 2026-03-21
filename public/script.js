const fileInput = document.getElementById('file');
const convertBtn = document.getElementById('convert');
const resetBtn = document.getElementById('reset');
const status = document.getElementById('status');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const result = document.getElementById('result');
const drop = document.getElementById('drop');
const fileListEl = document.getElementById('fileList');

let currentFiles = [];

drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', e => { drop.classList.remove('drag'); });
drop.addEventListener('drop', e => {
  e.preventDefault(); drop.classList.remove('drag');
  if (e.dataTransfer.files && e.dataTransfer.files.length) {
    addFiles(Array.from(e.dataTransfer.files));
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files.length) {
    addFiles(Array.from(fileInput.files));
  }
  try { fileInput.value = ''; } catch (e) {}
});

// Centralized file adding helper to avoid inconsistent state when selecting same file repeatedly
function addFiles(filesArray) {
  if (!filesArray || filesArray.length === 0) return;
  let added = 0;
  for (const f of filesArray) {
    const ext = (f.name || '').split('.').pop().toLowerCase();
    if (!(ext === 'ppt' || ext === 'pptx')) continue;
    if (!currentFiles.some(existing => existing.name === f.name && existing.size === f.size && existing.lastModified === f.lastModified)) {
      currentFiles.push(f);
      added++;
    }
  }
  try { fileInput.files = createFileList(currentFiles); } catch (e) { /* ignore */ }
  if (added > 0) renderFileList();
}

// Reset button clears selection
resetBtn.addEventListener('click', () => {
  resetSelection();
});

convertBtn.addEventListener('click', () => {
  const status = document.getElementById('status');
  result.innerHTML = '';
  if (!currentFiles || currentFiles.length === 0) { status.textContent = 'Pick one or more .ppt or .pptx files.'; return; }

  // validate extensions
  for (const f of currentFiles) {
    const ext = f.name.split('.').pop().toLowerCase();
    if (!(ext === 'ppt' || ext === 'pptx')) { status.textContent = 'Only .ppt/.pptx allowed.'; return; }
  }

  const form = new FormData();
  for (const f of currentFiles) form.append('file', f);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/convert');

  convertBtn.disabled = true;
  status.textContent = 'Uploading...';
  progressWrap.hidden = false;
  progressBar.style.width = '0%';

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressBar.style.width = pct + '%';
      status.textContent = 'Uploading: ' + pct + '%';
    }
  };

  xhr.onload = () => {
    convertBtn.disabled = false;
    progressWrap.hidden = true;
    progressBar.style.width = '0%';
    if (xhr.status === 200) {
      try {
        const json = JSON.parse(xhr.responseText);
        if (json && json.downloadUrl) {
          const a = document.createElement('a');
          a.href = json.downloadUrl;

          a.className = 'download group flex items-center gap-4 px-10 py-5 bg-gradient-to-r from-emerald-500 to-teal-600 border border-emerald-500/20 text-white font-bold rounded-xl hover:bg-emerald-500/20 hover:scale-105 hover:shadow-[0_0_30px_rgba(16,182,129,0.4)] transition-all duration-300 shadow-emerald-500/10';
          
          const isZip = json.filename && json.filename.toLowerCase().endsWith('.zip');
          a.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            <span>${isZip ? 'Download PDFs (ZIP)' : 'Download PDF'}</span>
          `;

          if (json.filename) a.download = json.filename;
          result.appendChild(a);
          status.textContent = 'Finished. Click the download button.';
        } else {
          status.textContent = 'Conversion succeeded but no download link returned.';
        }
      } catch (e) {
        status.textContent = 'Conversion succeeded but response could not be read.';
      }
    } else {
      try {
        const json = JSON.parse(xhr.responseText || '{}');
        status.textContent = json.error || 'Conversion failed.';
      } catch (e) {
        status.textContent = 'Conversion failed (server error).';
      }
    }
  };

  xhr.onerror = () => {
    convertBtn.disabled = false;
    progressWrap.hidden = true;
    status.textContent = 'Upload failed.';
  };

  xhr.send(form);
});

async function renderFileList() {
  const fileListEl = document.getElementById('fileList');
  const emptyState = document.getElementById('empty-state');
  const convertBtn = document.getElementById('convert');
  const resetBtn = document.getElementById('reset');
  const status = document.getElementById('status');
  
  fileListEl.innerHTML = '';

  if (!currentFiles || currentFiles.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    if (convertBtn) convertBtn.disabled = true;
    if (resetBtn) resetBtn.hidden = true;
    status.textContent = 'Ready';
    return;
  }

  // Hide empty state if files exist
  if (emptyState) emptyState.classList.add('hidden');
  if (convertBtn) convertBtn.disabled = false;
  if (resetBtn) resetBtn.hidden = false;

  // Create the grid container if it doesn't exist or just use fileListEl
  currentFiles.forEach((f, idx) => {
    const p = document.createElement('div');
    p.className = 'preview-card relative group bg-white/5 border border-white/10 rounded-2xl p-4 transition-all hover:bg-white/10';

    const wrap = document.createElement('div');
    wrap.className = 'aspect-video rounded-xl overflow-hidden bg-black/20 mb-3 relative';

    const remove = document.createElement('button');
    remove.className = 'absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10';
    remove.innerHTML = '✕';
    remove.addEventListener('click', () => { removeFileAt(idx); });

    const thumb = document.createElement('div');
    thumb.className = 'w-full h-full flex items-center justify-center';
    thumb.id = `thumb-container-${idx}`;
    
    // Initial placeholder
    const img = document.createElement('img');
    img.className = 'max-h-full object-contain';
    img.src = makePlaceholder(getExt(f.name));

    thumb.appendChild(img);
    wrap.appendChild(remove);
    wrap.appendChild(thumb);

    const fname = document.createElement('div');
    fname.className = 'text-sm font-medium truncate text-slate-300 px-1';
    fname.textContent = f.name;

    p.appendChild(wrap);
    p.appendChild(fname);
    fileListEl.appendChild(p);

  });

  await processPreviewsSequentially();

  status.textContent = `${currentFiles.length} file(s) selected`;
}

// In script.js: Update the loop to be sequential
async function renderAllPreviews() {
  for (let i = 0; i < currentFiles.length; i++) {
    const thumb = document.getElementById(`thumb-${i}`);
    if (thumb && !thumb.dataset.rendered) {
      await renderPptPreviewFromPdfBytes(currentFiles[i], thumb);
      thumb.dataset.rendered = "true";
    }
  }
}

async function processPreviewsSequentially() {
  for (let i = 0; i < currentFiles.length; i++) {
    const thumbContainer = document.getElementById(`thumb-container-${i}`);
    if (thumbContainer) {
      thumbContainer.innerHTML = '<div class="text-[10px] text-cyan-400 animate-pulse">Processing...</div>';
      
      try {
        await renderPptPreviewFromPdfBytes(currentFiles[i], thumbContainer);
      } catch (e) {
        console.error(`Failed to render preview ${i}:`, e);
      }
    }
  }
}

// Toggle drop area to a compact 'add more' state
function setDropCompact() {
  if (!drop) return;
  drop.classList.add('compact');
  drop.style.minHeight = '84px';
}

// Restore the drop area to its original large appearance
function restoreDropDefault() {
  if (!drop) return;
  drop.classList.remove('compact');
  drop.style.minHeight = '';
}

function removeFileAt(index) {
  if (index < 0 || index >= currentFiles.length) return;
  currentFiles.splice(index, 1);
  // update the hidden fileInput to reflect currentFiles
  try { fileInput.files = createFileList(currentFiles); } catch (e) { /* ignore */ }
  renderFileList();
}

function resetSelection() {
  currentFiles = [];
  try { fileInput.value = ''; } catch (e) {}
  
  renderFileList();
  
  try { result.innerHTML = ''; } catch (e) {}
  status.textContent = 'Ready';
}

// Utility: create a DataTransfer-based FileList from an array of File objects
function createFileList(files) {
  try {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    return dt.files;
  } catch (e) {
    return fileInput.files;
  }
}

function getExt(name) {
  return (name || '').split('.').pop().toLowerCase();
}

function makePlaceholder(ext) {
  const label = (ext || 'ppt').toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='100%' height='100%' fill='%2309141a'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='40' fill='%23cfeaff'>${label}</text></svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

// Upload a PPT/PPTX to the server, get PDF bytes, and render first page client-side with PDF.js
async function renderPptPreviewFromPdfBytes(file, thumbElement) {
  if (!file || !thumbElement) return;
  
  try {
    const fd = new FormData();
    fd.append('file', file);

    const resp = await fetch('/preview-pdf', { method: 'POST', body: fd });
    if (!resp.ok) throw new Error('Preview failed');

    const arrayBuffer = await resp.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdfDoc.getPage(1);
    
    // Calculate scale to fit the whole-page view grid
    const viewport = page.getViewport({ scale: 1 });
    const targetWidth = thumbElement.clientWidth || 300;
    const scale = targetWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

    thumbElement.innerHTML = '';
    canvas.className = 'w-full h-full object-contain';
    thumbElement.appendChild(canvas);
  } catch (err) {
    console.error('Render error:', err);
    thumbElement.innerHTML = `<div class="text-[10px] text-red-400">Preview Unavailable</div>`;
  }
}

// initial render
renderFileList();