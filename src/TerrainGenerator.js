import convolution from '../libs/webglConvolution.js'
import { perlin2, seed as noiseSeed } from '../libs/noiseGen.js'
import { loadImageData, drawStepToCanvas } from './utils.js'

const DEFAULT_OPTIONS = {
  debug: false,
  width: 1024,
  height: 612,
  terrainTypeImg: '/img/type-1.png', // URL to an img of terrain type
  noiseResolution: 35,
  noiseResolutionBlack: 18,
  noiseThreshold: 20.0
}

// Generate random terrain shape corresponding to a terrain type
export default class TerrainGenerator {

  constructor (opts, onReady) {
    // Check options values
    this.options = Object.assign({}, DEFAULT_OPTIONS, opts)
    if (this.options.width % 2 != 0 || this.options.height % 2) {
      throw new Error("Terrain width and height should be even")
    }
    
    // We will work on images 4 times smaller than the final resolution
    // then magnify it at the last step
    this.w = this.options.width / 2
    this.h = this.options.height / 2
    this.terr = new ImageData(this.w, this.h)
    // Load image and execute callback when ready
    this.ready = false
    loadImageData(this.options.terrainTypeImg, {
      width: this.w,
      height: this.h
    }).then(terrainTypeImg => {
      this.terrainTypeImg = terrainTypeImg
      this.terrainTypePoints = this.loadTerrainTypePoints()
      this.ready = true
      onReady()
    })
  }

  // Compute and return the following:
  // fgPoints : An array of points (x,y) representing the core of the terrain
  // bgPoints: An array of points (x,y) at the left, right, and top border representing the background
  //           we don't include the bottom border because we want holes at the bottom to be filled by terrain
  loadTerrainTypePoints (threshold = 100) {
    let points = { fg: [], bg: [] }
    const td = this.terrainTypeImg.data
    for (let x = 0; x < this.w; x++) {
      for (let y = 0; y < this.h; y++) {
        if (td[(x + y * this.w) * 4] < threshold && (
            td[(x - 1 + y * this.w) * 4] > threshold ||
            td[(x + 1 + y * this.w) * 4] > threshold ||
            td[(x + (y + 1) * this.w) * 4] > threshold ||
            td[(x + (y - 1) * this.w) * 4] > threshold)) {
          points.fg.push([x, y])
        } else if (td[(x + y * this.w) * 4] < threshold && td[2 + (x + y * this.w) * 4] < threshold && (
            x === 0 ||
            y === 0 ||
            x === this.w - 1)) {
          points.bg.push([x, y])
        }
      }
    }
    return points
  }

  // Apply Perlin noise to a terrain image
  // The noise resolution will be different for blue zones vs. the rest
  perlinNoise (seed) {
    const perlin = perlin2 // Something with webpack makes it faster than using the reference directly !!!
    const d = this.terr.data
    noiseSeed(seed)
    for (let x = 0; x < this.w; x++) {
      for (let y = 0; y < this.h; y++) {
        let pix = (x + y * this.w) * 4

        let value = Math.abs(perlin(x / this.options.noiseResolution, y / this.options.noiseResolution))
        value = Math.max(0, (25 - value * 256) * 8)

        // A second value with different noise is calculated for black terrain pixels
        if (d[pix] === 0 && d[2 + pix] === 0) {
          let value2 = Math.abs(perlin((this.w - x - 1) / this.options.noiseResolutionBlack, y / this.options.noiseResolutionBlack))
          value2 = Math.max(0, (25 - value2 * 256) * 8)
          value = (value + value2) / 2.0
        }

        // Do not touch red pixels
        if (d[pix] < 200) {
          d[pix] = d[1 + pix] = d[2 + pix] = 0
          if (value > this.options.noiseThreshold) {
            d[pix] = d[1 + pix] = 255
          }
        }
      }
    }
  }

  removePerlin () {
    const d = this.terr.data
    for (let x = 0; x < this.w; x++) {
      for (let y = 0; y < this.h; y++) {
        let pix = (x + y * this.w) * 4
        if (d[pix] === 255 && d[pix + 1] === 255) {
          d[pix] = (d[pix + 2] === 255 ? 255 : 0)
          d[pix + 1] = 0
        }
      }
    }
  }
  
