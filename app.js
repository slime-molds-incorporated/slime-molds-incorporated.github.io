import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm'
import piexif from 'https://cdn.jsdelivr.net/npm/piexifjs@1.0.6/+esm'

const MAX_PREVIEW_SIZE = 200;
let allTags = [];
let photos = []
const yearNameIndices = {}
let filteredYear = null; // null means showing unassigned photos

const fileInput = document.getElementById('file-input')
const sizeSlider = document.getElementById('size-slider');
const photoGrid = document.getElementById('photo-grid')
const yearGrid = document.getElementById('year-grid')
const exportBtn = document.getElementById('export-btn')
const tagSelect = document.getElementById('tag-select');
const newTagInput = document.getElementById('new-tag-input');
const addTagBtn = document.getElementById('add-tag-btn');

const loadMetadataBtn = document.getElementById('load-metadata-btn');
const loadMetadataInput = document.getElementById('load-metadata-input');
const loadStatus = document.getElementById('load-status');

const toggleInstructionsBtn = document.getElementById('toggle-instructions-btn');
const instructionsPara = document.getElementById('instructions');

toggleInstructionsBtn.addEventListener('click', () => {
  const visible = instructionsPara.style.display === 'block';
  if (visible) {
    instructionsPara.style.display = 'none';
    toggleInstructionsBtn.textContent = 'See Instructions';
  } else {
    instructionsPara.style.display = 'block';
    toggleInstructionsBtn.textContent = 'Hide Instructions';
  }
});


loadMetadataBtn.addEventListener('click', () => {
  loadMetadataInput.value = null; // reset file input
  loadMetadataInput.click();
});

loadMetadataInput.addEventListener('change', () => {
  const file = loadMetadataInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    importMetadataCSV(text);
  };
  reader.readAsText(file);
});

function importMetadataCSV(csvText) {
  // Parse CSV (simple split assuming no commas in fields)
  // Format expected: original_filename,new_filename,new_date_taken,tags

  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    loadStatus.textContent = 'CSV is empty or missing data';
    return;
  }

  // Extract headers
  const headers = lines[0].split(',').map(h => h.trim());
  const filenameIdx = headers.indexOf('original_filename');
  const newNameIdx = headers.indexOf('new_filename');
  const dateIdx = headers.indexOf('new_date_taken');
  const tagsIdx = headers.indexOf('tags');

  if (filenameIdx === -1) {
    loadStatus.textContent = 'CSV missing "original_filename" header';
    return;
  }

  // Build a map from filename -> metadata object
  const metadataMap = new Map();

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    const originalFilename = row[filenameIdx]?.trim();
    if (!originalFilename) continue;

    const newFilename = newNameIdx !== -1 ? row[newNameIdx]?.trim() : null;
    const newDate = dateIdx !== -1 ? row[dateIdx]?.trim() : null;
    const tagsRaw = tagsIdx !== -1 ? row[tagsIdx]?.trim() : '';

    const tagsArray = tagsRaw ? tagsRaw.split('_').filter(t => t) : [];

    metadataMap.set(originalFilename, {
      newFilename,
      newDate,
      tags: tagsArray,
    });
  }

  // Reset allTags and rebuild from CSV tags (to catch all tags)
  allTags = [];

  // Update photos array metadata by matching filename
  photos.forEach(photo => {
    const meta = metadataMap.get(photo.name);
    if (meta) {
      // Overwrite metadata (except pixel data / previewURL)
      if (meta.newFilename) photo.newName = meta.newFilename;
      if (meta.newDate) photo.assignedYear = parseInt(meta.newDate.split(':')[0]); // year only from "YYYY:MM:DD..."
      photo.tags = meta.tags || [];

      console.log(photo);

      // Collect tags globally
      meta.tags.forEach(tag => {
        if (tag && !allTags.includes(tag)) allTags.push(tag);
      });
    }
  });

  loadStatus.textContent = `Loaded metadata for ${metadataMap.size} photos`;

  // Re-render UI to reflect changes
  refreshPhotoGrid();
  selectionChanged();

  filteredYear = null;
  updateYearTileStyles();
  refreshPhotoGrid();
}


function getNextIndexForYear(obj, year) {
    if (!(year in yearNameIndices)) {
        obj[year] = 0;
        return 0;
    } else {
        obj[year]++;
        return obj[year];
    }
}

let currentSize = sizeSlider.value;

sizeSlider.addEventListener('input', () => {
  currentSize = sizeSlider.value;
  const size = currentSize + 'px';
  document.querySelectorAll('.photo-tile').forEach(tile => {
    tile.style.width = size;
    tile.style.height = size;
  });
});

fileInput.addEventListener('change', handleFiles)

function downsampleImage(file, maxSize = MAX_PREVIEW_SIZE) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        resolve({ url, blob });
      }, 'image/jpeg', 0.75);
    };
    img.src = URL.createObjectURL(file);
  });
}

async function handleFiles(event) {
  photos = [];
  photoGrid.innerHTML = '';
  const files = Array.from(event.target.files).filter(file => file.type.startsWith('image/'));
  for (const file of files) {
    const { url: previewURL } = await downsampleImage(file, MAX_PREVIEW_SIZE);
    photos.push({
      file,
      name: file.name,
      previewURL,
      assignedYear: null,
      selected: false
    });
  }
  photos.forEach((photo, index) => renderPhotoTile(photo, index));
}

