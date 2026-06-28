/**
 * Sistema Web de Control de Asistencia y Cálculo de Remuneraciones
 * js/supervisor.js - Lógica de la Consola de Supervisión
 */

let supervisorUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // Verificar si hay una sesión activa al cargar
    checkActiveSession();

    // Event Listeners para Login
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('btn-logout').addEventListener('click', handleLogout);

    // Navegación entre pestañas
    setupTabs();

    // Filtros de Historial
    document.getElementById('filter-worker').addEventListener('change', loadHistoryRecords);
    document.getElementById('filter-date').addEventListener('change', loadHistoryRecords);

    // Eventos del Modal de Ajuste Manual
    document.getElementById('btn-add-record-modal').addEventListener('click', () => openAttendanceModal());
    document.getElementById('btn-close-modal').addEventListener('click', closeAttendanceModal);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeAttendanceModal);
    document.getElementById('attendance-form').addEventListener('submit', handleSaveRecord);

    // Eventos del Módulo Financiero
    document.getElementById('btn-calculate-payroll').addEventListener('click', handleCalculatePayroll);
    document.getElementById('btn-print-paystub').addEventListener('click', () => window.print());

    // Eventos del Modal de Creación de Trabajadores
    document.getElementById('btn-add-worker-modal').addEventListener('click', () => openWorkerModal());
    document.getElementById('btn-close-worker-modal').addEventListener('click', closeWorkerModal);
    document.getElementById('btn-cancel-worker-modal').addEventListener('click', closeWorkerModal);
    document.getElementById('worker-form').addEventListener('submit', handleSaveWorker);

    // Monitorear cambios en la base de datos en tiempo real (Tesis Feature)
    window.AppDB.onRecordsChange(() => {
        if (supervisorUser) {
            updateDashboardData();
        }
    });

    window.AppDB.onUsersChange(() => {
        if (supervisorUser) {
            populateSelectFilters();
            loadWorkersList();
            loadWorkerStatusSidebar();
        }
    });

    // Formateadores automáticos de RUT
    setupRutFormatting('rut-input');
    setupRutFormatting('worker-rut');
});

// --- SESIÓN DE USUARIO ---

function checkActiveSession() {
    supervisorUser = window.AppDB.getCurrentUser();
    if (supervisorUser) {
        if (supervisorUser.role === 'supervisor') {
            showDashboard();
        } else {
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
    if (result.success && result.user.role === 'supervisor') {
        supervisorUser = result.user;
        showDashboard();
        showToast("Sesión de supervisor iniciada.", "success");
    } else {
        errorBlock.style.display = 'block';
    }
}

function handleLogout() {
    window.AppDB.logout();
    supervisorUser = null;
    showLogin();
    showToast("Sesión administrativa finalizada.", "warning");
}

// --- VISTAS DEL DASHBOARD ---

function showLogin() {
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('dashboard-section').style.display = 'none';
    document.getElementById('supervisor-header').style.display = 'none';
}

function showDashboard() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'grid';
    document.getElementById('supervisor-header').style.display = 'flex';
    document.getElementById('sup-name-badge').textContent = supervisorUser.name;

    // Poblar selectores de filtros y campos
    populateSelectFilters();
    populateMonthSelector();

    // Ajustar visibilidad inicial de la barra lateral (pestaña por defecto: 'live')
    const sidebar = document.querySelector('.sidebar');
    const grid = document.getElementById('dashboard-section');
    sidebar.style.display = 'block';
    grid.classList.remove('full-width');

    // Cargar información inicial
    updateDashboardData();
}

function updateDashboardData() {
    loadLiveScans();
    loadHistoryRecords();
    loadWorkerStatusSidebar();
    loadWorkersList();
}

// --- NAVEGACIÓN POR PESTAÑAS ---

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Desactivar botones y secciones
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Activar actual
            btn.classList.add('active');
            const targetTab = btn.getAttribute('data-tab');
            document.getElementById(`tab-${targetTab}`).classList.add('active');

            // Ajustar visibilidad de la barra lateral y ancho del dashboard según la pestaña
            const sidebar = document.querySelector('.sidebar');
            const grid = document.getElementById('dashboard-section');
            if (targetTab === 'live' || targetTab === 'workers') {
                sidebar.style.display = 'block';
                grid.classList.remove('full-width');
            } else {
                sidebar.style.display = 'none';
                grid.classList.add('full-width');
            }

            // Recargar datos si es necesario
            updateDashboardData();
        });
    });
}

