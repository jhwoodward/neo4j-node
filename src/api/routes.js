import express from 'express';
import type from './type';
import label from './label';
import predicate from './predicate';
import nodeRoutes from './node.routes';
import pictureRoutes from './picture.routes';
import relationshipRoutes from './relationship.routes';
import graphRoutes from './graph.routes';
import searchRoutes from './search.routes';
import userRoutes from './user.routes';
import multipleRoutes from './multiple.routes';

const router = new express.Router();
nodeRoutes(router);
pictureRoutes(router);
relationshipRoutes(router);
graphRoutes(router);
searchRoutes(router);
userRoutes(router);
multipleRoutes(router);

router.route('/predicates').get((req, res) => {
  predicate.refreshList().then(predicates => res.status(200).json(predicates));
});

router.route('/types').get((req, res) => {
  type.refreshList().then(types => res.status(200).json(types));
});

router.route('/labels/distinct').post((req, res) => {
  label.list.distinct(req.body.labels)
        .then(data => res.status(200).json(data))
        .catch(err => res.status(500).json({ error: err }));
});

export default router;

