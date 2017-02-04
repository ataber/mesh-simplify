var Heap = require('heap')
var ndarray = require('ndarray')
var vec3 = require('gl-vec3')
var vec4 = require('gl-vec4')
var normals = require('normals').faceNormals
var ops = require('ndarray-ops')
var solve = require('ndarray-linear-solve')
var removeOrphans = require('remove-orphan-vertices')
var orientation = require('robust-orientation')

module.exports = function(positions, cells, faceNormals, threshold) {
  if (!threshold) {
    threshold = 0;
  }

  if (!faceNormals) {
    faceNormals = normals(cells, positions)
  }

  var n = positions.length;
  var vertices = positions.map(function(p, i) {
    return {
      position: p,
      index: i,
      pairs: [],
      error: null
    }
  })

  cells.map(function(cell) {
    for (var i = 0; i < 2; i++) {
      var j = (i + 1) % 3;
      var v1 = cell[i];
      var v2 = cell[j];
      // consistent ordering to prevent double entries
      if (v1 < v2) {
        vertices[v1].pairs.push(v2);
      } else {
        vertices[v2].pairs.push(v1);
      }
    }
  })

  if (threshold > 0) {
    for (var i = 0; i < n; i++) {
      for (var j = i - 1; j >= 0; j--) {
        if (vec3.distance(cells[i], cells[j]) < threshold) {
          if (i < j) {
            vertices[i].pairs.push(vertices[j]);
          } else {
            vertices[j].pairs.push(vertices[i]);
          }
        }
      }
    }
  }

  cells.map(function(cell, cellId) {
    var normal = faceNormals[cellId];
    // [a, b, c, d] where plane is defined by a*x+by+cz+d=0
    // choose the first vertex WLOG
    var pointOnTri = positions[cells[cellId][0]];
    var plane = [normal[0], normal[1], normal[2], -vec3.dot(normal, pointOnTri)];

    cell.map(function(vertexId) {
      var errorQuadric = ndarray(new Float32Array(4 * 4), [4, 4]);
      for (var i = 0; i < 4; i++) {
        for (var j = i; j >= 0; j--) {
          var value = plane[i] * plane[j];
          errorQuadric.set(i, j, value);
          if (i != j) {
            errorQuadric.set(j, i, value);
          }
        }
      }

      if (vertices[vertexId].error) {
        var existingQuadric = vertices[vertexId].error;
        ops.add(existingQuadric, existingQuadric, errorQuadric);
        vertices[vertexId].error = existingQuadric;
      } else {
        vertices[vertexId].error = errorQuadric;
      }
    })
  });

  function vertexError(vertex, quadratic) {
    var xformed = new Array(4);
    vec4.transformMat4(xformed, vertex, quadratic);
    return vec4.dot(vertex, xformed);
  };

  function optimalPosition(v1, v2) {
    var q1 = v1.error;
    var q2 = v2.error;
    var costMatrix = ndarray(new Float32Array(4 * 4), [4, 4]);
    ops.add(costMatrix, q1, q2);
    var mat4Cost = Array.from(costMatrix.data);
    var optimal = ndarray(new Float32Array(4));
    var toInvert = costMatrix;
    toInvert.set(0, 3, 0);
    toInvert.set(1, 3, 0);
    toInvert.set(2, 3, 0);
    toInvert.set(3, 3, 1);
    var solved = solve(optimal, toInvert, ndarray([0, 0, 0, 1]));

    if (!solved) {
      var v1Homogenous = v1.position;
      v1Homogenous.push(1);
      var v2Homogenous = v2.position;
      v2Homogenous.push(1);
      var midpoint = vec3.add(new Array(3), v1.position, v2.position);
      vec3.scale(midpoint, midpoint, 0.5);
      midpoint.push(1);
      var v1Error = vertexError(v1Homogenous, mat4Cost);
      var v2Error = vertexError(v2Homogenous, mat4Cost);
      var midpointError = vertexError(midpoint, mat4Cost);
      var minimum = Math.min([v1Error, v2Error, midpointError]);
      if (v1Error == minimum) {
        optimal = v1Homogenous;
      } else if (v2Error == minimum) {
        optimal = v2Homogenous;
      } else {
        optimal = midpoint;
      }
    } else {
      optimal = optimal.data;
    }

    var error = vertexError(optimal, mat4Cost);
    return {vertex: optimal.slice(0, 3), error: error};
  };

  var costs = new Heap(function(a, b) {
    return a.cost - b.cost;
  });

  var edges = []
  vertices.map(function(v1) {
    v1.pairs.map(function(index) {
      var v2 = vertices[index];
      var optimal = optimalPosition(v1, v2);

      var edge = {
        pair: [v1.index, index],
        cost: optimal.error,
        optimalPosition: optimal.vertex
      };

      costs.push(edge);
      // to update costs
      edges.push(edge);
    });
  });

  return function(targetCount) {
    var n = positions.length;
    var newVertices = Array.from(vertices);
    var newCells = Array.from(cells);
    var deletedCount = 0;
    if (!targetCount) {
      targetCount = n - 200;
    }

    while (n - deletedCount > targetCount) {
      var leastCost = costs.pop();
      var i1 = leastCost.pair[0];
      var i2 = leastCost.pair[1];
      newVertices[i1].position = leastCost.optimalPosition;

      for (var i = newCells.length - 1; i >= 0; i--) {
        var cell = newCells[i];
        if (cell.indexOf(i2) != -1) {
          if (cell.indexOf(i1) != -1) {
            // Delete cells with zero area, as v1 == v2 now
            newCells.splice(i, 1);
          }

          cell[cell.indexOf(i2)] = i1;
        }
      }

      var v1 = newVertices[i1];
      var v2 = newVertices[i2];
      edges.map(function(edge) {
        if (edge.pair.sort() == [i1, i2]) {
          return
        }

        if (edge.pair.indexOf(i1) != -1) {
          var optimal = optimalPosition(v1, newVertices[edge.pair[1]]);
          edge.optimalPosition = optimal.vertex;
          edge.cost = optimal.error;
          costs.updateItem(edge);
        }

        if (edge.pair.indexOf(i2) != -1) {
          // use v1 as that is the new position of v2
          var optimal = optimalPosition(v1, newVertices[(edge.pair.indexOf(i2) + 1) % 2]);
          edge.optimalPosition = optimal.vertex;
          edge.cost = optimal.error;
          costs.updateItem(edge);
        }
      });

      deletedCount++;
    }

    return removeOrphans(newCells, newVertices.map(p => p.position));
  };
}
