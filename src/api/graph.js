
  import cypher from './cypher';
  import utils from './utils';
  import image from './image';

  const api = {
    // returns graph data object for given query(q), with properties nodes, edges containing neo node/edge data by property=id
    // node structure is {id:1,labels:[],properties:{}}
    // edge structure is
    // post
    // q = graph query
    // NB THIS IS A DANGEROUS ONE AS IT WOULD ALLOW ANY QUERY TO BE EXECUTED AGAINST THE GRAPH
    get:(q, returnArray) => {
      return cypher.executeQuery(q, 'graph').then(data => {
        return api.build(data, returnArray);
      });

    }
    ,
    // get all relationships with other :Global nodes
    // by (internal)ID
    getRelationships: function (id) {
      const q = `match (n)-[r]-(m:Global) where ID(n)=${id} return r`;
      return api.get(q);
    }
    ,
    build : function (data, returnArray) {

      const edges = {};
      const nodes = {};
      const nodeArray = [];
      const edgeArray = [];

      for (const i = 0; i < data.length; i++) {
        const val = data[i];
        for (const relx = 0; relx < val.graph.relationships.length; relx++) {
          const rel = val.graph.relationships[relx];
          edges[rel.id] = rel;
          edgeArray.push(rel);
        }

        for (const nodex = 0; nodex < val.graph.nodes.length; nodex++) {
          const node = val.graph.nodes[nodex];
          const n = utils.camelCase(node.properties);
          n.labels = node.labels;
          n.id = node.id;
          image.configure(n.image);
          nodes[node.id] = n;
          nodeArray.push(n);
        }
      }
      if (returnArray) {
        return { nodes: nodeArray, edges: edgeArray };
      }
      else {
        return { nodes: nodes, edges: edges };
      }
    }
  };


  export default api;



