import _ from 'lodash';
import image from './image';
import label from './label';
import utils from './utils';
import type from './type';
import cypher from './cypher';
import relationship from './relationship';
import changeCase from 'change-case';

const parseNodeData = (data) => {
  const n = utils.camelCase(data[0].row[0]);
  if (data[0].row[1]) {
    n.id = data[0].row[1];
  }
  if (data[0].row[2]) {
    n.labels = data[0].row[2];
    if (n.labels) {
      n.labels = n.labels.sort();
    }
  }
  return n;
};

const getNode = (match, where) => {
  const q = `
      match(${match} where ${where}
      with n optional match (${match}) -[:IMAGE] - (i:Image:Main)
      return n,ID(n),LABELS(n),i`;

  return cypher.executeQuery(q)
    .then((data) => {
      if (data.length) {
        const n = parseNodeData(data);
        if (data[0].row[3]) {
          n.image = image.configure(data[0].row[3]);
        }
        return n;
      }
      return null;
    });
};

const getNodeById = id => getNode('n', `ID(n) = ${id}`);

const getNodeByLabel = lab => getNode('n:Label', `n.Label = ${lab}`);

const addRelationships = n => relationship.list.conceptual(n).
  then(r => {
    if (Object.keys(r).length) {
      n.relationships = r;
    }
    return n;
  });

// returns a new property object for the node
// --removes any empty propertes
// --removes id property as this is internal to neo4j
// --removes labels property as this is persisted with labels in neo4j
// --remove temp property as this data should not be persisted
const trimForSave = n => {
  const props = {};
  Object.keys(n).forEach(key => {
    if (n[key] !== null &&
        n[key] !== undefined &&
        n[key] !== '' &&
        key !== 'labels' &&
        key !== 'labelled' &&
        key !== 'relationships' &&
        key !== 'image' &&
        key !== 'id' &&
        key !== 'temp' &&
        key !== 'schema' &&
        key !== 'web') {
      props[key] = n[key];
    }
  });
  return utils.pascalCase(props);
};

const createRelationships = n => {
  const statements = [];
  Object.keys(n.relationships).forEach(prop => {
    const rel = n.relationships[prop];
    for (let i = 0; i < rel.items.length; i++) {
      statements.push(relationship.createStatement(n, rel.predicate, rel.items[i]));
    }
  });
  return cypher.executeStatements(statements);
};

const updateRelationships = n => relationship.difference(n).
  then(diff => {
    if (diff.length) {
      const statements = [];
      for (let c = 0; c < diff.length; c++) {
        const changed = diff[c];
        for (let i = 0; i < changed.add.length; i++) {
          statements.push(relationship.createStatement(n, changed.predicate, changed.add[i]));
        }
        for (let i = 0; i < changed.remove.length; i++) {
          statements.push(relationship.removeStatement(n, changed.predicate, changed.remove[i]));
        }
      }
      return cypher.executeStatements(statements);
    }
    return null;
  });
  
const get = (id) => {
  const parsed = utils.parseIdOrLabel(id);
  if (parsed.id) {
    return getNodeById(parsed.id);
  }
  if (parsed.label) {
    return getNodeByLabel(parsed.label);
  }
};

const updateProperties = n => {
  const q = 'match(n) where ID(n)={id} set n={props} return n,ID(n),LABELS(n)';
  return cypher.executeQuery(q, 'row', { id: n.id, props: trimForSave(n) }).
    then(parseNodeData);
};

const updateLabels = n => {
  label.addParents(n);
  n.labels = utils.pascalCase(n.labels);
  const statements = [];
  return api.get(n).
    then(existing => {
      const arrLabelsToRemove = _.difference(existing.labels, n.labels);
      const arrLabelsToAdd = _.difference(n.labels, existing.labels);
      if (arrLabelsToAdd.length || arrLabelsToRemove.length) {
        const sAddLabels = '';
        if (arrLabelsToAdd.length) {
          sAddLabels = ` set n:${arrLabelsToAdd.join(':')}`;
        }
        const sRemoveLabels = '';
        if (arrLabelsToRemove.length) {
          sRemoveLabels = ` remove n:${arrLabelsToRemove.join(':')}`;
        }
        statements.push({ statement: `match(n) where ID(n)=${n.id} ${sRemoveLabels} ${sAddLabels}` });
      }
      if (existing.label && existing.label != n.label && n.label) {
        statements.push({ statement: `match(n:${existing.label}) remove n:${existing.label} set n:${n.label}` });
      }
      if (statements.length) {
        return cypher.executeStatements(statements);
      }
    });
};

const getSchema = (labels) => {
  let label, t, schema = {};
  for (let i = 0; i < labels.length; i++) {
    label = labels[i];
    t = type.list[changeCase.camelCase(label)];
    if (!t) continue;// ignore if label does not have a type definition

        // can't use extend because need to ensure api required=true
        // always takes precendence over required=false
    for (let key in t.props) {
      let required = false;
      if (schema[key])
            {
        required = schema[key].required;
      }
      schema[key] = t.props[key];
      if (required) {
        schema[key].required = true;
      }
    }
  }
  return schema;
};

