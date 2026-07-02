/**
 * Sistema Web de Control de Asistencia y Cálculo de Remuneraciones
 * js/control-point.js - Lógica del Punto de Control QR (Multicódigos y Zoom)
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar Generadores de Códigos QR
    generateQRCodes();

    // 2. Iniciar Reloj en Vivo
    startClock();

    // 3. Configurar listeners de clic programáticos en las tarjetas (Brave Compatibility)
    setupQRClickEvents();

    // 4. Configurar eventos de cierre para la modal de zoom
    setupZoomCloseEvents();
});

// Generación de códigos QR de tamaño estándar mediante QRious
function generateQRCodes() {
    try {
        const qrColor = '#0B0F19';
        const qrBg = '#FFFFFF';
        const qrSize = 160;

        // 1. QR Entrada
        new QRious({
            element: document.getElementById('qr-entrada-canvas'),
            value: 'qrassist_entrada',
            size: qrSize,
            level: 'H',
            foreground: qrColor,
            background: qrBg
        });

        // 2. QR Salida
        new QRious({
            element: document.getElementById('qr-salida-canvas'),
            value: 'qrassist_salida',
            size: qrSize,
            level: 'H',
            foreground: qrColor,
            background: qrBg
        });

        // 3. QR Iniciar Extras
        new QRious({
            element: document.getElementById('qr-extra-in-canvas'),
            value: 'qrassist_extra_inicio',
            size: qrSize,
            level: 'H',
            foreground: qrColor,
            background: qrBg
        });

        // 4. QR Finalizar Extras
        new QRious({
            element: document.getElementById('qr-extra-out-canvas'),
            value: 'qrassist_extra_fin',
            size: qrSize,
            level: 'H',
            foreground: qrColor,
            background: qrBg
        });

        // 5. QR Link Portal Trabajador (Acceso Móvil)
        new QRious({
            element: document.getElementById('qr-link-worker-canvas'),
            value: 'https://g2tuetue.github.io/QR-Asistencia/worker.html',
            size: 140,
            level: 'H',
            foreground: qrColor,
            background: qrBg
        });

        // 6. QR Link Portal Supervisor (Acceso Consola)
        new QRious({
            element: document.getElementById('qr-link-supervisor-canvas'),
            value: 'https://g2tuetue.github.io/QR-Asistencia/supervisor.html',
            size: 140,
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

// Enlace de clics programático en las tarjetas
function setupQRClickEvents() {
    const qrBoxes = document.querySelectorAll('.qr-box');
    qrBoxes.forEach(box => {
        // Cambiar cursor a puntero para indicar clickeable
        box.style.cursor = 'pointer';

        box.addEventListener('click', () => {
            const title = box.getAttribute('data-title');
            const value = box.getAttribute('data-value');
            const emoji = box.getAttribute('data-emoji');

            if (title && value) {
                zoomQR(title, value, emoji);
            }
        });
    });
}

// Función para agrandar el código QR seleccionado en la modal
function zoomQR(title, value, emoji) {
    const backdrop = document.getElementById('qr-zoom-backdrop');
    document.getElementById('zoom-title').innerHTML = `${emoji} ${title}`;

    // Generar un código QR nuevo más grande (280px) en la canvas de la modal
    new QRious({
        element: document.getElementById('qr-zoom-canvas'),
        value: value,
        size: 280,
        level: 'H',
        foreground: '#0B0F19',
        background: '#FFFFFF'
    });

    // Mostrar la modal
    backdrop.style.display = 'flex';
}

// Configurar cierre de la modal zoom
function setupZoomCloseEvents() {
    const backdrop = document.getElementById('qr-zoom-backdrop');
    const closeBtn = document.getElementById('btn-close-zoom');

    // Cerrar haciendo clic en el fondo oscuro
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            backdrop.style.display = 'none';
        }
    });

    // Cerrar con el botón
    closeBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
    });
}
