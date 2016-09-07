var config = require('../api.config');
var txUrl = config.neo4j.root + '/db/data/transaction/commit';
  
function cypher(statements, transform) {
  var r = require('request-promise');
  
  return r.post({
    uri: txUrl,
    method: 'POST',
    json: { statements: statements },
    headers: {
      'Authorization': config.neo4j.password
    },
    transform: transform
  });
}

function NeoError(err, q) {
  // See https://code.google.com/p/v8/wiki/JavaScriptStackTraceApi    
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, NeoError);
  } else {
    this.stack = (new Error()).stack || '';
  }
  
  this.error = err.code;
  this.message = err.message;
  this.query = q;
}

NeoError.prototype = Object.create(Error.prototype);
NeoError.prototype.constructor = NeoError;

function isEmpty(obj) {
  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      return false;
    }
  }
  return true;
}

var api = {
  buildStatement: function (q, type, params, includeStats) {
    var out = { 'statement': q, 'includeStats': includeStats ? true : false };
    if (params && !isEmpty(params)) {
        out.parameters = params;
    }
    if (type) {
        out.resultDataContents = [type];
    }
    return out;
  },
  executeStatements: function (statements) {
    //check api each statement is a statement and not just a query
    statements = statements.map(function(s){
      if (!s.statement) {
        s = api.buildStatement(s);
      }
      return s;
    });
    return cypher(statements).then(function (d) {
      if (d.errors.length) {
        throw (new NeoError(d.errors[0], statements));
      } else {
        return d.results;
      }
    });
  }, 
  executeQuery: function (q, type, params) { //type = graph or row
    var statements = [api.buildStatement(q, type, params)];
    return cypher(statements).then(function (d) {
      if (d.errors.length) {
        throw (new NeoError(d.errors[0], statements));
      }
      else if (d.results.length) {
        return d.results[0].data;
      }
      else {
        return null;
      }
    });
  }
};

module.exports = api;  
