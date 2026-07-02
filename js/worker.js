/**
 * Sistema Web de Control de Asistencia y Cálculo de Remuneraciones
 * js/worker.js - Lógica del Portal del Trabajador
 */

let currentUser = null;
let html5QrCode = null;

document.addEventListener('DOMContentLoaded', () => {
    // Verificar si ya hay una sesión activa al cargar
    checkActiveSession();

    // Event Listeners para Login
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Event Listeners de la Interfaz del Dashboard
    const btnOpenScanner = document.getElementById('btn-open-scanner');
    if (btnOpenScanner) {
        btnOpenScanner.addEventListener('click', startCamera);
    }
    const btnCloseScanner = document.getElementById('btn-close-scanner');
    if (btnCloseScanner) {
        btnCloseScanner.addEventListener('click', stopCamera);
    }
    document.getElementById('btn-logout').addEventListener('click', handleLogout);

    // Simulador de Escaneo
    document.getElementById('btn-simulate-scan').addEventListener('click', handleSimulateScan);

    // Event Listeners de Botones en las Hojas de Acción (Action Sheets)
    setupActionSheetListeners();

    // Formateador automático de RUT
    setupRutFormatting('rut-input');
});

// --- SESIÓN DE USUARIO ---

function checkActiveSession() {
    currentUser = window.AppDB.getCurrentUser();
    if (currentUser) {
        // Redirigir al dashboard si es un rol de trabajador
        if (currentUser.role === 'worker') {
            showDashboard();
        } else {
            // Si es supervisor, sacarlo (el supervisor usa supervisor.html)
            window.AppDB.logout();
            showLogin();
        }
    } else {
        showLogin();
    }
}

function handleLogin(e) {
    e.preventDefault();
    const rutInput = document.getElementById('rut-input').value.trim();
    const passwordInput = document.getElementById('password-input').value.trim();
    const errorBlock = document.getElementById('login-error');

    errorBlock.style.display = 'none';

    const result = window.AppDB.login(rutInput, passwordInput);
    if (result.success && result.user.role === 'worker') {
        currentUser = result.user;
        showDashboard();
        showToast(`¡Bienvenido/a, ${currentUser.name}!`, 'success');
    } else if (result.success && result.user.role === 'supervisor') {
        // Redirigir al supervisor a su vista correspondiente
        window.location.href = 'supervisor.html';
    } else {
        errorBlock.style.display = 'block';
    }
}

function handleLogout() {
    stopCamera();
    window.AppDB.logout();
    currentUser = null;
    showLogin();
    showToast("Sesión cerrada correctamente.", "warning");
}

// --- TRANSICIONES DE VISTA ---

function showLogin() {
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('dashboard-section').style.display = 'none';
    document.getElementById('logged-user-header').style.display = 'none';
}

function showDashboard() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    document.getElementById('logged-user-header').style.display = 'block';

    // Cargar perfil
    document.getElementById('w-name').textContent = currentUser.name;
    document.getElementById('w-rut').textContent = `RUT: ${currentUser.rut}`;

    // Obtener iniciales para avatar
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('w-avatar').textContent = initials;

    updateWorkerStatus();
    loadTodayRecords();
}

// Actualiza el badge visual del estado actual del trabajador
function updateWorkerStatus() {
    const badge = document.getElementById('w-status-badge');
    const statusObj = window.AppDB.getWorkerTodayStatus(currentUser.rut);

    badge.textContent = statusObj.status;
    badge.className = `status-badge ${statusObj.class}`;
}

