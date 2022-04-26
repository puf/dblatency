import './style.css';

const appDiv = document.getElementById('app');
appDiv.innerHTML = '<h1>Firebase DB latency test</h1>';
const responsesTable = document.getElementById('responsestable');
const myidElm = document.getElementById('myid');
const sentatElm = document.getElementById('sentat');
const sendBtn = document.getElementById('send');
const logElm = document.getElementById('log');

const sentat2Elm = document.getElementById('sentat2');
const responses2Table = document.getElementById('responsestable2');

import { initializeApp } from "firebase/app";
import { getDatabase, ref, child, push, set, remove, onValue } from "firebase/database";
import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from "firebase/firestore";
const firebaseConfig = {
  projectId: "dblatency",
  databaseURL: "https://dblatency-default-rtdb.firebaseio.com",
};

const app = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);
const firestore = getFirestore(app);

const root = ref(rtdb, 'latency');
const sendRef = child(root, "send");
const myid = push(sendRef).key;
myidElm.innerText = myid;
const echoRef = child(root, "echo");

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
onValue(child(echoRef, myid), (snapshot) => {
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
onSnapshot(collection(collectionRef, myid, "echo"), (snapshot) => {
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