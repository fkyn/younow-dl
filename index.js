var yargs = require('yargs');

yargs
    .usage('Usage: $0 <live|user|uri> [options]')
    .command(require('./lib/live'))
    .command(require('./lib/user'))
    .command(require('./lib/uri'))
    .demand(1)
    .strict()
    .help('h')
    .alias('h', 'help')
    .wrap(null)
    .argv;
