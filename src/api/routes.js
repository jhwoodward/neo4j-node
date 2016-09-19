var router = require('express').Router();
var type = require('./type');
var label = require('./label');
var predicate = require('./predicate');
var script = require('./script');

require('./node.routes')(router);
require('./picture.routes')(router);
require('./relationship.routes')(router);
require('./graph.routes')(router);
require('./search.routes')(router);
require('./multiple.routes')(router);

router.route('/predicates').get(function (req, res) {
  predicate.refreshList().then(function (predicates) {
    res.status(200).json(predicates);
  });
});

router.route('/types').get(function (req, res) {
  type.getAll().then(function (types) {
    res.status(200).json(types);
  });
});

router.route('/labels/distinct').post(function(req,res){
  label.list.distinct(req.body.labels)    
  .then(function(data){
    res.status(200).json(data);
  })
  .catch(function (err) {
    res.status(500).json({error:err});
  });
});

 

router.route('/script/:lookup').get(function (req, res) {
  script.create(req.params.lookup).then(function (types) {
    res.status(200).json(types);
  });
});

module.exports = router;
