# TerrainVer
Generate Worms-style cartoon terrain in JavaScript. You can see a full demo on [this page](https://juliango202.com/terrainver/).
![Snap 1](https://juliango202.github.io/img/terrainver/terrain3.png)

## Generate a random terrain mask

For browsers with [support for es6 modules](https://caniuse.com/es6-module):
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
}).then((terrainGenerator) => {
  const terrainShape = terrainGenerator.generate(Math.random())
  document.body.appendChild(terrainShape)
})
</script>
```

To support other browsers, you can put the javascript in a `main.js` file and create a bundle with [Rollup](https://rollupjs.org) that you import:
```
rollup main.js --o js-bundle.js --f iife
<script type="javascript" src="js-bundle.js"></script>
```

If you want have already loaded some images that you want to use, you can call the constructor directly:
```javascript
const terrainGenerator = new TerrainGenerator({ width: 874, height: 546, ... })
const terrainShape = terrainGenerator.generate(Math.random())
```

The example above should produce an image like this:
![Snap 2](https://juliango202.github.io/img/terrainver/shape2.png)

## Simple rendering of a terrain mask




