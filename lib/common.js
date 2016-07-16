var request = require('request-promise');
var sprintf = require('sprintf-js').sprintf;

var URI = {};
URI.userInfo = 'https://api.younow.com/php/api/broadcast/info/user=%(username)s';
URI.broadcasts = 'https://api.younow.com/php/api/post/getBroadcasts/channelId=%(userId)s/startFrom=%(start)i';
URI.videoInfo = 'https://api.younow.com/php/api/broadcast/videoPath/broadcastId=%(broadcastId)s';

module.exports.URI = URI;

module.exports.request = function(uri, replace) {
    return request({
        uri: sprintf(uri, replace),
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/51.0.2704.79 Chrome/51.0.2704.79 Safari/537.36'
        },
        json: true
    });
};
