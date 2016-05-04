import node from './node';

export default (router) => {
  router.route('/node/get/:id').get((req, res) => {
    node.get(req.params.id)
            .then(data => {
              if (!data) {
                res.sendStatus(204);
              } else {
                res.status(200).json(data);
              }
            })
            .catch(err => {
              res.status(500).json(err);
            });
  });

  router.route('/node/getWithRels/:id').get((req, res) => {
    node.getWithRels(req.params.id)
             .then(data => {
               if (!data) {
                 res.sendStatus(204);
               } else {
                 res.status(200).json(data);
               }
             })
             .catch(err => {
               res.status(500).json(err);
             });
  });

  router.route('/node/schema/:id').get((req, res) => {
    node.getSchema(req.params.id)
            .then(data => {
              if (!data) {
                res.sendStatus(204);
              } else {
                res.status(200).json(data);
              }
            })
            .catch(err => {
              res.status(500).json(err);
            });
  });

  router.route('/node/save').post((req, res) => {
    node.save(req.body.node, req.body.user)
            .then(data => {
              res.status(201).json(data);
            })
             .catch(err => {
               res.status(500).json(err);
             });
  });

  router.route('/node/delete').post((req, res) => {
    node.delete(req.body.node)
            .then(data => {
              res.status(200).json(data);
            })
             .catch(err => {
               res.status(500).json(err);
             });
  });

  router.route('/node/destroy').post((req, res) => {
    node.destroy(req.body.node)
            .then(data => {
              res.status(200).json(data);
            })
             .catch(err => {
               res.status(500).json(err);
             });
  });

  router.route('/node/restore').post((req, res) => {
    node.restore(req.body.node)
            .then(data => {
              res.status(200).json(data);
            })
             .catch(err => {
               res.status(500).json(err);
             });
  });


  router.route('/node/list/labelled/:id').get((req, res) => {
    node.list.labelled(req.params.id)
          .then(data => {
            res.status(200).json(data);
          })
          .catch(err => {
            res.status(500).json({ error: err });
          });
  });
};
