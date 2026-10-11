/**
 * cli.mjs — read-only queries over the knowledge graph (npm run kg -- <cmd>).
 *
 *   stats                       node counts by type, page counts by status
 *   show <id>                   one node with its in/out edges
 *   neighbors <id> [rel] [in|out|both]
 *   search <text>               full-text search over node fields
 *   pages --status <status>     pages by status (published, held-ymyl, ...)
 */
import { byType, countByType, get, loadGraph, neighbors, search } from './lib.mjs';

const [cmd, ...args] = process.argv.slice(2);
const g = loadGraph();
const label = (n) => `${n.id}  ${n.title ?? n.question ?? n.text?.slice(0, 80) ?? n.what?.slice(0, 80) ?? n.name ?? n.url ?? ''}`;
const strip = ({ __file, ...n }) => n;

switch (cmd) {
  case 'stats': {
    console.log('nodes by type');
    for (const [t, c] of Object.entries(countByType(g.nodes))) console.log(`  ${t.padEnd(12)} ${c}`);
    const status = {};
    for (const p of byType(g, 'page')) status[`${p.lang} ${p.status}`] = (status[`${p.lang} ${p.status}`] ?? 0) + 1;
    console.log('pages by language and status');
    for (const [k, c] of Object.entries(status).sort()) console.log(`  ${k.padEnd(20)} ${c}`);
    const edges = [...g.out.values()].reduce((a, e) => a + e.length, 0);
    console.log(`edges ${edges}`);
    break;
  }
  case 'show': {
    const n = get(g, args[0]);
    if (!n) { console.error(`not found: ${args[0]}`); process.exit(1); }
    console.log(JSON.stringify(strip(n), null, 2));
    const inc = g.in.get(n.id) ?? [];
    if (inc.length) console.log(`incoming:\n${inc.map((e) => `  ${e.from} -${e.rel}->`).join('\n')}`);
    break;
  }
  case 'neighbors': {
    const [id, rel, dir = 'both'] = args;
    for (const n of neighbors(g, id, rel && rel !== '-' ? rel : undefined, dir)) console.log(label(n));
    break;
  }
  case 'search': {
    for (const n of search(g, args.join(' '))) console.log(label(n));
    break;
  }
  case 'pages': {
    const i = args.indexOf('--status');
    const want = i >= 0 ? args[i + 1] : undefined;
    for (const p of byType(g, 'page').filter((p) => !want || p.status === want).sort((a, b) => a.id.localeCompare(b.id))) {
      console.log(`${p.status.padEnd(14)} ${p.id}`);
    }
    break;
  }
  default:
    console.log('usage: npm run kg -- stats | show <id> | neighbors <id> [rel|-] [in|out|both] | search <text> | pages --status <s>');
    process.exit(cmd ? 1 : 0);
}
