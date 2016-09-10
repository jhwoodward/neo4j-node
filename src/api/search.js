var cypher = require('./cypher');

function search(q) {
  return cypher.executeQuery(q, 'row')
    .then(function (data) {
      var out = data.map(function (d) {
        return {
          id: d.row[0],
          label: d.row[1],
          type: d.row[2]
        };
      });
      return out;
    });
}

//searches are performed on the Lookup property only as a 'contains' wildcard
var api = {
  label: function(label, txt) {
    if (txt) {
      var q = '';
      /*
      if (txt === '*') {
        q = 'match (n:' + label + ')-[:INSTANCE_OF]->(m:Label) return ID(n),n.Label,m.Label';
      } else {
        q= 'match (n:' + label + ')-[:INSTANCE_OF]->(m:Label) where n.Label=~ \'(?i).*' + txt + '.*\' return ID(n),n.Label,m.Label';
      }*/

      if (txt === '*') {
        q = 'match (n:' + label + ') return ID(n),n.Label,n._class';
      } else {
        q= 'match (n:' + label + ') where n.Label=~ \'(?i).*' + txt + '.*\' return ID(n),n.Label,n._class';
      }

      return search(q);

    }
  }
};
module.exports = api;
