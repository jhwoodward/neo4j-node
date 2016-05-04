import search from './search';

export default (router) => {
  // Used to be /node/match
  router.route('/search').post((req, res) => {
    const txt = req.body.txt;
    const restrict = req.body.restrict;
    let searchFn;
    if (restrict === 'user') {
      searchFn = () => search.label('User', txt);
    } else {
      searchFn = () => search.label('Label', txt);
    }
    searchFn(txt).
      then(data => res.status(200).json(data)).
      catch(err => res.status(500).json({ error: err }));
  });

  router.route('/search/:label/:txt').get((req, res) => {
    search.label(req.params.label, req.params.txt).
    then(data => res.status(200).json(data)).
    catch(err => res.status(500).json({ error: err }));
  });

  // Default search is anything with the Label label
  router.route('/search/:txt').get((req, res) => {
    search.label('Label', req.params.txt).
      then(data => res.status(200).json(data)).
      catch(err => res.status(500).json({ error: err }));
  });
};
