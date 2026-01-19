"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const parse_manpage_1 = require("./parse-manpage");
const emit_ts_1 = require("./emit-ts");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Load Config
const configPath = path_1.default.resolve(__dirname, '../schema-config.json');
const config = JSON.parse(fs_1.default.readFileSync(configPath, 'utf-8'));
const [networkHtml, netdevHtml] = process.argv.slice(2);
if (!networkHtml || !netdevHtml) {
    console.error('Usage: node index.js systemd.network.html systemd.netdev.html');
    process.exit(1);
}
const network = (0, parse_manpage_1.parseManPage)(networkHtml, 'network');
const netdev = (0, parse_manpage_1.parseManPage)(netdevHtml, 'netdev');
const ts = (0, emit_ts_1.emitSchema)(network, netdev, config);
process.stdout.write(ts);
