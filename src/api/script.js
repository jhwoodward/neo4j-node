var cypher = require('./cypher');


module.exports = {
  create: function(lookup) { 
    
    var q = `match (n {Lookup:'${lookup}'}) - [r] - (m) return n,LABELS(n),type(r),ID(m)`;
    return cypher.executeQuery(q)
      .then(function (data) {
        if (data.length) {
         
          var n = data[0].row[0];
          var labels = data[0].row[1];
          var rels = data.map(function(d) {
            return { type: d.row[2], id: d.row[3] };
          });

          var labelString = labels.join(':')

          var props = '';
          var count = 0;
          for (var key in n) {

            if (count > 0) {
              props += ', ';
            }

            if (n[key] === parseInt(n[key])) {
               props += key + ': ' + n[key];
            } else {
              props += key + ': \'' + n[key] + '\'';
            }

            count += 1;
           
         
          }
          props = '{' + props + '}';
          
          var out = 'create (n:Imported:' + labels.join(':') + ' ' + props + ') ';

          rels.forEach(function(rel) {
             out += 'with n match(m) where ID(m) = ' + rel.id + ' create n - [:' + rel.type + '] -> m ';
          })
         
          return out;


        } else {
            return null;
        }
      });

 }
};
