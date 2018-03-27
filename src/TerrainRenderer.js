import convolution from '../libs/webglConvolution.js'
import PositionGenerator from './PositionGenerator.js'
import { Random, loadImage, getHtmlImageData, drawStepToCanvas, hexToRgb, timer } from './utils.js'

const DEFAULT_OPTIONS = {
  debug: false,
  groundImg: null,
  backgroundImg: null,
  charaImg: null,
  charaWidth: null,
  charaHeight: null,
  borderWidth: 8,
  borderColor: '#89c53f',
  nbCharas: 10,
  waveDisplacement: 6,
  waveFps: 20,
  waveColor: '#2f5a7e',
  waveDuration: 60000  // default to one minute, set to 0 for infinite
}

// Generate terrain graphics from a terrain shape
export default class TerrainRenderer {

  // Factory method to create a TerrainRenderer from img urls instead of img objects
  static async fromImgUrl (shapeCanvas, opts) {
    const imgOpts = Object.assign({}, opts, {
      groundImg: await loadImage(opts.groundImg),
      backgroundImg: await loadImage(opts.backgroundImg),
      charaImg: await loadImage(opts.charaImg)
    })
    return new TerrainRenderer(shapeCanvas, imgOpts)
  }

  constructor (shapeCanvas, opts) {
    // Check option values
    this.options = Object.assign({}, DEFAULT_OPTIONS, opts)
    this.borderColor = hexToRgb(this.options.borderColor)
    if (!this.borderColor) {
      throw new Error('Invalid borderColor value. Should be hex color like #aa3300')
    }
    if (!this.options.groundImg || !this.options.backgroundImg || !this.options.charaImg) {
      throw new Error('Required groundImg, backgroundImg, and charaImg options must be HTMLImageElement(or CanvasImageSource)')
    }

    // Initalize properties
    this.terrainShape = shapeCanvas.getContext('2d').getImageData(0, 0, shapeCanvas.width, shapeCanvas.height)
    this.terr = new ImageData(shapeCanvas.width, shapeCanvas.height)
    this.posGenerator = new PositionGenerator(this.terrainShape, {debug: this.options.debug})

    // Read the background and ground images into ImageData objects
    this.background = getHtmlImageData(this.options.backgroundImg, { width: this.terr.width, height: this.terr.height })
    this.ground = getHtmlImageData(this.options.groundImg)
  }

  // Draw the terrain on specific canvas
  // NOTE: in a real game, background and foreground would be drawn separately at different times
  drawTerrain (seed, bgCanvas, bgWaterCanvas, fgCanvas, fgWaterCanvas) {
    if (seed < 0 || seed >= 1) {
      throw new Error('Invalid seed: ' + seed + ', must be between [0,1).')
    }
    const debug = this.options.debug
    if (debug) timer.start('draw-terrain')
    const randomGen = new Random(seed)

    // Draw background
    bgCanvas.width = this.terr.width
    bgCanvas.height = this.terr.height
    bgCanvas.getContext('2d').putImageData(this.background, 0, 0)

    this.drawWave(bgWaterCanvas, this.terr.width, 160, 15)

    // Draw terrain
    this.groundOffsetX = randomGen.nextIntBetween(0, this.ground.width) // start at random X
    this.groundOffsetY = randomGen.nextIntBetween(0, this.ground.height) // start at random Y
    if (debug) timer.start('texturize')
    this.texturize()
    if (debug) timer.stop('texturize')

    // Draw result to fgCanvas
    const fgCtx = fgCanvas.getContext('2d')
    fgCanvas.width = this.terr.width
    fgCanvas.height = this.terr.height
    fgCtx.putImageData(this.terr, 0, 0)

    if (debug) {
      drawStepToCanvas(fgCanvas, 'canvas-render', 0.5)
      drawStepToCanvas(fgCanvas, 'canvas-surface', 0.5)
      this.posGenerator.drawSurfacePoints(document.getElementById('canvas-surface'), 0.5)
    }

    // Draw characters
    if (debug) timer.start('characters')
    this.drawCharacters(seed, randomGen, fgCtx)
    if (debug) timer.stop('characters')

    if (debug) drawStepToCanvas(fgCanvas, 'canvas-chara', 0.5)
    if (debug) timer.start('wave')
    this.drawWave(fgWaterCanvas, this.terr.width, 160, 21)
    if (debug) timer.stop('wave')

    if (debug) timer.stop('draw-terrain')
  }

