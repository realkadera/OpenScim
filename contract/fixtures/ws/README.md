# `/api/ws` protocol 1 fixtures

One JSON file per message example of the lobby's WebSocket, `GET /api/ws`.
They are the source of truth for the wire format: `client/net/protocol.js`
must accept every valid server message and build every valid client
message exactly, and `test/test-net-protocol.mjs` checks that it does.

- `valid/*.json`: `{name, direction, when, body}`. `direction` is `client`
  (client to server) or `server` (server to client). Every `body` must
  parse, and re-serialize to the same JSON.
- `invalid/*.json`: `{name, direction, why, expect?, body}`. Each breaks
  exactly one rule, named in `why`, and must be rejected. For `client`
  fixtures, `expect` is what the server does with it: `{"error": "<code>"}`
  (an `error` frame; the socket stays open) or `{"close": <code>}`. Before
  `welcome`, every rejection closes with `4002` instead, except a `hello`
  whose `proto` or `enc` is wrong, which closes with `4010`.
- `upgrade/*.json`: the HTTP refusals of `GET /api/ws` (`route`, `method`,
  `status`, `body` in the standard error envelope). A browser sees each of
  them as a failed connection, without the status.

## Coordinates

Tiles are `[x, y]`: integers in the lobby's 64×64 grid, `0..=63` on each
axis, origin `[0, 0]` at the south-west corner, `+x` east, `+y` north. They
are exactly what the client's `SimulationEngine.getState()` returns as
`playerPosition`; nothing transforms them. Facing is the OSRS angle,
`0..=2047`: `0` south, `512` west, `1024` north, `1536` east
(`playerFacingAngle`).

`presence.walk-north` and `presence-tick.walk-north` pin this: a player
walking north from the start tile `[31, 25]` arrives with a larger `y`.
