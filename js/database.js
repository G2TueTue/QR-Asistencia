/**
 * Sistema Web de Control de Asistencia y Cálculo de Remuneraciones
 * js/database.js - Módulo de Persistencia y Reglas de Negocio
 * 
 * Este archivo centraliza el almacenamiento y procesamiento de datos.
 * Funciona por defecto con LocalStorage (sincronizado en tiempo real entre pestañas)
 * y está diseñado para ser fácilmente conectado a Firebase.
 */

// Toggle para activar Firebase cuando se configuren las credenciales en firebase-config.js
const USE_FIREBASE = false; 

class DatabaseManager {
    constructor() {
        this.initLocalStorage();
        this.setupTabSynchronization();
    }

    // Inicializa datos de prueba y se asegura de sobreescribir claves viejas/corruptas de otros proyectos
    initLocalStorage() {
        const defaultUsers = [
            {
                rut: "12.345.678-9",
                name: "Juan Pérez",
                password: "1234",
                role: "worker",
                baseSalary: 600000,
                targetHours: 160
            },
            {
                rut: "18.765.432-1",
                name: "María González",
                password: "5678",
                role: "worker",
                baseSalary: 600000,
                targetHours: 160
            },
            {
                rut: "99.999.999-9",
                name: "Supervisor Admin",
                password: "admin",
                role: "supervisor"
            }
        ];

        const existingUsers = localStorage.getItem('qr_asistencia_users');
        let shouldReset = false;

        if (!existingUsers) {
            shouldReset = true;
        } else {
            try {
                const parsed = JSON.parse(existingUsers);
                // Si no es un arreglo, no contiene nuestro RUT de prueba o la meta no es 160, forzamos el reset
                if (!Array.isArray(parsed) || !parsed.some(u => u.rut === "12.345.678-9") || !parsed.some(u => u.targetHours === 160)) {
                    shouldReset = true;
                }
            } catch (e) {
                shouldReset = true;
            }
        }

        if (shouldReset) {
            localStorage.setItem('qr_asistencia_users', JSON.stringify(defaultUsers));
            // También forzar el reset de registros de prueba para que coincidan con los nuevos usuarios
            const testRecords = this.generateTestRecords();
            localStorage.setItem('qr_asistencia_records', JSON.stringify(testRecords));
        }
    }

    // Escucha cambios en LocalStorage desde otras pestañas (ej: el celular escanea y el PC del supervisor se actualiza)
    setupTabSynchronization() {
        window.addEventListener('storage', (event) => {
            if (event.key === 'qr_asistencia_records' && this.onRecordsChangeCallback) {
                this.onRecordsChangeCallback(this.getAllRecords());
            }
        });
    }

    // Callback para actualizar interfaces en tiempo real
    onRecordsChange(callback) {
        this.onRecordsChangeCallback = callback;
    }

    // --- MÉTODOS DE USUARIOS ---

    getUsers() {
        return JSON.parse(localStorage.getItem('qr_asistencia_users')) || [];
    }

    getUserByRut(rut) {
        return this.getUsers().find(u => u.rut === rut);
    }

    login(rut, password) {
        const user = this.getUserByRut(rut);
        if (user && user.password === password) {
            localStorage.setItem('qr_asistencia_current_user', JSON.stringify(user));
            return { success: true, user };
        }
        return { success: false, message: "RUT o contraseña incorrectos" };
    }

    getCurrentUser() {
        return JSON.parse(localStorage.getItem('qr_asistencia_current_user')) || null;
    }

    logout() {
        localStorage.removeItem('qr_asistencia_current_user');
    }

    // --- MÉTODOS DE ASISTENCIA ---

    getAllRecords() {
        return JSON.parse(localStorage.getItem('qr_asistencia_records')) || [];
    }

    getRecordsByWorker(rut) {
        return this.getAllRecords().filter(r => r.rut === rut);
    }

