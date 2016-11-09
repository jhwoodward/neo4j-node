var _ = require('lodash');
var image = require('./image');
var label = require('./label');
var utils = require('./utils');
var type = require('./type');
var cypher = require('./cypher');
var graph = require('./graph');
var relationship = require('./relationship');
var changeCase = require('change-case');
var predicate = require('./predicate');
var merge = require('deepmerge');

var api = {
  //get node by (internal)ID or label
  get: function (id) {
    var parsed = utils.parseIdOrLabel(id);
    if (parsed.id) {
      return getNodeById(parsed.id);
    }
    if (parsed.label) {
      return getNodeByLabel(parsed.label) ;
    }
  },
  //Get node by (internal ID) or label
  //Add relationships
  getWithRels: function (id) {
    var parsed = utils.parseIdOrLabel(id);
    if (parsed.id) {
      return getNodeById(parsed.id)
        .then(addRelationships);
    }
    if (parsed.label) {
      return getNodeByLabel(parsed.label)
        .then(addRelationships);
    }
  },
  //returns a new property object for the node
  //--removes any empty propertes
  //--removes id property as this is internal to neo4j
  //--removes labels property as this is persisted with labels in neo4j
  //--remove temp property as this data should not be persisted
  trimForSave : function (n) {
    var props = {};
    for (var key in n)
    {
      if (n[key] !== null && n[key] !== undefined && n[key] !== '' &&
        key !== 'labels' && 
        key !== 'labelled' && 
        key !== 'relationships' && 
        key !== 'image' && 
        key !== 'id' && 
        key !== 'temp' &&
        key !== 'schema' &&
        key !== 'web') {//web links ?? not implemented yet
        props[key] = n[key];
      }
    }
    return utils.pascalCase(props);
  },
  //TODO: 
  //for labels (types), type hierachy needs to be enforced - eg if Painter then add Person:Global,-----------------DONE
  //if Painting the add Picture:Creation. These will need to be kept updated.
  //when Lookup is updated, the corresponding label needs to be renamed MATCH (n:OLD_LABEL)  REMOVE n:OLD_LABEL SET n:NEW_LABEL--------------- DONE
  //when updating Type, label needs to be updated, when creating----------------------DONE
  //When we come to modifying labels on creations, their relationships will need to be kept updated
  save: function (n, user) {
    if (n.id > -1) { 
      return api.update(n, user);
    } else {
      return api.create(n, user);
    }
  },
  saveImage: function(n) {
    var args = { 'nodeid': n.id, 'imageid': n.image.id };
    var removeMain = cypher.buildStatement('match (n)-[r:IMAGE {Main:true}]->(i:Image) where ID(n)={nodeid} set r.Main=false','row',args);
    var addMain = cypher.buildStatement('match (n),(i) where ID(i) = {imageid} and ID(n)={nodeid} MERGE (n)-[:IMAGE {Main:true}]->(i)','row',args);

    return cypher.executeStatements([removeMain, addMain])
      .then(function (result) {
        
        return result.length ===0;
      });
  },
  //n can be an object with any properties
  //the following properties have special meaning:
  //--id: must not be > -1 as this indicates an existing node
  //--labels: an array of strings. The node will be saved with these neo4j labels. Required.
  //--temp.relationships: relationships defined as properties. Not Required.
  //--temp.links: links .. ??? Not Required
  //user is an optional parameter
  //--if supplied and user exists a 'created' relationship is added
  //Following save each rel is created as a neo4j relationship
  create: function(n, user) {
    if (n.id > -1) { throw ('Node must have ID < 0 for insert'); }
    if (!(n.labels instanceof Array)) { throw ('Node must have labels array property'); }

    label.addParents(n);
    n.labels = utils.pascalCase(n.labels);
    var q = 'create (n:' + n.labels.join(':') + ' {props}) with n set n.created=timestamp() ';
    //if user passed as second argument create a link to the user from this node
    if (user) {
      q += ' with n  MATCH (u:User {Lookup:\'' + user.lookup + '\'})  create (u) - [s:CREATED]->(n)';
    }
    q += ' return n,ID(n)';

    return cypher.executeQuery(q, 'row', { 'props': api.trimForSave(n) })
      .then(function (result) {
          n = _.extend(n, parseNodeData(result));
          return createRelationships(n);
      })
      .then(function() {
          return api.getWithRels(n);
      });
  },
  update:function(n, user) {
    if (n.id <= -1) { throw ('Node must have ID >=0 for update'); }
    //NB Have to update labels before properties in case label property has been modified
    return  updateLabels(n)
      .then(function() {
        return updateProperties(n);
      })
      .then(function() {
        return updateRelationships(n);
      })
      .then(function() {
        return api.getWithRels(n);
      });
  },
  //Deletes node and relationships forever
  destroy: function (node) {
   // var q = 'match (n) where ID(n)=' + node.id + '  OPTIONAL MATCH (n)-[r]-()  delete n,r';
   // return cypher.executeQuery(q);
  },
  //Logical delete (relationships are left intact)
  //--removes labels and adds label Deleted
  //--sets property deleted = timestamp
  //--stores labels in oldlabels property
  delete: function (node) {
    if (!node || !node.id){
      throw 'node not supplied';
    }
    var q = 'match(n)  where ID(n)=' + node.id + '  remove n:' + node.labels.join(':');
    q += ' set n:Deleted,n.oldlabels={labels},n.deleted=timestamp()  return n,ID(n),LABELS(n)';
    return cypher.executeQuery(q, 'row', { labels: node.labels })
      .then(parseNodeData);
  },
  //Removes 'Deleted' label and restores old labels
  //Currently requires the 'oldlabels' property to be present on the node
  restore: function (node) {
    if (!node || !node.id){
      throw 'node not supplied';
    }
    var q = 'match(n)  where ID(n)=' + node.id + '  set n:' + node.oldlabels.join(':');
    q += ' remove n:Deleted,n.oldlabels,n.deleted return n,ID(n),LABELS(n) ';
    return cypher.executeQuery(q)
      .then(parseNodeData);
  },
  getLabels: function(id) {
    var q = utils.getMatch(id) + ' with n return LABELS(n)';
    return cypher.executeQuery(q)
    .then(function (data) {
      if (data.length) {
        return data[0].row[0];
      } else {
        return [];
      }
    });
  },
  list: {
    //returns an array of nodes api have this label
    labelled: function (label, limit) {
      limit = limit || 500;
      var q = 'match (n:' + changeCase.pascalCase(label) + ') return ID(n),n limit ' + limit;
      return cypher.executeQuery(q).then(function (data) {
          var labelled = [];
          for (var i = 0; i < data.length; i++) {
              var item = utils.camelCase(data[i].row[1]);
              item.id = data[i].row[0];
              labelled.push(item);
          }
          return labelled;
      });
    }
  }
};

