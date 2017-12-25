var bunny = require('bunny');
var meshSimplify = require('./index');

console.time('simplify')
var simplified = meshSimplify(bunny.cells, bunny.positions)(1000);
console.timeEnd('simplify')
var positions = simplified.positions;
var cells = simplified.cells;
var normals = require('normals');

var regl = require('regl')()
var mat4 = require('gl-mat4')
var wire = require('gl-wireframe')
var camera = require('regl-camera')(regl, {
  center: [0, 0, 0],
  theta: Math.PI / 2,
  distance: 4
})

var drawOriginal = regl({
  vert: `
  precision mediump float;
  attribute vec3 position;
  uniform mat4 projection;
  uniform mat4 view;
  void main() {
    gl_Position = projection * view * vec4(position, 1.0);
  }
  `, frag: `
  precision mediump float;
  void main() {
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
  }
  `,
  attributes: {
    position: bunny.positions
  },
  elements: wire(bunny.cells),
  primitive: 'lines'
})

var drawWires = regl({
  vert: `
  precision mediump float;
  attribute vec3 position, normal;
  varying vec3 vNorm;
  uniform mat4 projection;
  uniform mat4 view;
  void main() {
    vNorm = normal;
    gl_Position = projection * view * vec4(position, 1.0);
  }
  `, frag: `
  precision mediump float;
  varying vec3 vNorm;
  void main() {
    vec3 lightDir = normalize(vec3(1., 1., 0.));
    gl_FragColor = vec4(vec3(0.6) + dot(vNorm, lightDir), 1.0);
  }
  `,
  attributes: {
    position: positions,
    normal: normals.vertexNormals(cells, positions)
  },
  elements: wire(cells),
  primitive: 'lines'
})

var faceNormals = normals.faceNormals(cells, positions)
var explodedPositions = [];
var perVertexFaceNormals = [];
cells.map(function(cell, i) {
  explodedPositions.push(positions[cell[0]]);
  explodedPositions.push(positions[cell[1]]);
  explodedPositions.push(positions[cell[2]]);
  perVertexFaceNormals.push(faceNormals[i]);
  perVertexFaceNormals.push(faceNormals[i]);
  perVertexFaceNormals.push(faceNormals[i]);
});

var drawOuter = regl({
  vert: `
  precision mediump float;

  attribute vec3 position, normal;
  varying vec3 vNorm;
  uniform mat4 projection;
  uniform mat4 view;
  void main() {
    vNorm = normal;
    gl_Position = projection * view * vec4(position, 1.0);
  }
  `
  , frag: `
  precision mediump float;
  varying vec3 vNorm;
  void main() {
    vec3 lightDir = normalize(vec3(1., 1., 0.));
    gl_FragColor = vec4(vNorm, 0.8);
  }
  `,
  attributes: {
    position: explodedPositions,
    normal: perVertexFaceNormals
  },
  count: cells.length * 3,
  primitive: 'triangles'
})

regl.frame(() => {
  regl.clear({
    color: [1, 1, 1, 1],
    depth: 1
  })
  camera(() => {
    drawOriginal({
      view: mat4.create()
    })
    drawWires({
      view: mat4.create()
    })
    drawOuter({
      view: mat4.create()
    })
  })
})
