var Promise = require('bluebird');
var ffmpeg = require('fluent-ffmpeg');
var ProgressBar = require('progress');
var sprintf = require('sprintf-js').sprintf;
var logger = require('./logger');
var common = require('./common');

var command = {};

command.command = 'uri <uri>';

command.describe = 'Download broadcast by URI';

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
    var regexp = /.+(younow.com)\/(.+?)\/(\d+)\/.+/g;
    var match = regexp.exec(argv.uri);
    if (!match) {
        logger.error('invalid younow uri');
        process.exit(1);
    }

    var username = match[2];
    var broadcastId = parseInt(match[3], 10);

    logger.info('get video data for broadcast `%s`', broadcastId);

    /*
     * get video data
     */
    Promise.props({
            username: username,
            broadcastId: broadcastId,
            res: common.request(common.URI.videoInfo, {
                broadcastId: broadcastId
            })
        })
        .then(function(data) {
            if (data.res.errorCode !== 0) {
                throw new Error(data.res.errorMsg);
            }

            data.video = data.res;
            delete data.res;

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
                bid: data.broadcastId,
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
                })
                .on('error', function(error) {
                    logger.error('failed download', error);
                })
                .save(filepath);
        });
};

module.exports = command;
