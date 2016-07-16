var Promise = require('bluebird');
var inquirer = require('inquirer');
var ffmpeg = require('fluent-ffmpeg');
var ProgressBar = require('progress');
var Spinner = require('cli-spinner').Spinner;
var sprintf = require('sprintf-js').sprintf;
var logger = require('./logger');
var common = require('./common');

var command = {};

command.command = 'user <username>';

command.describe = 'List and download past broadcasts of a user';

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
    }
};

command.handler = function(argv) {
    logger.info('get user data for user `%s`', argv.username);

    /*
     * get user data
     */
    Promise.props({
            username: argv.username,
            res: common.request(common.URI.userInfo, {
                username: argv.username
            })
        })
        .then(function(data) {
            data.user = data.res;
            delete data.res;

            if (typeof data.user.userId === 'undefined') {
                throw new Error('unknown username');
            }

            return data;
        })
        .catch(function(error) {
            logger.error('cannot find user', error);
            process.exit(1);
        })
        /*
         * get all video broadcasts
         */
        .then(function(data) {
            logger.info('get all broadcasts for user `%s`', data.username);

            data.res = new Promise(function(resolve, reject) {
                var spinner = new Spinner('load broadcasts...');
                var posts = [];
                var pos = 0;
                var next = function(argument) {
                    spinner.setSpinnerTitle('load broadcasts... page ' + (pos + 1));
                    return common.request(common.URI.broadcasts, {
                            userId: data.user.userId,
                            start: pos++
                        })
                        .then(function(result) {
                            if (result.errorCode !== 0) {
                                throw new Error(result.errorMsg);
                            }

                            if (Array.isArray(result.posts)) {
                                posts = posts.concat(result.posts);
                            }

                            if (result.hasMore) {
                                return next();
                            } else {
                                spinner.stop(true);
                                resolve(posts)
                            }
                        })
                        .catch(function(error) {
                            spinner.stop(true);
                            reject(error);
                        });
                }

                spinner.start();
                next();
            });

            return Promise.props(data);
        })
        .then(function(data) {
            var broadcasts = [];
            for (var i = 0; i < data.res.length; i++) {
                var post = data.res[i];
                if (post.media && post.media.type == 5) {
                    var broadcast = post.media.broadcast;
                    broadcasts.push(broadcast);
                }
            }

            data.broadcasts = broadcasts;
            delete data.res;

            return data;
        })
        .catch(function(error) {
            logger.error('cannot get broadcasts', error);
            process.exit(1);
        })
        /*
         * select a broadcast
         */
        .then(function(data) {
            if (data.broadcasts.length == 0) {
                throw new Error('user has no broadcasts');
            }

            var choices = [];
            for (var i = 0; i < data.broadcasts.length; i++) {
                var broadcast = data.broadcasts[i];
                var length = new Date(broadcast.broadcastLength * 1000).toISOString().substr(11, 8);
                choices.push({
                    name: '[' + (i + 1) + '] ' + broadcast.ddateAired + ' (' + broadcast.timeAgo + ' ago) - ' + length,
                    //name: '[' + i + '] https://www.younow.com/' + data.username + '/' + broadcast.broadcastId + '/' + data.user.userId + '/',
                    value: broadcast
                });
            }

            data.res = inquirer.prompt([{
                type: 'list',
                name: 'broadcast',
                message: 'Select a broadcast to download',
                choices: choices,
                pageSize: 20
            }]);

            return Promise.props(data);
        })
        .then(function(data) {
            data.broadcast = data.res.broadcast;
            delete data.res;

            return data;
        })
        .catch(function(error) {
            logger.error('cannot select broadcast', error);
            process.exit(1);
        })
        /*
         * get video data for selected broadcast
         */
        .then(function(data) {
            logger.info('get video data for broadcast `%s`', data.broadcast.broadcastId);

            data.res = common.request(common.URI.videoInfo, {
                broadcastId: data.broadcast.broadcastId
            });

            return Promise.props(data);
        })
        .then(function(data) {
            data.video = data.res;
            delete data.res;

            if (data.video.errorCode !== 0) {
                throw new Error(data.res.errorMsg);
            }

            return data;
        })
        .catch(function(error) {
            logger.error('cannot get video data', error);
            process.exit(1);
        })
        /*
         * download file
         */
        .then(function(data) {
            logger.info('download broadcast');

            var formatArgs = {
                u: data.video.profileUrlString,
                uid: data.video.userId,
                bid: data.broadcast.broadcastId,
                d: data.video.broadcastTitle
            };

            var filename = '';
            try {
                filename = sprintf(argv.filename, formatArgs);
            } catch (e) {
                logger.warn('invalid filename format', e);
                filename = sprintf(liveModule.builder.f.default, formatArgs);
            }

            var uri = data.video.hls;
            var filepath = argv.directory + '/' + filename;
            var totalLength = parseInt(data.video.length, 10);

            var progressBar = new ProgressBar('downloading :bar :percent', {
                complete: '█',
                incomplete: '-',
                width: 50,
                total: totalLength
            });

            progressBar.curr = 0;
            progressBar.update();

            ffmpeg(uri, { timeout: 432000 })
                .videoCodec('libx264')
                .audioCodec('aac')
                .addOption('-f', 'mpegts')
                .on('progress', function(progress) {
                    var current = progress.timemark.split(/[:.]+/);
                    current = parseInt(current[0], 10) * 3600 + parseInt(current[1], 10) * 60 + parseInt(current[2], 10);
                    progressBar.curr = current;
                    progressBar.update();
                })
                .on('end', function() {
                    progressBar.curr = progressBar.total;
                    progressBar.update();
                    process.exit(0);
                })
                .on('error', function(error) {
                    logger.error('failed download', error);
                    process.exit(1);
                })
                .save(filepath);
        });
};

module.exports = command;
