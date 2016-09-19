var search = require('./search');
var picture = require('./picture');

module.exports = function(router) {

   //for more complex queries combining property, label and predicate searches 
   //post a json object like
   //{site:"artsy",labels:[Delacroix,Drawing],props:{props:[Title],val:"sketchbook"},predicate:{predicate:"BY",target:"Delacroix"}}
  router.route('/search/picture').post(function(req, res) {
    picture.list.search(req.body.query, req.body.options)
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
        

  //used to be /node/match
  router.route('/search').post(function(req, res) {
    var txt = req.body.txt;
    var restrict = req.body.restrict;
    var searchFn;
    var label;
    if (!restrict || restrict === 'Label') {
      label = 'Label';
    } else if (restrict === 'user') {
      label = 'User';
    } 
    search.label(label, txt)
      .then(function (data) {
          res.status(200).json(data);
      })
      .catch(function (err) {
          res.status(500).json(err);
      });
  });
    
    
  router.route('/search/:label/:txt').get(function(req, res) {
    search.label(req.params.label, req.params.txt).then(function (data) {
      res.status(200).json(data);
    })
    .catch(function (err) {
      res.status(500).json(err);
    });
  });
    
  //default search is anything with the Label label
  router.route('/search/:txt').get(function(req, res) {
    search.label('Label', req.params.txt).then(function (data) {
      if (!data){
          res.sendStatus(204);
      }
      else{
          res.status(200).json(data);
      }
    })
    .catch(function (err) {
        res.status(500).json(err);
    });
  });

  return router;
};
