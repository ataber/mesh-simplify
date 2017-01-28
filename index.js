var heap = require('heap')
var ndarray = require('ndarray')
var vec3 = require('gl-vec3')
var normals = require('normals').faceNormals
var ops = require('ndarray-ops')

module.exports = function(positions, cells, faceNormals, threshold) {
  if (!threshold) {
    threshold = 0;
  }

  if (!faceNormals) {
    faceNormals = normals(cells, positions)
  }

  var validPairs = new Set();
  function symmetricAdd(set, i, j) {
    // choose a convention to prevent double entries
    var value;
    if (i < j) {
      value = [i, j];
    } else {
      value = [j, i];
    }

    if (!set.has(value)) {
      set.add(value)
    }
  }

  cells.map(function(cell) {
    for (var i = 0; i < 2; i++) {
      var j = (i + 1) % 3;
      symmetricAdd(validPairs, cell[i], cell[j]);
    }
  })

  if (threshold > 0) {
    for (var i = 0; i < positions.length; i++) {
      for (var j = i - 1; j >= 0; j--) {
        if (vec3.distance(cells[i], cells[j]) < threshold) {
          symmetricAdd(validPairs, i, j);
        }
      }
    }
  }

  var centroids = cells.map(function(cell) {
    var centroid = new Array(3).fill(0);
    cell.map(function(vertexId) {
      vec3.add(centroid, centroid, positions[vertexId]);
    })
    return vec3.scale(centroid, centroid, 1 / 3);
  })

  var n = positions.length;
  var errorQuadrics = new Array(n);
  cells.map(function(cell, cellId) {
    var normal = faceNormals[cellId];
    // [a, b, c, d] where plane is defined by a*x+by+cz+d=0
    var plane = [normal[0], normal[1], normal[2], vec3.dot(normal, centroids[cellId])];

    cell.map(function(vertexId) {
      var errorQuadric = ndarray(new Float32Array(4 * 4), [4, 4]);
      for (var i = 0; i < 4; i++) {
        for (var j = i; j >= 0; j--) {
          var value = plane[i] * plane[j]
          errorQuadric.set(i, j, value)
          errorQuadric.set(j, i, value)
        }
      }

      var existingQuadric = errorQuadrics[vertexId];
      if (existingQuadric) {
        ops.add(existingQuadric, existingQuadric, errorQuadric);
      } else {
        errorQuadrics[vertexId] = errorQuadric;
      }
    })
  })
  var initialError = positions.map(function(vertex, vertexId) {
    var xformed = new Array(3);
    var result = new Array(3);
    vec3.transformMat4(xformed, errorQuadrics[vertexId].data, vertex)
    return vec3.dot(result, vertex, xformed)
  })
  console.log(initialError)
}
