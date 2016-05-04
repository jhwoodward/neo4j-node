import cypher from './cypher';

const api = {
  get: (userLookup) => {
    const statements = [];
    statements.push(cypher.buildStatement(`match (n:User {Lookup:'${userLookup}'}) return n`
      , 'row'));
    statements.push(cypher.buildStatement(`match (n:User {Lookup:'${userLookup}'}) - [r:FAVOURITE] 
      - (f:Favourite) - [] -> (item) return ID(item)`
      , 'row'));
    return cypher.executeStatements(statements).
      then(results => {
        const user = results[0].data[0].row[0];
        user.favourites = {};
        for (let i = 0; i < results[1].data.length; i++) {
          const fav = results[1].data[i];
          const favNodeId = fav.row[0];
          user.favourites[favNodeId] = { id: favNodeId };
        }
        return user;
      });
  },
  saveFavourite: (node, user) => {
    const statements = [];
    const s = `
      create (n:Favourite:${user.Lookup} {created:timestamp()})
      with n MATCH (b),(u:User {Lookup:'${user.Lookup}'}) 
      where  ID(b) = ${node.id} create (u) - [s:FAVOURITE]->(n)-[r:FAVOURITE]->(b)
      return ID(r),ID(s)
      `;
    statements.push(cypher.buildStatement(s, null, null, true));
    return cypher.executeStatements(statements);
  }
};

export default api;