  drawCharacters (seed, randomGen, canvasCtx) {
    // Here we expect charaImg to be a grid of characters that we choose from randomly
    const charaImg = this.options.charaImg
    const charaW = this.options.charaWidth || charaImg.width
    const charaH = this.options.charaHeight || charaImg.height
    const charaCol = charaImg.width / charaW
    const charaRow = charaImg.height / charaH
    for (let n = 0; n < this.options.nbCharas; n++) {
      const pt = this.posGenerator.getSurfacePoint(seed)
      const choiceCharaRow = randomGen.nextIntBetween(0, charaRow - 1)
      const choiceCharaCol = randomGen.nextIntBetween(0, charaCol - 1)
      canvasCtx.drawImage(charaImg, choiceCharaCol * charaW, choiceCharaRow * charaH, charaW, charaH, pt[0] - charaW / 2, pt[1] - charaH + 10, charaW, charaH)
    }
  }

  // Wave code adapted from https://codepen.io/jeffibacache/pen/tobCk
  drawWave (waveCanvas, width, height, waveOffset) {
    waveCanvas.width = width
    waveCanvas.height = height
    if (waveCanvas.waveAnim) {
      cancelAnimationFrame(waveCanvas.waveAnim)
      waveCanvas.waveAnim = undefined
    }
    const context = waveCanvas.getContext('2d')
    context.strokeStyle = this.options.waveColor

    const fpsInterval = 1000 / this.options.waveFps
    const waveDuration = this.options.waveDuration
    const waveDisplacement = this.options.waveDisplacement

    let offset = waveOffset
    let drawFrame = (elapsed) => {
      context.clearRect(0, 0, width, height)
      context.beginPath()
      context.moveTo(0, waveOffset + Math.sin(offset) * Math.cos(1) + (height >> 1))

      for (let i = 0; i < Math.PI * 2; i += 0.4) {
        context.lineWidth = 140
        context.lineTo((i / Math.PI * 2) * width, waveOffset + Math.sin(i + offset) * waveDisplacement + (height >> 1))
      }
      context.stroke()
      offset += (elapsed / 700.0)
    }

    // Drawloop is always called when rendering a frame but we draw
    // the waves with drawFrame() only at a specific framerate.
    let start = Date.now()
    let then = start
    let now = null
    let drawLoop = () => {
      if (waveDuration && now - start > waveDuration) return
      now = Date.now()
      waveCanvas.waveAnim = requestAnimationFrame(drawLoop)
      const elapsed = now - then
      if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval)
        drawFrame(elapsed)
      }
    }
    drawLoop()
    drawFrame(1)
  }

  texturize () {
    const terrainShape = this.terrainShape.data
    const terrain = this.terr.data
    const w = this.terr.width
    const h = this.terr.height
    const ground = this.ground.data
    const groundW = this.ground.width
    const groundH = this.ground.height
    const borderWidth = this.options.borderWidth

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const pix = (x + y * w) * 4

        if (terrainShape[3 + pix] === 0) {
          // Pixel is not terrain
          terrain[pix] = 0
          terrain[1 + pix] = 0
          terrain[2 + pix] = 0
          terrain[3 + pix] = 0
          continue
        }

        // Pixel is terrain
        terrain[3 + pix] = terrainShape[3 + pix]   // Copy alpha

        let isBorder = false
        if (borderWidth >= 1) {
          for (let bw = 1; bw <= borderWidth; bw++) {
            if (terrainShape[(x + (y - bw) * w) * 4] === 0) {
              isBorder = true
              break
            }
          }
        }

        if (isBorder) {
          // Pixel is on terrain top border
          terrain[pix] = this.borderColor.r
          terrain[1 + pix] = this.borderColor.g
          terrain[2 + pix] = this.borderColor.b
          continue
        }

        // Pixel is inside terrain
        const groundPix = ((this.groundOffsetX + x) % groundW + ((this.groundOffsetY + y) % groundH) * groundW) * 4
        terrain[pix] = ground[groundPix]
        terrain[1 + pix] = ground[1 + groundPix]
        terrain[2 + pix] = ground[2 + groundPix]

        if (terrainShape[(x + (y - borderWidth - 1) * w) * 4] === 0) {
          // Pixel is just below the terrain border
          // Use alpha from the shape border top pixel for blending this pixel too
          // This will antialiase the bottom edge of the terrain border
          const alpha = terrainShape[3 + (x + (y - borderWidth) * w) * 4] / 255.0
          terrain[pix] = terrain[pix] * alpha + this.borderColor.r * (1.0 - alpha)
          terrain[1 + pix] = terrain[1 + pix] * alpha + this.borderColor.g * (1.0 - alpha)
          terrain[2 + pix] = terrain[2 + pix] * alpha + this.borderColor.b * (1.0 - alpha)
        }
      }
    }
  }
}