// Carga las marcas realizadas por el usuario hoy en la tabla
function loadTodayRecords() {
    const todayStr = window.getChileanDateStr();
    const records = window.AppDB.getRecordsByWorker(currentUser.rut)
        .filter(r => r.date === todayStr)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Más recientes primero

    const tbody = document.getElementById('today-records-table');
    tbody.innerHTML = "";

    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center" style="color: var(--text-muted); font-style: italic; padding: 1.5rem;">
                    No has registrado ninguna marca hoy.
                </td>
            </tr>
        `;
        return;
    }

    records.forEach(r => {
        const timeStr = new Date(r.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
        let typeBadgeClass = "";
        let typeText = "";

        switch (r.type) {
            case 'entrada':
                typeBadgeClass = 'status-working';
                typeText = 'Entrada 🟢';
                break;
            case 'colacion_inicio':
                typeBadgeClass = 'status-lunch';
                typeText = 'Inicio Colación 🥖';
                break;
            case 'colacion_fin':
                typeBadgeClass = 'status-working';
                typeText = 'Fin Colación 🔄';
                break;
            case 'salida':
                typeBadgeClass = 'status-out';
                typeText = 'Salida 🔴';
                break;
            case 'extra_inicio':
                typeBadgeClass = 'status-overtime';
                typeText = 'Inicio Turno Extra ⚡';
                break;
            case 'extra_fin':
                typeBadgeClass = 'status-out';
                typeText = 'Fin Turno Extra 🔴';
                break;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600; font-feature-settings: 'tnum';">${timeStr}</td>
            <td><span class="status-badge ${typeBadgeClass}" style="font-size: 0.7rem; padding: 0.15rem 0.5rem;">${typeText}</span></td>
            <td style="color: var(--text-secondary); font-size: 0.8rem;">${r.source === 'qr_general' || r.source === 'qr_extra' ? 'Código QR 📸' : 'Manual ✍️'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- CÁMARA & ESCANEO ---

function startCamera() {
    document.getElementById('scanner-container').style.display = 'block';
    document.getElementById('dashboard-actions').style.display = 'none';

    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 12, qrbox: 250 };

    html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanError
    ).catch(err => {
        console.error("Error al iniciar cámara html5Qrcode:", err);
        showToast("No se pudo acceder a la cámara. Otorga permisos de cámara o utiliza el simulador.", "error");
        stopCamera();
    });
}

function stopCamera() {
    if (html5QrCode) {
        if (html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                html5QrCode = null;
                document.getElementById('scanner-container').style.display = 'none';
                document.getElementById('dashboard-actions').style.display = 'block';
            }).catch(err => {
                console.error("Error al apagar la cámara:", err);
            });
        } else {
            document.getElementById('scanner-container').style.display = 'none';
            document.getElementById('dashboard-actions').style.display = 'block';
        }
    }
}

function onScanSuccess(decodedText, decodedResult) {
    // Apagar la cámara al detectar un QR válido
    stopCamera();

    // Procesar lectura
    if (decodedText === 'qrassist_general') {
        openActionSheet('general');
    } else if (decodedText === 'qrassist_overtime') {
        openActionSheet('overtime');
    } else if (decodedText.startsWith('qrassist_')) {
        const specificAction = decodedText.replace('qrassist_', '');

        // 1. Obtener el estado actual del trabajador hoy en la base de datos
        const currentStatus = window.AppDB.getWorkerTodayStatus(currentUser.rut).status;

        // 2. Validar si la transición de estado está permitida
        const validation = checkActionAllowed(currentStatus, specificAction);

        if (!validation.allowed) {
            showToast(validation.message, "error");
            return;
        }

        // 3. Abrir confirmación si es válida
        setupAndOpenConfirmSheet(specificAction);
    } else {
        showToast("Código QR no reconocido para este sistema corporativo.", "error");
    }
}

// Validador de Máquina de Estados para Asistencia
function checkActionAllowed(currentStatus, action) {
    // Los estados pueden ser: 'Trabajando (Jornada)', 'Trabajando (Horas Extras)', 'Fuera de Turno'

    if (currentStatus === 'Trabajando (Jornada)') {
        if (action === 'salida') {
            return { allowed: true };
        }
        if (action === 'entrada') {
            return { allowed: false, message: "Ya registraste tu Entrada. No puedes ingresar dos veces seguidas." };
        }
        if (action === 'extra_inicio') {
            return { allowed: false, message: "Debes registrar tu Salida de la jornada ordinaria antes de poder iniciar turnos de Horas Extras." };
        }
        if (action === 'extra_fin') {
            return { allowed: false, message: "No tienes un turno de horas extras activo para finalizar." };
        }
    }

    if (currentStatus === 'Trabajando (Horas Extras)') {
        if (action === 'extra_fin') {
            return { allowed: true };
        }
        if (action === 'entrada') {
            return { allowed: false, message: "Tienes un turno de horas extras activo. Debes finalizarlo antes de iniciar otra jornada." };
        }
        if (action === 'salida') {
            return { allowed: false, message: "Tienes un turno de horas extras activo. Debes finalizarlo para poder marcar la Salida de jornada." };
        }
        if (action === 'extra_inicio') {
            return { allowed: false, message: "Ya has iniciado tu turno de horas extras. No puedes marcar Entrada Extra dos veces." };
        }
    }

    // Estado: Fuera de Turno (no tiene marcas hoy o la última fue Salida/Extra Fin)
    if (action === 'entrada' || action === 'extra_inicio') {
        return { allowed: true };
    }

    if (action === 'salida') {
        return { allowed: false, message: "No puedes marcar Salida si no has registrado una Entrada hoy." };
    }
    if (action === 'extra_fin') {
        return { allowed: false, message: "No tienes un turno de horas extras activo para finalizar." };
    }

    return { allowed: true };
}

function onScanError(errorMessage) {
    // Este callback se llama constantemente mientras busca QRs, se puede omitir para evitar saturación de logs
}

// --- SIMULADOR DE ESCANEO ---

function handleSimulateScan() {
    const selectedQr = document.getElementById('simulate-qr-select').value;
    onScanSuccess(selectedQr, null);
}

// --- CONTROL DE HOJAS DE ACCIÓN (ACTION SHEETS) ---

function openActionSheet(type) {
    const backdrop = document.getElementById(`${type}-backdrop`);
    const sheet = document.getElementById(`${type}-action-sheet`);

    backdrop.style.display = 'block';
    // Forzar reflow para animación
    setTimeout(() => {
        backdrop.classList.add('active');
        sheet.classList.add('active');
    }, 10);
}

function closeActionSheets() {
    const backdrops = document.querySelectorAll('.backdrop');
    const sheets = document.querySelectorAll('.action-sheet');

    backdrops.forEach(b => b.classList.remove('active'));
    sheets.forEach(s => s.classList.remove('active'));

    setTimeout(() => {
        backdrops.forEach(b => b.style.display = 'none');
    }, 300);
}

function setupActionSheetListeners() {
    // Canceladores de hojas de acción
    document.getElementById('btn-cancel-general').addEventListener('click', closeActionSheets);
    document.getElementById('btn-cancel-overtime').addEventListener('click', closeActionSheets);
    document.getElementById('general-backdrop').addEventListener('click', closeActionSheets);
    document.getElementById('overtime-backdrop').addEventListener('click', closeActionSheets);

    // Canceladores de confirmación específica
    document.getElementById('btn-cancel-confirm').addEventListener('click', closeActionSheets);
    document.getElementById('confirm-backdrop').addEventListener('click', closeActionSheets);
    document.getElementById('btn-save-confirm').addEventListener('click', () => {
        if (window.pendingConfirm) {
            registerAttendanceMark(window.pendingConfirm.type, window.pendingConfirm.source);
        }
    });

    // Botones de acción del QR General
    const generalButtons = document.querySelectorAll('#general-action-sheet .action-btn');
    generalButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-type');
            registerAttendanceMark(type, 'qr_general');
        });
    });

    // Botones de acción del QR de Horas Extras
    const overtimeButtons = document.querySelectorAll('#overtime-action-sheet .action-btn');
    overtimeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-type');
            registerAttendanceMark(type, 'qr_extra');
        });
    });
}

function setupAndOpenConfirmSheet(action) {
    let title = "";
    let icon = "";
    let source = "qr_general";

    switch (action) {
        case 'entrada':
            title = "Entrada al Trabajo 🟢";
            icon = "🟢";
            break;
        case 'colacion_inicio':
            title = "Inicio de Colación 🥖";
            icon = "🥖";
            break;
        case 'colacion_fin':
            title = "Fin de Colación 🔄";
            icon = "🔄";
            break;
        case 'salida':
            title = "Salida del Trabajo 🔴";
            icon = "🔴";
            break;
        case 'extra_inicio':
            title = "Iniciar Turno Extra ⚡";
            icon = "⚡";
            source = "qr_extra";
            break;
        case 'extra_fin':
            title = "Finalizar Turno Extra 🔴";
            icon = "🔴";
            source = "qr_extra";
            break;
        default:
            showToast("Acción no válida.", "error");
            return;
    }

    // Guardar estado pendiente
    window.pendingConfirm = { type: action, source: source };

    // Rellenar modal
    document.getElementById('confirm-icon').textContent = icon;
    document.getElementById('confirm-action-name').textContent = title;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('confirm-time').textContent = `Hora detectada: ${timeStr}`;

    openActionSheet('confirm');
}

function registerAttendanceMark(type, source) {
    closeActionSheets();

    // Registrar marca
    window.AppDB.addRecord(currentUser.rut, type, source);

    // Mensaje de éxito específico
    let msg = "";
    switch (type) {
        case 'entrada': msg = "¡Entrada de jornada registrada!"; break;
        case 'colacion_inicio': msg = "Colación iniciada. ¡Buen provecho!"; break;
        case 'colacion_fin': msg = "Regreso de colación registrado."; break;
        case 'salida': msg = "Salida de jornada registrada. ¡Buen descanso!"; break;
        case 'extra_inicio': msg = "¡Turno de horas extras iniciado!"; break;
        case 'extra_fin': msg = "Turno de horas extras finalizado."; break;
    }

    showToast(msg, 'success');

    // Refrescar datos en pantalla
    updateWorkerStatus();
    loadTodayRecords();
}

// --- NOTIFICACIONES TOAST ---

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = "ℹ️";
    if (type === 'success') icon = "🟢";
    if (type === 'warning') icon = "🥖";
    if (type === 'error') icon = "🔴";

    toast.innerHTML = `
        <div style="font-size: 1.25rem;">${icon}</div>
        <div>${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- UTILERÍAS COMPARTIDAS ---

function setupRutFormatting(inputId) {
    const inputElement = document.getElementById(inputId);
    if (!inputElement) return;

    inputElement.addEventListener('input', () => {
        let value = inputElement.value;
        let cleaned = value.replace(/[^0-9kK]/g, '');
        if (!cleaned) {
            inputElement.value = '';
            return;
        }
        if (cleaned.length > 9) cleaned = cleaned.slice(0, 9);
        
        let formatted = '';
        if (cleaned.length === 1) {
            formatted = cleaned;
        } else {
            const dv = cleaned.slice(-1).toUpperCase();
            const body = cleaned.slice(0, -1);
            let formattedBody = '';
            if (body.length <= 3) {
                formattedBody = body;
            } else if (body.length <= 6) {
                formattedBody = body.slice(0, -3) + '.' + body.slice(-3);
            } else {
                formattedBody = body.slice(0, -6) + '.' + body.slice(-6, -3) + '.' + body.slice(-3);
            }
            formatted = formattedBody + '-' + dv;
        }
        
        const start = inputElement.selectionStart;
        const prevLen = value.length;
        
        inputElement.value = formatted;
        
        const diff = formatted.length - prevLen;
        inputElement.setSelectionRange(start + diff, start + diff);
    });
}
