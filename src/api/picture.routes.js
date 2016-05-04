import picture from './picture';
import image from './image';

export default (router) => {
  router.route('/picture/get/:id').
    get((req, res) => picture.get(req.params.id).
    then(data => res.status(200).json(data)).
    catch(err => res.status(500).json(err))
    );

  router.route('/picture/getWithRels/:id').
    get((req, res) => picture.getWithRels(req.params.id).
    then(data => {
      if (!data) {
        res.sendStatus(204);
      } else {
        res.status(200).json(data);
      }
    }).
    catch(err => res.status(500).json(err))
    );

   // For more complex queries combining property, label and predicate searches
   // post a json object like
   // {site:"artsy",labels:[Delacroix,Drawing],
   //   props:{props:[Title],val:"sketchbook"},
   //   predicate:{predicate:"BY",target:"Delacroix"}
   // }
  router.route('/pictures/labelled/:labels').
    get((req, res) => picture.list.labelled(req.params, req.query).
    then((data) => {
      if (!data) {
        res.sendStatus(204);
      } else {
        res.status(200).json(data);
      }
    }).
    catch(err => res.status(500).json(err))
    );

  router.route('/pictures/property/:prop/:val').get((req, res) => picture.list.property(req.params, req.query)
            .then((data) => {
              if (!data) {
                res.sendStatus(204);
              }
              else {
                res.status(200).json(data);
              }
            }).catch(err => res.status(500).json(err)));


  router.route('/pictures/:predicate/:id').get((req, res) => picture.list.predicate(req.params, req.query)
            .then((data) => {
              if (!data) {
                res.sendStatus(204);
              } else {
                res.status(200).json(data);
              }
            }).catch(err => res.status(500).json(err)));



  router.route('/pictures').post((req, res) => picture.list.combined(req.body, req.query)
            .then((data) => {
              if (!data) {
                res.sendStatus(204);
              } else {
                res.status(200).json(data);
              }
            }).catch(err => res.status(500).json(err)));


      // NB At the moment my ajax post is sending data in the query
      // Should be changed to request body
  router.route('/image/error').post((req, res) => image.error(req.body)
            .then((data) => {
              if (!data) {
                res.sendStatus(204);
              } else {
                res.status(200).json(data);
              }
            }).catch(err => res.status(500).json(err)));
};
