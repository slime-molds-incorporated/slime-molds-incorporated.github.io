import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm'
import piexif from 'https://cdn.jsdelivr.net/npm/piexifjs@1.0.6/+esm'

const fileInput = document.getElementById('file-input')
const photoGrid = document.getElementById('photo-grid')
const yearGrid = document.getElementById('year-grid')
const exportBtn = document.getElementById('export-btn')

let photos = []

fileInput.addEventListener('change', handleFiles)

function handleFiles(event) {
  photos = []
  photoGrid.innerHTML = ''
  const files = Array.from(event.target.files).filter(file => file.type.startsWith('image/'))
  files.forEach((file, index) => {
    const reader = new FileReader()
    reader.onload = e => {
      const photo = {
        file,
        name: file.name,
        originalDataURL: e.target.result,
        assignedYear: null,
        selected: false
      }
      photos.push(photo)
      renderPhotoTile(photo, index)
    }
    reader.readAsDataURL(file)
  })
}

function renderPhotoTile(photo, index) {
  const tile = document.createElement('div')
  tile.className = 'photo-tile'
  tile.innerHTML = `<img src="${photo.originalDataURL}" style="width: 100%; height: 100%; object-fit: cover;">`

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
  const zip = new JSZip()
  const assignedPhotos = photos.filter(p => p.assignedYear)

  for (const photo of assignedPhotos) {
    const arrayBuffer = await photo.file.arrayBuffer()
    const dataURL = await fileToDataURL(photo.file)
    const binaryStr = atob(dataURL.split(',')[1])
    const binary = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      binary[i] = binaryStr.charCodeAt(i)
    }

    let exifObj = {}
    try {
      exifObj = piexif.load(binaryStr)
    } catch (e) {
      exifObj = { '0th': {}, Exif: {}, GPS: {}, '1st': {}, thumbnail: null }
    }

    const formattedDate = `${photo.assignedYear}:01:01 00:00:00`
    exifObj['0th'][piexif.ImageIFD.DateTime] = formattedDate
    exifObj.Exif[piexif.ExifIFD.DateTimeOriginal] = formattedDate
    exifObj.Exif[piexif.ExifIFD.DateTimeDigitized] = formattedDate
    const exifBytes = piexif.dump(exifObj)

    const updatedDataURL = piexif.insert(exifBytes, dataURL)
    const updatedBlob = dataURLtoBlob(updatedDataURL)

    zip.file(photo.name, updatedBlob)
  }

  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, 'corrected_photos.zip')
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
