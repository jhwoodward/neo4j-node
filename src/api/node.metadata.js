import cypher from './cypher';

const api = {

  saveWikipagename: n => {
    if (!n.wikipagename) {
      throw 'wikipagename not supplied';
    }
    if (!n.id) {
      throw 'no id supplied';
    }
    const statements = [];
    statements.push(cypher.buildStatement(`
      match(n) where ID(n)=${n.id} 
      set n.Wikipagename={page} 
      return n`,
      'row',
      { page: n.wikipagename }));

    return cypher.executeStatements(statements).
      then(results => results[0].data[0].row[0]);
  },
  saveMetadata: d => {
    const statements = [];
    // NB POOR ASSUMPTION !
    let q = d.imageUrl ?
      'match(n:Wga {ImageUrl:{imageUrl}}) ' :
      'match(n:Olga {ImageCache:{imageCache}}) ';

    if (d.page) {
      q += ' set  n.ImageRef={page}';
      if (d.title) {
        q += ',n.Title={title}';
      }
      if (d.date) {
        q += ',n.Date={date}';
      }
      if (d.type) {
        q += ',n.Medium={type}';
      }
      if (d.dimensions) {
        q += ',n.Dimensions={dimensions}';
      }
      if (d.collection) {
        q += ',n.Collection={collection}';
      }
      if (d.metadata) {
        q += ',n.Metadata={metadata}';
      }
      q += '  return n.ImageRef';
      statements.push(cypher.buildStatement(q, 'row', d));
    } else {
      q += ' set  n:NoRef';
    }
    statements.push(cypher.buildStatement(q, 'row', d));
    return cypher.executeStatements(statements);
  }
};

export default api;