    /**
     * Agrega una nueva marca de asistencia.
     * @param {string} rut - RUT del trabajador
     * @param {string} type - 'entrada', 'colacion_inicio', 'colacion_fin', 'salida', 'extra_inicio', 'extra_fin'
     * @param {string} source - 'qr_general', 'qr_extra', 'manual'
     */
    addRecord(rut, type, source = 'qr_general') {
        const records = this.getAllRecords();
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

        const newRecord = {
            id: 'rec_' + Math.random().toString(36).substr(2, 9),
            rut: rut,
            date: dateStr,
            timestamp: now.toISOString(),
            type: type,
            source: source,
            editedBy: null,
            editedAt: null
        };

        records.push(newRecord);
        localStorage.setItem('qr_asistencia_records', JSON.stringify(records));

        // Disparar evento local para que la misma pestaña sepa que cambió
        if (this.onRecordsChangeCallback) {
            this.onRecordsChangeCallback(records);
        }

        return newRecord;
    }

    /**
     * Agrega un registro manual (para el supervisor).
     */
    addManualRecord(rut, dateStr, timeStr, type, supervisorRut) {
        const records = this.getAllRecords();
        const timestamp = new Date(`${dateStr}T${timeStr}:00`).toISOString();

        const newRecord = {
            id: 'rec_' + Math.random().toString(36).substr(2, 9),
            rut: rut,
            date: dateStr,
            timestamp: timestamp,
            type: type,
            source: 'manual',
            editedBy: supervisorRut,
            editedAt: new Date().toISOString()
        };

        records.push(newRecord);
        localStorage.setItem('qr_asistencia_records', JSON.stringify(records));

        if (this.onRecordsChangeCallback) {
            this.onRecordsChangeCallback(records);
        }

        return newRecord;
    }

    /**
     * Modifica un registro de asistencia (para el supervisor).
     */
    updateRecord(id, dateStr, timeStr, type, supervisorRut) {
        const records = this.getAllRecords();
        const index = records.findIndex(r => r.id === id);

        if (index !== -1) {
            const timestamp = new Date(`${dateStr}T${timeStr}:00`).toISOString();
            records[index] = {
                ...records[index],
                date: dateStr,
                timestamp: timestamp,
                type: type,
                editedBy: supervisorRut,
                editedAt: new Date().toISOString()
            };

            localStorage.setItem('qr_asistencia_records', JSON.stringify(records));

            if (this.onRecordsChangeCallback) {
                this.onRecordsChangeCallback(records);
            }
            return true;
        }
        return false;
    }

    /**
     * Elimina un registro de asistencia.
     */
    deleteRecord(id) {
        let records = this.getAllRecords();
        records = records.filter(r => r.id !== id);
        localStorage.setItem('qr_asistencia_records', JSON.stringify(records));

        if (this.onRecordsChangeCallback) {
            this.onRecordsChangeCallback(records);
        }
        return true;
    }

    // --- MÉTODOS DE CÁLCULO DE HORAS Y LIQUIDACIÓN ---

    /**
     * Obtiene el último estado conocido del trabajador hoy.
     */
    getWorkerTodayStatus(rut) {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayRecords = this.getRecordsByWorker(rut)
            .filter(r => r.date === todayStr)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        if (todayRecords.length === 0) return { status: 'Fuera de Turno', class: 'status-out' };

        const lastRecord = todayRecords[todayRecords.length - 1];

        switch (lastRecord.type) {
            case 'entrada':
                return { status: 'Trabajando (Jornada)', class: 'status-working' };
            case 'colacion_inicio':
                return { status: 'En Colación', class: 'status-lunch' };
            case 'colacion_fin':
                return { status: 'Trabajando (Jornada)', class: 'status-working' };
            case 'salida':
                return { status: 'Fuera de Turno', class: 'status-out' };
            case 'extra_inicio':
                return { status: 'Trabajando (Horas Extras)', class: 'status-overtime' };
            case 'extra_fin':
                return { status: 'Fuera de Turno', class: 'status-out' };
            default:
                return { status: 'Desconocido', class: 'status-unknown' };
        }
    }

