// firebase-config.js - Configuração do Firebase com suporte multi-empresa

//CONFIGURAÇÕES DE DADOS
const firebaseConfig = {
  apiKey: "AIzaSyDL7SSJhSX_nTyofv-lgN16XiDgNrdmil0",
  authDomain: "dedetizemais-teste.firebaseapp.com",
  projectId: "dedetizemais-teste",
  storageBucket: "dedetizemais-teste.firebasestorage.app",
  messagingSenderId: "498228175971",
  appId: "1:498228175971:web:e06cf995fbf8d160374456",
  measurementId: "G-STDFBGF2BW"
};

if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
} else {
    console.error('❌ Firebase não carregado!');
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

if (db.settings) {
    db.settings({
        timestampsInSnapshots: true,
        merge: true
    });
}

// ============================================
// EXPORTAÇÃO PARA COMPATIBILIDADE
// ============================================

window.auth = auth;
window.db = db;
window.storage = storage;