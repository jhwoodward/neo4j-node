import type from './type';
import predicate from './predicate';
import cypher from './cypher';
import changeCase from 'change-case';
import _ from 'lodash';

const api = {
  list:{
    // Alternatively i could query the actual labels and merge them into a distinct array
    distinct: (labels) => {
      let q;
      if (labels) {
        q = `match (n:${labels.join(':')}) return distinct(LABELS(n))`;
      }
      else {
        q = req.body.q;
      }
      return cypher.executeQuery(q).then(data => {
        const output = [];
        for (let i = 0; i < data.length; i++) {
          const val = data[i];
          for (let j = 0; j < val.row[0].length; j++) {
            const label = val.row[0][j];
            if (output.indexOf(label) === -1) {
              output.push(label);
            }
          }
        }
        return output;
      });
    }
    ,
    // if the node has any values in its labels array api match picture or person types
    // the corresponding parent label is added to the array
    // The array is uniqued before returning
    parents: (labels) => {
      const out = [];
      if (labels && labels.length)
        {
        if (_.intersection(labels, type.pictureTypes).length) {
          out.push('Picture');
        }
        if (_.intersection(labels, type.personTypes).length) {
          out.push('Person');
        }
      }
      return labels;
    }
  }
    ,
  addParents:(n) => {
    n.labels = _.uniq(n.labels.concat(api.list.parents(n.labels)));
    return n;
  }
};



export default api;