// --- POBLAR SELECTORES DINÁMICOS ---

function populateSelectFilters() {
    const workers = window.AppDB.getUsers().filter(u => u.role === 'worker');

    // Select de filtro historial
    const filterWorker = document.getElementById('filter-worker');
    // Select del modal manual
    const modalWorkerSelect = document.getElementById('modal-worker-select');
    // Select del modulo financiero
    const payrollWorker = document.getElementById('payroll-worker');

    // Limpiar opciones anteriores
    filterWorker.innerHTML = '<option value="all">Todos los trabajadores</option>';
    modalWorkerSelect.innerHTML = '';
    payrollWorker.innerHTML = '';

    workers.forEach(w => {
        const optText = `${w.name} (${w.rut})`;

        filterWorker.innerHTML += `<option value="${w.rut}">${optText}</option>`;
        modalWorkerSelect.innerHTML += `<option value="${w.rut}">${optText}</option>`;
        payrollWorker.innerHTML += `<option value="${w.rut}">${optText}</option>`;
    });
}

function populateMonthSelector() {
    const monthSelect = document.getElementById('payroll-month');
    monthSelect.innerHTML = "";

    const months = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const now = new Date();
    // Generar el mes actual y los últimos 5 meses
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const monthIdx = d.getMonth();
        const monthName = months[monthIdx];

        const value = `${year}-${monthIdx}`;
        monthSelect.innerHTML += `<option value="${value}">${monthName} ${year}</option>`;
    }
}

// --- PESTAÑA: MONITOREO EN VIVO (MARCAS DE HOY) ---

function loadLiveScans() {
    const todayStr = window.getChileanDateStr();
    const records = window.AppDB.getAllRecords()
        .filter(r => r.date === todayStr)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Más recientes primero

    const tbody = document.getElementById('live-scans-table');
    tbody.innerHTML = "";

    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center" style="color: var(--text-muted); font-style: italic; padding: 1.5rem;">
                    No se han registrado marcas el día de hoy.
                </td>
            </tr>
        `;
        return;
    }

    records.forEach(r => {
        const worker = window.AppDB.getUserByRut(r.rut);
        const name = worker ? worker.name : "Desconocido";
        const timeStr = new Date(r.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

        let typeBadgeClass = "";
        let typeText = "";

        switch (r.type) {
            case 'entrada': typeBadgeClass = 'status-working'; typeText = 'Entrada 🟢'; break;
            case 'colacion_inicio': typeBadgeClass = 'status-lunch'; typeText = 'Inicio Colación 🥖'; break;
            case 'colacion_fin': typeBadgeClass = 'status-working'; typeText = 'Fin Colación 🔄'; break;
            case 'salida': typeBadgeClass = 'status-out'; typeText = 'Salida 🔴'; break;
            case 'extra_inicio': typeBadgeClass = 'status-overtime'; typeText = 'Inicio Turno Extra ⚡'; break;
            case 'extra_fin': typeBadgeClass = 'status-out'; typeText = 'Fin Turno Extra 🔴'; break;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600; font-feature-settings: 'tnum';">${timeStr}</td>
            <td style="font-weight: 600; color: white;">${name}</td>
            <td style="font-family: monospace;">${r.rut}</td>
            <td><span class="status-badge ${typeBadgeClass}" style="font-size: 0.7rem; padding: 0.15rem 0.5rem;">${typeText}</span></td>
            <td style="color: var(--text-secondary); font-size: 0.8rem;">${r.source === 'manual' ? 'Manual (Supervisor) ✍️' : 'Código QR 📸'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- PESTAÑA: HISTORIAL Y AJUSTES (TABLA GENERAL Y EDICIÓN) ---

function loadHistoryRecords() {
    const selectedWorker = document.getElementById('filter-worker').value;
    const selectedDate = document.getElementById('filter-date').value;

    let records = window.AppDB.getAllRecords();

    // Filtro por trabajador
    if (selectedWorker !== 'all') {
        records = records.filter(r => r.rut === selectedWorker);
    }

    // Filtro por fecha
    if (selectedDate) {
        records = records.filter(r => r.date === selectedDate);
    }

    // Ordenar por fecha y hora descendente
    records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const tbody = document.getElementById('history-records-table');
    tbody.innerHTML = "";

    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center" style="color: var(--text-muted); font-style: italic; padding: 1.5rem;">
                    No se encontraron marcas de asistencia con los filtros seleccionados.
                </td>
            </tr>
        `;
        return;
    }

    records.forEach(r => {
        const worker = window.AppDB.getUserByRut(r.rut);
        const name = worker ? worker.name : "Desconocido";
        const dateObj = new Date(r.timestamp);
        const dateStr = dateObj.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });

        let typeBadgeClass = "";
        let typeText = "";

        switch (r.type) {
            case 'entrada': typeBadgeClass = 'status-working'; typeText = 'Entrada 🟢'; break;
            case 'colacion_inicio': typeBadgeClass = 'status-lunch'; typeText = 'Colación 🥖'; break;
            case 'colacion_fin': typeBadgeClass = 'status-working'; typeText = 'Fin Colación 🔄'; break;
            case 'salida': typeBadgeClass = 'status-out'; typeText = 'Salida 🔴'; break;
            case 'extra_inicio': typeBadgeClass = 'status-overtime'; typeText = 'Turno Extra ⚡'; break;
            case 'extra_fin': typeBadgeClass = 'status-out'; typeText = 'Fin Extra 🔴'; break;
        }

        const isEdited = r.editedBy ? `Ajustado por ${r.editedBy}` : 'Original';
        const editedClass = r.editedBy ? 'color: var(--color-colacion); font-weight: 500;' : 'color: var(--text-muted);';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td style="font-weight: 600; font-feature-settings: 'tnum';">${timeStr}</td>
            <td style="font-weight: 500; color: white;">${name}</td>
            <td><span class="status-badge ${typeBadgeClass}" style="font-size: 0.65rem; padding: 0.15rem 0.4rem;">${typeText}</span></td>
            <td style="font-size: 0.8rem; color: var(--text-secondary);">${r.source === 'manual' ? 'Manual' : 'Código QR'}</td>
            <td style="font-size: 0.75rem; ${editedClass}">${isEdited}</td>
            <td style="white-space: nowrap;">
                <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-right: 0.25rem;" onclick="openAttendanceModal('${r.id}')">✏️ Editar</button>
                <button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="handleDeleteRecord('${r.id}')">🗑️ Borrar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- MODAL DE REGISTRO MANUAL (AGREGAR / EDITAR) ---

