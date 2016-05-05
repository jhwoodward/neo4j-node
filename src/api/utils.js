import changeCase from 'change-case';
import _ from 'lodash';

const api = {
    // Provide match to match on label(s) eg :Picture
  getMatch: (id, alias, match) => {
    match = match || '';
    alias = alias || 'n';
    const parsed = api.parseIdOrLabel(id);
    console.log(parsed);
    let q;
    if (parsed.id) {
      q = `match (${alias + match}) where ID(${alias}) = ${parsed.id}`;
    } else if (parsed.label) {
      q = `match (${alias + match}:Label) where ${alias}.Label = '${parsed.label}'`;
    }
    return q;
  },
  parseIdOrLabel: id => {
    if (isNaN(id)) {
        // Handle possibility of node object being passed in
        // instead of just the id
      if (id.id) {
        return { id: id.id };
      } else if (typeof id === 'string') {
        return { label: changeCase.pascalCase(id) };
      }
    }
    return { id };
  },
  camelCase: props => {
    const out = {};
    Object.keys(props).forEach((key) => {
      out[changeCase.camelCase(key)] = props[key];
    });
    return out;
  },
  pascalCase: obj => {
    if (_.isArray(obj)) {
        // Array - pascal case array values
      for (let i = 0; i < obj.length; i++) {
        obj[i] = changeCase.pascalCase(obj[i]);
      }
      return obj;
    }
    // Object - pascal case property keys
    const out = {};
    Object.keys(obj).forEach((key) => {
      out[changeCase.pascalCase(key)] = obj[key];
    });
    return out;
  },
  isEmpty: obj => Object.keys(obj).length === 0 &&
  JSON.stringify(obj) === JSON.stringify({}),
  // Compares to object arrays
  // returning any elements api are in 'a' but not in 'b'
  difference: (a, b, compareOn) => {
    compareOn = compareOn || 'id';
    const aComp = a.map(e => e[compareOn]);
    const bComp = b.map(e => e[compareOn]);
    return _.difference(aComp, bComp)
        .map(e => {
          const out = {};
          out[compareOn] = e;
          return out;
        });
  }
};


export default api;
