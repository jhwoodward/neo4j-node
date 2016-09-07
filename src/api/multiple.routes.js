var multiple = require('./multiple');

module.exports = function(router) {
  //nb changed from 'node/saveMultiple'
  var saveMultiple = function(req, res) {
    multiple.save(req.body.multiple)
    .then(function(data) {
          res.status(200).json(data);
    })
    .catch(function (err) {
          res.status(500).json({ error: err });
    });
  };
  router.route('/node/saveMultiple').post(saveMultiple);
  router.route('/multiple/save').post(saveMultiple);
  return router;
};