window.openAttendanceModal = function (id = null) {
    const backdrop = document.getElementById('modal-backdrop');
    const modal = document.getElementById('attendance-modal');
    const form = document.getElementById('attendance-form');
    const title = document.getElementById('modal-title');
    const saveBtn = document.getElementById('btn-save-modal');
    const workerSelect = document.getElementById('modal-worker-select');

    form.reset();
    document.getElementById('edit-record-id').value = id || "";

    if (id) {
        // Modo Edición
        title.textContent = "Editar Marca de Asistencia";
        saveBtn.textContent = "Guardar Cambios";
        workerSelect.disabled = true; // No permitir cambiar de trabajador a un registro existente

        const record = window.AppDB.getAllRecords().find(r => r.id === id);
        if (record) {
            workerSelect.value = record.rut;
            document.getElementById('modal-date').value = record.date;

            const dateObj = new Date(record.timestamp);
            const hour = String(dateObj.getHours()).padStart(2, '0');
            const min = String(dateObj.getMinutes()).padStart(2, '0');
            document.getElementById('modal-time').value = `${hour}:${min}`;
            document.getElementById('modal-type-select').value = record.type;
        }
    } else {
        // Modo Creación
        title.textContent = "Crear Registro de Asistencia Manual";
        saveBtn.textContent = "Registrar Marca";
        workerSelect.disabled = false;

        const todayStr = window.getChileanDateStr();
        document.getElementById('modal-date').value = todayStr;

        const ts = window.getChileanTimestamp(); // YYYY-MM-DD HH:mm:ss
        const timePart = ts.split(' ')[1]; // HH:mm:ss
        const hourMin = timePart.substring(0, 5); // HH:mm
        document.getElementById('modal-time').value = hourMin;
    }

    backdrop.style.display = 'block';
    setTimeout(() => {
        backdrop.classList.add('active');
        modal.classList.add('active');
    }, 10);
};

function closeAttendanceModal() {
    const backdrop = document.getElementById('modal-backdrop');
    const modal = document.getElementById('attendance-modal');

    backdrop.classList.remove('active');
    modal.classList.remove('active');

    setTimeout(() => {
        backdrop.style.display = 'none';
    }, 300);
}

