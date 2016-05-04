import cypher from './cypher';
import utils from './utils';
import changeCase from 'change-case';

const api = {
  init: () => {
    api.refreshList();
    return api;
  },
    // object containing all types keyed on Lookup
  list: {},
  isType: label => api.list[label] !== undefined,
  refreshList: () => cypher.executeQuery(
            // NB types would require at least one property to show up here
            'match (n:Type)-[r:PROPERTY]->(p:Property) return n,collect(r),collect(p),labels(n)',
                'row')
                .then(data => {
                  const types = {};
                  for (let i = 0; i < data.length; i++) {
                    const d = data[i];
                    const t = utils.camelCase(d.row[0]);
                    const labels = d.row[3];

                    if (t.lookup) {
                      const type = {
                        lookup: t.lookup,
                        description: t.description,
                        props: {},
                        isSystem: labels.indexOf('SystemInfo') > -1,
                        isGlobal: labels.indexOf('Global') > -1
                      };
                      if (t.systemInfo) {
                        type.systemInfo = t.systemInfo;
                      }
                      // Relationship has metadata such as 'Required' true/false
                      const rels = d.row[1];
                      const props = d.row[2];
                      for (let j = 0; j < props.length; j++) {
                        const p = utils.camelCase(props[j]);
                        const propName = changeCase.camelCase(p.lookup);
                        const rel = utils.camelCase(rels[j]);
                        const prop = {
                          name: propName,
                          required: (rel && rel.required) || false,
                          type: p.type || 'string',
                        };
                        type.props[propName] = prop;
                      }
                      types[t.lookup] = type;
                    } else {
                      console.warn(`Type without lookup (id:${d.row[0]})`);
                    }
                  }
                  api.list = types;
                  return types;
                })
};

export default api.init();
