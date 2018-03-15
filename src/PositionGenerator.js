const DEFAULT_OPTIONS = {
  marginTop: 40,  // don't generate position too high
  marginRight: 1,
  marginBottom: 60,  // don't generate position in water
  marginLeft: 1,
  surfacePointMinWidth: 4,  // don't pick point where surface is too narrow
  seed: Math.random()
}

// Use Halton sequence to generate positions
// https://en.wikipedia.org/wiki/Halton_sequence
// This will return a number between [0,1)
const HALTON_BASE_X = 2
function halton (index, base) {
  let result = 0
  let f = 1 / base
  let i = index
  while (i > 0) {
    result = result + f * (i % base)
    i = Math.floor(i / base)
    f = f / base
  }
  return result
}

// Distance between two points
function distanceBetween (a, b) {
  return Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2))
}

// Two points (a, b) are considered at a *breaking* distance if some
// game character could not physically move from a to b without jump
const CHAIN_BREAKING_DIST = 5 // arbitrary maximum distance
function distanceIsBreaking (a, b) {
  const diffX = Math.abs(a[0] - b[0])
  const diffY = Math.abs(a[1] - b[1])
  if (diffX < diffY - 1) {
    return true // slope is too steep
  }
  return distanceBetween(a, b) > CHAIN_BREAKING_DIST
}

// Generate pseudo-random(uniformly distributed) positions on a given terrain
export default class PositionGenerator {

  constructor (terrainShape, opts) {
    this.options = Object.assign({}, DEFAULT_OPTIONS, opts)

    // Compute surface points
    let surfacePoints = []
    const edgesY = terrainShape.edgesY
    const w = terrainShape.mask.width
    const h = terrainShape.mask.height
    for (let y = this.options.marginTop; y < h - this.options.marginBottom; y++) {
      for (let x = this.options.marginLeft; x < w - this.options.marginRight; x++) {
        // A surface point is detected when a edge point does not have an upper neighboor
        if (edgesY[(x + y * w) * 4] > 100 && edgesY[(x + (y - 1) * w) * 4] < 50) {
          surfacePoints.push([x, y])
        }
      }
    }

    // Cache some properties
    this.innerWidth = w - this.options.marginLeft - this.options.marginRight
    this.innerHeight = h - this.options.marginTop - this.options.marginBottom

    // Sort points by location using a simple march-through algorithm
    // Start at (0,0) and march through closest points
    let curr = [0, 0]
    let visited = []
    while (surfacePoints.length > 0) {
      // Sort remaining points by distance to current
      surfacePoints.sort(function (a, b) {
        return distanceBetween(curr, b) - distanceBetween(curr, a)
      })
      // If there is a break in the chain take the next leftmost point
      // instead of the next closest point
      if (distanceIsBreaking(curr, surfacePoints[surfacePoints.length - 1])) {
        surfacePoints.sort(function (a, b) {
          return b[0] - a[0]
        })
      }
      curr = surfacePoints.pop()
      visited.push(curr)
    }
    this.visited = visited

    // Second pass to remove points where the surface is too narrow
    // To be OK, a point must have a neighbourhood of (surfacePointMinWidth-1)/2
    // points on the left and on the right without breaking distance
    const halfWidth = Math.ceil((this.options.surfacePointMinWidth - 1) / 2.0)
    this.okPoints = []
    for (let curr = 0; curr < visited.length; curr++) {
      let currPt = visited[curr]
      let isOk = true
      for (let nbg = curr - halfWidth; nbg < curr + halfWidth; nbg++) {
        const nbgNext = nbg + 1
        if (nbg < 0 || nbgNext >= visited.length || // Not enough neighboor points
            distanceIsBreaking(visited[nbg], visited[nbgNext])) {  // Breaking distance in neighbourhood
          isOk = false
          break
        }
      }
      if (isOk) {
        this.okPoints.push(currPt)
      }
    }

    this.haltonIndexX = 0
  }

  // Return next random surface point
  getSurfacePoint () {
    let nextRandomNb = halton(this.haltonIndexX++, HALTON_BASE_X)
    // randomize halton sequence by using the random seed as an offset
    nextRandomNb = (nextRandomNb + this.options.seed) % 1.0
    return this.okPoints[Math.floor(nextRandomNb * this.okPoints.length)]
  }
}
