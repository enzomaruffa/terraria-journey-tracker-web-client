# Terraria Journey Tracker — Web Client

The UI for [terraria-journey-tracker-server](https://github.com/enzomaruffa/terraria-journey-tracker-server):
research progress for a Terraria **Journey mode** character, updating live as you play.

Svelte 5 + SvelteKit 2, built to a static bundle with no backend of its own.

## Two ways it runs

**With the tracker.** The Python server serves this build from its own port and pushes
updates over a WebSocket whenever your character file changes. One command, one URL, no Node
needed by the end user — see the server's README.

**On its own.** Drop a `.plr` onto the page. It is decrypted and parsed in the browser with
WebCrypto and never leaves your machine. On Chrome and Edge the page keeps a handle to the
file and re-reads it as you play, so it stays live without a server at all. Other browsers
parse it once per drop.

## Development

```sh
npm install
npm run sync-data -- ../terraria-journey-tracker-server/data
npm run dev
```

<http://localhost:5173>. `/api` is proxied to the tracker on port 4777, so the same relative
URLs work in development and in the bundled build — there is no port to configure anywhere in
the client.

`sync-data` copies the item, recipe and station snapshots into `static/data/`. They are what
the serverless mode reads, and they are committed, so this only needs re-running when the
server's data is regenerated for a new Terraria version.

```sh
npm run check     # svelte-check
npm run lint      # prettier + eslint
npm test          # vitest
npm run build     # -> build/
```

## Hosting it standalone

```sh
docker build -t terraria-tracker-web .
docker run -p 8080:80 terraria-tracker-web
```

That serves the drag-and-drop mode from nginx with no tracker behind it. To run it against a
live character file instead, build the server image — it bundles this client.

## How the browser reads a .plr

Character files are AES-128-CBC encrypted under a key Terraria ships in its own binary. The
research table sits inside a binary blob whose layout changes with most content patches, so
rather than seeking to a fixed offset the parser searches for the table by its shape: a run
of length-prefixed item internal names each followed by an `int32`, cross-checked against the
item list and against the entry count Terraria stores just ahead of it.

This mirrors `src/terraria_tracker/plr/` on the server, and the two implementations are
tested against each other's output.

## License

[MIT](https://choosealicense.com/licenses/mit/)
