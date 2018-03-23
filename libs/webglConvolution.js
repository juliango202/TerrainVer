/*
 *
 * This is an adaptation of https://github.com/phoboslab/WebGLImageFilter
 * - Removed color filters and other parts not needed
 * - Partially updated syntax to ES6
 * - Updated code to run convolutions of arbitrary kernel size
 * - A few speed improvements
 * - Added Scale 3X filter
 *
 * -------------------------------------------------------------
 *
 * Adapted from WebGLImageFilter(MIT Licensed)
 * 2013, Dominic Szablewski - phoboslab.org
 *
 */

const WebGLProgram = function (gl, vertexSource, fragmentSource) {
  const _collect = function (source, prefix, collection) {
    const r = new RegExp('\\b' + prefix + ' \\w+ (\\w+)', 'ig')
    source.replace(r, function (match, name) {
      collection[name] = 0
      return match
    })
  }

  const _compile = function (gl, source, type) {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.log(gl.getShaderInfoLog(shader))
      return null
    }
    return shader
  }

  this.uniform = {}
  this.attribute = {}

  const _vsh = _compile(gl, vertexSource, gl.VERTEX_SHADER)
  const _fsh = _compile(gl, fragmentSource, gl.FRAGMENT_SHADER)

  this.id = gl.createProgram()
  gl.attachShader(this.id, _vsh)
  gl.attachShader(this.id, _fsh)
  gl.linkProgram(this.id)

  if (!gl.getProgramParameter(this.id, gl.LINK_STATUS)) {
    console.log(gl.getProgramInfoLog(this.id))
  }

  gl.useProgram(this.id)

  // Collect attributes
  _collect(vertexSource, 'attribute', this.attribute)
  for (let a in this.attribute) {
    this.attribute[a] = gl.getAttribLocation(this.id, a)
  }

  // Collect uniforms
  _collect(vertexSource, 'uniform', this.uniform)
  _collect(fragmentSource, 'uniform', this.uniform)
  for (let u in this.uniform) {
    this.uniform[u] = gl.getUniformLocation(this.id, u)
  }
}

