import './style.css';

const appDiv = document.getElementById('app');
appDiv.innerHTML = '<h1>Firebase DB latency test</h1>';
const myidElm = document.getElementById('myid');
const sendBtn = document.getElementById('send');
const logElm = document.getElementById('log');
const countElm = document.getElementById('clientcount');
const rtdbTable = document.getElementById('rtdbtable');

const sentat2Elm = document.getElementById('sentat2');
const responses2Table = document.getElementById('responsestable2');

import { initializeApp, getApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, child, push, set, remove, onValue, onDisconnect, serverTimestamp } from "firebase/database";
import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyALE_zSIPfqjyJw_bIOLYNpq7kqiKsD2nc", // auth
  projectId: "dblatency", // firestore
  databaseURL: "https://dblatency-default-rtdb.firebaseio.com", // rtdb
};
const RTDB_URLS = {
  "us-central1": "https://dblatency-default-rtdb.firebaseio.com/",
  "asia-southeast1": "https://dblatency-asia-southeast1.asia-southeast1.firebasedatabase.app/",
  "europe-west1": "https://dblatency-europe-west1.europe-west1.firebasedatabase.app/",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let rtdb = getDatabase(app); // TODO: do this based on dropdown
const firestore = getFirestore(app);

let root = ref(rtdb, 'latency');
let sendRef = child(root, "send");
let echoRef = child(root, "echo");
let myid, myEchoRTDBUnsub, myEchoFirestoreUnsub, mymsg, sendTimestamp;

for (const [name, url] of Object.entries(RTDB_URLS)) {
  // Create Firebase App instance
  initializeApp({ databaseURL: url }, name);

  // Add instance to results table
  // createElm('tr', [
  //   createElm('td', name }),
  //   createElm('td', { id: `rtdb-${name}` }),
  // ]);
  const row = document.createElement('tr');
  const nameCell = document.createElement('td');
  nameCell.innerText = name;
  row.appendChild(nameCell);
  const valueCell = document.createElement('td');
  valueCell.id = `rtdb-${name}`;
  row.appendChild(valueCell);
  rtdbTable.appendChild(row);
}

// Auth and presence
let lastConnectionInThisWindow;
onAuthStateChanged(auth, (user) => {
  if (user) {
    setMyID(user.uid);
    onValue(ref(rtdb, ".info/connected"), (snapshot) => {
      if (snapshot.val() === true) {
        const con = push(ref(rtdb, `users/${user.uid}`))
        onDisconnect(con).remove();
        set(con, serverTimestamp());
      }
    })
  }
  else {
    signInAnonymously(auth);
  }
});
onValue(ref(rtdb, "users"), (snapshot) => {
  console.log(`Got /users snapshot: ${JSON.stringify(snapshot.val())}, size=${snapshot.size}`);
  countElm.innerText = snapshot.size.toString();
})

const collectionRef = collection(firestore, "latency");
const sendDocRef = doc(collectionRef, "send");
const createElementWithText = (tag, textContent) => {
  const td = document.createElement(tag);
  td.textContent = textContent;
  return td;
};
const log = (msg) => {
  console.log(msg)
  const time = new Date().toISOString();
  logElm.value += `${time.substring(time.length-13)}: ${msg}\n`;
}

sendBtn.addEventListener("click", (e) => {
  mymsg = push(sendRef).key;
  sendTimestamp = Date.now();

  // Remove previous responses from database
  remove(child(echoRef, myid)); // remove previous echo nodes
  // TODO: remove previous echo docs?

  // Remove previous responses from UI
  //responsesTable.innerHTML = "";
  responses2Table.innerHTML = "";

  // Measure write latency to all RTDB instances
  for (const [name, url] of Object.entries(RTDB_URLS)) {
    const db = getDatabase(getApp(name));
    const myref = ref(db, `latency/${myid}`);
    const now = Date.now();
    const cell = document.getElementById(`rtdb-${name}`);
    console.log(`Writing ${now} to ${myref.toString()}`);
    set(myref, now).then(() => {
      cell.innerText = `${Date.now()-now}ms`;
    }).catch((e) => {
      console.error(e);
      log(`Error: ${e}`);
    });
  };

  // Send ping message that other clients will echo
  // setDoc(sendDocRef, { sender: myid, msg: mymsg, timestamp: sendTimestamp });
})


let echoCount = 0;
onValue(sendRef, (snapshot) => {
  if (!snapshot.exists()) return;
  const data = snapshot.val();
  if (data.sender !== myid && echoCount++ < 10) {
    set(child(child(echoRef, data.sender), myid), Date.now());
    // clear any data for our latest echo from the database)
    remove(child(echoRef, myid));
    log("Responded to RTDB ping from "+data.sender);
  }
  else {
    //sentatElm.innerText = data.timestamp + " (" + new Date(data.timestamp) + ")";
  }
});
function setMyID(newid) {
  if (myEchoRTDBUnsub) myEchoRTDBUnsub();
  if (myEchoFirestoreUnsub) myEchoFirestoreUnsub();

  myid = newid;
  myidElm.innerText = myid;

  myEchoRTDBUnsub = onValue(child(echoRef, myid), (snapshot) => {
    console.log(Date.now()+`Got response for RTDB ping with ${snapshot.size} nodes`);
    if (!snapshot.exists()) return;
    //responsesTable.innerHTML = "";
    // snapshot.forEach((responseSnapshot) => {
    //   const key = `rtdb_${responseSnapshot.key}`;
    //   let tr = document.getElementById(key);
    //   if (!tr) {
    //     console.log("adding result for "+key);
    //     const tr = document.createElement("tr");
    //     tr.id = key;
    //     tr.appendChild(createElementWithText("td", responseSnapshot.key));
    //     tr.appendChild(createElementWithText("td", responseSnapshot.val()));
    //     tr.appendChild(createElementWithText("td", (Date.now() - sendTimestamp)+"ms"));
    //     responsesTable.appendChild(tr);
    //   }
    // });
  })
  myEchoFirestoreUnsub = onSnapshot(collection(collectionRef, myid, "echo"), (snapshot) => {
    console.log(Date.now()+`: Got response for Firestore ping with ${snapshot.size} docs`);
    if (snapshot.empty) return;
    //responses2Table.innerHTML = "";
    snapshot.docs.forEach((responseSnapshot) => {
      const key = `fs_${responseSnapshot.id}`;
      let tr = document.getElementById(key);
      if (!tr) {
        console.log("adding result for "+key);
        const tr = document.createElement("tr");
        tr.id = key;
        tr.appendChild(createElementWithText("td", responseSnapshot.id));
        tr.appendChild(createElementWithText("td", responseSnapshot.data().timestamp));
        tr.appendChild(createElementWithText("td", (Date.now() - sendTimestamp)+"ms"));
        responses2Table.appendChild(tr);
      }
    });
  });
}

onSnapshot(sendDocRef, (snapshot) => {
  if (!snapshot.exists()) return;
  const data = snapshot.data();
  if (data.sender !== myid && echoCount++ < 10) {
    const echoDoc = doc(collectionRef, data.sender, "echo", myid);
    setDoc(echoDoc, { timestamp: Date.now() });
    log("Responded to Firestore ping from "+data.sender);
    // TODO: clear any data for our latest echo from Firestore (but not fro the UI?)
    getDocs(collection(collectionRef, myid, "echo")).then((snapshot) => {
      snapshot.docs.forEach((doc) => { deleteDoc(doc.ref); });
    })
  }
  else {
    sentat2Elm.innerText = data.timestamp + " (" + new Date(data.timestamp) + ")";
  }
});
