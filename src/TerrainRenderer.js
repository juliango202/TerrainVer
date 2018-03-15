import convolution from '../libs/webglConvolution.js'
import { getRandomInt, loadImageData, hexToRgb }  from './utils.js'

const DEFAULT_OPTIONS = {
  groundImg: '/img/ground.png', 
  backgroundImg: '/img/background.png',
  borderWidth: 8,
  borderColor: '#89c53f',
  seed: Math.random()
}

// Generate terrain graphics from a terrain shape
export default class TerrainRenderer {

  constructor (shapeCanvas, opts, onReady) {
    // Check option values
    this.options = Object.assign({}, DEFAULT_OPTIONS, opts)
    this.borderColor = hexToRgb(this.options.borderColor)
    if( !this.borderColor ) {
      throw new Error("Invalid borderColor value. Should be hex color like #aa3300")
    }
    
    this.terrainShape = shapeCanvas.getContext('2d').getImageData(0, 0, shapeCanvas.width, shapeCanvas.height)
    this.terr = new ImageData(shapeCanvas.width, shapeCanvas.height)

    // this.posGenerator = new PositionGenerator(this.terrainShape, {
    //   seed: this.seed
    // })

    // Load image and execute callback when ready
    this.ready = false
    Promise.all([
      loadImageData(this.options.groundImg),
      loadImageData(this.options.backgroundImg, { 
        width: this.terr.width,
        height: this.terr.height
      })
    ]).then(([groundImg, backgroundImg]) => {
      this.groundImg = groundImg
      this.backgroundImg = backgroundImg
      this.ready = true
      onReady()
    })
  }

  // Draw the background on a specific canvas
  drawBackground (bgCanvas, bgWaterCanvas) { 
    bgCanvas.width  = this.terr.width
    bgCanvas.height = this.terr.height
    bgCanvas.getContext('2d').putImageData(this.backgroundImg, 0, 0)

    //this.bgWave.drawSineWave(this.options.wateranim);
  }
  
  //  Draw the terrain on a specific canvas
  drawTerrain (fgCanvas, fgWaterCanvas) {
    this.texturize()

    // Draw result to fgCanvas
    fgCanvas.width = this.terr.width;
    fgCanvas.height = this.terr.height;
    fgCanvas.getContext('2d').putImageData(this.terr, 0, 0)
  }

  texturize () {
    const terrainShape = this.terrainShape.data
    const terrain = this.terr.data
    const w = this.terr.width
    const h = this.terr.height

    const ground = this.groundImg.data
    const groundW = this.groundImg.width
    const groundH = this.groundImg.height
    const groundX = getRandomInt(0, groundW) // start at random X
    const groundY = getRandomInt(0, groundH) // start at random Y
    
    const borderWidth = this.options.borderWidth
    const borderColor = this.borderColor

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
          terrain[pix] = borderColor.r
          terrain[1 + pix] = borderColor.g
          terrain[2 + pix] = borderColor.b
          continue;
        }
        
        // Pixel is inside terrain        
        const groundPix = ((groundX + x) % groundW + ((groundY + y) % groundH) * groundW) * 4
        terrain[pix] = ground[groundPix]
        terrain[1 + pix] = ground[1 + groundPix]
        terrain[2 + pix] = ground[2 + groundPix]
        
        if (terrainShape[(x + (y - borderWidth - 1) * w) * 4] === 0) {
            // Pixel is just below the terrain border
            // Use alpha from the shape border top pixel for blending this pixel too 
            // This will antialiase the bottom edge of the terrain border
            const alpha = terrainShape[(x + (y - borderWidth) * w) * 4] / 255.0
            terrain[pix] = terrain[pix] * alpha + borderColor.r * (1.0 - alpha);
            terrain[1+pix] = terrain[1+pix] * alpha + borderColor.g * (1.0 - alpha);
            terrain[2+pix] = terrain[2+pix] * alpha + borderColor.b * (1.0 - alpha);
        }
      }
    }
  }  
}
