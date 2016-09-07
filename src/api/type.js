var cypher = require("./cypher");
var utils = require("./utils");
var changeCase = require("change-case");
var _ = require("lodash");

var api = {
  //object containing all types keyed on Lookup
  list: {},
  isType: function (label) {
    return api.list[label] !== undefined;
  },
  schema:function() {
    //return list with full schema
    //NB types would require at least one property to show up here
    var q = "match (n:Type) return n,collect(r),collect(p),labels(n)";
    return cypher.executeQuery(q, "row");    
  },
  refreshList: function () {
    //NB types would require at least one property to show up here
    var q = "match (n:Type)-[r:PROPERTY]->(p:Property) return n,collect(r),collect(p),labels(n)";
    return cypher.executeQuery(q, "row")
        .then(onLoaded);
      
    function onLoaded(data) {
      var i, j, types = {};
      for (i = 0; i < data.length; i++) {
        var d = data[i];
        var t = utils.camelCase(d.row[0]);
        var labels = d.row[3];
        
        if (t.lookup) {
          var typeName = changeCase.camelCase(t.lookup);
          var type = {
            lookup: typeName,
            description: t.description,
            props: {},
            isSystem: labels.indexOf("SystemInfo") > -1,
            isGlobal: labels.indexOf("Global") > -1
          };
          
          if (t.systemInfo) {
            type.systemInfo = t.systemInfo;
          }
            
          var rels = d.row[1];//relationship has metadata such as 'Required' true/false
          var props = d.row[2];//array
          for (j = 0; j < props.length; j++) {
            var p = utils.camelCase(props[j]);
            var propName = changeCase.camelCase(p.lookup);
            var rel = utils.camelCase(rels[j]);
            var prop = {
              name :propName,
              required: (rel && rel.required) || false,
              type: p.type || "string",
            };
            type.props[propName] = prop;
          }  
          types[typeName] = type;
        } else {
          console.warn("Type without lookup (id:" + d.row[0] + ")");
        }
      }
      api.list = types;
      return types;
    }
  },
  isSystemInfo: function (label) {
      return label === "Global" || label === "Type" || 
        label === "Label" || label === "SystemInfo";
  },
  //should be in the ui
  getLabelClass: function (node, label) {
    if (node && label === node.Type) {
        return 'label-warning';
    }
    if (api.isSystemInfo(label)) {
        return 'label-system';
    }
    if (api.isType(label)) {
        return 'label-inverse pointer';
    }
    return 'label-info';
  },
  personTypes: ['Painter',
      'Illustrator',
      'Philosopher',
      'Poet',
      'FilmMaker',
      'Sculptor',
      'Writer',
      'Patron',
      'Leader',
      'Explorer',
      'Composer',
      'Scientist',
      'Caricaturist',
      'Mathematician'],
  pictureTypes: ['Painting', 'Illustration', 'Drawing', 'Print']
  ,
  isPerson: function (type) {
    return api.personTypes.indexOf(type) > -1;
  }
};

module.exports = (function(){
    api.refreshList();
    return api;
})();
