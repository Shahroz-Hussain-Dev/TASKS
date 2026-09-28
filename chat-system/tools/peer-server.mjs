// Tiny local PeerJS signalling server used by the e2e test (bound to 127.0.0.1 so IPv6-less sandboxes work).
import { createRequire } from 'node:module';
import http from 'node:http';
const require = createRequire(process.env.PW_REQUIRE_FROM || import.meta.url);
const { ExpressPeerServer } = require('peer');
const express = require('express');
const port = Number(process.argv[2] || 9000);
const app = express();
const server = http.createServer(app);
app.use('/', ExpressPeerServer(server, { path: '/', allow_discovery: false }));
server.listen(port, '127.0.0.1', () => console.log(`peer server on 127.0.0.1:${port}`));
