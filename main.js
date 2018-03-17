import TerrainGenerator from './src/TerrainGenerator.js'
import TerrainRenderer from './src/TerrainRenderer.js'
import { timer } from './src/utils.js'

let terrainGenerator = null  
let terrainShape = null
let terrainGenOptions = {
  terrainTypeImg: '/img/type-1.png',
  noiseResolution: 35
}
let terrainRenderOptions = {}
    
// Instantiate the TerrainGenerator with the choosen options
function newTerrainGenerator(opts) {
  disableForm ()
  terrainGenOptions = Object.assign({ debug: true, width: 1536, height: 960 }, terrainGenOptions, opts)
  terrainGenerator = new TerrainGenerator(terrainGenOptions, generate)  
}
newTerrainGenerator();


function generate () {
  if( !terrainGenerator ) return;
  terrainShape = terrainGenerator.generate(Math.random())
  document.getElementById('bgcanvas').parentElement.style.width = terrainShape.width + "px"
  document.getElementById('bgcanvas').parentElement.style.height = terrainShape.height + "px"
  renderTerrain ()
}

function renderTerrain (opts) {
  if( !terrainShape ) return;
  terrainRenderOptions = Object.assign({ debug: true }, terrainRenderOptions, opts)
 
  const graphicsRenderer = new TerrainRenderer(terrainShape, terrainRenderOptions, () => {
      graphicsRenderer.drawBackground(
        document.getElementById('bgcanvas'), 
        document.getElementById('bgwater')
      )
      graphicsRenderer.drawTerrain(
        document.getElementById('fgcanvas'), 
        document.getElementById('fgwater')
      )
      document.getElementById('timing').innerHTML = timer.toString();
      enableForm ()
    }
  ); 
}

// Demo form management

// document.getElementById('showsurface').onchange = function() {
//   showsurface = this.checked;
//   newTerrainGenerator();
// }
// 
// document.getElementById('wateranim').onchange = function() {
//   wateranim = this.checked;
//   newTerrainGenerator();
// }

for(var i = 0; i < document.genform.selshape.length; i++) {
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
  generate();
  return false;
};

function disableForm() {
  document.getElementById('gen').disabled = true
  document.getElementById('type1').disabled = true
  document.getElementById('type2').disabled = true
  document.getElementById('type3').disabled = true
  document.getElementById('noiseres').disabled = true
}

function enableForm() {
  document.getElementById('gen').disabled = false
  document.getElementById('type1').disabled = false
  document.getElementById('type2').disabled = false
  document.getElementById('type3').disabled = false
  document.getElementById('noiseres').disabled = false
}


// Make the generate terrain menu sticky after scroll
var genform = document.getElementById("genform"),
    genformTop = genform.offsetTop;
window.onscroll = function() {myFunction()};

function myFunction() {
  if (window.pageYOffset >= genformTop) {
    genform.classList.add("sticky");
  } else {
    genform.classList.remove("sticky");
  }
}

