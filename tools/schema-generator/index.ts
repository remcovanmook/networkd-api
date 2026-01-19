import { parseManPage } from './parse-manpage';
import { emitSchema, SchemaConfig } from './emit-ts';
import fs from 'fs';
import path from 'path';

// Load Config
const configPath = path.resolve(__dirname, '../schema-config.json');
const config: SchemaConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const [networkHtml, netdevHtml] = process.argv.slice(2);

if (!networkHtml || !netdevHtml) {
  console.error('Usage: node index.js systemd.network.html systemd.netdev.html');
  process.exit(1);
}

const network = parseManPage(networkHtml, 'network');
const netdev = parseManPage(netdevHtml, 'netdev');

const ts = emitSchema(network, netdev, config);
process.stdout.write(ts);
