
// Generate pseudo random integer between min and max(inclusive)
// Adapted from: https://gist.github.com/blixt/f17b47c62508be59987b
export class RandomInt {
  constructor (seed) {
    this.seed = seed % 2147483647
    if (this.seed <= 0) this.seed += 2147483646
  }
  
  next (min, max) {
    this.seed = this.seed * 16807 % 2147483647;
    const randomFloat = (this.seed - 1) / 2147483646
    return Math.floor(randomFloat * (max - min + 1)) + min
  }
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

// Load an html img into an ImageData array(optionnaly scale it to given size)
const imageDataCanvas = document.createElement('canvas')
const context = imageDataCanvas.getContext('2d')
export function getHtmlImageData (img, scaleToSize) {
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

// Load an image from its URL
const imageCache = new Map()
export function loadImage (src) {
  const imageId = `${src}`
  return imageCache.has(imageId)
    ? Promise.resolve(imageCache.get(imageId))
    : new Promise((resolve) => {
      const img = new Image()
      img.src = src
      img.onload = () => {
        imageCache.set(imageId, img)
        resolve(img)
      }
    })
}

// A simple class to time our methods
class Timer {

  constructor () {
    this.entries = {}
  }

  // Start an iteration of the timer with the given name
  start (name) {
    if (!(name in this.entries)) {
      this.entries[name] = { time: null, avg: 0, nb: 0 }
    }
    this.entries[name].time = new Date();
  }
  
  // Stop an iteration of the timer with the given name
  stop (name) {
    if (!(name in this.entries)) {
      throw new Error("The timer '" + name + "' hasn't been started")
    }
    this.entries[name].avg += (new Date()).getTime() - this.entries[name].time.getTime();
    this.entries[name].time = null;
    this.entries[name].nb++;
  }
  
  toString() {
    var str = "--Timers--\n";
    for (let i in this.entries) {
      str += i + ": avg=" + this.entries[i].avg / this.entries[i].nb + " (" + this.entries[i].nb + " occurences)\n";
    }
    return str;
  }
}  

export const timer = new Timer();