module.exports = api;

function parseNodeData(data) {
  var n = utils.camelCase(data[0].row[0]);
  if (data[0].row[1]){
    n.id = data[0].row[1];
  }
  if (data[0].row[2]){
    n.labels = data[0].row[2];
    if (n.labels) {
      n.labels = n.labels.sort();
    }
  }
  return n;
}

//read
function getNode(match, where) {
  var q = 'match(' + match + ')  where ' + where;
  q += ' with n optional match (n) -[:INSTANCE_OF] -> (t:Class)';
  q += ' with n,t optional match (n) -[:IMAGE {Main:true}] -> (i:Image)';
  q += ' return n,ID(n),LABELS(n),collect(t.Lookup),collect(i) ';
  return cypher.executeQuery(q)
    .then(function (data) {
      if (data.length) {
        var n = parseNodeData(data);

        if (n.class) {
          delete n.class;
        }
        n.type = data[0].row[3][0];
        
        var imageData = data[0].row[4][0];
        if (image) {
            n.image = image.configure(imageData);
        }
    
        return n;
      } else {
          return null;
      }
    });
}

//read
function getNodeById(id) {
  return getNode('n', 'ID(n) = ' + id );
}

//read
function getNodeByLabel(label) {
  return getNode('n:Label', 'n.Label = \'' + label + '\'');
}

//read
function addRelationships(n) {
  return relationship.list.conceptual(n)
    .then(function(r) {
      if (Object.keys(r).length) {
        n.relationships=r;
      }
      return n;
  });
}

//write
//Create relationships for node n
//requires presence of n.relationships
function createRelationships(n) {
  var i, prop, rel, statements = [];
  for (prop in n.relationships) {
    rel = n.relationships[prop];
    for (i = 0; i < rel.items.length; i++) {
      statements.push(relationship.buildCreateStatement(n, rel.predicate, rel.items[i]));
    }
  }
  return cypher.executeStatements(statements);
}

//write
function updateRelationships(n) {
  //check passed in node against saved node for differences
  return relationship.difference(n)
    .then(function(diff) {
      if (diff.length){
        var i, statements = [];
        for (var c = 0; c < diff.length; c++){
          var changed = diff[c];
          for (i = 0; i < changed.add.length; i++) {
            statements.push(relationship.buildCreateStatement(n,changed.predicate, changed.add[i]));
          }
          for (i = 0; i < changed.remove.length; i++) {
            statements.push(relationship.buildRemoveStatement(n,changed.predicate, changed.remove[i]));
          }
        }
        return cypher.executeStatements(statements);
      }
  });
}

//write
function updateProperties(n) {
  //update props
  var q = 'match(n) where ID(n)={id} set n={props} return n,ID(n),LABELS(n)';
  return cypher.executeQuery(q, 'row', { 'id': n.id,'props': api.trimForSave(n) })
    .then(parseNodeData);
}

//write
function updateLabels(n) {
  label.addParents(n);
  n.labels = utils.pascalCase(n.labels);
  var statements = [];
  //check passed in node against saved node for differences
  return api.get(n)
    .then(function(existing) {
      var arrLabelsToRemove = _.difference(existing.labels, n.labels);
      var arrLabelsToAdd = _.difference(n.labels, existing.labels);
      
      if (arrLabelsToAdd.length || arrLabelsToRemove.length) {
        var sAddLabels = '';
        if (arrLabelsToAdd.length) {
          sAddLabels = ' set n:' + arrLabelsToAdd.join(':');
        }
        var sRemoveLabels = '';
        if (arrLabelsToRemove.length) {
          sRemoveLabels = ' remove n:' + arrLabelsToRemove.join(':');
        }
        statements.push({ statement: 'match(n) where ID(n)=' + n.id + sRemoveLabels + sAddLabels });
      }
      
      //update item labels if changing Label property
      if (existing.label && existing.label !== n.label && n.label) {
        statements.push({ statement: 'match(n:' + existing.label + ') remove n:' + existing.label + ' set n:' + n.label });
      }
      
      if (statements.length) {
        return cypher.executeStatements(statements);
      }  
  });
}