    /**
     * Procesa los registros de un mes y año determinado para calcular horas diarias.
     * Agrupa por día.
     */
    calculateMonthlyBreakdown(rut, year, month) {
        const records = this.getRecordsByWorker(rut);
        
        // Filtrar por mes y año
        const filteredRecords = records.filter(r => {
            const date = new Date(r.timestamp);
            return date.getFullYear() === year && date.getMonth() === month;
        });

        // Agrupar por fecha
        const recordsByDate = {};
        filteredRecords.forEach(r => {
            if (!recordsByDate[r.date]) {
                recordsByDate[r.date] = [];
            }
            recordsByDate[r.date].push(r);
        });

        const breakdown = [];

        // Para cada día con registros
        Object.keys(recordsByDate).forEach(dateStr => {
            const dayRecords = recordsByDate[dateStr].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            let entrada = null;
            let salida = null;
            let extraInicios = [];
            let extraFines = [];

            dayRecords.forEach(r => {
                if (r.type === 'entrada') entrada = new Date(r.timestamp);
                if (r.type === 'salida') salida = new Date(r.timestamp);
                if (r.type === 'extra_inicio') extraInicios.push(new Date(r.timestamp));
                if (r.type === 'extra_fin') extraFines.push(new Date(r.timestamp));
            });

            // 1. Calcular jornada ordinaria (restando obligatoriamente 1 hora de colación)
            let regularHours = 0;
            if (entrada && salida) {
                const diffMs = salida - entrada;
                const diffHrs = diffMs / (1000 * 60 * 60);
                regularHours = Math.max(0, diffHrs - 1.0); // Descontar 1 hora de colación obligatoria
            }

            // 2. Calcular jornada extraordinaria (sin restar colación)
            let overtimeHours = 0;
            const extraCount = Math.min(extraInicios.length, extraFines.length);
            for (let i = 0; i < extraCount; i++) {
                const diffMs = extraFines[i] - extraInicios[i];
                overtimeHours += Math.max(0, diffMs / (1000 * 60 * 60));
            }

            breakdown.push({
                date: dateStr,
                entrada: entrada ? this.formatTime(entrada) : '--:--',
                salida: salida ? this.formatTime(salida) : '--:--',
                regularHours: parseFloat(regularHours.toFixed(2)),
                overtimeHours: parseFloat(overtimeHours.toFixed(2)),
                totalDaily: parseFloat((regularHours + overtimeHours).toFixed(2)),
                rawRecords: dayRecords
            });
        });

        // Ordenar breakdown por fecha ascendente
        return breakdown.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    /**
     * Calcula la liquidación de sueldo mensual (Reglas Financieras)
     */
    calculatePayroll(rut, year, month) {
        const breakdown = this.calculateMonthlyBreakdown(rut, year, month);
        const user = this.getUserByRut(rut);

        if (!user) return null;

        // Sumar horas
        let totalRegularHours = 0;
        let totalExtraShiftHours = 0; // Provienen del QR de Horas Extras directamente

        breakdown.forEach(day => {
            totalRegularHours += day.regularHours;
            totalExtraShiftHours += day.overtimeHours;
        });

        // Fórmulas de Negocio
        const baseTarget = 160;
        const rateBase = 600000;
        const rateExtra = 4500;

        let baseSalaryEarned = 0;
        let regularOvertimeHours = 0;

        if (totalRegularHours >= baseTarget) {
            // Cumple o supera las 180 horas base
            baseSalaryEarned = rateBase;
            // El exceso de la jornada regular se convierte en horas extras
            regularOvertimeHours = totalRegularHours - baseTarget;
        } else {
            // Opción A: Pago proporcional si trabaja menos de 180 horas ordinarias
            baseSalaryEarned = (totalRegularHours / baseTarget) * rateBase;
            baseSalaryEarned = Math.max(0, parseFloat(baseSalaryEarned.toFixed(0)));
            regularOvertimeHours = 0;
        }

        // Sumar horas extras: las regulares que exceden 180 + todas las realizadas vía el QR de Horas Extras
        const totalOvertimeHours = regularOvertimeHours + totalExtraShiftHours;
        const overtimeSalaryEarned = Math.round(totalOvertimeHours * rateExtra);
        const totalSalary = Math.round(baseSalaryEarned + overtimeSalaryEarned);

        return {
            rut: rut,
            name: user.name,
            totalRegularHours: parseFloat(totalRegularHours.toFixed(2)),
            totalExtraShiftHours: parseFloat(totalExtraShiftHours.toFixed(2)),
            regularOvertimeHours: parseFloat(regularOvertimeHours.toFixed(2)),
            totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
            baseSalaryEarned: baseSalaryEarned,
            overtimeSalaryEarned: overtimeSalaryEarned,
            totalSalary: totalSalary,
            breakdown: breakdown
        };
    }

    // Auxiliar para formatear fecha/hora
    formatTime(date) {
        return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    // --- MÓDULO DE GENERACIÓN DE DATOS DE PRUEBA ---
    generateTestRecords() {
        const records = [];
        const ruts = ["12.345.678-9", "18.765.432-1"];
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // Mes actual

        // Generar marcas para los últimos 15 días laborables del mes
        // para dar realismo a la simulación del supervisor
        for (let day = 1; day <= 15; day++) {
            // Evitar fines de semana en la jornada ordinaria estándar
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                // El sábado simulamos un turno de horas extras para Juan Pérez
                if (dayOfWeek === 6 && day <= 10) {
                    const dateStr = date.toISOString().split('T')[0];
                    // Turno extra: 09:00 a 14:00 (5 horas extras)
                    records.push({
                        id: `rec_test_extra_i_${day}`,
                        rut: ruts[0],
                        date: dateStr,
                        timestamp: new Date(year, month, day, 9, 0, 0).toISOString(),
                        type: 'extra_inicio',
                        source: 'qr_extra',
                        editedBy: null,
                        editedAt: null
                    });
                    records.push({
                        id: `rec_test_extra_f_${day}`,
                        rut: ruts[0],
                        date: dateStr,
                        timestamp: new Date(year, month, day, 14, 0, 0).toISOString(),
                        type: 'extra_fin',
                        source: 'qr_extra',
                        editedBy: null,
                        editedAt: null
                    });
                }
                continue; 
            }

            const dateStr = date.toISOString().split('T')[0];

            // Trabajador 1: Juan Pérez (jornada completa ordenada, ej. 08:00 a 18:00 = 10hrs brutas - 1hr colacion = 9hrs netas diarias)
            records.push({
                id: `rec_test_1_e_${day}`,
                rut: ruts[0],
                date: dateStr,
                timestamp: new Date(year, month, day, 8, 0, 0).toISOString(),
                type: 'entrada',
                source: 'qr_general',
                editedBy: null,
                editedAt: null
            });
            records.push({
                id: `rec_test_1_s_${day}`,
                rut: ruts[0],
                date: dateStr,
                timestamp: new Date(year, month, day, 18, 0, 0).toISOString(),
                type: 'salida',
                source: 'qr_general',
                editedBy: null,
                editedAt: null
            });

            // Trabajador 2: María González (jornada irregular, algunos días trabaja 6 horas y otros faltó para ver el sueldo proporcional)
            if (day % 3 !== 0) { // María trabaja sólo algunos días
                const entryHour = 9;
                const exitHour = day % 2 === 0 ? 17 : 15; // 8 o 6 horas brutas (7 o 5 horas netas)
                records.push({
                    id: `rec_test_2_e_${day}`,
                    rut: ruts[1],
                    date: dateStr,
                    timestamp: new Date(year, month, day, entryHour, 0, 0).toISOString(),
                    type: 'entrada',
                    source: 'qr_general',
                    editedBy: null,
                    editedAt: null
                });
                records.push({
                    id: `rec_test_2_s_${day}`,
                    rut: ruts[1],
                    date: dateStr,
                    timestamp: new Date(year, month, day, exitHour, 0, 0).toISOString(),
                    type: 'salida',
                    source: 'qr_general',
                    editedBy: null,
                    editedAt: null
                });
            }
        }

        return records;
    }
}

// Instancia global disponible en las interfaces
window.AppDB = new DatabaseManager();
