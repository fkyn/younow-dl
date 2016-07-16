var Promise = require('bluebird');
var Spinner = require('cli-spinner').Spinner;
var rtmpdump = require('rtmpdump');
var fs = require('fs');
var sprintf = require('sprintf-js').sprintf;
var dateFormat = require('dateformat');
var logger = require('./logger');
var common = require('./common');

var command = {};

command.command = 'live <username>';

command.describe = 'Record live broadcast of a user';

command.builder = {
    f: {
        alias: 'filename',
        describe: 'Download filename',
        default: '%(u)s %(bid)s %(d)s.mp4',
        type: 'string'
    },
    d: {
        alias: 'directory',
        describe: 'Download directory',
        default: process.cwd(),
        normalize: true,
        type: 'string'
    },
    w: {
        alias: 'wait',
        describe: 'Wait until broadcast is available',
        type: 'boolean'
    },
    i: {
        alias: 'interval',
        describe: 'Interval between polling for broadcast availability',
        default: 10000,
        type: 'number'
    }
};

command.handler = function(argv) {
    logger.info('get user data for user `%s`', argv.username);

    /*
     * get live broadcast id for user 
     */
    Promise.props({
            username: argv.username,
            res: common.request(common.URI.userInfo, {
                username: argv.username
            })
        })
        .then(function(data) {
            if (typeof data.res.userId === 'undefined') {
                throw new Error('unknown username');
            }

            if (!data.res.broadcastId || !data.res.media) {
                if (argv.wait) {
                    setTimeout(function() {
                        command.handler(argv);
                    }, argv.interval);
                }

                throw new Error('user is not live');
            }

            data.broadcast = data.res;

            return data;
        })
        .catch(function(error) {
            if (argv.wait) {
                throw error;
            }

            logger.error('cannot find broadcast', error);
            process.exit(1);
        })
        /*
         * download video
         */
        .then(function(data) {
            logger.info('record broadcast');

            var formatArgs = {
                u: data.broadcast.user.profileUrlString,
                uid: data.broadcast.user.userId,
                bid: data.broadcast.broadcastId,
                d: dateFormat(parseInt(data.broadcast.dateCreated, 10) * 1000, 'mmmm dd, yyyy')
            };

            try {
                argv.f = argv.filename = sprintf(argv.filename, formatArgs);
            } catch (e) {
                logger.warn('invalid filename format', e);
                argv.f = argv.filename = sprintf(liveModule.builder.f.default, formatArgs);
            }

            var spinner = new Spinner('start download...');

            var filepath = argv.directory + '/' + argv.filename;
            var outputStream = fs.createWriteStream(filepath, {
                flags: 'a'
            });

            var inputStream = rtmpdump.createStream({
                rtmp: 'rtmp://' + data.broadcast.media.host + 'oddcast/' + data.broadcast.media.prefix,
                app: data.broadcast.media.app,
                playpath: data.broadcast.media.stream,
                flashVer: 'LNX 22,0,0,192',
                swfVfy: 'https://cdn.younow.com/swf/Player.swf?ver=49.001',
                pageUrl: 'https://www.younow.com/' + data.username + '/'
            });

            inputStream.on('connected', function(info) {
                spinner.start();
            });

            inputStream.on('progress', function(read, time) {
                var mb = Math.round((read / 1024) * 100) / 100;
                spinner.setSpinnerTitle('downloading... ' + time + 's elapsed / ' + mb + 'mb read');
            });

            inputStream.on('close', function() {
                spinner.stop(true);

                if (argv.wait) {
                    command.handle(argv);
                }

                logger.info('stream ended');
            });

            inputStream.on('error', function(error) {
                spinner.stop(true);

                if (argv.wait) {
                    command.handle(argv);
                }

                throw error;
            });

            inputStream.pipe(outputStream);
        })
        .catch(function(error) {
            if (argv.wait) {
                return;
            }

            logger.error('download failed', error);
            process.exit(1);
        });
};

module.exports = command;
