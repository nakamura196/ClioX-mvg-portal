# Prototype (c): short demo video with English captions

Branch `proto/demo-video`. One line: a 98-second silent video, "Clio-X: a
first look for archivists", that walks through one dataset page with an
orange frame on each thing the English caption talks about — who holds the
records, the persistent identifier, the change log, "compute only", data
rooms, the network fee, and why a wallet is needed only to run an analysis.

- No narration, captions only. English captions are drawn into the picture;
  English and Japanese are also in the MP4 as selectable tracks (off by
  default) and as `captions.en.vtt` / `captions.ja.vtt`.
- Recorded from the portal as it is on `demo/ocr-i18n` (no UI changes on
  this branch). Sample: InterPARES Indexed Archival Dataset,
  `did:op:65e78d53…f43d` (Pontus-X devnet), same as the guided tour.
- The script is text: `scripts/demo-video/script.json` (13 captions, ja
  alongside each en). Edit it and run
  `zsh scripts/demo-video/build.zsh` with a dev server on port 8140 to get
  a new video in `docs/prototypes/demo-video/out/` (not committed; about
  4 MB).
- Loading waits are cut out. Frames come from the browser's own paint
  timestamps, so captions stay in sync (Playwright's built-in recorder
  drifted by 1–4 s).

Known limits: the page shows "No assets found" under algorithms and
"No file info available" (development data); the video does not point at
them. The captions are Claude's draft — the analogies (catalogue entry,
reference code, audit trail) should be checked by an archivist before
the video is shown outside.

Stills: `title.png`, `custodian.png`, `compute-tag.png`, `data-room.png`.
