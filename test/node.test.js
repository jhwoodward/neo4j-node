var assert = require('assert');
var should = require('should');

var node = require('../src/api/node');
var utils = require('../src/api/utils');
var _ = require('lodash');
var changeCase = require('change-case');
var testData = require("./test.data");
var nodes = testData.getNodes();

describe('Node', function() {

  // runs after all tests in this block
  before(testData.cleanup);
  after(testData.cleanup);

  //placeholder store deleted node
  var key, i, nDeleted;
  
  describe('create', function () {
    it('should return a new id for the created node', function (done) {
      var createdCount = 0;
      function created() {
        createdCount += 1;
        if (createdCount === Object.keys(nodes).length) {
          done();
        }
      }
      
      Object.keys(nodes).forEach(function(key) {
        node.save(nodes[key]).then(function(saved) {
          saved.should.have.property('id').which.is.a.Number().above(-1);
          saved.should.have.property('created').which.is.a.Number().above(0);
          nodes[key] = saved;//store for further operations
          created();
        });
      });
    });
  });

  describe('update', function () {
    
    it('should update properties when they change', function (done) {
      nodes.Joe.type = "cow";
      node.save(nodes.Joe).then(function(saved) {
        saved.should.have.property('id').which.is.a.Number().equal(nodes.Joe.id);
        saved.should.have.property('created').which.is.a.Number().equal(nodes.Joe.created);  
        saved.should.have.property('type').which.is.equal("cow");
        saved.should.have.property('name').which.is.equal("Joe");
        nodes.Joe = saved;//store for further operations
        done();
      });
    });

    it('should add labels when they change', function (done) {
      nodes.Joe.labels.push("camera");
      nodes.Joe.labels.push("dog");
    
      node.save(nodes.Joe).then(function(saved) {
        saved.labels.should.be.instanceof(Array).and.have.lengthOf(4);
        saved.labels.should.containEql("Camera");
        saved.labels.should.containEql("Dog");
        
        //what the api should so to the labels
        nodes.Joe.labels = utils.pascalCase(nodes.Joe.labels);
        nodes.Joe.labels = nodes.Joe.labels.sort();
        
        saved.labels.should.eql(nodes.Joe.labels);
        nodes.Joe = saved;//store for further operations
        done();
      });
    });

    it('should remove labels when they change', function (done) {
      nodes.Joe.labels = _.remove(nodes.Joe.labels,function(e){return e != "Camera";}); 

      node.save(nodes.Joe).then(function(saved) {
        saved.labels.should.be.instanceof(Array).and.have.lengthOf(3);
        saved.labels.should.not.containEql("Camera");
        saved.labels.should.containEql("Dog");
        nodes.Joe = saved;//store for further operations
        done();
      });
    });
          
    it('labels should be pascal case', function (done) {
      node.get(nodes.Jim).then(function(saved) {
        for (i = 0; i < saved.labels.length; i++) {
          var firstLetterOfLabel = saved.labels[i][0];
          changeCase.isUpperCase(firstLetterOfLabel).should.equal(true);
        }
        done();
      });
    });
  });

  describe('delete', function () {
    it('should mark node as deleted', function (done) {
      node.delete(nodes.Joe).then(function(deleted) {
        deleted.should.have.property('id').which.is.a.Number().equal(nodes.Joe.id);
        deleted.should.have.property('deleted').which.is.a.Number().above(0);  
        deleted.labels.should.be.instanceof(Array).and.have.lengthOf(1);
        deleted.labels[0].should.equal("Deleted");
        nDeleted = deleted; //store for further operations
        done();
      });
    });
  });
    
  describe('restore', function () {
    it('should restore node as before', function (done) {
      node.restore(nDeleted).then(function(restored) {
        restored.should.eql(nodes.Joe); //eql for object comparison
        done();
      });
    });
  });

  describe('get',function(){
    it ('should return the full node object',function(done) {
      node.get(nodes.Joe.id).then(function(saved) {
        saved.should.eql(nodes.Joe); //eql for object comparison
        done();
      });
    });
  });
      
  describe('destroy', function () {
    it('should be gone forever', function (done) {
      node.destroy(nDeleted).then(function() {
        node.get(nDeleted).then(function(destroyed){
          should.not.exist(destroyed);
          done();
        });
      });
    });
  });
});
