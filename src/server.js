const config = require('./config');
const app = require('./app');

app.listen(config.port, () => console.log(`Bucket list API on http://localhost:${config.port}`));
