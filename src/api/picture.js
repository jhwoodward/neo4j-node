var utils = require('./utils');
var type = require('./type');
var cypher = require('./cypher');
var image = require('./image');
var graph = require('./graph');
var relationship = require('./relationship');
var changeCase = require('change-case');
var _ = require('lodash');

function getPicture(id) {
  var q= utils.getMatch(id,'n',':Picture') + ' with n optional match (n) - [:IMAGE {Main:true}] -> (i:Image)  return n,ID(n),LABELS(n),i,ID(i),LABELS(i) ';
  return cypher.executeQuery(q, 'row')
    .then(onLoaded);

  function onLoaded (data) {
    if (data.length) {
      var n = utils.camelCase(data[0].row[0]);
      n.id = data[0].row[1];
      n.labels = data[0].row[2];
      if (n.labels) { n.labels.sort(); }
      n.images = [];
      for (var i=0;i < data.length;i++) {
        if (data[i].row[3]) {
          var img = utils.camelCase(data[i].row[3]);
          img.id = data[i].row[4];
          img.labels= data[i].row[5];
          image.configure(img);
          n.images.push(img);
        }
      }
      return n;
    } else {
      return null;
    }
  }
}

function getList(q, options) {
  if (options) {
    if (options.pageSize) {
      options.pageSize = parseInt(options.pageSize);
    }
    if (options.pageNum) {
      options.pageNum = parseInt(options.pageNum);
    }
    if (options.sort && options.sort !== 'created') {
      options.sort = changeCase.pascalCase(options.sort);
    }
  }

  var defaults = {
    pageNum: 1,
    pageSize: 20,
    sort: 'created',
    sortOrder: 'DESC'
  };
  
  options = _.extend(defaults,options);

  var startIndex = (options.pageNum-1) * options.pageSize;
  var endIndex = startIndex + options.pageSize;

  var query = q + '  return p,ID(p),LABELS(p),i,ID(i)';
  query += ' order by p.' + options.sort + ' ' + options.sortOrder;
  if (startIndex > 0) {
      query += ' skip ' + (startIndex);
  }
  query += ' limit ' + options.pageSize;
    
  var count = q + ' return count(p)';
  var statements = [query, count];
  var out = { options: options, q: query, count: 0, items: [] };

  return cypher.executeStatements(statements)
    .then(onLoaded);
  
  function onLoaded (results) {
    out.count = results[1].data[0].row[0];
    var data = results[0].data;

    for (var i=0;i < data.length; i++) {
      var props = utils.camelCase(data[i].row[0]);
      var p;     
      if (options.format === 'compact'){
          p = { id: data[i].row[1], title: props.title };
      } else {
          p= _.extend(props, {
              id: data[i].row[1],
              labels: data[i].row[2]
          });
      }
      p.image =  image.configure(data[i].row[3], options);
      p.image.id = data[i].row[4];
      out.items.push(p);
    }
    return out;      
  }
}

function labelQuery(labels) {
  if (!labels instanceof Array) {
    labels = labels.split(',');
  }
  labels = labels.map(function(label) {
    return changeCase.pascalCase(label); 
  }).join(':');
                  
  var q = 'match (p:Picture) - [:IMAGE {Main:true}] -> (i:Image)';
  q += ' where not p:CacheError and not p:NotFound  and p:' + labels;
  return q;
}

function propertyQuery(property) {
  property.name=changeCase.pascalCase(property.name);
  var q = 'match (p:Picture) - [:IMAGE {Main:true}] -> (i:Image)';
  q += ' where not p:CacheError and not p:NotFound and p.' + property.name + '=~ \'(?i).*' + property.value + '.*\' ';
  return q;
}

function predicateQuery(predicate) {
  //allow multiple predicates input instead
  var relType = predicate.lookup.toUpperCase();
  if (relType === 'OF') {
    relType += '|:DEPICTS';
  }
  var q = utils.getMatch(predicate.target) + ' with n match (n) <- [:' + relType + '] - (p:Picture) - [:IMAGE] -> (i:Image:Main) where  not p:CacheError and not p:NotFound  ';
  return q;
}
    
var api = {
  //Same as get node except api all images are returned instead of just the main one
  get:function(id) {
    return getPicture(id);
  },
  //Picture relationships added
  getWithRels:function(id) {
    return getPicture(id).then(function(n) {
      return relationship.list.conceptual(n)
        .then(function(r) {
            n.relationships = r;
          return relationship.list.visual(n)
            .then(function(r) {
              n.relationships = _.merge(n.relationships, r);
              return n;
          });
      });
    });
  },
  //can optionally pass an alternative predicate such as 'of'
  //same as /relationship/visual/id if not predicate passed in
  list: {
    predicate:  function (params,options) {
      var q = predicateQuery({ lookup: params.predicate, target: params.id });
      return getList(q, options);
    },
    //returns an array of pictures api have this label
    labelled: function (params, options) {
      var q = labelQuery(params.labels);
      return getList(q, options);
    },
    property: function(params, options) {
      var q = propertyQuery({ name: params.prop, value: params.val });
      return getList(q, options);
    },
    //{site:"artsy",labels:[Delacroix,Drawing],props:{props:[Title],val:"sketchbook"},predicate:{predicate:"BY",target:"Delacroix"}}
    search: function(query, options) {
      /*
      query.options = {
        pageNum: 1,
        pageSize: 20,
        sort: 'created',
        sortOrder: 'DESC'
      };
      */

      var q = labelQuery(query.labels);
      return getList(q, options);
    }
  }  
};

module.exports = api;
