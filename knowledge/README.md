# knowledge/: the project's long-term memory

This folder holds a graph of what e-bambino knows: the pages, the sources, the claims and the evidence behind them,
the opportunities and briefs, the reviews, the runs, the outcomes and the lessons. It is plain JSON tracked in git,
so it has no database and git history serves as the audit trail.

- `nodes/<type>/<id>.json`: one file per node. Edges are stored on the source node.
- `graph.json`: the compiled view with adjacency lists. Build it with `npm run kg:build`. It is gitignored.
- `STOP`: if this file exists, every automated job halts. Only a human removes it.

The schema is in `scripts/kg/schema.mjs` and the rules are in `docs/system/CONTRACT.md`.

## Reading (agents: do this before proposing or writing anything)

```bash
npm run kg -- stats
npm run kg -- search "stroller"            # is the topic already covered?
npm run kg -- pages --status held-ymyl
npm run kg -- show opp:on-the-go-stroller-buying-guide
npm run kg -- neighbors page:en/safety/car-seat-installation-check CITES
```

In code: `import { loadGraph, byType, get, neighbors, search } from './scripts/kg/lib.mjs'`.

## Writing

- **Never hand-edit Page or Source nodes.** They are derived from the content by `npm run kg:sync`. To change one,
  change the content and sync again.
- Write other nodes with `writeNode()` from `scripts/kg/lib.mjs` and build their IDs with `idFor.*`. Writes are
  deterministic and merge edges without duplicating them.
- Record each run as a Run node with PRODUCED edges to what it made.
- Only a human may record a Review with `result: "approve"`.
- Before committing, run `npm run kg:sync`, then `npm run kg:check`. The check must report 0 errors.
