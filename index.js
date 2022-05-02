import './style.css';

const appDiv = document.getElementById('app');
appDiv.innerHTML = '<h1>Firebase DB latency test</h1>';
const responsesTable = document.getElementById('responsestable');
const myidElm = document.getElementById('myid');
const sentatElm = document.getElementById('sentat');
const sendBtn = document.getElementById('send');
const logElm = document.getElementById('log');
const countElm = document.getElementById('clientcount');

const sentat2Elm = document.getElementById('sentat2');
const responses2Table = document.getElementById('responsestable2');

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, child, push, set, remove, onValue, onDisconnect } from "firebase/database";
import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs, onSnapshot, serverTimestamp } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyALE_zSIPfqjyJw_bIOLYNpq7kqiKsD2nc", // auth
  projectId: "dblatency", // firestore
  databaseURL: "https://dblatency-default-rtdb.firebaseio.com", // rtdb
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const rtdb = getDatabase(app);
const firestore = getFirestore(app);

const root = ref(rtdb, 'latency');
const sendRef = child(root, "send");
const echoRef = child(root, "echo");
let myid, myEchoRTDBUnsub, myEchoFirestoreUnsub;

// Auth and presence
signInAnonymously(auth);
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
});
onValue(ref(rtdb, "users"), (snapshot) => {
  console.log(`Got users snapshot: ${JSON.stringify(snapshot.val())}, size=${snapshot.size}`);
  countElm.innerText = snapshot.size.toString();
})

const collectionRef = collection(firestore, "latency");
const sendDocRef = doc(collectionRef, "send");
const createCell = (value) => {
  const td = document.createElement("td");
  td.innerText = value;
  return td;
};
const log = (msg) => {
  console.log(msg)
  const time = new Date().toISOString();
  logElm.value += `${time.substring(time.length-13)}: ${msg}\n`;
}

sendBtn.addEventListener("click", (e) => {
  set(sendRef, { sender: myid, timestamp: Date.now() });
  setDoc(sendDocRef, { sender: myid, timestamp: Date.now() });
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
    sentatElm.innerText = data.timestamp + " (" + new Date(data.timestamp) + ")";
  }
});
function setMyID(newid) {
  if (myEchoRTDBUnsub) myEchoRTDBUnsub();
  if (myEchoFirestoreUnsub) myEchoFirestoreUnsub();

  myid = newid;
  myidElm.innerText = myid;

  myEchoRefUnsub = onValue(child(echoRef, myid), (snapshot) => {
    console.log(`Got response for RTDB ping with ${snapshot.size} nodes`);
    if (!snapshot.exists()) return;
    responsesTable.innerHTML = "";
    snapshot.forEach((responseSnapshot) => {
      const tr = document.createElement("tr");
      tr.appendChild(createCell(responseSnapshot.key));
      tr.appendChild(createCell(responseSnapshot.val()));
      tr.appendChild(createCell((Date.now() - responseSnapshot.val())+"ms"));
      responsesTable.appendChild(tr);
    });
  })
  myEchoFirestoreUnsub = onSnapshot(collection(collectionRef, myid, "echo"), (snapshot) => {
    console.log(`Got response for Firestore ping with ${snapshot.size} docs`);
    if (snapshot.empty) return;
    responses2Table.innerHTML = "";
    snapshot.docs.forEach((responseSnapshot) => {
      const tr = document.createElement("tr");
      tr.appendChild(createCell(responseSnapshot.id));
      tr.appendChild(createCell(responseSnapshot.data().timestamp));
      tr.appendChild(createCell((Date.now() - responseSnapshot.data().timestamp)+"ms"));
      responses2Table.appendChild(tr);
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
