import user from './user';
export default (router) => {
  router.route('/user/saveFavourite').post((req, res) => {
    user.saveFavourite(req.body.node, req.body.user).
    then(data => res.status(200).json(data)).
    catch(err => res.status(500).json({ error: err }));
  });
  router.route('/user/:user').get((req, res) => {
    user.get(req.params.user).
    then(data => res.status(200).json(data)).
    catch(err => res.status(500).json({ error: err }));
  });
};