function handleSaveRecord(e) {
    e.preventDefault();
    const id = document.getElementById('edit-record-id').value;
    const rut = document.getElementById('modal-worker-select').value;
    const date = document.getElementById('modal-date').value;
    const time = document.getElementById('modal-time').value;
    const type = document.getElementById('modal-type-select').value;

    const supervisorRut = supervisorUser.rut;

    if (id) {
        // Actualizar marca existente
        window.AppDB.updateRecord(id, date, time, type, supervisorRut);
        showToast("Registro de asistencia actualizado correctamente.", "success");
    } else {
        // Registrar marca nueva
        window.AppDB.addManualRecord(rut, date, time, type, supervisorRut);
        showToast("Se ha registrado la marca manual correctamente.", "success");
    }

    closeAttendanceModal();
    updateDashboardData();
}

window.handleDeleteRecord = function (id) {
    if (confirm("¿Estás seguro de que deseas eliminar este registro de asistencia de forma permanente?")) {
        window.AppDB.deleteRecord(id);
        showToast("El registro ha sido eliminado correctamente.", "error");
        updateDashboardData();
    }
};

// --- MÓDULO FINANCIERO (CÁLCULO Y LIQUIDACIÓN) ---

function handleCalculatePayroll() {
    const rut = document.getElementById('payroll-worker').value;
    const period = document.getElementById('payroll-month').value;
    const [year, monthIdx] = period.split('-').map(Number);

    const payroll = window.AppDB.calculatePayroll(rut, year, monthIdx);

    if (!payroll) {
        showToast("No se pudo calcular la liquidación. Verifica los datos del trabajador.", "error");
        return;
    }

    // Mostrar sección
    document.getElementById('payroll-results-container').style.display = 'block';

    // Rellenar métricas de resumen
    document.getElementById('res-hours-regular').textContent = `${payroll.totalRegularHours.toFixed(1)}h`;
    document.getElementById('res-hours-extra').textContent = `${payroll.totalOvertimeHours.toFixed(1)}h`;
    document.getElementById('res-salary-base').textContent = formatCurrency(payroll.baseSalaryEarned);
    document.getElementById('res-salary-total').textContent = formatCurrency(payroll.totalSalary);

    // Rellenar boleta de liquidación de sueldo
    const monthsNames = [
        "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
        "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
    ];
    document.getElementById('stub-period').textContent = `PERÍODO: ${monthsNames[monthIdx]} ${year}`;
    document.getElementById('stub-worker-name').textContent = payroll.name;
    document.getElementById('stub-worker-rut').textContent = payroll.rut;

    document.getElementById('stub-hours-regular').textContent = `${payroll.totalRegularHours.toFixed(1)} / 160.0 hrs`;
    document.getElementById('stub-salary-base').textContent = formatCurrency(payroll.baseSalaryEarned);

    // Detalle de horas extras
    document.getElementById('stub-hours-overtime-total').textContent = `${payroll.totalOvertimeHours.toFixed(1)} hrs`;
    document.getElementById('stub-salary-overtime').textContent = formatCurrency(payroll.overtimeSalaryEarned);

    document.getElementById('stub-salary-total').textContent = formatCurrency(payroll.totalSalary);

    showToast(`Remuneración calculada para ${payroll.name}.`, "success");
}

function formatCurrency(value) {
    return '$' + value.toLocaleString('es-CL');
}

// --- BARRA LATERAL: ESTADO DE LA PLANTA ---

