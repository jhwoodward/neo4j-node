import utils from './utils';
import cypher from './cypher';
import image from './image';
import relationship from './relationship';
import changeCase from 'change-case';
import _ from 'lodash';

const getPicture = (id) => {
  const q = `${utils.getMatch(id, 'n', ':Picture')} 
  with n optional match (n) - [:IMAGE] -> (i:Image)  
  return n,ID(n),LABELS(n),i,ID(i),LABELS(i)
  `;
  return cypher.executeQuery(q, 'row').
  then((data) => {
    if (data.length) {
      const n = utils.camelCase(data[0].row[0]);
      n.id = data[0].row[1];
      n.labels = data[0].row[2];
      if (n.labels) n.labels.sort();
      n.images = [];
      for (let i = 0; i < data.length; i++) {
        if (data[i].row[3]) {
          const img = utils.camelCase(data[i].row[3]);
          img.id = data[i].row[4];
          img.labels = data[i].row[5];
          image.configure(img);
          n.images.push(img);
        }
      }
      return n;
    }
    return null;
  });
};

const getList = (q, options) => {
  if (options) {
    if (options.pageSize) {
      options.pageSize = parseInt(options.pageSize, 10);
    }
    if (options.pageNum) {
      options.pageNum = parseInt(options.pageNum, 10);
    }
    if (options.sort && options.sort !== 'created') {
      options.sort = changeCase.pascalCase(options.sort);
    }
  }

  const defaults = {
    pageNum: 1,
    pageSize: 20,
    sort: 'created',
    sortOrder: 'DESC'
  };

  options = Object.assign({}, defaults, options);
  const startIndex = (options.pageNum - 1) * options.pageSize;
  let query = `
      ${q} return p,ID(p),LABELS(p),i,ID(i) 
      order by p.${options.sort} ${options.sortOrder}
    `;
  if (startIndex > 0) {
    query += ` skip ${startIndex}`;
  }
  query += ` limit ${options.pageSize}`;

  const count = `${q} return count(p)`;
  const statements = [query, count];
  const out = { options, q: query, count: 0, items: [] };

  return cypher.executeStatements(statements)
    .then((results) => {
      out.count = results[1].data[0].row[0];
      const data = results[0].data;
      for (let i = 0; i < data.length; i ++) {
        const props = utils.camelCase(data[i].row[0]);
        let p;
        if (options.format === 'compact') {
          p = { id: data[i].row[1], title: props.title };
        } else {
          p = Object.assign(props, {
            id: data[i].row[1],
            labels: data[i].row[2]
          });
        }
        p.image = image.configure(data[i].row[3], options);
        p.image.id = data[i].row[4];
        out.items.push(p);
      }
      return out;
    });
};

const labelQuery = (labels) => {
  labels = labels.split(',')
                        .map(label => changeCase.pascalCase(label))
                        .join(':');
  return `
          match (p:Picture) - [:IMAGE] -> (i:Image:Main)
          where not p:CacheError and not p:NotFound  and p:${labels}
        `;
};

const propertyQuery = (property) => {
  property.name = changeCase.pascalCase(property.name);
  return `
      match (p:Picture) - [:IMAGE] -> (i:Image:Main)
      where  not p:CacheError and not p:NotFound 
      and p.${property.name}=~ '(?i).*${property.value}.*'
      `;
};

const predicateQuery = (predicate) => {
  let relType = predicate.lookup.toUpperCase();
  if (relType === 'OF') {
    relType += '|:DEPICTS';
  }
  return `
      ${utils.getMatch(predicate.target)}
      with n match (n) <- [:${relType}] - (p:Picture) - [:IMAGE] -> (i:Image:Main) 
      where  not p:CacheError and not p:NotFound 
      `;
};

const api = {
    // Same as get node except api all images are returned instead of just the main one
  get: id => getPicture(id),
  getWithRels: id => getPicture(id).
    then(n => relationship.list.conceptual(n).
      then(r => {
        n.relationships = r;
        return relationship.list.visual(n).
          then(v => {
            n.relationships = _.merge(n.relationships, v);
            return n;
          });
      })
      ),
  list: {
    predicate: (params, options) => {
      const q = predicateQuery({ lookup: params.predicate, target: params.id });
      return getList(q, options);
    },
    labelled: (params, options) => {
      const q = labelQuery(params.labels);
      return getList(q, options);
    },
    property: (params, options) => {
      const q = propertyQuery({ name: params.prop, value: params.val });
      return getList(q, options);
    }
  }
};

export default api;

