var cypher = require('./cypher');
var utils = require('./utils');
var _ = require('lodash');

function Predicate(data) {
    _.extend(this, data);
}
    
Predicate.prototype.setDirection = function(direction) {
    this.direction = direction;
    return this;
};
  
Predicate.prototype.toString = function() {
  if (this.direction === 'in' && !this.symmetrical) {
    if (this.reverse){//use reverse if present
      return this.reverse.replace(/_/g, ' ').toLowerCase();
    } else {
      var lookup = this.lookup.toUpperCase();
      if (lookup === 'CREATED' || lookup === 'CREATES') {
          return 'created by'; 
      } else if (lookup === 'INFLUENCES') {
          return 'influenced by'; 
      } else if (lookup === 'INSPIRES') {
          return 'inspired by'; 
      } else if (lookup === 'ANTICIPATES') {
          return 'anticipated by'; 
      } else if (lookup === 'DEVELOPS') {
          return 'developed by'; 
      } else if (lookup === 'DEPICTS') {
          return 'depicted by'; 
      } else if (lookup === 'TYPE_OF') {
          return 'type(s)'; 
      } else {
          return '(' + this.lookup.replace(/_/g, ' ').toLowerCase() + ')';
      }
    }
  }
  return this.lookup.replace(/_/g, ' ').toLowerCase();
};
  
Predicate.prototype.flip = function () {
  if (!this.isDirectional) {
    return;
  }
  if (this.direction === 'in') {
    this.setDirection('out');
  } else {
    this.setDirection('in');
  }
  return this;

};

var api = {
  init: function() {
    api.refreshList();
    return api;
  },
  //can pass in active or reverse INFLUENCES OR INFLUENCED_BY
  get: function(lookup) {
    var p = api.list[lookup];
    if (!p) {
      console.warn('Predicate ' + lookup + ' does not exist in DB');
      p = {
        lookup: lookup,
        reverse: '(' + lookup + ')'
        };
    }
    return new Predicate(p);
  },
  //object containing all predicates keyed on Lookup
  list: {},
  refreshList: function () {
    return cypher.executeQuery('match (n:Predicate) return ID(n),n','row')
      .then(function (data) {
        var predicates = {};
        for (var i =0; i < data.length; i++) {
          var d = data[i];
          var symmetrical = d.row[1].Symmetrical || false;
            if (d.row[1].Lookup) {
              predicates[d.row[1].Lookup] = {
                lookup: d.row[1].Lookup,
                force: d.row[1].Force,//Attract or Repel
                symmetrical:symmetrical,
                reverse: symmetrical ? d.row[1].Lookup : d.row[1].Reverse 
              };
          } else {
              console.warn('Predicate without lookup (id:' + d.row[0] + ')');
          }
        }
        api.list = predicates;
        return predicates;
    });
  }
};

module.exports = api.init();
