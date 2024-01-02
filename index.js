import './style.css';

const appDiv = document.getElementById('app');
appDiv.innerHTML = '<h1>Firebase DB latency test</h1>';
const myidElm = document.getElementById('myid');
const sendBtn = document.getElementById('send');
const logElm = document.getElementById('log');
const countElm = document.getElementById('clientcount');
const rtdbTable = document.getElementById('rtdbtable');
const firestoreTable = document.getElementById('firestoretable');
const autoMeasureElm = document.getElementById('automeasure');
const logToServerElm = document.getElementById('logtoserver');

import { initializeApp, getApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, push, set, onValue, onDisconnect, serverTimestamp as rtdbTimestamp } from "firebase/database";
import { getFirestore, collection, doc, setDoc, addDoc, initializeFirestore, serverTimestamp as firestoreTimestamp } from "firebase/firestore";
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
  "us-west2": "us-west2",
  "asia-southeast1": "asia-southeast1",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let rtdb = getDatabase(app); // TODO: do this based on dropdown
const firestore = getFirestore(app);

let root = ref(rtdb, 'latency');
let myid, myip;
let isLoggingEnabled = true, isAutoMeasureEnabled = false;

function createElm(tagName, ...args) {
  const elm = document.createElement(tagName);
  for (const arg of args) {
    if (typeof arg === 'string') elm.innerText = arg
    else if (Array.isArray(arg)) for (let key in arg) elm.appendChild(arg[key])
    else if (typeof arg === 'object') for (let key in arg) elm[key] = arg[key];
  }
  return elm;
}

for (const [name, url] of Object.entries(RTDB_URLS)) {
  // Create Firebase App instance
  initializeApp({ databaseURL: url }, name);

  // Add instance to results table
  rtdbTable.appendChild(
    createElm('tr', [
      createElm('td', name),
      createElm('td', { id: `rtdb-${name}` }),
    ])
  );
}

for (const [label, name] of Object.entries(FIRESTORE_INSTANCES)) {
  firestoreTable.appendChild(
    createElm('tr', [
      createElm('td', label),
      createElm('td', { id: `firestore-${label}` }),
    ])
  );
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
        set(con, rtdbTimestamp());
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
      const latency = Date.now()-now;
      cell.innerText = `${latency}ms`;
      if (isLoggingEnabled) logToDatabase("RTDB", name, latency);
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
    setDoc(myref, { timestamp: now, serverTimestamp: firestoreTimestamp() }).then(() => {
      const latency = Date.now()-now;
      cell.innerText = `${latency}ms`;
      if (isLoggingEnabled) logToDatabase("Firestore", name, latency);
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

function getMyIP() {
  return fetch("https://api.ipify.org/?format=text").then(res => res.text());
}
const logDb = initializeFirestore(app, {}, "(default)");
const logs = collection(logDb, "logs");
async function logToDatabase(dbtype, instance, latency) {
  try {
    if (!myip) {
      myip = await getMyIP();
    }
    addDoc(logs, { 
      id: myid, ip: myip, dbtype, instance, latency, timestamp: firestoreTimestamp(),
      location: false, city: false, state:false, country: false, continent: false, 
    });
  } catch (e) {
    console.error(e);
  }
}

autoMeasureElm.checked = isAutoMeasureEnabled;
logToServerElm.checked = isLoggingEnabled;
let autoMeasureTimer = null;
autoMeasureElm.addEventListener("click", (e) => {
  setAutoMeasureEnabled(autoMeasureElm.checked);
})
logToServerElm.addEventListener("click", (e) => {
  isLoggingEnabled = logToServerElm.checked;
})
function setAutoMeasureEnabled(enabled) {
  if (isAutoMeasureEnabled) clearInterval(autoMeasureTimer);
  isAutoMeasureEnabled = enabled;
  if (isAutoMeasureEnabled) {
    sendBtn.click();
    autoMeasureTimer = setInterval(() => sendBtn.click(), 60000);
  }
}
