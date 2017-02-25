var bunny = require('bunny')
var meshSimplify = require('./index')

var simplified = meshSimplify(bunny.positions, bunny.cells, null, 0)(2000)
var norms = require('normals').vertexNormals(simplified.cells, simplified.positions)
var shell = require("mesh-viewer")()

shell.on("viewer-init", function() {
  mesh = shell.createMesh({
    positions: simplified.positions,
    cells: simplified.cells,
    vertexNormals: norms
  })
})

shell.on("gl-render", function() {
  mesh.draw()
})
