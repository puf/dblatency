# dblatency

This page compares the client-to-client latency between the two databases that are part of Firebase: Realtime Database and Firestore.

When you click the <kbd>Send ping</kbd> the client write a message to a fixed path in RTDB and to a fixed document in Firestore.

It measures how long it takes for the write to complete and shows that in the tables.

[Run this](https://dblatency.stackblitz.io)

[🆕 Run this on Firebase Hosting](https://dblatency.web.app)

[Edit on StackBlitz ⚡️](https://stackblitz.com/edit/dblatency)

## TODO

- [x] Make it run on Firebase Hosting, since StackBlitz has been unreliable on this (age-old) template. It auto-deploys from GitHub, so you (well: I) can still edit from StackBlitz.
- [x] Add lark.sh RTDB-compatible database
- [ ] Add lark.sh database with its own SDK
- [ ] Add Firestore enterprise database (with good old API)
- [ ] Add Firestore enterprise database with pipeline SDK
- [ ] Allow a client to have a nickname, a region, IP (?), user-agent and more
- [x] Store results permanently in DB (after requesting permission)
- [ ] Lookup geolocation (or IP) and store (if enabled) (after requesting permission)
- [x] Allow the user to opt-in to logging their latencies to the databases
- [x] Allow the user to opt-in to auto-testing, meaning we re-run the tests every minute
- [ ] Show the last latency, and the average and variance (for past 30m)
- [ ] Store ID, auto-measure and logging opt-ins in cookie