function loadWorkerStatusSidebar() {
    const workers = window.AppDB.getUsers().filter(u => u.role === 'worker');
    const container = document.getElementById('worker-status-sidebar');
    container.innerHTML = "";

    workers.forEach(w => {
        const statusObj = window.AppDB.getWorkerTodayStatus(w.rut);

        const card = document.createElement('div');
        card.className = "worker-status-card";
        card.innerHTML = `
            <div class="worker-status-info">
                <h4>${w.name}</h4>
                <p>RUT: ${w.rut}</p>
            </div>
            <div>
                <span class="status-badge ${statusObj.class}" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;">${statusObj.status}</span>
            </div>
        `;
        container.appendChild(card);
    });
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

// --- GESTIÓN DE TRABAJADORES ---

function loadWorkersList() {
    const workers = window.AppDB.getUsers().filter(u => u.role === 'worker');
    const tbody = document.getElementById('workers-list-table');
    if (!tbody) return;
    tbody.innerHTML = "";

    if (workers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center" style="color: var(--text-muted); font-style: italic; padding: 1.5rem;">
                    No hay trabajadores registrados.
                </td>
            </tr>
        `;
        return;
    }

    workers.forEach(w => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 500; color: white;">${w.name}</td>
            <td style="font-feature-settings: 'tnum';">${w.rut}</td>
            <td style="font-feature-settings: 'tnum'; font-family: monospace;">${w.password}</td>
            <td><span class="status-badge status-overtime" style="font-size: 0.7rem; padding: 0.15rem 0.5rem;">Trabajador 👥</span></td>
            <td style="font-feature-settings: 'tnum'; font-weight: 600;">$${w.baseSalary.toLocaleString('es-CL')}</td>
            <td>
                <div class="flex gap-1">
                    <button class="btn btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.25rem; box-shadow: none; min-width: 95px;" onclick="openWorkerModal('${w.rut}')">
                        📝 Editar
                    </button>
                    <button class="btn btn-danger" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.25rem; min-width: 95px;" onclick="handleDeleteWorker('${w.rut}')">
                        🗑️ Eliminar
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.handleDeleteWorker = function (rut) {
    if (confirm(`¿Está seguro de que desea eliminar al trabajador con RUT ${rut}? Esta acción borrará permanentemente su cuenta.`)) {
        try {
            window.AppDB.deleteWorker(rut);
            showToast("Trabajador eliminado exitosamente.", "warning");

            // Actualizar localmente
            populateSelectFilters();
            loadWorkersList();
            loadWorkerStatusSidebar();
        } catch (error) {
            showToast(error.message || "Error al eliminar el trabajador.", "error");
        }
    }
};

window.openWorkerModal = function (rut = null) {
    const backdrop = document.getElementById('worker-modal-backdrop');
    const modal = document.getElementById('worker-modal');
    const title = document.getElementById('worker-modal-title');
    const rutInput = document.getElementById('worker-rut');
    const saveBtn = document.getElementById('btn-save-worker');

    if (rut) {
        // Modo Edición
        title.textContent = "Editar Trabajador";
        rutInput.value = rut;
        rutInput.disabled = true; // El RUT es inmutable
        saveBtn.textContent = "Guardar Cambios";

        const worker = window.AppDB.getUsers().find(w => w.rut === rut);
        if (worker) {
            document.getElementById('worker-name').value = worker.name;
            document.getElementById('worker-password').value = worker.password;
            document.getElementById('worker-salary').value = worker.baseSalary;
        }
    } else {
        // Modo Creación
        title.textContent = "Agregar Nuevo Trabajador";
        rutInput.value = "";
        rutInput.disabled = false;
        saveBtn.textContent = "Registrar Trabajador";

        document.getElementById('worker-name').value = "";
        document.getElementById('worker-password').value = "";
        document.getElementById('worker-salary').value = "600000";
    }

    backdrop.style.display = 'block';
    setTimeout(() => {
        backdrop.classList.add('active');
        modal.classList.add('active');
    }, 10);
};

function closeWorkerModal() {
    const backdrop = document.getElementById('worker-modal-backdrop');
    const modal = document.getElementById('worker-modal');

    backdrop.classList.remove('active');
    modal.classList.remove('active');

    setTimeout(() => {
        backdrop.style.display = 'none';
    }, 300);
}

function handleSaveWorker(e) {
    e.preventDefault();
    const rutInput = document.getElementById('worker-rut');
    const rut = rutInput.value.trim();
    const name = document.getElementById('worker-name').value.trim();
    const password = document.getElementById('worker-password').value.trim();
    const salary = Number(document.getElementById('worker-salary').value);
    const isEditMode = rutInput.disabled;

    if (!rut || !name || !password || isNaN(salary) || salary < 0) {
        showToast("Por favor complete todos los campos correctamente.", "error");
        return;
    }

    try {
        if (isEditMode) {
            window.AppDB.updateWorker(rut, name, password, salary);
            showToast("Trabajador actualizado exitosamente.", "success");
        } else {
            window.AppDB.addWorker(rut, name, password, salary);
            showToast("Trabajador registrado exitosamente.", "success");
        }
        closeWorkerModal();

        // Actualizar vistas locales
        populateSelectFilters();
        loadWorkersList();
        loadWorkerStatusSidebar();
    } catch (error) {
        showToast(error.message || "Error al guardar el trabajador.", "error");
    }
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
