var cypher = require('./cypher');
var utils = require('./utils');
var image = require('./image');

var api = {
  //returns graph data object for given query(q), with properties nodes, edges containing neo node/edge data by property=id
  //node structure is {id:1,labels:[],properties:{}}
  //edge structure is 
  //post
  //q = graph query
  //NB THIS IS A DANGEROUS ONE AS IT WOULD ALLOW ANY QUERY TO BE EXECUTED AGAINST THE GRAPH
  get:function (q, returnArray) {
    return cypher.executeQuery(q, 'graph').then(function (data) {
      return api.build(data, returnArray);
    });
  },
  //get all relationships with other :Global nodes
  //by (internal)ID
  getRelationships: function (id) {
    var q = 'match (n)-[r]-(m:Global) where ID(n)=' + id + ' return r';
    return api.get(q);
  },
  build : function (data, returnArray) {
    var edges = {};
    var nodes = {};
    var nodeArray = [];
    var edgeArray = [];

    for (var i = 0; i < data.length; i++) {
      var val = data[i];
      for (var relx = 0; relx < val.graph.relationships.length; relx++) {
          var rel = val.graph.relationships[relx];
          edges[rel.id] = rel;
          edgeArray.push(rel);
      }
      for (var nodex = 0; nodex < val.graph.nodes.length; nodex++) {
          var node = val.graph.nodes[nodex];
          var n = utils.camelCase(node.properties);
          n.labels = node.labels;
          n.id = node.id;
          image.configure(n.image);
          nodes[node.id] = n;
          nodeArray.push(n);
      }
    }
    if (returnArray) {
        return { nodes: nodeArray, edges: edgeArray };
    } else {
        return { nodes: nodes, edges: edges };
    }
  }
};
 
module.exports = api;
