var path = require('path'),
    rAppidJsNode = require('lib/rAppidJsNode.js'),
    jsdom = require('jsdom').jsdom,
    flow = require('flow');

var optimize = function (args, callback) {
    if (args.length >= 2 && args.length <= 4) {

        var applicationDir = args[0],
            applicationMain = args[1],
            indexFileName = "index.html",
            configFileName = "config.json",
            applicationBaseUrl = args[2] || "";

        flow()
            .seq("applicationContext", function(cb){
                rAppidJsNode.createApplicationContext(applicationDir, applicationMain, configFileName, applicationBaseUrl, cb);
            })
            .seq("systemManager", function(cb){
                // create an document
                var doc = jsdom('<html><head></head><body></body></html>');

                this.vars.applicationContext.createApplicationInstance(doc, function (err, systemManager, application) {
                    cb(null, systemManager);
                });
            })
            .seq(function(cb) {
                // start the application
                this.vars.systemManager.$application.start(null, cb);
            })
            .exec(function(err, results) {
                if (err) {
                    console.log(err);
                } else {
                    console.log(results.systemManager.$applicationDomain);
                }
            });

    } else {
        // show usage
        callback(true);
    }
};

optimize.usage = "rappidjs optimize <directory> <applicationMain> [applicationBaseUrl] [configFile]" +
                    "\tdirectory - public directory of the application" +
                    "\tapplicationMain - application file" +
                    "\tconfigFile - config file [config.json]";

module.exports = optimize;

