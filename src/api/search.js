import cypher from './cypher';

const search = (q) => cypher.executeQuery(q, 'row').
  then((data) => {
    if (data) {
      return data.map((d) => ({
        id: d.row[0],
        lookup: d.row[1],
        class: d.row[2],
        label: d.row[3]
      }));
    }
    return [];
  });

// Searches are performed on the lookup property only as a 'contains' wildcard
const api = {
  label: (label, txt) => {
    let q;
    if (txt === '*') {
      q = `match (n:${label})  
                  return ID(n), n.Lookup, n._class, n.Label`;
    } else {
      q = `match (n:${label}) where n.Lookup =~ '(?i).*${txt}.*' 
                  return ID(n), n.Lookup, n._class, n.Label`;
    }
    return search(q);
  }
};

export default api;
