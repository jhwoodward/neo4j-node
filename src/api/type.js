var cypher = require('./cypher');
var utils = require('./utils');
var changeCase = require('change-case');
var predicate = require('./predicate');
var  _ = require('lodash');

var api = {
  getAll: function() { return predicate.refreshList().then(getTypes); },
  reset: function() { return setLabels();}
};


function getTypes(predicates) {
  var propQuery = `
    match (n:Class) optional match (n) - [r:PROPERTY] -> (p:Property) 
    return n,collect(r),collect(p),null as  subtypes
    union match (n:Class) - [:EXTENDS*] -> (b:Class)-[r:PROPERTY]->(p:Property) 
    return n,collect(r),collect(p),collect(b) as subtypes
    `;
 //   union match (n:Class) <- [:EXTENDS*] - (b:Class)-[r:PROPERTY]->(p:Property) 
 //   return n,collect(r),collect(p),collect(b)
 //   `; // Backwards - for graphql return type only

  var relTypeQuery = `
    match (n:Class ) -[r] -> (c:Class)  where type(r)<>'EXTENDS'
    return n.Lookup,collect(type(r)),'out' as direction,collect(c.Lookup),collect(r)

    union 

    match (n:Class ) - [:EXTENDS*] -> (d:Class) - [r] -> (c:Class)  where type(r)<>'EXTENDS' 
    return n.Lookup,collect(type(r)),'out' as direction,collect(c.Lookup),collect(r)

    union 

    match (n:Class ) <-[r] - (c:Class) where type(r)<>'EXTENDS' 
    return n.Lookup,collect(type(r)),'in' as direction,collect(c.Lookup),collect(r)

    union 
    
    match (n:Class ) - [:EXTENDS*] -> (d:Class) <- [r] - (c:Class) where type(r)<>'EXTENDS' 
    return n.Lookup,collect(type(r)),'in' as direction,collect(c.Lookup),collect(r)
    `;
    /*
    union match (n:Class ) <- [:EXTENDS*] - (d:Class) - [r] -> (c:Class)  
  
    where type(r)<>'EXTENDS' 
    return n.Lookup,collect(type(r)),'out' as direction,collect(c.Lookup),collect(r)
    union match (n:Class ) <- [:EXTENDS*] - (d:Class) <- [r] - (c:Class)  
    where type(r)<>'EXTENDS' 
    return n.Lookup,collect(type(r)),'in' as direction,collect(c.Lookup),collect(r)
    `; // Backwards - for graphql return type only
*/

  var subtypesQuery = `
    match (n:Class) - [:EXTENDS*] -> (b:Class)
    return n.Lookup,collect(b.Lookup) as subtypes
    `;

  return cypher.executeStatements([propQuery, relTypeQuery, subtypesQuery]).
    then(function(results) {
      var types = {};

      results[0].data.forEach(function(pd) {
        var type = utils.camelCase(pd.row[0]);

        if (!type.lookup) {
          console.warn(`Type without lookup (id:${pd.row[0].id})`);
          return;
        }

        var props = pd.row[2].map(function(e) {
          var p = utils.camelCase(e);
          p.name = changeCase.camelCase(e.Lookup);
          delete p.lookup;
          if (!p.type) {
            p.type = 'string';
          }
          return p;
        });

        var subtypes = results[2].data.filter(function(item) { return type.lookup === item.row[0] });
        if (subtypes.length) {
           type.subtypes = subtypes[0].row[1];
        } else {
          type.subtypes = [];
        }
       

        var propsMetadata = pd.row[1].map(function(e) { 
          return { 
            required: e.Required || false 
          };
        });
   
        type.props = _.keyBy(_.merge(props, propsMetadata), 'name');

        type.reltypes = {};
 
        var rels = results[1].data.filter(function(item) { return type.lookup === item.row[0] });
 
        rels.forEach(function(e) {
          var relTypeNames = e.row[1];
          var classNames = e.row[3];
          var pred = relTypeNames.map(function(p) { return { predicate: predicates[p] };});
          var dir = _.fill(Array(pred.length), { direction: e.row[2] });
          var cls = classNames.map(function(c) { return { class: c }; });
          var merged = _.merge(pred, dir, cls);
          var reltypes = _.keyBy(merged , function(r) { 
                             return (r.direction === 'in' ? r.predicate.reverse.toLowerCase() :
                                r.predicate.lookup.toLowerCase())});
          type.reltypes = Object.assign(type.reltypes, reltypes);
        });

        // only add if it has props - otherwise it has no use
        if (Object.keys(type.props).length) {
          if (types[type.lookup]) {
            types[type.lookup] = _.merge(types[type.lookup], type);
          } else {
            types[type.lookup] = type;
          }
        }
      });

      return types;
    });
};

function setLabels() {
  //clear existing labels

  return api.getAll().then(function(types) {
    
    var statements = [];
    var typeLabels = Object.keys(types).join(':');
   // var typeLabels = types.map(function(t){return t.Lookup;}).join(':');

    //clear existing labels
    statements.push(cypher.buildStatement(`
    match(n) where not n:Class and not n:Predicate and not n:Property and not n:Schema 
    remove n:${typeLabels}
    `));

   
    Object.keys(types).forEach(function(key) {
      var t = types[key];
      var typelabels = t.subtypes;
      typelabels.push(t.lookup);
      if (typelabels.length) {
         statements.push(cypher.buildStatement(`
         match (n) - [:INSTANCE_OF] -> (c:Class {Lookup:'${key}'}) 
         set n._class='${key}', n:${typelabels.join(':')}`));
      }
    });

    return cypher.executeStatements(statements).then(function(resp) {
      return resp;
    });
    

  });
}

module.exports = api;
