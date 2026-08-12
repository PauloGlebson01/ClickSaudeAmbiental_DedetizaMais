// firebase-config.js - Configuração do Firebase com suporte multi-empresa

//CONFIGURAÇÕES DE DADOS
const firebaseConfig = {
    apiKey: "AIzaSyDHt9ZAm6LfU77RP4OVvwxCyZ7q-NYoi00",
    authDomain: "dedetiza-mais.firebaseapp.com",
    projectId: "dedetiza-mais",
    storageBucket: "dedetiza-mais.firebasestorage.app",
    messagingSenderId: "559555651090",
    appId: "1:559555651090:web:74d21126e40ea13c919acb",
    measurementId: "G-4YQ6WJH6PX"
};

if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    console.log('🔥 Firebase inicializado com sucesso!');
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

console.log('✅ Firebase Config carregado!');