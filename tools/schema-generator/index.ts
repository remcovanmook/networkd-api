// tools/schema-generator/index.ts

import { parseManPage } from './parse-manpage';
import { emitSchema } from './emit-ts';

const [networkHtml, netdevHtml] = process.argv.slice(2);

if (!networkHtml || !netdevHtml) {
  console.error('Usage: node index.js systemd.network.html systemd.netdev.html');
  process.exit(1);
}

const network = parseManPage(networkHtml, 'network');
const netdev = parseManPage(netdevHtml, 'netdev');

const ts = emitSchema(network, netdev);
process.stdout.write(ts);