  paintBackground () {
    // Floodfill from background points at the border
    this.floodFill(this.terrainTypePoints.bg.slice(), {
      channel: 1
    })
  }

  removeHoles () {
    // Replace remaining black area with terrain(ie. red) and background back to black
    const d = this.terr.data
    for (let x = 0; x < this.w; x++) {
      for (let y = 0; y < this.h; y++) {
        const pix = (x + y * this.w) * 4
        if (d[pix] === 255 && d[1 + pix] === 255) {
          d[pix] = d[1 + pix] = 0
        } else {
          d[pix] = 255
        }
      }
    }
  }

  // Fast scanline floodfill algo adapted from http://lodev.org/cgtutor/floodfill.html#Recursive_Scanline_Floodfill_Algorithm
  // stack is an array of points [x,y] to floodfill
  // channel is color of floodfill 0 => R, 1 => Y
  floodFill (stack, {channel = 0, threshold = 255}) {
    let pt
    let x
    let y
    let x1
    let spanAbove
    let spanBelow
    const d = this.terr.data
    const w = this.w
    const h = this.h

    while (stack.length > 0) {
      pt = stack.pop()
      x = pt[0]
      y = pt[1]
      x1 = x
      while (x1 >= 0 && d[(x1 + y * w) * 4] < threshold) { x1-- }
      x1++
      spanAbove = 0
      spanBelow = 0
      while (x1 < w && d[(x1 + y * w) * 4] < threshold) {
        d[(x1 + y * w) * 4] = 255
        d[channel + (x1 + y * w) * 4] = 255
        if (!spanAbove && y > 0 && d[(x1 + (y - 1) * w) * 4] < threshold) {
          stack.push([
            x1, y - 1
          ])
          spanAbove = 1
        } else if (spanAbove && y > 0 && d[(x1 + (y - 1) * w) * 4] >= threshold) {
          spanAbove = 0
        }
        if (!spanBelow && y < h - 1 && d[(x1 + (y + 1) * w) * 4] < threshold) {
          stack.push([
            x1, y + 1
          ])
          spanBelow = 1
        } else if (spanBelow && y < h - 1 && d[(x1 + (y + 1) * w) * 4] >= threshold) {
          spanBelow = 0
        }
        x1++
      }
    }
  }
  
  magnify () {
    const tempCanvas = document.createElement("canvas")
    drawStepToCanvas(this.terr, tempCanvas)
    return hqx(tempCanvas, 2)
  }

  // Generate a terrain and return a html Canvas object representing it(red on black image)
  generate (seed) {
    if (!this.ready) throw new Error('generator not yet ready')
    const startTime = new Date()

    // Start with a copy of the terrain type image
    this.terr.data.set(this.terrainTypeImg.data)
    if (this.options.debug) drawStepToCanvas(this.terr, "canvas-terrain")

    // Extend terrain accross area defined by random Perlin noise
    this.perlinNoise(seed)
    if (this.options.debug) drawStepToCanvas(this.terr, "canvas-perlin")
      
    this.floodFill(this.terrainTypePoints.fg.slice(), {})
    if (this.options.debug) drawStepToCanvas(this.terr, "canvas-fperlin")
    
    this.removePerlin()
    if (this.options.debug) drawStepToCanvas(this.terr, "canvas-rperlin")

    // Cleanup terrain shape through convolutions
    convolution(['dilation', 'dilation', 'dilation', 'dilation', 'dilation'], this.terr, this.terr)
    if (this.options.debug) drawStepToCanvas(this.terr, "canvas-dilation")
      
    this.paintBackground()
    if (this.options.debug) drawStepToCanvas(this.terr, "canvas-paintbg")
    this.removeHoles()
      
    convolution(['erosion', 'erosion', 'erosion', 'erosion'], this.terr, this.terr)
    if (this.options.debug) drawStepToCanvas(this.terr, "canvas-erosion")

    // Magnify result to final size using hq2x algorithm
    const finalCanvas = this.magnify()
    if ( this.options.debug ) drawStepToCanvas(finalCanvas, "canvas-antialias", 0.5)
      
    // Done!
    console.log('Generated terrain seed(' + seed + ') duration(' + (new Date() - startTime) + 'ms)')

    return finalCanvas
  }
}
