var bunny = require('bunny')
var meshSimplify = require('./index')

meshSimplify(bunny.positions, bunny.cells, null, 0)
// meshSimplify(bunny.positions, bunny.cells, null, 0.1)
