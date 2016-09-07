var node = require('../src/api/node');
//for cleanup
var cypher = require("../src/api/cypher");
var key;
var nodes;

function setNodes() {
  nodes = {
    Joe: { name: "Joe", label: "Joe", colour: "brown", type: "horse", labels: ["Label", "Mochatest"]},
    Jim: {name: "Jim", label: "Jim", colour: "green", type: "cat", labels: ["Label", "Mochatest"]}, 
    Alex:  {name: "Alex", label: "Alex", colour: "green", type: "cat", labels: ["Label", "Mochatest"]}, 
    NoLabel: {name: "John", colour: "green", type: "person", labels: ["Mochatest"]}
  };
}
setNodes();
function createNodes(done) {
  cleanup().then(create);
  
  var createdCount = 0;
  function created() {
    createdCount += 1;
    if (createdCount === Object.keys(nodes).length) {
      done();
    }
  }
  function create() {
    Object.keys(nodes).forEach(function(key) {
      node.save(nodes[key]).then(function(saved) {
        saved.should.have.property('id').which.is.a.Number().above(-1);
        saved.should.have.property('created').which.is.a.Number().above(0);
        nodes[key] = saved;//store for further operations
        created();
      });
    });
  }
}

function cleanup(done) {
  return cypher.executeQuery("match (n:Mochatest) optional match (n)-[r]-() delete n,r")
    .then(function() {
      setNodes();
      if (done) {
        done();
      }
    });
}

module.exports = {
  getNodes: function() { return nodes; },
  create: createNodes,
  cleanup: cleanup
};