function renderTagSelect() {
  tagSelect.innerHTML = '';
  allTags.forEach(tag => {
    const id = `tag-checkbox-${tag}`;
    const div = document.createElement('div');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;

    // If **all** selected photos have this tag, check it; otherwise unchecked
    const allSelectedHaveTag = photos.filter(p => p.selected).every(p => p.tags && p.tags.includes(tag));
    checkbox.checked = allSelectedHaveTag;

    checkbox.addEventListener('change', () => {
      photos.forEach(photo => {
        if (photo.selected) {
          if (checkbox.checked) {
            if (!photo.tags) photo.tags = [];
            if (!photo.tags.includes(tag)) photo.tags.push(tag);
          } else {
            if (photo.tags) {
              photo.tags = photo.tags.filter(t => t !== tag);
            }
          }
        }
      });
    });

    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = tag;

    div.appendChild(checkbox);
    div.appendChild(label);
    tagSelect.appendChild(div);
  });
}

addTagBtn.addEventListener('click', () => {
  const newTag = newTagInput.value.trim();
  if (newTag && !allTags.includes(newTag)) {
    allTags.push(newTag);
    newTagInput.value = '';
    renderTagSelect();
  }
});

// Whenever selection changes, update tag selector
function selectionChanged() {
  renderTagSelect();
  // ... any other selection-based updates
}

function renderPhotoTile(photo, index) {
  const tile = document.createElement('div')
  tile.className = 'photo-tile'
  tile.style.width = currentSize + 'px'
  tile.style.height = currentSize + 'px'
  tile.innerHTML = `<img src="${photo.previewURL}" style="width: 100%; height: 100%; object-fit: cover;">`

  const checkmark = document.createElement('div')
  checkmark.className = 'checkmark'
  checkmark.textContent = '✓'
  checkmark.style.display = photo.selected ? 'block' : 'none';
  tile.appendChild(checkmark);

  if (filteredYear === null) {
    // Normal selection mode: toggle selected on left-click
    tile.addEventListener('click', () => {
      photo.selected = !photo.selected;
      tile.classList.toggle('selected', photo.selected);
      checkmark.style.display = photo.selected ? 'block' : 'none';
      selectionChanged();
    });
  } else {
    // Filter mode: left-click unassigns year
    tile.addEventListener('click', () => {
      photo.assignedYear = null;
      refreshPhotoGrid();
      selectionChanged();
    });
  }

  tile.dataset.index = index;
  photoGrid.appendChild(tile);
}

function renderYearTiles() {
  for (let year = 1939; year <= 2025; year++) {
    const tile = document.createElement('div')
    tile.className = 'year-tile'
    tile.textContent = year
    tile.addEventListener('click', () => {
      if (filteredYear === null) {
        assignYear(year);
      }
    });
    tile.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (filteredYear === year) {
        // Disable filter
        filteredYear = null;
      } else {
        filteredYear = year;
      }
      updateYearTileStyles();
      refreshPhotoGrid();
    });
    yearGrid.appendChild(tile)
  }
}

function updateYearTileStyles() {
  document.querySelectorAll('.year-tile').forEach(tile => {
    if (+tile.textContent === filteredYear) {
      tile.style.backgroundColor = 'black';
      tile.style.color = 'white';
    } else {
      tile.style.backgroundColor = '';
      tile.style.color = '';
    }
  });
}


function assignYear(year) {
  photos.forEach(photo => {
    if (photo.selected && !photo.assignedYear) {
      photo.assignedYear = year
      photo.selected = false
    }
  })
  refreshPhotoGrid()
}

function refreshPhotoGrid() {
  photoGrid.innerHTML = '';

  let visiblePhotos = [];
  if (filteredYear === null) {
    visiblePhotos = photos.filter(p => !p.assignedYear);
  } else {
    visiblePhotos = photos.filter(p => p.assignedYear === filteredYear);
  }

  visiblePhotos.forEach((photo, index) => renderPhotoTile(photo, index));
}

photoGrid.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (filteredYear !== null) {
    filteredYear = null;
    updateYearTileStyles();
    refreshPhotoGrid();
  }
});

exportBtn.addEventListener('click', async () => {
  const assignedPhotos = photos.filter(p => p.assignedYear);
  if (assignedPhotos.length === 0) {
    alert('No photos assigned yet.');
    return;
  }

  // CSV header
  let csvContent = 'original_filename,new_filename,new_date_taken,tags\n';

  assignedPhotos.forEach(photo => {
    const dateStr = photo.assignedYear ? `${photo.assignedYear}:01:01 00:00:00` : 'unknown';
    const newName = photo.newName || `${photo.assignedYear}-01-01__${[...Array(10)].map(() => Math.random().toString(36)[2]).join('')}.jpg`;
    const tagsString = photo.tags ? photo.tags.join('_') : '';
    csvContent += `${photo.name},${newName},${dateStr},${tagsString}\n`;
  });

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv' });
  saveAs(blob, 'photo_metadata_map.csv');
})

function fileToDataURL(file) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.readAsDataURL(file)
  })
}

function dataURLtoBlob(dataURL) {
  const parts = dataURL.split(';base64,')
  const byteString = atob(parts[1])
  const mimeString = parts[0].split(':')[1]
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  return new Blob([ab], { type: mimeString })
}



// Initialize year tiles
renderYearTiles()
