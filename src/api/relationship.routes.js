var relationship = require('./relationship');

module.exports = function(router) {

  router.route('/relationship/visual/:id1/:id2').get(function (req, res) {
    relationship.list.visual(req.params.id1, req.params.id2, req.query)
      .then(function(data) {
        res.status(200).json(data);
      })
      .catch(function (err) {
        res.status(500).json({ error: err });
      });
    });
    
  router.route('/relationship/visual/:id').get(function (req, res) {

    console.log(req.query);
    //possible options:
    //format=compact 
    //summary=true
    relationship.list.visual(req.params.id, undefined, req.query)
      .then(function(data) {
        res.status(200).json(data);
      })
      .catch(function (err) {
        res.status(500).json({ error: err });
      });
   });

  router.route('/relationship/conceptual/:id').get(function (req, res) {
    relationship.list.conceptual(req.params.id, req.query)
      .then(function(data) {
        res.status(200).json(data);
      })
      .catch(function (err) {
        res.status(500).json({ error: err });
      });
  });
    


  router.route('/relationship/shortest/:from/:to').get(function (req, res) {
    relationship.list.shortest(req.params.from, req.params.to)
      .then(function(data) {
        res.status(200).json(data);
        })
      .catch(function (err) {
        res.status(500).json({ error: err });
      });
  });

  router.route('/relationship/allshortest/:from/:to').get(function (req, res) {
    relationship.list.allShortest(req.params.from, req.params.to)
      .then(function(data) {
        res.status(200).json(data);
        })
      .catch(function (err) {
        res.status(500).json({ error: err });
      });
  });

  router.route('/relationship/save').post(function(req, res) {
    relationship.save(req.body.edge)//used to be req.body.e
      .then(function(data) {
         res.status(200).json(data);
      })
      .catch(function (err) {
         res.status(500).json({ error: err });
      });
  });
    
  router.route('/relationship/delete').post(function(req, res) {
    relationship.delete(req.body.edge)
      .then(function(data) {
        res.status(200).json(data);
      })
      .catch(function (err) {
        res.status(500).json({ error:err });
      });
  });

  return router;
};
