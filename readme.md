# pushstate-asset-server

A server that

# installing

```
npm install pushstate-asset-server
```

# usage

```
var server = PushStateAssetServer({
  root: serverRoot,
  port: 9000, // default 9000
  index: 'index.html', // default 'index.html'
  host: 'localhost', // default 'localhost'
  debug: false, // default false
  livereload: false // default false
});

// start the server
server.start();

// stop the server
server.stop();
```