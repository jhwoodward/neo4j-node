import multiple from './multiple';

export default (router) => {
  const saveMultiple = (req, res) => {
    multiple.save(req.body.multiple)
        .then(data => { res.status(200).json(data); })
        .catch(err => { res.status(500).json({ error:err }); });
  };
  router.route('/node/saveMultiple').post(saveMultiple);
  router.route('/multiple/save').post(saveMultiple);
};
