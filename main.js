import TerrainGenerator from './src/TerrainGenerator.js'
import TerrainRenderer from './src/TerrainRenderer.js'
import { timer } from './src/utils.js'


// This method just waits a bit to let the UI refresh
// Ideally terrain stuff should be in a web worker instead but workers don't support ES6 modules yet
function waitForUi() {
  return new Promise(r => setTimeout(r, 20));
}


// Instantiate a new TerrainGenerator
let terrainGenerator = null 
let terrainGenOptions = {
  debug: true, 
  width: 1536, 
  height: 960,
  noiseResolution: 35,
  terrainTypeImg: '/img/type-1.png'
}
async function newTerrainGenerator(opts) {
  disableForm ()
  await waitForUi()
  Object.assign(terrainGenOptions, opts)
  terrainGenerator = await TerrainGenerator.fromImgUrl(terrainGenOptions)
  generateTerrain ()
}


// Generate a new terrainShape
let terrainShape = null
async function generateTerrain () {
  disableForm ()
  await waitForUi()
  terrainShape = terrainGenerator.generate(Math.random())
  document.getElementById('bgcanvas').parentElement.style.width = terrainShape.width + "px"
  document.getElementById('bgcanvas').parentElement.style.height = terrainShape.height + "px"
  renderTerrain ()  
}


// Render the current terrainShape
let terrainRenderOptions = {
  debug: true, 
  groundImg: '/img/ground.png', 
  backgroundImg: '/img/background.png',
  avatarsImg: '/img/avatars.png',
}
async function renderTerrain (opts) {
  if( !terrainShape ) return;
  disableForm ()
  await waitForUi()
  Object.assign(terrainRenderOptions, opts)
  const graphicsRenderer = await TerrainRenderer.fromImgUrl(terrainShape, terrainRenderOptions)
  graphicsRenderer.drawTerrain(
    document.getElementById('bgcanvas'), 
    document.getElementById('bgwater'),
    document.getElementById('fgcanvas'), 
    document.getElementById('fgwater')
  )
  document.getElementById('timing').innerHTML = timer.toString()
  enableForm ()
}

// Demo form management
function disableForm () {
  document.getElementById('gen').disabled = true
  document.getElementById('type1').disabled = true
  document.getElementById('type2').disabled = true
  document.getElementById('type3').disabled = true
  document.getElementById('noiseres').disabled = true
}

function enableForm () {
  document.getElementById('gen').disabled = false
  document.getElementById('type1').disabled = false
  document.getElementById('type2').disabled = false
  document.getElementById('type3').disabled = false
  document.getElementById('noiseres').disabled = false
}

function pageInit () {
  // document.getElementById('showsurface').onchange = function() {
  //   showsurface = this.checked;
  //   newTerrainGenerator();
  // }
  // 
  // document.getElementById('wateranim').onchange = function() {
  //   wateranim = this.checked;
  //   newTerrainGenerator();
  // }
  
  for(let i = 0; i < document.genform.selshape.length; i++) {
    document.genform.selshape[i].onclick = function() {
      newTerrainGenerator({ terrainTypeImg: this.value })
    };
  } 

  document.getElementById('noiseres').onchange = function() {
    newTerrainGenerator({ noiseResolution: parseInt(this.value) })
  }

  document.getElementById('nbavatars').onchange = function() {
    renderTerrain ({ nbAvatars: parseInt(this.value) })
  }

  document.getElementById('gen').onclick = function() {
    generateTerrain();
    return false;
  }
  
  // Make the generate terrain menu sticky after scroll
  const genform = document.getElementById("genform")
  const initOffset = genform.offsetTop
  window.onscroll = () => {
    genform.classList.toggle("sticky", window.pageYOffset >= initOffset)
  }
  
  newTerrainGenerator()
}

pageInit ()