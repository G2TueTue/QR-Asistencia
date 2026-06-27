/**
 * Sistema Web de Control de Asistencia y Cálculo de Remuneraciones
 * js/firebase-config.js - Configuración e Inicialización de Firebase
 * 
 * INSTRUCCIONES PARA PASAR A PRODUCCIÓN EN LA WEB (OPCIONAL PARA TESIS):
 * 
 * 1. Ve a la consola de Firebase: https://console.firebase.google.com/
 * 2. Crea un nuevo proyecto llamado "Control Asistencia QR" (o el nombre que gustes).
 * 3. Habilita "Authentication" y activa el método de inicio de sesión "Correo electrónico y contraseña"
 *    o gestiona los accesos mediante Firestore.
 * 4. Habilita "Cloud Firestore" en modo de prueba o producción y crea las colecciones:
 *    - 'usuarios': Documentos con ID = RUT, campos: { nombre, rol, sueldo_base, horas_meta }
 *    - 'asistencias': Documentos con ID auto-generado, campos: { rut, fecha, marca_tiempo, tipo, origen }
 * 5. Registra una aplicación Web en tu proyecto de Firebase, copia los valores del objeto `firebaseConfig`
 *    y pégalos a continuación.
 * 6. En `js/database.js`, cambia la constante `USE_FIREBASE` a `true`.
 */

// Configuración de Firebase (Remplaza con tus llaves de Firebase Console)
const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUÍ",
    authDomain: "TU_PROJECT_ID.firebaseapp.com",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_PROJECT_ID.appspot.com",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
};

// Variable para verificar si el usuario completó la configuración
const isFirebaseConfigured = firebaseConfig.apiKey !== "TU_API_KEY_AQUÍ";

let db = null;
let auth = null;

if (isFirebaseConfigured) {
    try {
        // Inicializar Firebase
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        console.log("Firebase inicializado correctamente de forma global.");
    } catch (error) {
        console.error("Error al inicializar Firebase. Revisa tus credenciales:", error);
    }
} else {
    console.log("Modo Demo Activo: Utilizando LocalStorage localmente.");
}

// Exponer en el objeto global de la ventana
window.FirebaseDB = db;
window.FirebaseAuth = auth;
window.IsFirebaseConfigured = isFirebaseConfigured;
