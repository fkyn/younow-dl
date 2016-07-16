var winston = require('winston');

var logger = winston.loggers.add('app', {
    console: {
        level: 'info',
        colorize: true
    }
});

module.exports = logger;
