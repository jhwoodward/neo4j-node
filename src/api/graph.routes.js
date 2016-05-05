import graph from './graph';

export default (router) => {
  router.route('/graph').post((req, res) =>
    graph.get(req.body.q, req.body.returnArray).
      then(data => res.status(200).json(data)).
      catch(err => res.status(500).json(err))
      );

  router.route('/graph/relationships/:id').get((req, res) =>
    graph.getRelationships(req.params.id).
      then(data => res.status(200).json(data)).
      catch(err => res.status(500).json(err))
      );
};
