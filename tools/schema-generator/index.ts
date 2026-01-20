import { parseManPage } from './parse-manpage';
import { emitSchema } from './emit-ts';

const [networkHtml, netdevHtml, linkHtml] = process.argv.slice(2);

if (!networkHtml || !netdevHtml) {
  console.error('Usage: node index.js systemd.network.html systemd.netdev.html [systemd.link.html]');
  process.exit(1);
}

const network = parseManPage(networkHtml, 'network');
const netdev = parseManPage(netdevHtml, 'netdev');
const link = linkHtml ? parseManPage(linkHtml, 'link') : undefined;

const ts = emitSchema(network, netdev, link);
process.stdout.write(ts);
