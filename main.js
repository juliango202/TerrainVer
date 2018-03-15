import TerrainGenerator from './src/TerrainGenerator.js'
import TerrainRenderer from './src/TerrainRenderer.js'


const DEFAULT_TERRAIN_OPTS = {
  debug: true,
  width: 1536,
  height: 960,
  terrainTypeImg: '/img/type-1.png',
  noiseResolution: 35,
  noiseResolutionBlack: 18,
  noiseThreshold: 20.0
}

let terrainGenerator = null    
    
// Instantiate the TerrainGenerator with the choosen options
function newTerrainGenerator(opts) {
  document.getElementById('gen').disabled = true;
  const options = Object.assign({}, DEFAULT_TERRAIN_OPTS, opts)
  terrainGenerator = new TerrainGenerator(options, generate)  
}
newTerrainGenerator();


function generate() {
  if( !terrainGenerator ) return;
  
  const shapeCanvas = terrainGenerator.generate(0)
  document.getElementById('bgcanvas').parentElement.style.width = shapeCanvas.width + "px";
  document.getElementById('bgcanvas').parentElement.style.height = shapeCanvas.height + "px"; //fix
  
  const graphicsRenderer = new TerrainRenderer(shapeCanvas, {}, () => {
      graphicsRenderer.drawBackground(
        document.getElementById('bgcanvas'), 
        document.getElementById('bgwater')
      )
      graphicsRenderer.drawTerrain(
        document.getElementById('fgcanvas'), 
        document.getElementById('fgwater')
      )
      document.getElementById('gen').disabled = false;
    }
  );  
  //   document.getElementById('timing').innerHTML = theTimer.toString();
}


for(var i = 0; i < document.genform.selshape.length; i++) {
  document.genform.selshape[i].onclick = function() {
    newTerrainGenerator({ type: this.value })
  };
}       
 

// document.getElementById('showsurface').onchange = function() {
//   showsurface = this.checked;
//   newTerrainGenerator();
// }
// 
// document.getElementById('wateranim').onchange = function() {
//   wateranim = this.checked;
//   newTerrainGenerator();
// }

document.getElementById('noiseres').onchange = function() {
  newTerrainGenerator({ noiseResolution: parseInt(this.value) })
}


document.getElementById('gen').onclick = function() {
  generate();
  return false;
};


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

