import './style.css';

const appDiv = document.getElementById('app');
appDiv.innerHTML = '<h1>Firebase DB latency test</h1>';
const myidElm = document.getElementById('myid');
const sendBtn = document.getElementById('send');
const logElm = document.getElementById('log');
const countElm = document.getElementById('clientcount');
const rtdbTable = document.getElementById('rtdbtable');
const firestoreTable = document.getElementById('firestoretable');

import { initializeApp, getApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, child, push, set, remove, onValue, onDisconnect, serverTimestamp } from "firebase/database";
import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs, onSnapshot, initializeFirestore, serverTimestamp } from "firebase/firestore";
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
const FIRESTORE_INSTANCES = {
  "nam5": "(default)",
  "eur3": "eur3",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let rtdb = getDatabase(app); // TODO: do this based on dropdown
const firestore = getFirestore(app);

let root = ref(rtdb, 'latency');
let myid;

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

for (const [label, name] of Object.entries(FIRESTORE_INSTANCES)) {
  const row = document.createElement('tr');
  const nameCell = document.createElement('td');
  nameCell.innerText = label;
  row.appendChild(nameCell);
  const valueCell = document.createElement('td');
  valueCell.id = `firestore-${label}`;
  row.appendChild(valueCell);
  firestoreTable.appendChild(row);

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

  // Measure write latency to all Firestore instances
  for (const [label, name] of Object.entries(FIRESTORE_INSTANCES)) {
    const db = initializeFirestore(app, {}, name);
    const myref = doc(db, "latency", myid);
    const now = Date.now();
    const cell = document.getElementById(`firestore-${label}`);
    console.log(`Writing ${now} to ${myref.path}`);
    setDoc(myref, { timestamp: now, serverTimestamp: serverTimestamp() }).then(() => {
      console.log(`Firestore: ${Date.now()-now}ms`)
      cell.innerText = `${Date.now()-now}ms`;
    }).catch((e) => {
      console.error(e);
      log(`Error: ${e}`);
    });
  }
})

function setMyID(newid) {
  myid = newid;
  myidElm.innerText = myid;
}
