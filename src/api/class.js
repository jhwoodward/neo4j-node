module.exports = function(config)
{
    "use strict";

    var extend = require('extend');
    config = extend ( require('./config.default'), config);
    var cypher = require("./cypher")(config);
    var utils = require("./utils")(config);
    var changeCase = require("change-case");
    var predicate = require("./predicate")(config);
    var _ = require("lodash");
  var merge = require('deepmerge');


var that = {
    //object containing all types keyed on Lookup
    list: {}
    ,
    isClass: function (label) {
        return that.list[label] !== undefined;
    }
    ,
    refreshList: function () {
        return predicate.refreshList().then(that.buildSchema);
    }
    ,
    isSystemInfo: function (label) {
        return label == "Global" || label == "Type" || label == "Label" || label == "SystemInfo";
    },
    //TODO : move to the ui
    getLabelClass: function (node, label) {

        if (node && label === node.Type) {
            return 'label-warning';
        }
        
        if (that.isSystemInfo(label)) {
            return 'label-system';
        }
        
        if (that.isType(label)) {
            return 'label-inverse pointer';
        }
        return 'label-info';
    }
    ,
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
        'Mathematician']
    ,
    pictureTypes: ['Painting', 'Illustration', 'Drawing', 'Print']
    ,
    isPerson: function (type) {
        return that.personTypes.indexOf(type) > -1;
    }


};

return (function(){
     that.refreshList();
     return that;
})();


};