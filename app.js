import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm'
import piexif from 'https://cdn.jsdelivr.net/npm/piexifjs@1.0.6/+esm'

const fileInput = document.getElementById('file-input')
const sizeSlider = document.getElementById('size-slider');
const photoGrid = document.getElementById('photo-grid')
const yearGrid = document.getElementById('year-grid')
const exportBtn = document.getElementById('export-btn')
const MAX_PREVIEW_SIZE = 100;

let photos = []
const yearNameIndices = {}

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

function renderPhotoTile(photo, index) {
  const tile = document.createElement('div')
  tile.className = 'photo-tile'
  tile.style.width = currentSize + 'px'
  tile.style.height = currentSize + 'px'
  tile.innerHTML = `<img src="${photo.previewURL}" style="width: 100%; height: 100%; object-fit: cover;">`

  const checkmark = document.createElement('div')
  checkmark.className = 'checkmark'
  checkmark.textContent = '✓'
  checkmark.style.display = 'none'
  tile.appendChild(checkmark)

  tile.addEventListener('click', () => {
    photo.selected = !photo.selected
    tile.classList.toggle('selected', photo.selected)
    checkmark.style.display = photo.selected ? 'block' : 'none'
  })

  tile.dataset.index = index
  photoGrid.appendChild(tile)
}

function renderYearTiles() {
  for (let year = 1939; year <= 2025; year++) {
    const tile = document.createElement('div')
    tile.className = 'year-tile'
    tile.textContent = year
    tile.addEventListener('click', () => assignYear(year))
    yearGrid.appendChild(tile)
  }
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
  photoGrid.innerHTML = ''
  photos.forEach((photo, index) => {
    if (!photo.assignedYear) {
      renderPhotoTile(photo, index)
    }
  })
}

exportBtn.addEventListener('click', async () => {
  const assignedPhotos = photos.filter(p => p.assignedYear);
  if (assignedPhotos.length === 0) {
    alert('No photos assigned yet.');
    return;
  }

  // CSV header
  let csvContent = 'original_filename,new_filename,new_date_taken\n';

  assignedPhotos.forEach(photo => {
    const dateStr = `${photo.assignedYear}:01:01 00:00:00`; // Exif date format
    // Generate new filename with random 10 char hash
    const randomHash = [...Array(10)].map(() => Math.random().toString(36)[2]).join('');
    const newName = `${photo.assignedYear}-01-01__${randomHash}.jpg`;
    csvContent += `${photo.name},${newName},${dateStr}\n`;
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
