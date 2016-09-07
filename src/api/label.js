var type = require('./type');
var predicate = require('./predicate');
var cypher = require('./cypher');
var changeCase = require('change-case');
var _= require('lodash');

var api = {
  list: {
    //Alternatively i could query the actual labels and merge them into a distinct array
    distinct: function (labels) {
      var q = 'match (n:' + labels.join(':') + ') return distinct(LABELS(n))';

      return cypher.executeQuery(q).then(function (data) {
        var output = [];
        for (var i = 0; i < data.length; i++) {
          var val = data[i];
          for (var j = 0; j < val.row[0].length; j++) {
            var label = val.row[0][j];
            if (output.indexOf(label) === -1) {
              output.push(label);
            }
          }
        }
        return output;
      });
    },
    //if the node has any values in its labels array api match picture or person types
    //the corresponding parent label is added to the array
    //The array is uniqued before returning
    parents: function (labels) {
      var out = [];
      if (labels && labels.length)
      {
        if (_.intersection(labels,type.pictureTypes).length) {
          out.push('Picture');
        }
        if (_.intersection(labels,type.personTypes).length) {
          out.push('Person');
        }
      }
      return labels;
    }
  },
  addParents: function(n) {
      n.labels = _.uniq(n.labels.concat(api.list.parents(n.labels)));
      return n;
  }
};

module.exports = api; 
