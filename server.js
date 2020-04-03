'use strict';
const log = require('loglevel');

require('http')
    .createServer(require('./app'))
    .listen(Number(process.env.PORT) || 3000, function () {
        log.info('listening on port', this.address().port);
    });
