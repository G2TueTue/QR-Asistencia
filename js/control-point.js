/**
 * Sistema Web de Control de Asistencia y Cálculo de Remuneraciones
 * js/control-point.js - Lógica del Punto de Control QR (Redirecciones de Portal)
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar Generadores de Códigos QR para los Portales
    generateQRCodes();

    // 2. Iniciar Reloj en Vivo
    startClock();
});

// Generación de códigos QR de tamaño estándar mediante QRious
function generateQRCodes() {
    try {
        const qrColor = '#0B0F19';
        const qrBg = '#FFFFFF';
        const qrSize = 170;

        // 1. QR Link Portal Trabajador (Acceso Móvil)
        new QRious({
            element: document.getElementById('qr-link-worker-canvas'),
            value: 'https://g2tuetue.github.io/QR-Asistencia/worker.html',
            size: qrSize,
            level: 'H',
            foreground: qrColor,
            background: qrBg
        });

        // 2. QR Link Portal Supervisor (Acceso Consola)
        new QRious({
            element: document.getElementById('qr-link-supervisor-canvas'),
            value: 'https://g2tuetue.github.io/QR-Asistencia/supervisor.html',
            size: qrSize,
            level: 'H',
            foreground: qrColor,
            background: qrBg
        });

    } catch (e) {
        console.error("Error al generar códigos QR con la librería QRious:", e);
    }
}

// Reloj en tiempo real
function startClock() {
    const timeElement = document.getElementById('live-time');
    const dateElement = document.getElementById('live-date');

    function update() {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

        const dateOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        dateElement.textContent = now.toLocaleDateString('es-CL', dateOptions);
    }

    setInterval(update, 1000);
    update();
}
