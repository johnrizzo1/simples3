// Finds a free port starting from the preferred port (default 5173).
// Usage: node scripts/find-free-port.cjs [preferred_port]
// Prints the available port number to stdout.

const net = require('net');

const preferred = parseInt(process.argv[2] || '5173', 10);

function tryPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(tryPort(port + 1));
      } else {
        reject(err);
      }
    });
    server.once('listening', () => {
      server.close(() => resolve(port));
    });
    server.listen(port, '127.0.0.1');
  });
}

tryPort(preferred).then((port) => {
  console.log(port);
});
