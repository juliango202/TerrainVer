# TerrainVer
Generate Worms-style cartoon terrain in JavaScript. You can see a full demo on [this page](https://juliango202.com/terrainver/).

![Snap 1](https://juliango202.github.io/img/terrainver/terrain1.png)

Example to create a terrain mask(for browsers with [support for es6 modules](https://caniuse.com/es6-module)):

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

![Snap 2](https://juliango202.github.io/img/terrainver/shape.png)