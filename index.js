import './style.css';

const gel = (s) => document.getElementById(s);
const appDiv = gel('app');
appDiv.innerHTML = '<h1>Firebase DB latency test</h1>';
const myidElm = gel('myid');
const sendBtn = gel('send');
const logElm = gel('log');
const countElm = gel('clientcount');
const rtdbTable = gel('rtdbtable');
const firestoreTable = gel('firestoretable');
const autoMeasureElm = gel('automeasure');
const logToServerElm = gel('logtoserver');

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

let myid, myip;
let isLoggingEnabled = true, isAutoMeasureEnabled = false;

let rtdbHistory = {}, firestoreHistory = {};

function createElm(tagName, ...args) {
  const elm = document.createElement(tagName);
  for (const arg of args) {
    if (typeof arg === 'string') elm.innerText = arg
    else if (Array.isArray(arg)) for (let key in arg) elm.appendChild(arg[key])
    else if (typeof arg === 'object') for (let key in arg) elm.setAttribute(key, arg[key]);
  }
  return elm;
}

for (const [name, url] of Object.entries(RTDB_URLS)) {
  // Create Firebase App instance
  initializeApp({ databaseURL: url }, name);

  // Add history table
  rtdbHistory[name] = [];

  // Add instance to results table
  rtdbTable.appendChild(createElm('tr', [
    createElm('td', name),
    createElm('td', { id: `rtdb-${name}`, align: 'right' }),
    createElm('td', { id: `rtdb-min-${name}`, align: 'right' }),
    createElm('td', { id: `rtdb-max-${name}`, align: 'right' }),
    createElm('td', [
      createElm('canvas', { class: 'sparkline', id: `rtdb-sparkline-${name}`, 'data-sparkline': '0', width: 100, height: 20 }),
    ]),
]));}

for (const [label, name] of Object.entries(FIRESTORE_INSTANCES)) {
  firestoreHistory[label] = [];
  firestoreTable.appendChild(createElm('tr', [
    createElm('td', label),
    createElm('td', { id: `firestore-${label}`, align: 'right' }),
    createElm('td', { id: `firestore-min-${label}`, align: 'right' }),
    createElm('td', { id: `firestore-max-${label}`, align: 'right' }),
    createElm('td', [
      createElm('canvas', { class: 'sparkline', id: `firestore-sparkline-${label}`, 'data-sparkline': '0', width: 100, height: 20 }),
    ]),
  ]));
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
    console.log(`Writing ${now} to ${myref.toString()}`);
    set(myref, now).then(() => {
      const latency = Date.now()-now;
      const history = rtdbHistory[name];
      history.push({ t: Date.now(), l: latency });
      const vals = history.map(e => e.l);
      gel(`rtdb-${name}`).innerText = `${latency}ms`;
      gel(`rtdb-min-${name}`).innerText = `${Math.min(...vals)}ms`;
      gel(`rtdb-max-${name}`).innerText = `${Math.max(...vals)}ms`;
      const sparks = vals.toReversed().concat([0]);
      sparkline(gel(`rtdb-sparkline-${name}`), sparks);

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
    console.log(`Writing ${now} to ${myref.path}`);
    setDoc(myref, { timestamp: now, serverTimestamp: firestoreTimestamp() }).then(() => {
      const latency = Date.now()-now;
      const history = firestoreHistory[label];
      history.push({ t: Date.now(), l: latency });
      const vals = history.map(e => e.l);
      gel(`firestore-${label}`).innerText = `${latency}ms`;
      gel(`firestore-min-${label}`).innerText = `${Math.min(...vals)}ms`;
      gel(`firestore-max-${label}`).innerText = `${Math.max(...vals)}ms`;
      const sparks = vals.toReversed().concat([0]);
      sparkline(gel(`firestore-sparkline-${label}`), sparks);

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

// Sparkline.js below
function sparkline(c, spark) {
  var ctx = c.getContext("2d");
  ctx.reset();
  var min = Math.min.apply(Math, spark);
  var max = Math.max.apply(Math, spark);
  for (let a in spark) {
      spark[a] = parseInt(spark[a], 10);
      spark[a] += Math.abs(0 - min);
  }
  var scale = max - min;
  var margin = 0;
  var ratioW = ((c.width - margin * 2) * 1) / spark.length;
  var ratioH = ((c.height - margin * 2) * .8) / scale;
  var x = 0;
  var y = 0;
  var currentHeight = c.height - (spark[0] * ratioH + margin);
  for (let index in spark) {
      if (index == 0) {
          ctx.beginPath();
          ctx.lineWidth = "1";
          currentHeight = c.height - (spark[index] * ratioH + margin);
          ctx.moveTo(margin, currentHeight);
      }
      else {
          x = index * ratioW + margin;
          y = c.height - (spark[index] * ratioH + margin);
          ctx.lineTo(x, y);
      }
  }
  ctx.stroke();
}