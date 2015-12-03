/**
 * @author rik
 */
var _ = require('lodash');
var path = require('path');
var http = require('http');
var https = require('https');
var fs = require('fs');
var connect = require('connect');
var es = require("event-stream");
var liveReload = require("connect-livereload");
var tinyLr = require("tiny-lr");
var serveStatic = require('serve-static');

function PushStateAssetServer(options) {
  _.defaults(options, PushStateAssetServer.defaults);

  options.index = path.join(options.root, options.index);

  var _connect = connect();

  _.each(makeMiddleware(options), function (middleware) {
    _connect.use(middleware);
  });

  var server = makeServer(options, _connect);
  var root = typeof options.root === "object" ? options.root[0] : options.root;

  _connect.use(serveStatic(root));

  var props = {
    port: {
      value: options.port
    },
    root: {
      value: options.root
    },
    host: {
      value: options.host
    },
    debug: {
      value: options.debug
    },
    connect: {
      value: _connect
    },
    server: {
      value: server
    }
  };

  return Object.create(PushStateAssetServer.prototype, props);
}

PushStateAssetServer.defaults = {
  port: 9000,
  root: path.dirname(module.parent.id),
  index: 'index.html',
  host: "localhost",
  livereload: false,
  debug: false
};

PushStateAssetServer.prototype = {

  start: function () {
    var self = this;

    this.server.listen(this.port, function (_this) {
      return function (err) {
        var sockets, stopServer, stopped;

        if (err) {
          return _this.log("Error on starting server: " + err);
        } else {
          _this.log("Server started http" + (self.options.https != null ? 's' : '') + "://" + self.options.host + ":" + self.options.port);

          stopped = false;
          sockets = [];

          server.on("connection", function (socket) {
            sockets.push(socket);
            return socket.on("close", function () {
              return sockets.splice(sockets.indexOf(socket), 1);
            });
          });

          stopServer = function () {
            if (!stopped) {
              sockets.forEach(function (socket) {
                return socket.destroy();
              });

              server.close();

              return process.nextTick(function () {
                return process.exit(0);
              });
            }
          };

          process.on("SIGINT", stopServer);
          process.on("exit", stopServer);

          if (self.options.livereload) {
            startLiveReload(self);
          }
        }
      };
    });
  },

  close: function () {
    return this.server.close();
  },

  reload: function () {
    var self = this;

    return es.map(function (file, callback) {
      if (self.options.livereload && typeof self.lr === "object") {
        self.lr.changed({
          body: {
            files: file.path
          }
        });
      }

      return callback(null, file);
    });
  }

};

function startLiveReload(assetServer) {
  tinyLr.Server.prototype.error = function () {
  };

  if (assetServer.options.https && typeof assetServer.options.https === 'object') {
    lr = tinyLr({
      key: assetServer.options.https.key || fs.readFileSync(__dirname + '/certs/server.key'),
      cert: assetServer.options.https.cert || fs.readFileSync(__dirname + '/certs/server.crt')
    });
  } else {
    lr = tinyLr();
  }

  lr.listen(assetServer.options.livereload.port);

  return assetServer.lr = lr;
}

// @todo call function with context of PushStateAssetServer instance
function makeMiddleware(opt) {
  var middleware = opt.middleware ? opt.middleware.call(null, connect, opt) : [];

  if (opt.livereload) {
    makeLiveReloadMiddleware(opt, middleware)
  }

  makeRootMiddleware(opt, middleware);

  if (opt.index) {
    makeFallbackMiddleware(opt, middleware);
  }

  return middleware;
}

function makeLiveReloadMiddleware(opt, dstArr) {
  if (typeof opt.livereload === "boolean") {
    opt.livereload = {};
  }

  if (!opt.livereload.port) {
    opt.livereload.port = 35729;
  }

  dstArr.push(liveReload({
    port: opt.livereload.port
  }));
}

function makeRootMiddleware(opt, dstArr) {
  if (typeof opt.root === "object") {
    opt.root.forEach(function (path) {
      return dstArr.push(serveStatic(path));
    });
  } else {
    dstArr.push(serveStatic(opt.root));
  }
}

function makeFallbackMiddleware(opt, dstArr) {
  dstArr.push(function (req, res) {
    return fs.createReadStream(opt.index).pipe(res);
  });
}

function makeServer(opt, _connect) {
  if (opt.https && typeof opt.https === 'object') {
    return https.createServer({
      key: opt.https.key || fs.readFileSync(__dirname + '/certs/server.key'),
      cert: opt.https.cert || fs.readFileSync(__dirname + '/certs/server.crt'),
      ca: opt.https.ca || fs.readFileSync(__dirname + '/certs/ca.crt'),
      passphrase: opt.https.passphrase || 'asset-server'
    }, _connect);
  } else {
    return http.createServer(_connect);
  }
}

module.exports = PushStateAssetServer;