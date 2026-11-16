import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import worker from '../dist/worker.mjs';

const port = Number(process.argv[2] ?? 8080);
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, 'http://localhost');
    const request = new Request(url, { method: incoming.method, headers: incoming.headers });
    const response = await worker.fetch(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) {
      Readable.fromWeb(response.body).pipe(outgoing);
    } else {
      outgoing.end();
    }
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500);
    outgoing.end('Local release could not serve this request.');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Frostfall release at http://127.0.0.1:${server.address().port}/`);
});
