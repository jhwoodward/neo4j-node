import relationship from './relationship';

export default (router) => {
  router.route('/relationships/visual/:id1/:id2').get((req, res) => {
    relationship.list.visual(req.params.id1, req.params.id2, req.query)
          .then(data => res.status(200).json(data))
          .catch(err => res.status(500).json({ error: err }));
  });

  router.route('/relationships/visual/:id').get((req, res) => {
    // Possible options: format = compact
    const options = req.query;
    relationship.list.visual(req.params.id, undefined, options)
          .then(data => res.status(200).json(data))
          .catch(err => res.status(500).json({ error: err }));
  });

  router.route('/relationships/conceptual/:id').get((req, res) => {
    relationship.list.conceptual(req.params.id, req.query)
          .then(data => res.status(200).json(data))
          .catch(err => res.status(500).json({ error: err }));
  });

  router.route('/relationships/property/:id').get((req, res) => {
    relationship.list.property(req.params.id, req.query)
          .then(data => res.status(200).json(data))
          .catch(err => res.status(500).json({ error: err }));
  });

  router.route('/relationships/inferred/:id').get((req, res) => {
    relationship.list.inferred(req.params.id, req.query)
          .then(data => res.status(200).json(data))
          .catch(err => res.status(500).json({ error: err }));
  });

  // Used to be /edge/save
  router.route('/relationship/save').post((req, res) => {
    relationship.save(req.body.edge)
           .then(data => res.status(200).json(data))
          .catch(err => res.status(500).json({ error: err }));
  });

  // Used to be /edge/delete
  router.route('/relationship/delete').post((req, res) => {
    relationship.delete(req.body.edge)
         .then(data => res.status(200).json(data))
         .catch(err => res.status(500).json({ error: err }));
  });
};
