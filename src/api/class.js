import cypher from './cypher';
import utils from './utils';
import changeCase 'change-case';
import predicate from './predicate';
import _ from 'lodash';
import merge from 'deepmerge';

const api = {
    //object containing all types keyed on Lookup
    list: {}
    ,
    isClass: function (label) {
      return that.list[label] !== undefined;
    }
    ,
    refreshList: function () {
      return predicate.refreshList().then(api.buildSchema);
    }
    ,
    isSystemInfo: function (label) {
      return label === "Global" || label === "Type" || label === "Label" || label === "SystemInfo";
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


export default () => { api.refreshList(); return api; };

