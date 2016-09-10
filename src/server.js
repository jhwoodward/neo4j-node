var express = require('express');     
var app = express();                
var bodyParser = require('body-parser');
import schema from './graphql/schema';

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var config = require('./server.config');

// Add headers
app.use(require('./headers'));

var port = process.env.PORT || config.host.port;       

//configure routes
app.use(config.host.root, require('./api/routes'));
schema.load(app);

app.listen(port);
console.log('Listening on port ' + port);
