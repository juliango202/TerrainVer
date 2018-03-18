import convolution from '../libs/webglConvolution.js'
import PositionGenerator from './PositionGenerator.js'
import { RandomInt, loadImage, getHtmlImageData, hexToRgb, drawStepToCanvas }  from './utils.js'

const DEFAULT_OPTIONS = {
  debug: false,
  groundImg: null, 
  backgroundImg: null,
  avatarsImg: null,
  borderWidth: 8,
  borderColor: '#89c53f',
  nbAvatars: 10,
  waveDisplacement: 6,
  waveFps: 20,
  waveColor: "#2f5a7e",
  waveDuration: 0,
  seed: Math.random()
}

// Generate terrain graphics from a terrain shape
export default class TerrainRenderer {

  // Factory method to create a TerrainRenderer from img urls instead of img objects
  static async fromImgUrl (shapeCanvas, opts) {    
    const imgOpts = Object.assign({}, opts, { 
      groundImg: await loadImage(opts.groundImg),
      backgroundImg: await loadImage(opts.backgroundImg),
      avatarsImg: await loadImage(opts.avatarsImg) 
    })
    return new TerrainRenderer (shapeCanvas, imgOpts)
   }
   
  constructor (shapeCanvas, opts) {
    // Check option values
    this.options = Object.assign({}, DEFAULT_OPTIONS, opts)
    this.borderColor = hexToRgb(this.options.borderColor)
    if( !this.borderColor ) {
      throw new Error("Invalid borderColor value. Should be hex color like #aa3300")
    }
    if (this.options.seed < 0 || this.options.seed >= 1) {
      throw new Error('Invalid seed: ' + this.options.seed + ', must be between [0,1).')
    }
    if (!this.options.groundImg || !this.options.backgroundImg || !this.options.avatarsImg) {
      throw new Error("Required groundImg, backgroundImg, and avatarsImg options must be HTMLImageElement(or CanvasImageSource)")
    }
    
    // Initalize properties
    this.terrainShape = shapeCanvas.getContext('2d').getImageData(0, 0, shapeCanvas.width, shapeCanvas.height)
    this.terr = new ImageData(shapeCanvas.width, shapeCanvas.height)
    this.posGenerator = new PositionGenerator(this.terrainShape, { seed: this.options.seed })
    this.randomGen = new RandomInt(this.options.seed)
    
    // Read the background and ground images into ImageData objects
    this.background = getHtmlImageData(this.options.backgroundImg, { width: this.terr.width, height: this.terr.height })
    this.ground = getHtmlImageData(this.options.groundImg)
    this.groundOffsetX = this.randomGen.next(0, this.ground.width) // start at random X
    this.groundOffsetY = this.randomGen.next(0, this.ground.height) // start at random Y
  }
  
  // Draw the terrain on specific canvas
  // NOTE: in a real game, background and foreground would be drawn separately at different times
  drawTerrain (bgCanvas, bgWaterCanvas, fgCanvas, fgWaterCanvas) {
    // Draw background
    bgCanvas.width  = this.terr.width
    bgCanvas.height = this.terr.height
    bgCanvas.getContext('2d').putImageData(this.background, 0, 0)

    this.drawWave(bgWaterCanvas, this.terr.width, 160, 15)
    
    // Draw terrain
    this.texturize()
    
    // Draw result to fgCanvas
    const fgCtx = fgCanvas.getContext('2d')
    fgCanvas.width = this.terr.width;
    fgCanvas.height = this.terr.height;
    fgCtx.putImageData(this.terr, 0, 0)
    
    this.posGenerator.drawSurfacePoints(fgCanvas)
    this.drawAvatars(fgCtx)
    
    this.drawWave(fgWaterCanvas, this.terr.width, 160, 21)
    
    if (this.options.debug) drawStepToCanvas(fgCanvas, "canvas-antialias")
  }
  
  drawAvatars (fgCtx) {
    for(var n = 0; n < this.options.nbAvatars; n++) {
      var pt = this.posGenerator.getSurfacePoint();
      var AVATAR_WIDTH = 34;
      var AVATAR_HEIGHT = 32;
      var avatarchoice = this.randomGen.next(0,15)
      const translateX = avatarchoice * AVATAR_WIDTH
      
      fgCtx.drawImage(this.options.avatarsImg, avatarchoice * AVATAR_WIDTH, 0, AVATAR_WIDTH, AVATAR_HEIGHT, pt[0] - AVATAR_WIDTH/2, pt[1] - AVATAR_HEIGHT + 5, AVATAR_WIDTH, AVATAR_HEIGHT)
    }
  }
  
  // Wave code adapted from https://codepen.io/jeffibacache/pen/tobCk
  drawWave (waveCanvas, width, height, waveOffset) {
    waveCanvas.width = width
    waveCanvas.height = height
    if (waveCanvas.waveAnim) {
      cancelAnimationFrame(waveCanvas.waveAnim);
      waveCanvas.waveAnim = undefined;
    }
    const context = waveCanvas.getContext('2d');
    context.strokeStyle = this.options.waveColor;

    const fpsInterval = 1000 / this.options.waveFps
    const waveDuration = this.options.waveDuration
    const waveDisplacement = this.options.waveDisplacement
    
    let offset = waveOffset;
    let drawFrame = (elapsed) => {
      context.clearRect(0, 0, width, height);
      context.beginPath();
      context.moveTo(0, waveOffset + Math.sin(offset) * Math.cos(1) + (height >> 1));

      for(let i = 0; i < Math.PI * 2; i += 0.4)
      {
        context.lineWidth = 140;
        context.lineTo((i / Math.PI * 2) * width, waveOffset + Math.sin(i + offset) * waveDisplacement + (height >> 1));  
      }
      context.stroke();  
      offset += (elapsed/700.0);
    }   
        
    // Drawloop is always called when rendering a frame but we draw
    // the waves with drawFrame() only at a specific framerate.
    let start = Date.now(), then = start, now
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
    drawLoop();
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

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        const pix = (x + y * w) * 4
            
        if (terrainShape[pix] === 0) {
          // Pixel is not terrain
          terrain[pix] = 0
          terrain[1 + pix] = 0
          terrain[2 + pix] = 0
          terrain[3 + pix] = 0
          continue
        }
        
        // Pixel is terrain
        terrain[3 + pix] = terrainShape[pix];   // Copy alpha from antialised shape
        
        let isBorder = false
        if (borderWidth >= 1) {
          for (let bw = 1; bw <= borderWidth; bw++) {
            if (terrainShape[(x + (y - bw) * w) * 4] === 0) {
              isBorder = true
            }
          }
        }
        
        if (isBorder) {
          // Pixel is on terrain top border
          terrain[pix] = this.borderColor.r
          terrain[1 + pix] = this.borderColor.g
          terrain[2 + pix] = this.borderColor.b
          continue;
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
            const alpha = terrainShape[(x + (y - borderWidth) * w) * 4] / 255.0
            terrain[pix] = terrain[pix] * alpha + this.borderColor.r * (1.0 - alpha);
            terrain[1+pix] = terrain[1+pix] * alpha + this.borderColor.g * (1.0 - alpha);
            terrain[2+pix] = terrain[2+pix] * alpha + this.borderColor.b * (1.0 - alpha);
        }
      }
    }
  }
}

