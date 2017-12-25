# mesh-simplify

[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

Surface Simplification via Quadric Error Metrics. An implementation of [this paper](http://www.cs.cmu.edu/~./garland/Papers/quadrics.pdf), with influence from [this C++ implementation](https://github.com/sp4cerat/Fast-Quadric-Mesh-Simplification).

## Usage

[![NPM](https://nodei.co/npm/mesh-simplify.png)](https://www.npmjs.com/package/mesh-simplify)

```javascript
var bunny          = require('bunny')
var meshSimplify   = require('mesh-simplify')
var simplified     = meshSimplify(bunny.cells, bunny.positions)(1000);
console.log(simplified.positions.length) # <- 1000
```

`require("mesh-simplify")(cells, positions[, faceNormals, distanceThreshold])`
----------------------------------------------------
This returns a function that takes a target number of vertices and outputs a mesh with that number of vertices that approximates the input mesh.
`distanceThreshold` is a number signifying the maximum distance two unconnected vertices in the original mesh can be considered collapse-able.

## Contributing

See [stackgl/contributing](https://github.com/stackgl/contributing) for details.

## License

MIT. See [LICENSE.md](http://github.com/ataber/mesh-simplify/blob/master/LICENSE.md) for details.
