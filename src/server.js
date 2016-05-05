import express from 'express';
import bodyParser from 'body-parser';
import config from './server.config';
import headers from './headers';
import routes from './api/routes';

const port = process.env.PORT || config.host.port;
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(headers);
app.use(config.host.root, routes);
app.listen(port);

console.log(`Api listening on port ${port}`);
