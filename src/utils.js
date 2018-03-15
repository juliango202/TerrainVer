
// Generate random integer between min and max(inclusive)
export function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Convert hex color notation to RGB components
// from https://stackoverflow.com/a/5624139/257272
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
  } : null
}

// Use canvas API to resize some ImageData
function scaleImageData(imgData, destWidth, destHeight, isSmoothed) {
  const srcCanvas = document.createElement("canvas")
  srcCanvas.width = imgData.width
  srcCanvas.height = imgData.height
  srcCanvas.getContext('2d').putImageData(imgData, 0, 0)
  
  const dstCanvas = document.createElement("canvas")
  dstCanvas.width = destWidth
  dstCanvas.height = destHeight
  const dstCtx = dstCanvas.getContext('2d')
  
  dstCtx.imageSmoothingEnabled = isSmoothed
  dstCtx.mozImageSmoothingEnabled = isSmoothed
  dstCtx.webkitImageSmoothingEnabled = isSmoothed
  dstCtx.msImageSmoothingEnabled = isSmoothed
  
  dstCtx.drawImage(srcCanvas, 0, 0, imgData.width, imgData.height, 0, 0, destWidth, destHeight)
  return dstCtx.getImageData(0, 0, destWidth, destHeight);
}

// Draw src image to dest canvas, optionaly resizing by scaleFactor
export function drawStepToCanvas(src, dest, scaleFactor) { 
  scaleFactor = scaleFactor || 1
  if (typeof dest === "string") {
    dest = document.getElementById(dest)
  }
  dest.width  = Math.floor(src.width * scaleFactor)
  dest.height = Math.floor(src.height * scaleFactor)
  if (src instanceof HTMLCanvasElement) {
    dest.getContext('2d').drawImage(src, 0, 0, dest.width, dest.height);
  } else if (src instanceof ImageData) {
    if (scaleFactor != 1 ) {
      src = scaleImageData(src, dest.width, dest.height, false)
    }
    dest.getContext('2d').putImageData(src, 0, 0);
  } else {
    throw new Error("src should be a HTMLCanvasElement or ImageData object")
  }
}

// Load html img data into array(optionnaly scale it to given size)
const imageDataCanvas = document.createElement('canvas')
const context = imageDataCanvas.getContext('2d')
function getHtmlImageData (img, scaleToSize) {
  if (!scaleToSize) {
    scaleToSize = {
      width: img.width,
      height: img.height
    }
  }
  imageDataCanvas.width = scaleToSize.width
  imageDataCanvas.height = scaleToSize.height
  context.imageSmoothingEnabled = false
  context.drawImage(img, 0, 0, img.width, img.height, 0, 0, scaleToSize.width, scaleToSize.height)
  return context.getImageData(0, 0, scaleToSize.width, scaleToSize.height)
}

// Load an image from its URL and return an ImageData array 
const imageCache = new Map()
export function loadImageData (src, scaleToSize) {
  const imageId = `${src}`
  return imageCache.has(imageId)
    ? Promise.resolve(imageCache.get(imageId))
    : new Promise((resolve) => {
      const img = new Image()
      img.src = src
      img.onload = () => {
        const imageData = getHtmlImageData(img, scaleToSize)
        imageCache.set(imageId, imageData)
        resolve(imageData)
      }
    })
}



