// script.js - minimal frontend UX
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
    // Append dropped files to currentFiles (avoid duplicates by name)
    const dropped = Array.from(e.dataTransfer.files);
    for (const f of dropped) {
      if (!currentFiles.some(existing => existing.name === f.name && existing.size === f.size)) {
        currentFiles.push(f);
      }
    }
    fileInput.files = createFileList(currentFiles);
    renderFileList();
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) {
    // append new selections to current list (avoid duplicates)
    const picked = Array.from(fileInput.files);
    for (const f of picked) {
      if (!currentFiles.some(existing => existing.name === f.name && existing.size === f.size)) {
        currentFiles.push(f);
      }
    }
    fileInput.files = createFileList(currentFiles);
    renderFileList();
  }
});

// Reset button clears selection
resetBtn.addEventListener('click', () => {
  resetSelection();
});

convertBtn.addEventListener('click', () => {
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
          a.className = 'download';
          a.textContent = json.filename && json.filename.toLowerCase().endsWith('.zip') ? 'Download ZIP' : 'Download PDF';
          if (json.filename) a.download = json.filename;
          result.appendChild(a);
          status.textContent = 'Conversion ready. Click the download button.';
          // After conversion, keep the selected files visible and allow reset or further actions
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

// Helper: render the selected files list with remove icons
function renderFileList() {
  fileListEl.innerHTML = '';
  if (!currentFiles || currentFiles.length === 0) {
    fileListEl.textContent = '';
    status.textContent = 'Ready';
    // hide reset button when no files selected
    if (resetBtn) resetBtn.hidden = true;
    return;
  }
  const ul = document.createElement('ul');
  ul.className = 'files';
  currentFiles.forEach((f, idx) => {
    const li = document.createElement('li');
    li.className = 'file-item';
    const name = document.createElement('span');
    name.textContent = f.name;
    name.title = f.name;
    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${f.name}`);
    remove.textContent = '✖';
    remove.addEventListener('click', () => {
      removeFileAt(idx);
    });
    li.appendChild(name);
    li.appendChild(remove);
    ul.appendChild(li);
  });
  fileListEl.appendChild(ul);
  status.textContent = currentFiles.length === 1 ? currentFiles[0].name : `${currentFiles.length} files selected`;
  // show reset button when at least one file selected
  if (resetBtn) resetBtn.hidden = false;
}

function removeFileAt(index) {
  if (index < 0 || index >= currentFiles.length) return;
  currentFiles.splice(index, 1);
  // update the hidden fileInput to reflect currentFiles
  fileInput.files = createFileList(currentFiles);
  renderFileList();
}

function resetSelection() {
  currentFiles = [];
  fileInput.value = '';
  renderFileList();
  result.innerHTML = '';
  status.textContent = 'Ready';
}

// Utility: create a DataTransfer-based FileList from an array of File objects
function createFileList(files) {
  try {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    return dt.files;
  } catch (e) {
    // DataTransfer may not be available in some environments; return existing input.files
    return fileInput.files;
  }
}

// initial render
renderFileList();
