import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js';
import {
    getFirestore,
    collection,
    addDoc,
    getDocs
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: 'AIzaSyC1DKOSI9zfM0teA26B3mZsJKE7MBWBcAQ',
    authDomain: 'conlineexam-b1f71.firebaseapp.com',
    projectId: 'conlineexam-b1f71',
    storageBucket: 'conlineexam-b1f71.firebasestorage.app',
    messagingSenderId: '174324539283',
    appId: '1:174324539283:web:2d3ea5552f9bda13395266',
    measurementId: 'G-4Y9Z8TNQP2'
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

async function saveResult(studentName, marks, totalMarks) {
    const percentage = totalMarks > 0
        ? Math.round((marks / totalMarks) * 10000) / 100
        : 0;

    await addDoc(collection(db, 'results'), {
        name: studentName,
        marks: marks,
        total: totalMarks,
        percentage: percentage,
        submittedAt: new Date()
    });
}

async function getAllResults() {
    const querySnapshot = await getDocs(collection(db, 'results'));
    querySnapshot.forEach(function (doc) {
        console.log(doc.id, doc.data());
    });
}

window.ExamFirebase = {
    db: db,
    saveResult: saveResult,
    getAllResults: getAllResults
};
