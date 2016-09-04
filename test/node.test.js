'use strict';

var assert = require('assert');
var should = require('should');
var node = require('../built/api/node').default;
var utils = require('../built/api/utils').default;
var testData = require('./test.data');
var _= require('lodash');
var changeCase=require('change-case');

describe('Node', function() {

  before(testData.cleanup);
  after(testData.cleanup);
 
  //placeholder store deleted node
  let nDeleted;
  
  describe('create', function() {
        it('should return a new id for the created node', function(done) {
            const createdCount = 0;
            const created = () => {
                createdCount +=1;
                if (createdCount === Object.keys(testData.nodes).length){
                    done();
                }
            }
            
            for (let key in testData.nodes){
                node.save(testData.nodes[key]).then((saved) => {
                    saved.should.have.property('id').which.is.a.Number().above(-1);
                    saved.should.have.property('created').which.is.a.Number().above(0);
                    testData.nodes[key]=saved;
                    created();
                });
            }
           
        });
  });
  
   describe('update', function() {
        it('should update properties when they change', function(done) {
            const n = testData.nodes.Joe;
            n.type='cow';
            node.save(n).then((saved) => {
                saved.should.have.property('id').which.is.a.Number().equal(n.id);
                saved.should.have.property('created').which.is.a.Number().equal(n.created);  
                saved.should.have.property('type').which.is.equal('cow');
                saved.should.have.property('name').which.is.equal('Joe');
                n=saved;
                done();
            });
        });

        it('should add labels when they change', (done) => {
            const n = testData.nodes.Joe;
            n.labels.push('camera');
            n.labels.push('dog');
          
            node.save(n).then((saved) => {
                saved.labels.should.be.instanceof(Array).and.have.lengthOf(4);
                saved.labels.should.containEql('Camera');
                saved.labels.should.containEql('Dog');
                n.labels=utils.pascalCase(n.labels);
                n.labels = n.labels.sort();
                saved.labels.should.eql(n.labels);
                n=saved;
                done();
            });
        });
    
        it('should remove labels when they change', (done) => {
            const n = testData.nodes.Joe;
            n.labels = _.remove(n.labels, e => e!='Camera'); 
            node.save(n).then((saved) => {
                saved.labels.should.be.instanceof(Array).and.have.lengthOf(3);
                saved.labels.should.not.containEql('Camera');
                saved.labels.should.containEql('Dog');
                n=saved;
                done();
            });
        });
        
       it('labels should be pascal case', (done) => {
            node.get(testData.nodes.Jim).then((saved) => {
                for (let i = 0;i < saved.labels.length;i++) {
                    let firstLetterOfLabel = saved.labels[i][0];
                    changeCase.isUpperCase(firstLetterOfLabel).should.equal(true);
                }
                done();
            });
        });
    });

    describe('delete', () => {
        it('should mark node as deleted', (done) => {
             const n = testData.nodes.Joe;
            node.delete(n).then((deleted) => {
                deleted.should.have.property('id').which.is.a.Number().equal(n.id);
                deleted.should.have.property('deleted').which.is.a.Number().above(0);  
                deleted.labels.should.be.instanceof(Array).and.have.lengthOf(1);
                deleted.labels[0].should.equal('Deleted');
                nDeleted = deleted;
                done();
            });
        });
    });
    
   describe('restore', () => {
        it('should restore node as before', (done) => {
            node.restore(nDeleted).then((restored) => {
                restored.should.eql(testData.nodes.Joe);
                done();
            });
        });
    });
    
    describe('get', () => {
        it ('should return the full node object',(done) => {

              node.get(testData.nodes.Joe.id).then((saved) => {
                 saved.should.eql(testData.nodes.Joe);
                 done();
              });
        });
    });
    
   describe('destroy', () => {
        it('should be gone forever', (done) => {
            node.destroy(nDeleted).then(() => {
                node.get(nDeleted).then((destroyed) => {
                   should.not.exist(destroyed);
                   done();
                });
            });
        });
    });
});
