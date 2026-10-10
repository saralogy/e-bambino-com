/**
 * build.mjs — compile knowledge/nodes/ into knowledge/graph.json (npm run kg:build).
 * The output is gitignored; rebuild it whenever you need the adjacency view.
 */
import { buildGraph, GRAPH_FILE, loadNodes, stopped } from './lib.mjs';

if (stopped()) {
  console.log('knowledge/STOP is present: kg:build halted.');
  process.exit(0);
}
const out = buildGraph(loadNodes());
console.log(`kg:build  ${Object.keys(out.nodes).length} nodes -> ${GRAPH_FILE.replace(/.*\/knowledge\//, 'knowledge/')}`);
