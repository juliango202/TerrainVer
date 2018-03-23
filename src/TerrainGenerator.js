import convolution from '../libs/webglConvolution.js'
import hqx from '../libs/hqx.js'
import { perlin2, seed as noiseSeed } from '../libs/noiseGen.js'
import { loadImage, getHtmlImageData, drawStepToCanvas, timer } from './utils.js'

const DEFAULT_OPTIONS = {
  debug: false,
  blackToAlpha: true,
  width: 1024,
  height: 612,
  noiseResolution: 35,
  noiseResolutionBlack: 18,
  noiseThreshold: 20.0,
  terrainTypeImg: null
}

// Generate random terrain shape corresponding to a terrain type
export default class TerrainGenerator {

  // Factory method to create a TerrainGenerator from an img url instead of an img object
  static async fromImgUrl (opts) {
    const imgOpts = Object.assign({}, opts, { terrainTypeImg: await loadImage(opts.terrainTypeImg) })
    return new TerrainGenerator(imgOpts)
  }

  constructor (opts) {
    // Check options values
    this.options = Object.assign({}, DEFAULT_OPTIONS, opts)
    if (this.options.width % 2 !== 0 || this.options.height % 2) {
      throw new Error('Terrain width and height should be even')
    }
    if (!this.options.terrainTypeImg) {
      throw new Error('Required terrainTypeImg option must be an HTMLImageElement(or a CanvasImageSource)')
    }

    // We will work on images 4 times smaller than the final resolution
    // then magnify it at the last step
    this.w = this.options.width / 2
    this.h = this.options.height / 2
    this.terr = new ImageData(this.w, this.h)
    this.terrainType = getHtmlImageData(this.options.terrainTypeImg, { width: this.w, height: this.h })
    this.terrainTypePoints = this.loadTerrainTypePoints()
  }

  // Compute and return the following:
  // fgPoints : An array of points (x,y) at the contour of the core of the terrain
  // bgPoints: An array of points (x,y) at the border representing the background
  loadTerrainTypePoints (threshold = 100) {
    let points = { fg: [], bg: [] }
    const td = this.terrainType.data
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
            x === this.w - 1 ||
            y === this.h - 1)) {
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
    const tempCanvas = document.createElement('canvas')
    drawStepToCanvas(this.terr, tempCanvas)
    return hqx(tempCanvas, this.options.blackToAlpha)
  }

  // Generate a terrain and return a html Canvas object representing it(red on black image)
  generate (seed) {
    if (seed < 0 || seed >= 1) {
      throw new Error('Invalid seed: ' + seed + ', must be between [0,1).')
    }
    const debug = this.options.debug
    if (debug) timer.start('generate-terrain')

    // Start with a copy of the terrain type image
    if (debug) timer.start('terrain-type')
    this.terr.data.set(this.terrainType.data)
    if (debug) timer.stop('terrain-type')
    if (debug) drawStepToCanvas(this.terr, 'canvas-terrain')

    // Extend terrain accross area defined by random Perlin noise
    if (debug) timer.start('perlin-noise')
    this.perlinNoise(seed)
    if (debug) timer.stop('perlin-noise')
    if (debug) drawStepToCanvas(this.terr, 'canvas-perlin')

    if (debug) timer.start('floodfill-perlin')
    this.floodFill(this.terrainTypePoints.fg.slice(), {})
    if (debug) timer.stop('floodfill-perlin')
    if (debug) drawStepToCanvas(this.terr, 'canvas-fperlin')

    if (debug) timer.start('remove-perlin')
    this.removePerlin()
    if (debug) timer.stop('remove-perlin')
    if (debug) drawStepToCanvas(this.terr, 'canvas-rperlin')

    // Cleanup terrain shape through convolutions
    if (debug) timer.start('dilation')
    convolution(['dilation', 'dilation', 'dilation', 'dilation', 'dilation'], this.terr, this.terr)
    if (debug) timer.stop('dilation')
    if (debug) drawStepToCanvas(this.terr, 'canvas-dilation')

    if (debug) timer.start('nohole')
    this.paintBackground()
    if (debug) drawStepToCanvas(this.terr, 'canvas-paintbg')
    this.removeHoles()
    if (debug) timer.stop('nohole')

    if (debug) timer.start('erosion')
    convolution(['erosion', 'erosion', 'erosion', 'erosion'], this.terr, this.terr)
    if (debug) timer.stop('erosion')
    if (debug) drawStepToCanvas(this.terr, 'canvas-erosion')

    // Magnify result to final size using hq2x algorithm
    if (debug) timer.start('magnify')
    const finalCanvas = this.magnify()
    if (debug) timer.stop('magnify')
    if (debug) drawStepToCanvas(finalCanvas, 'canvas-magnify', 0.5)

    // Done!
    if (debug) timer.stop('generate-terrain')
    return finalCanvas
  }
}