const WebGLImageFilter = function () {
  let _drawCount = 0
  let _sourceTexture = null
  let _lastInChain = false
  let _currentFramebufferIndex = -1
  let _tempFramebuffers = [null, null]
  let _filterChain = []
  let _width = -1
  let _height = -1
  let _vertexBuffer = null
  let _currentProgram = null
  let _canvas = document.createElement('canvas')
  let gl = _canvas.getContext('webgl') || _canvas.getContext('experimental-webgl')

  if (!gl) {
    throw new Error("Couldn't get WebGL context")
  }

  this.addFilter = function (name, ...args) {
    const filter = _filter[name]
    _filterChain.push({func: filter, args})
  }

  this.reset = function () {
    _filterChain = []
  }

  this.apply = function (image, imageOut) {
    _resize(image.width, image.height)
    _drawCount = 0

    // Create the texture for the input image
    _sourceTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, _sourceTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)

    // No filters? Just draw
    if (_filterChain.length === 0) {
      _compileShader(SHADER.FRAGMENT_IDENTITY)
      _draw()
      return _canvas
    }

    for (let i = 0; i < _filterChain.length; i++) {
      _lastInChain = (i === _filterChain.length - 1)
      const f = _filterChain[i]

      f.func.apply(this, f.args || [])
    }

    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, imageOut)
  }

  const _resize = function (width, height) {
    // Same width/height? Nothing to do here
    if (width === _width && height === _height) { return }

    _canvas.width = _width = width
    _canvas.height = _height = height

    // Create the context if we don't have it yet
    if (!_vertexBuffer) {
      // Create the vertex buffer for the two triangles [x, y, u, v] * 6
      const vertices = new Float32Array([
        -1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0,
        -1, 1, 0, 0, 1, -1, 1, 1, 1, 1, 1, 0
      ])
      _vertexBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, _vertexBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

      // Note sure if this is a good idea; at least it makes texture loading in Ejecta instant.
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    }

    gl.viewport(0, 0, _width, _height)

    // Delete old temp framebuffers
    _tempFramebuffers = [null, null]
  }

  const _getTempFramebuffer = function (index) {
    _tempFramebuffers[index] =
      _tempFramebuffers[index] ||
      _createFramebufferTexture(_width, _height)

    return _tempFramebuffers[index]
  }

  const _createFramebufferTexture = function (width, height) {
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)

    const renderbuffer = gl.createRenderbuffer()
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer)

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)

    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    return {fbo: fbo, texture: texture}
  }

  const _draw = function (flags) {
    let source = null
    let target = null
    let flipY = false

    // Set up the source
    if (_drawCount === 0) {
      // First draw call - use the source texture
      source = _sourceTexture
    } else {
      // All following draw calls use the temp buffer last drawn to
      source = _getTempFramebuffer(_currentFramebufferIndex).texture
    }
    _drawCount++

              // Set up the target
    if (_lastInChain && !(flags & DRAW.INTERMEDIATE)) {
                      // Last filter in our chain - draw directly to the WebGL Canvas. We may
                      // also have to flip the image vertically now
      target = null
      flipY = _drawCount % 2 === 1
    } else {
                      // Intermediate draw call - get a temp buffer to draw to
      _currentFramebufferIndex = (_currentFramebufferIndex + 1) % 2
      target = _getTempFramebuffer(_currentFramebufferIndex).fbo
    }

              // Bind the source and target and draw the two triangles
    gl.bindTexture(gl.TEXTURE_2D, source)
    gl.bindFramebuffer(gl.FRAMEBUFFER, target)

    gl.uniform1f(_currentProgram.uniform.flipY, flipY ? -1 : 1)       // not working => (flipY ? -1 : 1)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  const _compileShader = function (fragmentSource) {
    // if (fragmentSource.__program) {
    //   _currentProgram = fragmentSource
    //   gl.useProgram(_currentProgram.id)
    //   return _currentProgram
    // }

    // Compile shaders
    _currentProgram = new WebGLProgram(gl, SHADER.VERTEX_IDENTITY, fragmentSource)

    const floatSize = Float32Array.BYTES_PER_ELEMENT
    const vertSize = 4 * floatSize
    gl.enableVertexAttribArray(_currentProgram.attribute.pos)
    gl.vertexAttribPointer(_currentProgram.attribute.pos, 2, gl.FLOAT, false, vertSize, 0 * floatSize)
    gl.enableVertexAttribArray(_currentProgram.attribute.uv)
    gl.vertexAttribPointer(_currentProgram.attribute.uv, 2, gl.FLOAT, false, vertSize, 2 * floatSize)

    // fragmentSource.__program = _currentProgram
    return _currentProgram
  }

  const DRAW = { INTERMEDIATE: 1 }

  const SHADER = {}
  SHADER.VERTEX_IDENTITY = [
    'precision highp float;',
    'attribute vec2 pos;',
    'attribute vec2 uv;',
    'varying vec2 vUv;',
    'uniform float flipY;',

    'void main(void) {',
    'vUv = uv;',
    'gl_Position = vec4(pos.x, pos.y*flipY, 0.0, 1.);',
    '}'
  ].join('\n')

  SHADER.FRAGMENT_IDENTITY = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D texture;',

    'void main(void) {',
    'gl_FragColor = texture2D(texture, vUv);',
    '}'
  ].join('\n')

  const _filter = {}

  // ----------------------------------------------------------------------------
  // Convolution Filter

  _filter.convolution = function (matrix, inverseColors = false) {
    const pixelSizeX = 1 / _width
    const pixelSizeY = 1 / _height
    const shader = generateConvolutionShader(matrix, inverseColors)
    const program = _compileShader(shader)
    gl.uniform2f(program.uniform.px, pixelSizeX, pixelSizeY)
    _draw()
  }

  // Generate(and cache) a shader that perform the convolution of an image with a matrix of a given size
  // Set inverseColors to true to treat black as the maximum value(dilation of black is erosion of white)
  const convolutionShaderCache = new Map()
  const generateConvolutionShader = function (matrix, inverseColors = false) {
    const shaderKey = matrix.toString() + inverseColors.toString()
    if (!convolutionShaderCache.has(shaderKey)) {
      const matrixSize = matrix.length
      if (matrixSize < 0 || matrixSize > 1000 || Math.sqrt(matrixSize) % 1 !== 0) throw new Error('invalid matrixSize')
      let convSize = Math.sqrt(matrixSize)
      if (convSize % 2 !== 1) throw new Error('invalid convSize')
      let halfSize = Math.floor(convSize / 2)
      let idx = 0
      let inverseColorsStr = inverseColors ? '1.0 - ' : ''
      let fragColor = []
      let shader = [
        'precision highp float;',
        'varying vec2 vUv;',
        'uniform sampler2D texture;',
        'uniform vec2 px;',
        'void main(void) {']
      for (let i = 0; i < convSize; i++) {
        for (let j = 0; j < convSize; j++) {
          if (matrix[idx] !== 0 || (i === halfSize && j === halfSize)) {
            shader.push('vec4 c' + i + '_' + j + ' = ' + inverseColorsStr + 'texture2D(texture, vec2(vUv.x + ' + (j - halfSize).toFixed(1) + '*px.x, vUv.y + ' + (i - halfSize).toFixed(1) + '*px.y));')
            if (matrix[idx] === 1 || matrix[idx] === 1.0) {
              fragColor.push('c' + i + '_' + j)
            } else if (matrix[idx] % 1 === 0) {  // Force float notation even for rounded numbers
              fragColor.push('c' + i + '_' + j + ' * ' + matrix[idx].toFixed(1))
            } else {
              fragColor.push('c' + i + '_' + j + ' * ' + matrix[idx])
            }
          }
          idx++
        }
      }
      shader.push('gl_FragColor = ' + inverseColorsStr + '(' + fragColor.join(' + ') + ');')
      shader.push('gl_FragColor.a = ' + inverseColorsStr + 'c' + halfSize + '_' + halfSize + '.a;')
      shader.push('}')
      convolutionShaderCache.set(shaderKey, shader.join('\n'))
    }
    return convolutionShaderCache.get(shaderKey)
  }

  _filter.dilation = function () {
    _filter.convolution.call(this, [
      0, 1, 1, 1, 0,
      1, 1, 1, 1, 1,
      1, 1, 1, 1, 1,
      1, 1, 1, 1, 1,
      0, 1, 1, 1, 0
    ], false)
  }

  _filter.erosion = function () {
    _filter.convolution.call(this, [
      0, 1, 1, 1, 0,
      1, 1, 1, 1, 1,
      1, 1, 1, 1, 1,
      1, 1, 1, 1, 1,
      0, 1, 1, 1, 0
    ], true)
  }

  _filter.dilation3 = function () {
    _filter.convolution.call(this, [
      1, 1, 1,
      1, 1, 1,
      1, 1, 1
    ], false)
  }

  _filter.dilhor = function () {
    _filter.convolution.call(this, [
      0, 0, 0,
      1, 1, 1,
      0, 0, 0
    ], true)
  }

  _filter.surface = function () {
    _filter.convolution.call(this, [
      0, -255, 0,
      0, 1, 0,
      0, 0, 0
    ], false)
  }

  _filter.threshold = function () {
    _filter.convolution.call(this, [
      0, 0, 0,
      0, 255, 0,
      0, 0, 0
    ], false)
  }

  _filter.thresholdblack = function () {
    _filter.convolution.call(this, [
      0, 0, 0,
      0, 255, 0,
      0, 0, 0
    ], true)
  }

  _filter.avg3 = function () {
    _filter.convolution.call(this, [
      0.111111111111, 0.111111111111, 0.111111111111,
      0.111111111111, 0.111111111111, 0.111111111111,
      0.111111111111, 0.111111111111, 0.111111111111
    ])
  }

  _filter.gaussian3 = function () {
    _filter.convolution.call(this, [
      0.077847, 0.123317, 0.077847,
      0.123317, 0.195346, 0.123317,
      0.077847, 0.123317, 0.077847
    ])
  }

  _filter.gaussian5 = function () {
    _filter.convolution.call(this, [
      0.003765, 0.015019, 0.023792, 0.015019, 0.003765,
      0.015019, 0.059912, 0.094907, 0.059912, 0.015019,
      0.023792, 0.094907, 0.150342, 0.094907, 0.023792,
      0.015019, 0.059912, 0.094907, 0.059912, 0.015019,
      0.003765, 0.015019, 0.023792, 0.015019, 0.003765
    ])
  }

  // ----------------------------------------------------------------------------
  // Line erosion Filter
  //

  _filter.surfaceErosion = function () {
    const pixelSizeX = 1 / _width
    const pixelSizeY = 1 / _height
    const program = _compileShader(_filter.surfaceErosion.SHADER)
    gl.uniform2f(program.uniform.px, pixelSizeX, pixelSizeY)
    _draw()
  }

  _filter.surfaceErosion.SHADER = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D texture;',
    'uniform vec2 px;',

    'void main(void) {',
    'vec4 A = texture2D(texture, vUv - px);', // top left
    'vec4 B = texture2D(texture, vec2(vUv.x - px.x, vUv.y) );', // mid left
    'vec4 C = texture2D(texture, vec2(vUv.x - px.x, vUv.y + px.y) );', // bottom left

    'vec4 D = texture2D(texture, vec2(vUv.x + px.x, vUv.y - px.y));', // top right
    'vec4 E = texture2D(texture, vec2(vUv.x + px.x, vUv.y) );', // mid right
    'vec4 F = texture2D(texture, vUv + px );', // bottom right

    'if ((A.r == 0.0 && B.r == 0.0 && C.r == 0.0) || (D.r == 0.0 && E.r == 0.0 && F.r == 0.0)) {',
    'gl_FragColor = vec4(0,0,0,0);',
    '} else {',
    'gl_FragColor = texture2D(texture, vUv);',
    '}',
    '}'
  ].join('\n')
}

// Perform a convolution on src image data using WebGL shaders
// filters => an array of convolution filters to apply consecutively
const imageFilter = new WebGLImageFilter()
let uint8Buffer = null
export default function convolution (filters, src, dest) {
  if (!(src instanceof ImageData)) {
    throw new Error('Invalide src buffer type!!!' + arguments.toString())
  }
  imageFilter.reset()
  filters.forEach(f => imageFilter.addFilter(f))
  if (dest instanceof Uint8Array) {
    imageFilter.apply(src, dest)
  } else if (dest instanceof ImageData) {
    const bufferSize = dest.width * dest.height * 4
    if (uint8Buffer == null || uint8Buffer.length !== bufferSize) {
      uint8Buffer = new Uint8Array(bufferSize)
    }
    imageFilter.apply(src, uint8Buffer)
    dest.data.set(uint8Buffer)
  } else {
    throw new Error('Invalide dest buffer type')
  }
}
