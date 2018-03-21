# TerrainVer
Generate Worms-style cartoon terrain in JavaScript. You can see a full demo on [this page](https://juliango202.com/terrainver/).

![Snap 1](https://juliango202.github.io/img/terrainver/terrain1.png)

Example to create a terrain mask:

```html
<script type="module">
import TerrainGenerator from './src/TerrainGenerator.js'

TerrainGenerator.fromImgUrl({
  width: 1024,
  height: 780,
  terrainTypeImg: './img/type-1.png',
  noiseResolution: 25
}).then((terrainGenerator) => {
  const terrainShape = terrainGenerator.generate(Math.random())
  document.body.appendChild(terrainShape)
})
</script>
```