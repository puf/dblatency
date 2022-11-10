# dblatency

This page compares the client-to-client latency between the two databases that are part of Firebase: Realtime Database and Firestore.

When you click the <kbd>Send ping</kbd> the client write a message to a fixed path in RTDB and to a fixed document in Firestore.

All clients listen for this path/document, and when they receive an update, they write a response back to another path based on the sender and their own ID.

The original sender receives those responses, and shows how long it took to get each of them.

[Edit on StackBlitz ⚡️](https://stackblitz.com/edit/dblatency)

## TODO

[x] BUG: we should only calculate the latency when we get the first response from a remote
[ ] BUG: we write the Firestore serverTimestamp sentinel to the /users/$uid node in RTDB
[ ] Allow a client to have a nickname, a region, IP (?), user-agent and more
[ ] Store results permanently in DB (after requesting permission)
[ ] Lookup geolocation (or IP) and store (if enabled) (after requesting permission)
[ ] Show multiple regions for RTDB
[ ] Show multiple regions for Firestore