const addSchema = (n) => {
  n.schema = getSchema(n.labels);
  return n;
};



const api = {
    // get node by (internal)ID or label
  get,
    // Get node by (internal ID) or label
    // Add relationships
  getWithRels: (id) => {
    const parsed = utils.parseIdOrLabel(id);
    if (parsed.id) {
      return getNodeById(parsed.id)
            .then(addRelationships);
    }
    if (parsed.label) {
      return getNodeByLabel(parsed.label)
            .then(addRelationships);
    }
  }
    ,
    // TODO:
    // for labels (types), type hierachy needs to be enforced - eg if Painter then add Person:Global,-----------------DONE
    // if Painting the add Picture:Creation. These will need to be kept updated.
    // when Lookup is updated, the corresponding label needs to be renamed MATCH (n:OLD_LABEL)  REMOVE n:OLD_LABEL SET n:NEW_LABEL--------------- DONE
    // when updating Type, label needs to be updated, when creating----------------------DONE
    // When we come to modifying labels on creations, their relationships will need to be kept updated
  save: (n, user) => {
    if (n.id > -1) {
      return api.update(n, user);
    }
    else {
      return api.create(n, user);
    }
  }
    ,
    // n can be an object with any properties
    // the following properties have special meaning:
    // --id: must not be > -1 as this indicates an existing node
    // --labels: an array of strings. The node will be saved with these neo4j labels. Required.
    // --temp.relationships: relationships defined as properties. Not Required.
    // --temp.links: links .. ??? Not Required
    // user is an optional parameter
    // --if supplied and user exists a 'created' relationship is added
    // Following save each rel is created as a neo4j relationship
  create:(n, user) => {
    if (n.id > -1) throw ('Node must have ID < 0 for insert');
    if (!(n.labels instanceof Array)) throw ('Node must have labels array property');

    label.addParents(n);
    n.labels = utils.pascalCase(n.labels);
    const q = `create (n:${n.labels.join(':')} {props}) with n set n.created=timestamp() `;

        // if user passed as second argument create a link to the user from this node
    if (user) {
      q += ` with n  MATCH (u:User {Lookup:'${user.lookup}'}) create (u) - [s:CREATED]->(n)`;
    }
    q += ' return n,ID(n)';

    return cypher.executeQuery(q, 'row', { 'props': api.trimForSave(n) })
            .then((result) => {
              n = Object.assign(n, parseNodeData(result));
              return createRelationships(n);
            })
            .then(() => {
              return api.getWithRels(n);
            });
  },
  update: (n, user) => {

    if (n.id <= -1) throw ('Node must have ID >=0 for update');

        // NB Have to update labels before properties in case label property has been modified
    return updateLabels(n).
                then(function () {
                  return updateProperties(n);
                }).
                then(function () {
                  return updateRelationships(n);
                }).
                then(function () {
                  return api.getWithRels(n);
                });
  },
    // Deletes node and relationships forever
  destroy: function (node) {
    const q = `match (n) where ID(n)=${node.id} OPTIONAL MATCH (n)-[r]-() delete n,r`;
    return cypher.executeQuery(q);
  },
    // Logical delete (relationships are left intact)
    // --removes labels and adds label Deleted
    // --sets property deleted = timestamp
    // --stores labels in oldlabels property
  delete: function (node) {
    if (!node || !node.id) {
      throw 'node not supplied';
    }
    const q = `
          match(n)  where ID(n)=${node.id} remove n:${node.labels.join(':')}
          set n:Deleted,n.oldlabels={labels},n.deleted=timestamp()
          return n,ID(n),LABELS(n)
        `;
    return cypher.executeQuery(q, 'row', { 'labels': node.labels }).then(parseNodeData);
  },
  // Removes 'Deleted' label and restores old labels
  // Currently requires the 'oldlabels' property to be present on the node
  restore: (node) => {
    if (!node || !node.id) {
      throw 'node not supplied';
    }
    const q = `
          match(n)  where ID(n)=${node.id} set n:${node.oldlabels.join(':')}
         remove n:Deleted, n.oldlabels, n.deleted 
         return n,ID(n),LABELS(n)`;

    return cypher.executeQuery(q).then(parseNodeData);
  },
  getSchema: (id) => {
    return api.getLabels(id).then(labels => {
      return getSchema(labels);
    });
  },
  getLabels: (id) => {
    const q = `${utils.getMatch(id)} with n return LABELS(n)`;
    return cypher.executeQuery(q).then(data => {
      if (data.length) {
        return data[0].row[0];
      }
      else {
        return [];
      }
    });
  },
  list:{
    // Returns an array of nodes api have this label
    labelled: (label, limit) => {
      limit = limit || 500;
      const q = `match (n:${changeCase.pascalCase(label)}) 
      return ID(n),n limit ${limit}`;
      return cypher.executeQuery(q).
        then(data => {
          const labelled = [];
          for (const i = 0; i < data.length; i++) {
            let item = utils.camelCase(data[i].row[1]);
            item.id = data[i].row[0];
            labelled.push(item);
          }
          return labelled;
        });
    }
  }
};

export default api;
