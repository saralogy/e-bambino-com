# Test fixtures (synthetic, NOT real Search Console data)

`FIXTURE-gsc-pages.csv` is invented test input for `scripts/outcomes/import-gsc.mjs`. Every number in it is
made up. It covers merging of URL variants (www, http, query string), a German page, thousands separators,
the home page and a foreign host (the last three must be reported as unmapped).

Never commit Outcome or Run nodes produced from a fixture. After a test run, delete them
(`git status knowledge/nodes`, then remove the new `outcome/` and `run/` files), or use `--dry-run`.
