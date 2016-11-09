var type = require('./type');
  
module.exports = function(router) {

  router.route('/type/reset').get(function (req, res) {
    type.reset().then(function (resp) {
      res.status(200).json(resp);
    });
  });

  router.route('/type/get/:id').get(function(req, res) {
    type.get(req.params.id)
      .then(function (data) {
        if (!data){
            res.sendStatus(204);
        } else {
            res.status(200).json(data);
        }
      })
      .catch(function (err) {
          res.status(500).json(err);
      });
  });

  router.route('/type/getall').get(function (req, res) {
    type.getAll().then(function (types) {
      res.status(200).json(types);
    });
  });


  return router;
};
