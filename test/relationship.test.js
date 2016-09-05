var assert = require('assert');
var should = require('should');
var _ = require('lodash');

var node = require('../src/api/node');
var testData = require('./test.data');

describe('Relationship', function() {
    
  before(testData.create);
  after(testData.cleanup);
  
  describe('create new node', function () {
    it('should create relationship with existing nodes', function (done) {
      var nodes = testData.getNodes();
      nodes.George = { 
        name: 'George', 
        label: 'George', 
        colour: 'brown', 
        type: 'elephant', 
        labels: ['Label', 'mochatest'],
        relationships: {
          'loves': {
            predicate: {
              lookup: 'loves',
              direction: 'out'
            },
            items: [nodes.Joe]
          },
          'influenced by': {
            predicate: {
              lookup: 'influences',
              direction: 'in'
            },
            items: [nodes.Jim]
          }
        }
      };
      node.save(nodes.George).then(function(saved) {
        saved.should.have.property('relationships');
        saved.relationships.should.have.property('loves');  
        saved.relationships.should.have.property('influenced by');  
        done();
      });
    });
  });
   
  describe('update node', function () {
    it('should create relationship', function (done) {
      var nodes = testData.getNodes();
      nodes.Alex.relationships = {
        'likes': {
          predicate: {
            lookup: 'likes',
            direction: 'out'
          },
          items: [nodes.Joe]
        },
        'influenced by': {
          predicate:{
              lookup:'influences',
              direction:'in'
          },
          items:[nodes.Jim]
        }
      }
      node.save(nodes.Alex).then(function(saved){
          saved.should.have.property('relationships');
          saved.relationships.should.have.property('likes');  
          saved.relationships.should.have.property('influenced by');  
          done();
      });
    });
        
    it('should add a relationship', function (done) {
      var nodes = testData.getNodes();
      nodes.Jim.relationships = nodes.Jim.relationships || {};
      nodes.Jim.relationships['watches'] = {
        predicate:{
          lookup: 'watches',
          direction:'out'
        },
        items: [nodes.Alex]
      }
      node.save(nodes.Jim).then(function(saved) {
          saved.should.have.property('relationships');
          saved.relationships.should.have.property('watches');  
          saved.relationships.watches.items[0].label.should.equal('Alex');
          done();
      });
    });

    xit('should create node for relationship if node does not exist', function (done) {
      var nodes = testData.getNodes();
      nodes.Jim.relationships = nodes.Jim.relationships || {};
      nodes.Jim.relationships['hates'] = {
        predicate: {
          lookup: 'hates',
          direction: 'out'
        },
        items: [{ name: 'Paul', colour:'black', type: 'person',labels: ['mochatest'] }],
      };
      node.save(nodes.Jim).then(function(saved) {
        saved.relationships.should.have.property('hates');   
        done();
      });
    });
        
    it('should not return relationship unless the item has a \'Label\' label and property', function (done) {
      var nodes = testData.getNodes();
      nodes.Jim.relationships = nodes.Jim.relationships || {};
      nodes.Jim.relationships['notlabelled'] = {
        predicate: {
          lookup: 'notlabelled',
          direction: 'out'
        },
        items: [nodes.NoLabel]
      };
      node.save(nodes.Jim).then(function(saved) {
        saved.should.have.property('relationships');
        saved.relationships.should.not.have.property('notlabelled');  
        done();
      });
    });
        
    it('should add items to a relationship', function (done) {
      var nodes = testData.getNodes();
      nodes.Jim.relationships.watches.items.push(nodes.Joe);
      node.save(nodes.Jim).then(function(saved) {
        saved.should.have.property('relationships');
        saved.relationships.should.have.property('watches');  
        saved.relationships.watches.items.length.should.equal(2);
        saved.relationships.watches.items[0].label.should.equalOneOf('Joe','Alex');
        saved.relationships.watches.items[1].label.should.equalOneOf('Joe','Alex');
        saved.relationships.watches.items[0].label.should.not.equal(saved.relationships.watches.items[1].label);
        done();
      });
    });
            
    it('should remove items from a relationship', function (done) {
      var nodes = testData.getNodes();
      nodes.Jim.relationships.watches.items.pop();
      node.save(nodes.Jim).then(function(saved) {
        saved.should.have.property('relationships');
        saved.relationships.should.have.property('watches');  
        saved.relationships.watches.items.length.should.equal(1);
        done();
      });
    });
            
    it('should remove a relationship', function (done) {
      var nodes = testData.getNodes();
      delete nodes.Alex.relationships['likes'];
      node.save(nodes.Alex).then(function(saved) {
        saved.should.have.property('relationships');
        saved.relationships.should.not.have.property('likes');  
        saved.relationships.should.have.property('influenced by');  
        done();
      });
    });

    it('relationship should change direction', function (done) {
      var nodes = testData.getNodes();
      //manual flip
      nodes.Alex.relationships['influences'] =  _.extend({}, nodes.Alex.relationships['influenced by']);
      nodes.Alex.relationships['influences'].predicate.direction = 'out';
      delete nodes.Alex.relationships['influenced by'];
      node.save(nodes.Alex).then(function(saved) {
        saved.should.have.property('relationships');
        saved.relationships.should.not.have.property('likes');  
        saved.relationships.should.not.have.property('influenced by');  
        saved.relationships.should.have.property('influences');
        saved.relationships.influences.predicate.direction.should.equal('out');
        done();
      });
    });
  });
});
