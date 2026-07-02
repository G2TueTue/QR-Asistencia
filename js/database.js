/**
 * Sistema Web de Control de Asistencia y Cálculo de Remuneraciones
 * js/database.js - Módulo de Persistencia y Reglas de Negocio
 * 
 * Este archivo centraliza el almacenamiento y procesamiento de datos.
 * Funciona por defecto con LocalStorage (sincronizado en tiempo real entre pestañas)
 * y está diseñado para ser fácilmente conectado a Firebase.
 */

// Toggle para activar Firebase cuando se configuren las credenciales en firebase-config.js
const USE_FIREBASE = true;

class DatabaseManager {
    constructor() {
        this.initLocalStorage();
        this.initHolidays();
        this.setupTabSynchronization();
        if (USE_FIREBASE && window.IsFirebaseConfigured) {
            this.initFirebaseSync();
        }
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
                overtimeRate: 4500,
                targetHours: 160
            },
            {
                rut: "18.765.432-1",
                name: "María González",
                password: "5678",
                role: "worker",
                baseSalary: 600000,
                overtimeRate: 4500,
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
                // Si no es un arreglo, no contiene nuestro RUT de prueba, la meta no es 160, o falta overtimeRate, forzamos el reset
                if (!Array.isArray(parsed) || !parsed.some(u => u.rut === "12.345.678-9") || !parsed.some(u => u.targetHours === 160) || !parsed.some(u => u.role === 'worker' && u.overtimeRate !== undefined)) {
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

    // Inicializar escuchas y sincronización en tiempo real con Firebase Firestore
    initFirebaseSync() {
        if (!window.FirebaseDB) {
            console.warn("FirebaseDB no está inicializado. Ejecutando en modo local.");
            return;
        }

        const db = window.FirebaseDB;

        // 1. Escuchar la colección 'Usuarios' en tiempo real
        db.collection('Usuarios').onSnapshot((snapshot) => {
            const users = [];
            snapshot.forEach((doc) => {
                users.push(this.mapUserFromFirestore(doc));
            });

            if (users.length > 0) {
                localStorage.setItem('qr_asistencia_users', JSON.stringify(users));
                console.log("Usuarios sincronizados desde Firebase:", users.length);
                if (this.onUsersChangeCallback) {
                    this.onUsersChangeCallback(users);
                }
            } else {
                // Si la colección está vacía, subimos los usuarios por defecto
                this.uploadDefaultUsers();
            }
        }, (error) => {
            console.error("Error sincronizando usuarios de Firebase:", error);
        });

        // 2. Escuchar la colección 'asistencias' en tiempo real
        db.collection('asistencias').onSnapshot((snapshot) => {
            const records = [];
            snapshot.forEach((doc) => {
                records.push(this.mapRecordFromFirestore(doc));
            });

            localStorage.setItem('qr_asistencia_records', JSON.stringify(records));
            console.log("Registros de asistencia sincronizados desde Firebase:", records.length);

            // Disparar callback para actualizar interfaces
            if (this.onRecordsChangeCallback) {
                this.onRecordsChangeCallback(records);
            }
        }, (error) => {
            console.error("Error sincronizando asistencias de Firebase:", error);
        });

        // 3. Escuchar la colección 'feriados' en tiempo real
        db.collection('feriados').onSnapshot((snapshot) => {
            const holidays = [];
            snapshot.forEach((doc) => {
                holidays.push({
                    date: doc.id,
                    name: doc.data().nombre || doc.data().name || ''
                });
            });

            if (holidays.length > 0) {
                localStorage.setItem('qr_asistencia_feriados', JSON.stringify(holidays));
                console.log("Feriados sincronizados desde Firebase:", holidays.length);
                if (this.onHolidaysChangeCallback) {
                    this.onHolidaysChangeCallback(holidays);
                }
            } else {
                this.uploadDefaultHolidays();
            }
        }, (error) => {
            console.error("Error sincronizando feriados de Firebase:", error);
        });
    }

    mapUserFromFirestore(doc) {
        const data = doc.data();
        return {
            rut: doc.id,
            name: data.nombre || data.name || '',
            password: data.contrasena || data.password || '',
            role: data.rol || data.role || 'worker',
            baseSalary: Number(data.sueldo_base || data.baseSalary || 600000),
            overtimeRate: Number(data.valor_hora_extra || data.overtimeRate || 4500),
            targetHours: Number(data.horas_meta || data.targetHours || 160)
        };
    }

    mapRecordFromFirestore(doc) {
        const data = doc.data();
        return {
            id: doc.id,
            rut: data.rut || '',
            date: data.fecha || data.date || '',
            timestamp: data.marca_tiempo || data.timestamp || '',
            type: data.tipo || data.type || '',
            source: data.origen || data.source || '',
            editedBy: data.editado_por || data.editedBy || null,
            editedAt: data.editado_en || data.editedAt || null
        };
    }

    mapRecordToFirestore(record) {
        return {
            rut: record.rut || '',
            fecha: record.date || '',
            marca_tiempo: record.timestamp || '',
            tipo: record.type || '',
            origen: record.source || '',
            editado_por: record.editedBy || null,
            editado_en: record.editedAt || null
        };
    }

    async uploadDefaultUsers() {
        const db = window.FirebaseDB;
        if (!db) return;

        const defaultUsers = [
            {
                rut: "12.345.678-9",
                name: "Juan Pérez",
                password: "1234",
                role: "worker",
                baseSalary: 600000,
                overtimeRate: 4500,
                targetHours: 160
            },
            {
                rut: "18.765.432-1",
                name: "María González",
                password: "5678",
                role: "worker",
                baseSalary: 600000,
                overtimeRate: 4500,
                targetHours: 160
            },
            {
                rut: "99.999.999-9",
                name: "Supervisor Admin",
                password: "admin",
                role: "supervisor"
            }
        ];

        console.log("Subiendo usuarios por defecto a Firebase...");
        const batch = db.batch();
        defaultUsers.forEach(user => {
            const docRef = db.collection('Usuarios').doc(user.rut);
            batch.set(docRef, {
                nombre: user.name,
                contrasena: user.password,
                rol: user.role,
                sueldo_base: user.baseSalary || null,
                valor_hora_extra: user.overtimeRate || null,
                horas_meta: user.targetHours || null
            });
        });
        await batch.commit();
        console.log("Usuarios por defecto subidos exitosamente.");
    }

    // Escucha cambios en LocalStorage desde otras pestañas (ej: el celular escanea y el PC del supervisor se actualiza)
    setupTabSynchronization() {
        window.addEventListener('storage', (event) => {
            if (event.key === 'qr_asistencia_records' && this.onRecordsChangeCallback) {
                this.onRecordsChangeCallback(this.getAllRecords());
            }
            if (event.key === 'qr_asistencia_feriados' && this.onHolidaysChangeCallback) {
                this.onHolidaysChangeCallback(this.getHolidays());
            }
        });
    }

    // Callback para actualizar interfaces en tiempo real
    onRecordsChange(callback) {
        this.onRecordsChangeCallback = callback;
    }

    onUsersChange(callback) {
        this.onUsersChangeCallback = callback;
    }

    // --- MÉTODOS DE USUARIOS ---

    getUsers() {
        const users = JSON.parse(localStorage.getItem('qr_asistencia_users')) || [];
        return users.map(u => ({
            ...u,
            overtimeRate: u.overtimeRate !== undefined ? u.overtimeRate : (u.role === 'worker' ? 4500 : undefined)
        }));
    }

    getUserByRut(rut) {
        return this.getUsers().find(u => u.rut === rut);
    }

    addWorker(rut, name, password, baseSalary, overtimeRate) {
        const users = this.getUsers();

        // Verificar si el RUT ya existe
        if (users.some(u => u.rut === rut)) {
            throw new Error("El RUT ya está registrado.");
        }

        const newWorker = {
            rut: rut,
            name: name,
            password: password,
            role: 'worker', // Rol fijo como trabajador
            baseSalary: Number(baseSalary),
            overtimeRate: Number(overtimeRate || 4500),
            targetHours: 160 // Meta por defecto
        };

        users.push(newWorker);
        localStorage.setItem('qr_asistencia_users', JSON.stringify(users));

        // Guardar en Firebase si está activo
        if (USE_FIREBASE && window.FirebaseDB) {
            const firebaseUser = {
                nombre: name,
                contrasena: password,
                rol: 'worker',
                sueldo_base: Number(baseSalary),
                valor_hora_extra: Number(overtimeRate || 4500),
                horas_meta: 160
            };
            window.FirebaseDB.collection('Usuarios').doc(rut).set(firebaseUser)
                .then(() => console.log("Usuario guardado en Firebase:", rut))
                .catch(err => console.error("Error al guardar usuario en Firebase:", err));
        }

        if (this.onUsersChangeCallback) {
            this.onUsersChangeCallback(users);
        }

        return newWorker;
    }

    deleteWorker(rut) {
        let users = this.getUsers();

        // Verificar si el usuario existe
        if (!users.some(u => u.rut === rut)) {
            throw new Error("El trabajador no existe.");
        }

        users = users.filter(u => u.rut !== rut);
        localStorage.setItem('qr_asistencia_users', JSON.stringify(users));

        // Borrar en Firebase si está activo
        if (USE_FIREBASE && window.FirebaseDB) {
            window.FirebaseDB.collection('Usuarios').doc(rut).delete()
                .then(() => console.log("Usuario eliminado de Firebase:", rut))
                .catch(err => console.error("Error al eliminar usuario en Firebase:", err));
        }

        if (this.onUsersChangeCallback) {
            this.onUsersChangeCallback(users);
        }
    }

    updateWorker(rut, name, password, baseSalary, overtimeRate) {
        const users = this.getUsers();
        const userIdx = users.findIndex(u => u.rut === rut);

        if (userIdx === -1) {
            throw new Error("El trabajador no existe.");
        }

        users[userIdx].name = name;
        users[userIdx].password = password;
        users[userIdx].baseSalary = Number(baseSalary);
        users[userIdx].overtimeRate = Number(overtimeRate || 4500);

        localStorage.setItem('qr_asistencia_users', JSON.stringify(users));

        // Actualizar en Firebase si está activo
        if (USE_FIREBASE && window.FirebaseDB) {
            const firebaseUser = {
                nombre: name,
                contrasena: password,
                rol: 'worker',
                sueldo_base: Number(baseSalary),
                valor_hora_extra: Number(overtimeRate || 4500),
                horas_meta: users[userIdx].targetHours || 160
            };
            window.FirebaseDB.collection('Usuarios').doc(rut).update(firebaseUser)
                .then(() => console.log("Usuario actualizado en Firebase:", rut))
                .catch(err => console.error("Error al actualizar usuario en Firebase:", err));
        }

        if (this.onUsersChangeCallback) {
            this.onUsersChangeCallback(users);
        }

        return users[userIdx];
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

    // --- MÉTODOS DE FERIADOS ---

    /**
     * Inicializa la lista predeterminada de días feriados de Chile para el año 2026
     * en LocalStorage si aún no existen registros.
     * @returns {void}
     */
    initHolidays() {
        const defaultHolidays = [
            { date: "2026-01-01", name: "Año Nuevo" },
            { date: "2026-04-03", name: "Viernes Santo" },
            { date: "2026-04-04", name: "Sábado Santo" },
            { date: "2026-05-01", name: "Día del Trabajo" },
            { date: "2026-05-21", name: "Día de las Glorias Navales" },
            { date: "2026-06-29", name: "San Pedro y San Pablo" },
            { date: "2026-07-16", name: "Día de la Virgen del Carmen" },
            { date: "2026-08-15", name: "Asunción de la Virgen" },
            { date: "2026-09-18", name: "Independencia Nacional" },
            { date: "2026-09-19", name: "Glorias del Ejército" },
            { date: "2026-10-12", name: "Encuentro de Dos Mundos" },
            { date: "2026-10-31", name: "Día de las Iglesias Evangélicas" },
            { date: "2026-11-01", name: "Día de Todos los Santos" },
            { date: "2026-12-08", name: "Inmaculada Concepción" },
            { date: "2026-12-25", name: "Navidad" }
        ];

        const existingHolidays = localStorage.getItem('qr_asistencia_feriados');
        if (!existingHolidays) {
            localStorage.setItem('qr_asistencia_feriados', JSON.stringify(defaultHolidays));
        }
    }

    /**
     * Obtiene el listado completo de feriados locales, ordenados por fecha ascendente.
     * @returns {Array<{date: string, name: string}>} Arreglo con los feriados registrados.
     */
    getHolidays() {
        const holidays = JSON.parse(localStorage.getItem('qr_asistencia_feriados')) || [];
        return holidays.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    /**
     * Determina si una fecha específica corresponde a un día feriado registrado.
     * @param {string} dateStr - Fecha a evaluar en formato YYYY-MM-DD.
     * @returns {boolean} True si es feriado, false de lo contrario.
     */
    isHoliday(dateStr) {
        const holidays = this.getHolidays();
        return holidays.some(h => h.date === dateStr);
    }

    /**
     * Obtiene el nombre del feriado correspondiente a una fecha.
     * @param {string} dateStr - Fecha en formato YYYY-MM-DD.
     * @returns {string} El nombre de la festividad, o una cadena vacía si no es festivo.
     */
    getHolidayName(dateStr) {
        const holidays = this.getHolidays();
        const found = holidays.find(h => h.date === dateStr);
        return found ? found.name : '';
    }

    /**
     * Registra un nuevo día feriado en la persistencia local y sincroniza en Firebase.
     * @param {string} dateStr - Fecha del feriado (YYYY-MM-DD).
     * @param {string} name - Nombre descriptivo de la festividad.
     * @throws {Error} Si ya existe un feriado en la fecha indicada.
     * @returns {{date: string, name: string}} El objeto del feriado creado.
     */
    addHoliday(dateStr, name) {
        const holidays = this.getHolidays();
        if (holidays.some(h => h.date === dateStr)) {
            throw new Error("Ya existe un feriado en esa fecha.");
        }

        const newHoliday = { date: dateStr, name: name };
        holidays.push(newHoliday);
        localStorage.setItem('qr_asistencia_feriados', JSON.stringify(holidays));

        // Sincronizar en Firebase si está activo
        if (USE_FIREBASE && window.FirebaseDB) {
            window.FirebaseDB.collection('feriados').doc(dateStr).set({ nombre: name })
                .then(() => console.log("Feriado guardado en Firebase:", dateStr))
                .catch(err => console.error("Error al guardar feriado en Firebase:", err));
        }

        if (this.onHolidaysChangeCallback) {
            this.onHolidaysChangeCallback(holidays);
        }

        return newHoliday;
    }

    /**
     * Elimina un día feriado del LocalStorage y de la colección remota de Firebase.
     * @param {string} dateStr - Fecha del feriado (YYYY-MM-DD) a remover.
     * @throws {Error} Si la fecha no corresponde a ningún feriado activo.
     * @returns {void}
     */
    deleteHoliday(dateStr) {
        let holidays = this.getHolidays();
        if (!holidays.some(h => h.date === dateStr)) {
            throw new Error("El feriado no existe.");
        }

        holidays = holidays.filter(h => h.date !== dateStr);
        localStorage.setItem('qr_asistencia_feriados', JSON.stringify(holidays));

        // Borrar en Firebase si está activo
        if (USE_FIREBASE && window.FirebaseDB) {
            window.FirebaseDB.collection('feriados').doc(dateStr).delete()
                .then(() => console.log("Feriado eliminado de Firebase:", dateStr))
                .catch(err => console.error("Error al eliminar feriado en Firebase:", err));
        }

        if (this.onHolidaysChangeCallback) {
            this.onHolidaysChangeCallback(holidays);
        }
    }

    async uploadDefaultHolidays() {
        const db = window.FirebaseDB;
        if (!db) return;

        const defaultHolidays = [
            { date: "2026-01-01", name: "Año Nuevo" },
            { date: "2026-04-03", name: "Viernes Santo" },
            { date: "2026-04-04", name: "Sábado Santo" },
            { date: "2026-05-01", name: "Día del Trabajo" },
            { date: "2026-05-21", name: "Día de las Glorias Navales" },
            { date: "2026-06-29", name: "San Pedro y San Pablo" },
            { date: "2026-07-16", name: "Día de la Virgen del Carmen" },
            { date: "2026-08-15", name: "Asunción de la Virgen" },
            { date: "2026-09-18", name: "Independencia Nacional" },
            { date: "2026-09-19", name: "Glorias del Ejército" },
            { date: "2026-10-12", name: "Encuentro de Dos Mundos" },
            { date: "2026-10-31", name: "Día de las Iglesias Evangélicas" },
            { date: "2026-11-01", name: "Día de Todos los Santos" },
            { date: "2026-12-08", name: "Inmaculada Concepción" },
            { date: "2026-12-25", name: "Navidad" }
        ];

        console.log("Subiendo feriados por defecto a Firebase...");
        const batch = db.batch();
        defaultHolidays.forEach(h => {
            const docRef = db.collection('feriados').doc(h.date);
            batch.set(docRef, { nombre: h.name });
        });
        await batch.commit();
        console.log("Feriados por defecto subidos exitosamente.");
    }

    onHolidaysChange(callback) {
        this.onHolidaysChangeCallback = callback;
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
        const dateStr = window.getChileanDateStr(now); // YYYY-MM-DD local de Chile

        const newRecord = {
            id: 'rec_' + Math.random().toString(36).substr(2, 9),
            rut: rut,
            date: dateStr,
            timestamp: window.getChileanTimestamp(now),
            type: type,
            source: source,
            editedBy: null,
            editedAt: null
        };

        records.push(newRecord);
        localStorage.setItem('qr_asistencia_records', JSON.stringify(records));

        // Persistir en Firebase
        if (USE_FIREBASE && window.FirebaseDB) {
            window.FirebaseDB.collection('asistencias').doc(newRecord.id).set(this.mapRecordToFirestore(newRecord))
                .then(() => console.log("Registro guardado en Firebase:", newRecord.id))
                .catch(err => console.error("Error al guardar registro en Firebase:", err));
        }

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
        const timestamp = `${dateStr} ${timeStr}:00`;

        const newRecord = {
            id: 'rec_' + Math.random().toString(36).substr(2, 9),
            rut: rut,
            date: dateStr,
            timestamp: timestamp,
            type: type,
            source: 'manual',
            editedBy: supervisorRut,
            editedAt: window.getChileanTimestamp()
        };

        records.push(newRecord);
        localStorage.setItem('qr_asistencia_records', JSON.stringify(records));

        // Persistir en Firebase
        if (USE_FIREBASE && window.FirebaseDB) {
            window.FirebaseDB.collection('asistencias').doc(newRecord.id).set(this.mapRecordToFirestore(newRecord))
                .then(() => console.log("Registro manual guardado en Firebase:", newRecord.id))
                .catch(err => console.error("Error al guardar registro manual en Firebase:", err));
        }

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
            const timestamp = `${dateStr} ${timeStr}:00`;
            records[index] = {
                ...records[index],
                date: dateStr,
                timestamp: timestamp,
                type: type,
                editedBy: supervisorRut,
                editedAt: window.getChileanTimestamp()
            };

            localStorage.setItem('qr_asistencia_records', JSON.stringify(records));

            // Actualizar en Firebase
            if (USE_FIREBASE && window.FirebaseDB) {
                window.FirebaseDB.collection('asistencias').doc(id).set(this.mapRecordToFirestore(records[index]))
                    .then(() => console.log("Registro actualizado en Firebase:", id))
                    .catch(err => console.error("Error al actualizar registro en Firebase:", err));
            }

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

        // Eliminar de Firebase
        if (USE_FIREBASE && window.FirebaseDB) {
            window.FirebaseDB.collection('asistencias').doc(id).delete()
                .then(() => console.log("Registro eliminado de Firebase:", id))
                .catch(err => console.error("Error al eliminar registro de Firebase:", err));
        }

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
        const todayStr = window.getChileanDateStr();
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
     * Procesa y agrupa cronológicamente los registros de asistencia de un trabajador 
     * en un mes/año particular, calculando las horas ordinarias y extras trabajadas por día.
     * Descuenta una hora obligatoria de colación en marcas regulares completas.
     * @param {string} rut - RUT del trabajador.
     * @param {number} year - Año de consulta (ej. 2026).
     * @param {number} month - Índice de mes (0 = Enero, 11 = Diciembre).
     * @returns {Array<Object>} Arreglo ordenado por fecha con el desglose diario.
     */
    calculateMonthlyBreakdown(rut, year, month) {
        const records = this.getRecordsByWorker(rut);

        // Ordenar todos los registros de este trabajador cronológicamente
        const sortedRecords = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const shifts = [];
        let activeEntrada = null;
        let activeExtra = null;

        for (let i = 0; i < sortedRecords.length; i++) {
            const record = sortedRecords[i];

            if (record.type === 'entrada') {
                if (activeEntrada) {
                    // Turno previo sin salida (incompleto)
                    shifts.push({
                        date: activeEntrada.date,
                        type: 'regular',
                        entrada: new Date(activeEntrada.timestamp),
                        salida: null,
                        regularHours: 0,
                        overtimeHours: 0,
                        rawRecords: [activeEntrada]
                    });
                }
                activeEntrada = record;
            } else if (record.type === 'salida') {
                if (activeEntrada) {
                    const entradaDate = new Date(activeEntrada.timestamp);
                    const salidaDate = new Date(record.timestamp);
                    const diffMs = salidaDate - entradaDate;
                    const diffHrs = diffMs / (1000 * 60 * 60);

                    if (diffHrs > 20.0) {
                        // Si pasan más de 20 horas, asumimos marcas independientes (olvido de marcar)
                        shifts.push({
                            date: activeEntrada.date,
                            type: 'regular',
                            entrada: entradaDate,
                            salida: null,
                            regularHours: 0,
                            overtimeHours: 0,
                            rawRecords: [activeEntrada]
                        });
                        shifts.push({
                            date: record.date,
                            type: 'regular',
                            entrada: null,
                            salida: salidaDate,
                            regularHours: 0,
                            overtimeHours: 0,
                            rawRecords: [record]
                        });
                    } else {
                        const regularHours = Math.max(0, diffHrs - 1.0); // Descontar colación obligatoria
                        shifts.push({
                            date: activeEntrada.date, // Se atribuye a la fecha de entrada
                            type: 'regular',
                            entrada: entradaDate,
                            salida: salidaDate,
                            regularHours: parseFloat(regularHours.toFixed(2)),
                            overtimeHours: 0,
                            rawRecords: [activeEntrada, record]
                        });
                    }
                    activeEntrada = null;
                } else {
                    // Salida sin entrada
                    shifts.push({
                        date: record.date,
                        type: 'regular',
                        entrada: null,
                        salida: new Date(record.timestamp),
                        regularHours: 0,
                        overtimeHours: 0,
                        rawRecords: [record]
                    });
                }
            } else if (record.type === 'extra_inicio') {
                if (activeExtra) {
                    // Turno extra previo sin salida
                    shifts.push({
                        date: activeExtra.date,
                        type: 'extra',
                        entrada: null,
                        salida: null,
                        regularHours: 0,
                        overtimeHours: 0,
                        rawRecords: [activeExtra]
                    });
                }
                activeExtra = record;
            } else if (record.type === 'extra_fin') {
                if (activeExtra) {
                    const extraInDate = new Date(activeExtra.timestamp.replace(' ', 'T'));
                    const extraFinDate = new Date(record.timestamp.replace(' ', 'T'));
                    const diffMs = extraFinDate - extraInDate;
                    const diffHrs = diffMs / (1000 * 60 * 60);
                    
                    if (diffHrs > 16.0) {
                        // Extra extremadamente largo
                        shifts.push({
                            date: activeExtra.date,
                            type: 'extra',
                            entrada: null,
                            salida: null,
                            regularHours: 0,
                            overtimeHours: 0,
                            rawRecords: [activeExtra]
                        });
                        shifts.push({
                            date: record.date,
                            type: 'extra',
                            entrada: null,
                            salida: null,
                            regularHours: 0,
                            overtimeHours: 0,
                            rawRecords: [record]
                        });
                    } else {
                        // Redondeo por turno: menor a 50 min se trunca, 50 min o más sube a hora completa
                        const hoursInt = Math.floor(diffHrs);
                        const minutesFraction = (diffHrs - hoursInt) * 60;
                        const finalOvertimeHours = minutesFraction >= 50 ? hoursInt + 1 : hoursInt;

                        shifts.push({
                            date: activeExtra.date,
                            type: 'extra',
                            entrada: null,
                            salida: null,
                            regularHours: 0,
                            overtimeHours: finalOvertimeHours,
                            rawRecords: [activeExtra, record]
                        });
                    }
                    activeExtra = null;
                } else {
                    // Fin de extra sin inicio
                    shifts.push({
                        date: record.date,
                        type: 'extra',
                        entrada: null,
                        salida: null,
                        regularHours: 0,
                        overtimeHours: 0,
                        rawRecords: [record]
                    });
                }
            }
        }

        // Guardar marcas que quedaron abiertas al final del ciclo
        if (activeEntrada) {
            shifts.push({
                date: activeEntrada.date,
                type: 'regular',
                entrada: new Date(activeEntrada.timestamp.replace(' ', 'T')),
                salida: null,
                regularHours: 0,
                overtimeHours: 0,
                rawRecords: [activeEntrada]
            });
        }
        if (activeExtra) {
            shifts.push({
                date: activeExtra.date,
                type: 'extra',
                entrada: null,
                salida: null,
                regularHours: 0,
                overtimeHours: 0,
                rawRecords: [activeExtra]
            });
        }

        // Agrupar los turnos calculados por su fecha
        const shiftsByDate = {};
        shifts.forEach(shift => {
            if (!shiftsByDate[shift.date]) {
                shiftsByDate[shift.date] = {
                    entrada: null,
                    salida: null,
                    regularHours: 0,
                    overtimeHours: 0,
                    rawRecords: []
                };
            }

            const group = shiftsByDate[shift.date];

            if (shift.entrada) {
                if (!group.entrada || shift.entrada < group.entrada) {
                    group.entrada = shift.entrada;
                }
            }
            if (shift.salida) {
                if (!group.salida || shift.salida > group.salida) {
                    group.salida = shift.salida;
                }
            }

            group.regularHours += shift.regularHours;
            group.overtimeHours += shift.overtimeHours;

            // Evitar duplicar registros en rawRecords
            shift.rawRecords.forEach(r => {
                if (!group.rawRecords.some(existing => existing.id === r.id)) {
                    group.rawRecords.push(r);
                }
            });
        });

        // Filtrar y estructurar el breakdown final para el mes y año solicitado
        const breakdown = [];
        Object.keys(shiftsByDate).forEach(dateStr => {
            const [y, m, d] = dateStr.split('-').map(Number);
            if (y === year && (m - 1) === month) {
                const group = shiftsByDate[dateStr];
                breakdown.push({
                    date: dateStr,
                    entrada: group.entrada ? this.formatTime(group.entrada) : '--:--',
                    salida: group.salida ? this.formatTime(group.salida) : '--:--',
                    regularHours: group.regularHours,
                    overtimeHours: group.overtimeHours,
                    totalDaily: group.regularHours + group.overtimeHours,
                    isHoliday: this.isHoliday(dateStr),
                    holidayName: this.getHolidayName(dateStr),
                    rawRecords: group.rawRecords.sort((a, b) => new Date(a.timestamp.replace(' ', 'T')) - new Date(b.timestamp.replace(' ', 'T')))
                });
            }
        });

        // Ordenar breakdown por fecha ascendente
        return breakdown.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    /**
     * Calcula la liquidación de sueldo mensual (Reglas Financieras).
     * Aplica pago proporcional de sueldo base si es menor a 160 horas metas.
     * Incorpora recargo legal del +50% (total 1.5x) para cualquier hora (ordinaria o extra)
     * trabajada durante días festivos (feriados).
     * @param {string} rut - RUT del trabajador.
     * @param {number} year - Año del período de cálculo.
     * @param {number} month - Mes del período de cálculo (0-11).
     * @returns {Object|null} Objeto con la liquidación detallada y resumen financiero, o null si el usuario no existe.
     */
    calculatePayroll(rut, year, month) {
        const breakdown = this.calculateMonthlyBreakdown(rut, year, month);
        const user = this.getUserByRut(rut);

        if (!user) return null;

        // Sumar horas exactas (floats sin redondear)
        let totalRegularHours = 0;
        let totalExtraShiftHours = 0; // Provienen del QR de Horas Extras directamente
        let holidayRegularHours = 0;
        let holidayExtraShiftHours = 0;

        breakdown.forEach(day => {
            totalRegularHours += day.regularHours;
            totalExtraShiftHours += day.overtimeHours;
            if (day.isHoliday) {
                holidayRegularHours += day.regularHours;
                holidayExtraShiftHours += day.overtimeHours;
            }
        });

        // Fórmulas de Negocio
        const baseTarget = Number(user.targetHours || 160);
        const rateBase = Number(user.baseSalary || 600000);
        const rateExtra = Number(user.overtimeRate || 4500);

        let baseSalaryEarned = 0;
        let regularOvertimeHours = 0;

        if (totalRegularHours >= baseTarget) {
            // Cumple o supera las horas meta
            baseSalaryEarned = rateBase;
            // El exceso de la jornada regular se convierte en horas extras (con redondeo a 50 min)
            const diff = totalRegularHours - baseTarget;
            const diffInt = Math.floor(diff);
            const diffMins = (diff - diffInt) * 60;
            regularOvertimeHours = diffMins >= 50 ? diffInt + 1 : diffInt;
        } else {
            // Opción A: Pago proporcional si trabaja menos de las horas ordinarias meta
            baseSalaryEarned = (totalRegularHours / baseTarget) * rateBase;
            baseSalaryEarned = Math.max(0, parseFloat(baseSalaryEarned.toFixed(0)));
            regularOvertimeHours = 0;
        }

        // Sumar horas extras: las regulares que exceden meta + todas las realizadas vía el QR de Horas Extras
        const totalOvertimeHours = regularOvertimeHours + totalExtraShiftHours;
        
        // Redondear a 2 decimales para la visualización del total consolidado (los extras ya son enteros)
        const totalRegularHoursRounded = parseFloat(totalRegularHours.toFixed(2));
        const totalExtraShiftHoursRounded = totalExtraShiftHours;
        const regularOvertimeHoursRounded = regularOvertimeHours;
        const totalOvertimeHoursRounded = totalOvertimeHours;

        // Surcharges (recargos) for holidays (+50% to make it 1.5x)
        const rateRegularHour = rateBase / baseTarget;
        const holidayRegularSurcharge = Math.round(holidayRegularHours * rateRegularHour * 0.5);
        const holidayExtraSurcharge = Math.round(holidayExtraShiftHours * rateExtra * 0.5);
        const totalHolidaySurcharge = holidayRegularSurcharge + holidayExtraSurcharge;

        const overtimeSalaryEarned = Math.round(totalOvertimeHoursRounded * rateExtra);
        const totalSalary = Math.round(baseSalaryEarned + overtimeSalaryEarned + totalHolidaySurcharge);

        // Formatear el desglose diario para visualización de 2 decimales limpios
        const formattedBreakdown = breakdown.map(day => ({
            ...day,
            regularHours: parseFloat(day.regularHours.toFixed(2)),
            overtimeHours: parseFloat(day.overtimeHours.toFixed(2)),
            totalDaily: parseFloat(day.totalDaily.toFixed(2))
        }));

        return {
            rut: rut,
            name: user.name,
            totalRegularHours: totalRegularHoursRounded,
            totalExtraShiftHours: totalExtraShiftHoursRounded,
            regularOvertimeHours: regularOvertimeHoursRounded,
            totalOvertimeHours: totalOvertimeHoursRounded,
            holidayRegularHours: parseFloat(holidayRegularHours.toFixed(2)),
            holidayExtraHours: parseFloat(holidayExtraShiftHours.toFixed(2)),
            holidayRegularSurcharge: holidayRegularSurcharge,
            holidayExtraSurcharge: holidayExtraSurcharge,
            totalHolidaySurcharge: totalHolidaySurcharge,
            baseSalaryEarned: baseSalaryEarned,
            overtimeSalaryEarned: overtimeSalaryEarned,
            totalSalary: totalSalary,
            breakdown: formattedBreakdown,
            referenceBaseSalary: rateBase,
            targetHours: baseTarget,
            overtimeRate: rateExtra
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
                    const dateStr = window.getChileanDateStr(date);
                    // Turno extra: 09:00 a 14:00 (5 horas extras)
                    records.push({
                        id: `rec_test_extra_i_${day}`,
                        rut: ruts[0],
                        date: dateStr,
                        timestamp: window.getChileanTimestamp(new Date(year, month, day, 9, 0, 0)),
                        type: 'extra_inicio',
                        source: 'qr_extra',
                        editedBy: null,
                        editedAt: null
                    });
                    records.push({
                        id: `rec_test_extra_f_${day}`,
                        rut: ruts[0],
                        date: dateStr,
                        timestamp: window.getChileanTimestamp(new Date(year, month, day, 14, 0, 0)),
                        type: 'extra_fin',
                        source: 'qr_extra',
                        editedBy: null,
                        editedAt: null
                    });
                }
                continue;
            }

            const dateStr = window.getChileanDateStr(date);

            // Trabajador 1: Juan Pérez (jornada completa ordenada, ej. 08:00 a 18:00 = 10hrs brutas - 1hr colacion = 9hrs netas diarias)
            records.push({
                id: `rec_test_1_e_${day}`,
                rut: ruts[0],
                date: dateStr,
                timestamp: window.getChileanTimestamp(new Date(year, month, day, 8, 0, 0)),
                type: 'entrada',
                source: 'qr_general',
                editedBy: null,
                editedAt: null
            });
            records.push({
                id: `rec_test_1_s_${day}`,
                rut: ruts[0],
                date: dateStr,
                timestamp: window.getChileanTimestamp(new Date(year, month, day, 18, 0, 0)),
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
                    timestamp: window.getChileanTimestamp(new Date(year, month, day, entryHour, 0, 0)),
                    type: 'entrada',
                    source: 'qr_general',
                    editedBy: null,
                    editedAt: null
                });
                records.push({
                    id: `rec_test_2_s_${day}`,
                    rut: ruts[1],
                    date: dateStr,
                    timestamp: window.getChileanTimestamp(new Date(year, month, day, exitHour, 0, 0)),
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
