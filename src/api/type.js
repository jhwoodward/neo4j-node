var cypher = require('./cypher');
var utils = require('./utils');
var changeCase = require('change-case');
var predicate = require('./predicate');
var  _ = require('lodash');

function buildSchema(predicates) {
  var propQuery = `
    match (n:Class) optional match n - [r:PROPERTY] -> (p:Property) 
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
    union match (n:Class ) - [:EXTENDS*] -> (d:Class) - [r] -> (c:Class)  
    where type(r)<>'EXTENDS' 
    return n.Lookup,collect(type(r)),'out' as direction,collect(c.Lookup),collect(r)
    union match (n:Class ) <-[r] - (c:Class)  
    where type(r)<>'EXTENDS' 
    return n.Lookup,collect(type(r)),'in' as direction,collect(c.Lookup),collect(r)
    union match (n:Class ) - [:EXTENDS*] -> (d:Class) <- [r] - (c:Class)  
    where type(r)<>'EXTENDS' 
    return n.Lookup,collect(type(r)),'in' as direction,collect(c.Lookup),collect(r)
    
    union match (n:Class ) <- [:EXTENDS*] - (d:Class) - [r] -> (c:Class)  
    where type(r)<>'EXTENDS' 
    return n.Lookup,collect(type(r)),'out' as direction,collect(c.Lookup),collect(r)
    union match (n:Class ) <- [:EXTENDS*] - (d:Class) <- [r] - (c:Class)  
    where type(r)<>'EXTENDS' 
    return n.Lookup,collect(type(r)),'in' as direction,collect(c.Lookup),collect(r)
    `; // Backwards - for graphql return type only

  return cypher.executeStatements([propQuery, relTypeQuery]).
    then(function(results) {
      var types = {};

      results[0].data.forEach(function(pd) {
        var type = utils.camelCase(pd.row[0]);

        if (!type.lookup) {
          console.warn(`Type without lookup (id:${pd.row[0]})`);
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

        type.subtypes = [];
        if (pd.row[3]) {
          pd.row[3].forEach(function(e) {
            if (type.subtypes.indexOf(e.Lookup) === -1) {
              type.subtypes.push(e.Lookup);
            }
          });       
        } 

        var propsMetadata = pd.row[1].map(function(e) { 
          return { 
            required: e.Required || false 
          };
        });
   
        type.props = _.keyBy(_.merge(props, propsMetadata), 'name');
        type.props.id = { type: 'int', name: 'id', readonly: true };
        type.reltypes = {};
 
        var rels = results[1].data.filter(function(item) { return type.lookup === item.row[0] });
 
        rels.forEach(function(e) {
          var pred = e.row[1].map(function(p) { return { predicate: predicates[p] };});
          var dir = _.fill(Array(pred.length), { direction: e.row[2] });
          var cls = e.row[3].map(function(c) { return { class: c }; });
          var reltypes = _.keyBy(_.merge(pred, dir, cls)
                            , function(r) { 
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

module.exports = {
  getAll: function() { return predicate.refreshList().then(buildSchema); }
};
