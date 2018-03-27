import TerrainGenerator from './src/TerrainGenerator.js'
import TerrainRenderer from './src/TerrainRenderer.js'
import { timer } from './src/utils.js'

const maxTerrainWidth = 2048
const clientWidth = document.documentElement.clientWidth
let options = {
  w: Math.min(clientWidth, maxTerrainWidth),
  seed: Math.random(),
  noise: 35,
  type: 'type-3',
  charas: 9
}

// Instantiate a new TerrainGenerator
let terrainGenerator = null
async function newTerrainGenerator () {
  toggleForm(false)
  await waitForUi()
  const width = options.w
  const height = Math.floor(width * 0.625)
  terrainGenerator = await TerrainGenerator.fromImgUrl({
    debug: true,
    width: width - width % 2, // Make sure width is even
    height: height - height % 2, // Make sure height is even
    terrainTypeImg: './img/' + options.type + '.png',
    noiseResolution: options.noise
  })
  generateTerrain()
}

// Generate a new terrainShape
let terrainShape = null
async function generateTerrain () {
  toggleForm(false)
  await waitForUi()
  timer.start('terrain-total')
  terrainShape = terrainGenerator.generate(options.seed)
  renderTerrain().then(() => {
    timer.stop('terrain-total')
    timer.toHtmlElts()
  })
}

// Render the current terrainShape
async function renderTerrain () {
  if (!terrainShape) return
  toggleForm(false)
  const graphicsRenderer = await TerrainRenderer.fromImgUrl(terrainShape, {
    debug: true,
    groundImg: './img/ground.png',
    backgroundImg: './img/background.svg',
    charaImg: './img/chara.png',
    charaWidth: 44,
    charaHeight: 41,
    nbCharas: options.charas
  })
  graphicsRenderer.drawTerrain(
    options.seed,
    document.getElementById('bgcanvas'),
    document.getElementById('bgwater'),
    document.getElementById('fgcanvas'),
    document.getElementById('fgwater')
  )
  document.getElementById('result').classList.remove('loading')

  if (history.pushState) {
    // display current terrain config to querystring for linking
    const url = window.location.protocol + '//' + window.location.host + window.location.pathname + '?terrain=' + btoa(JSON.stringify(options))
    window.history.pushState({path: url}, '', url)
  }
  toggleForm(true)
}

// Demo form management
const formElts = ['gen', 'type1', 'type2', 'type3', 'noiseres']
function toggleForm (enabled) {
  formElts.map(elt => {
    document.getElementById(elt).disabled = !enabled
  })
}

// This method just waits a bit to let the UI refresh
// Ideally terrain stuff should be in a web worker instead but workers don't support Canvas API yet
function waitForUi () {
  return new Promise(r => setTimeout(r, 20), err => console.log(err))
}

// Init form controls and stuff
function pageInit () {
  for (let i = 0; i < document.genform.selshape.length; i++) {
    document.genform.selshape[i].onclick = function () {
      options.type = this.value
      newTerrainGenerator()
    }
  }

  document.getElementById('noiseres').onchange = function () {
    options.noise = parseInt(this.value)
    newTerrainGenerator()
  }

  document.getElementById('nbcharas').onchange = function () {
    options.charas = parseInt(this.value)
    renderTerrain()
  }

  document.getElementById('gen').onclick = function () {
    options.seed = Math.random()
    generateTerrain()
    return false
  }

  // Load options from querystring config if any
  if (window.location.search.substring(0, 9) === '?terrain=') {
    options = JSON.parse(atob(window.location.search.substring(9)))
    options.w = Math.min(options.w, maxTerrainWidth)
  }

  // Adjust html size to match querystring config width
  if (options.w > clientWidth) {
    ['bgcanvas', 'bgwater', 'fgcanvas', 'fgwater'].map(canvas => {
      document.getElementById(canvas).style.maxWidth = '100%'
    })
  } else if (options.w < clientWidth) {
    const resultDivStyle = document.getElementById('bgcanvas').parentElement.style
    resultDivStyle.width = options.w + 'px'
    resultDivStyle.height = Math.floor(options.w * 0.625) + 'px'
    resultDivStyle.paddingBottom = '0px'
  }

  // Make the generate terrain menu sticky after scroll
  const genform = document.getElementById('genform')
  const initOffset = genform.offsetTop
  window.onscroll = () => {
    genform.classList.toggle('sticky', window.pageYOffset >= initOffset)
  }

  // Everything is done, start generating a terrain
  newTerrainGenerator()
}

pageInit()