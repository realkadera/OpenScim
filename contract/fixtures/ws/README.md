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

A client message is at most 4096 bytes (`welcome.limits.max_message_bytes`);
a bigger one closes the socket with `1009`. Server messages can be larger.
`error` `room_closed` means the client is in no room any more and sends
`join` again.

## Coordinates

Tiles are `[x, y]`: integers in the lobby's 64×64 grid, `0..=63` on each
axis, origin `[0, 0]` at the south-west corner, `+x` east, `+y` north. They
are exactly what the client's `SimulationEngine.getState()` returns as
`playerPosition`; nothing transforms them. Facing is the OSRS angle,
`0..=2047`: `0` south, `512` west, `1024` north, `1536` east
(`playerFacingAngle`).

`face`, optional on `presence`, on a `presence_tick` delta and on a member,
is the id of the player the sender keeps facing (the leader it follows). It
is left out, never `null`, when there is nobody; a `presence` without it ends
the facing. A client draws that player turned to the faced one every frame,
also while it walks, and uses `facing` again when `face` is gone.

`presence.walk-north` and `presence-tick.walk-north` pin this: a player
walking north from the start tile `[31, 25]` arrives with a larger `y`.

## Chat

`chat{rid?, text}`, sent only while joined, is relayed as
`chat{id, name, text, tick}` to every member of the sender's instance, the
sender included, at once and in the room's order. Nothing is stored. The
server cleans the text, then relays it as plain text. In order:

1. every White_Space character, and U+2800 BRAILLE PATTERN BLANK, U+3164
   HANGUL FILLER, U+FFA0 HALFWIDTH HANGUL FILLER and U+16FE4 KHITAN SMALL
   SCRIPT FILLER, becomes U+0020;
2. every character of General_Category Cc, Cf, Zl, Zp, Co or Cn (Cn
   includes the noncharacters such as U+FFFE and U+10FFFF), every
   Default_Ignorable_Code_Point, and U+FFFC OBJECT REPLACEMENT CHARACTER is
   removed;
3. NFC;
4. a combining mark (General_Category M) is removed when nothing comes before
   it or the character before it is U+0020; after any other character at
   most 2 marks are kept and the rest are removed;
5. runs of U+0020 become one U+0020, and leading and trailing U+0020 are
   removed;
6. a line with no character of General_Category L, N, P or S is `empty`;
7. a line of more than `chat_max_chars` Unicode scalar values is `too_long`.

Before any of this, a raw `text` longer than 16 × `chat_max_chars` bytes
(UTF-8) is `too_long` at once.

**"80 characters" means 80 Unicode scalar values of the cleaned text** (in
JavaScript: `[...cleaned].length`, not `cleaned.length`, which counts UTF-16
units). An emoji outside the BMP is 1; `e` + combining acute is 1 after NFC.
OSRS effect prefixes (`red:`, `wave:`, `glow1:scroll:`) are ordinary text: they
count, and the server never parses them. Over the limit is `too_long`, never
truncated. The limit is `welcome.limits.chat_max_chars` (80).

One line per user every `welcome.limits.chat_interval_ms` (4000), across
tabs and reconnects, and at most one line a second per client address
across accounts; sooner is `chat_rejected{reason: "rate_limited",
retry_in_ms}`. Only refused-by-rate lines carry `retry_in_ms`. A refused
line spends no interval.

`chat_rejected{rid?, reason}` names the refusal: `too_long`, `empty`,
`rate_limited`, `chat_off`, `not_joined` or `muted` (an operator muted the
user). The checks, in order: chat off (`chat_off`), not in a room
(`not_joined`), raw size (`too_long`), muted (`muted`), the rate
(`rate_limited`), then the cleaning rule (`empty`, `too_long`). `welcome.features.chat` says
whether chat is on; `notice{kind: "chat_off"}` and `notice{kind: "chat_on"}`
switch it while connected. No styling comes over the network: names and
texts are plain text, never markup or game tags.
