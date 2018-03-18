import TerrainGenerator from './src/TerrainGenerator.js'
import TerrainRenderer from './src/TerrainRenderer.js'
import { timer } from './src/utils.js'


// This method just waits a bit to let the UI refresh
// Ideally terrain stuff should be in a web worker instead but workers don't support ES6 modules yet
function waitForUi() {
  return new Promise(r => setTimeout(r, 20));
}


let options = {
  seed: Math.random(),
  noise: 35,
  type: 'type-1',
  avatars: 10
}

// Instantiate a new TerrainGenerator
let terrainGenerator = null 
async function newTerrainGenerator() {
  disableForm ()
  await waitForUi()
  terrainGenerator = await TerrainGenerator.fromImgUrl({
    debug: true, 
    width: 1536, 
    height: 960,
    terrainTypeImg: '/img/' + options.type + '.png',
    noiseResolution: options.noise
  })
  generateTerrain ()
}


// Generate a new terrainShape
let terrainShape = null
async function generateTerrain () {
  disableForm ()
  await waitForUi()
  terrainShape = terrainGenerator.generate(options.seed)
  document.getElementById('bgcanvas').parentElement.style.width = terrainShape.width + "px"
  document.getElementById('bgcanvas').parentElement.style.height = terrainShape.height + "px"
  renderTerrain ()  
}


// Render the current terrainShape
async function renderTerrain () {
  if( !terrainShape ) return;
  disableForm ()
  await waitForUi()
  const graphicsRenderer = await TerrainRenderer.fromImgUrl(terrainShape, {
    debug: true, 
    groundImg: '/img/ground.png', 
    backgroundImg: '/img/background.png',
    avatarsImg: '/img/avatars.png',
    nbAvatars: options.avatars
  })
  graphicsRenderer.drawTerrain(
    options.seed,
    document.getElementById('bgcanvas'), 
    document.getElementById('bgwater'),
    document.getElementById('fgcanvas'), 
    document.getElementById('fgwater')
  )
  
  if (history.pushState) {
    const optionsStr = JSON.stringify(options)
    console.log('Terrain config is ' + optionsStr)
    const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?terrain=' + btoa(optionsStr);
    window.history.pushState({path: newurl},'',newurl)
  }
  
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
      options.type = this.value
      newTerrainGenerator()
    };
  } 

  document.getElementById('noiseres').onchange = function() {
    options.noise = parseInt(this.value)
    newTerrainGenerator()
  }

  document.getElementById('nbavatars').onchange = function() {
    options.avatars = parseInt(this.value)
    renderTerrain ()
  }

  document.getElementById('gen').onclick = function() {
    options.seed = Math.random()
    generateTerrain();
    return false;
  }
  
  // Make the generate terrain menu sticky after scroll
  const genform = document.getElementById("genform")
  const initOffset = genform.offsetTop
  window.onscroll = () => {
    genform.classList.toggle("sticky", window.pageYOffset >= initOffset)
  }
  
  // Load options from querystring config if any
  if (window.location.search.substring(0, 9) === '?terrain=') {
    options = JSON.parse(atob(window.location.search.substring(9)))
  }
  newTerrainGenerator()
}

pageInit ()