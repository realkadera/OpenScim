# Our client against the released Scim.GG source

On 2026-11-24 Scim.GG published its TypeScript source,
https://github.com/scimgg/scimgg (MIT). The files here map our reconstruction
against it, as of upstream commit `f1cab1f` and our `origin/main` of
2026-11-26.

- `PLAN.md` holds the verdict, the workstreams, the behaviour decisions and
  the list of our own work that no adoption may lose. Start here.
- There is one report per area: `engine-core.md`, `combat-rules.md`,
  `encounters.md` (with `encounters-*.md`), `renderer-cache.md`, `ui-app.md`
  and `data-tooling.md`. Each has a mapping table, the behavioural
  differences, the pieces only one side has, and a recommendation per
  component. Section 7 of each lists our own changes to keep.
- `renderer-cache-*.tsv` map the classes, methods and top-level bindings of
  `client/assets/rendering.js` and `player.js` to upstream. The pairs are
  positional (aligned between methods of the same name, by arity), so a pair
  is a candidate, not a fact. A rename made from them is checked by
  comparing the two method bodies first.

The reports were written by readers who could not edit the repository.
Their paths `U/...` are upstream's tree, `O/...` ours. Paths into a temporary
working folder (`scratchpad/...`) name intermediate files that are not kept.
Line numbers are those of the day.

Licensing questions raised by this comparison are handled separately and
are not part of these files.
