# TerrainVer
Generate Worms-style cartoon terrain in JavaScript. You can see a full demo on [this page](https://juliango202.com/terrainver/).

![Snap 1](https://juliango202.github.io/img/terrainver/terrain3.png)

## Generate a random terrain mask
For browsers that [support es6 modules](https://caniuse.com/es6-module):
```html
<script type="module">
import TerrainGenerator from './src/TerrainGenerator.js'

TerrainGenerator.fromImgUrl({
  terrainTypeImg: './img/type-1.png', // Required, url of an image representing a terrain type
  width: 874, // Required, width of the image to generate
  height: 546, // Required, height of the image to generate
  noiseResolution: 35, // Optional, default 35, Perlin noise resolution in terrain-type image 'blue' area
  noiseResolutionBlack: 18, // Optional, default 18, Perlin noise resolution in terrain-type 'black' area
  noiseThreshold: 20.0, // Optional, default 20, value above which a pixel is set to noise
  blackToAlpha: true // Optional, default true, use red/alpha for terrain mask, if false red/black will be used
}).then((terrainGenerator) => {
  const terrainShape = terrainGenerator.generate(Math.random())
  document.body.appendChild(terrainShape)
})
</script>
```

To support other browsers, you can put this javascript in a `main.js` file and create a bundle with [Rollup](https://rollupjs.org) that you import:
```
rollup main.js --o js-bundle.js --f iife
<script type="javascript" src="js-bundle.js"></script>
```

The terrain type image is a low resolution image with red, blue, and black zones representing the general shape of a terrain.
See the explanation in [the demo page](https://juliango202.com/terrainver/) and `type-x.png` images in this repo for some examples.

If you have already loaded a terrain type image that you want to use, you can call the constructor directly:
```javascript
const terrainGenerator = new TerrainGenerator({ width: 874, height: 546, terrainTypeImg: myImgElt })
const terrainShape = terrainGenerator.generate(Math.random())
```

The example above should produce an image like this:
![Snap 2](https://juliango202.github.io/img/terrainver/shape.png)

## Simple rendering of a terrain mask
You can apply a simple rendering pass to the terrain shape mask:
```html
<div style="position: relative; width: 874px; height: 546px;">
  <canvas id="bgcanvas" style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; z-index: 10;"></canvas>
  <canvas id="bgwater" style="position: absolute; left: 0; bottom: 0; right: 0; z-index: 11;opacity: 0.24;"></canvas>
  <canvas id="fgcanvas" style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; z-index: 12;"></canvas>
  <canvas id="fgwater" style="position: absolute; left: 0; bottom: 0; right: 0; z-index: 13;opacity: 0.45;"></canvas>
</div>
```

```javascript
import TerrainRenderer from './src/TerrainRenderer.js'

TerrainRenderer.fromImgUrl(terrainShape, {
  groundImg: './img/ground.png', // Required, url of a texture image for the terrain ground
  backgroundImg: './img/background.png', // Required, url of a background image
  charaImg: './img/chara.png', // Required, url of an image representing a grid of 'characters' to display
  charaWidth: 44, // Width of one character, if missing charaImg is assumed to be only one character
  charaHeight: 41, // Height of one character, if missing charaImg is assumed to be only one character
  nbCharas: 7, // Optional, default 10, Number of characters to display in the rendering
  borderWidth: 8, // Optional, default 8, width of the terrain border
  borderColor: '#89c53f', // Optional, default #89c53f, color of the terrain border
  waveColor: '#2f5a7e', // Optional, default #2f5a7e, color of the water
  waveFps: 20, // Optional, default 20, frame per second for the water animation
  waveDuration: 60000 // Optional, default 60000, duration of the animation in milliseconds, use 0 for infinite
}).then((terrainRenderer) => {
  terrainRenderer.drawTerrain(
    Math.random(),
    document.getElementById('bgcanvas'),
    document.getElementById('bgwater'),
    document.getElementById('fgcanvas'),
    document.getElementById('fgwater')
  )
})
```

Like for the terrain mask, if you have already loaded the images to use you can call the TerrainRenderer constructor directly.

![Snap 3](https://juliango202.github.io/img/terrainver/terrain4.png)


