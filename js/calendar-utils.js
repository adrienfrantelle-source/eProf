// ===== SOCLE COMMUN CALENDRIER / AGENDA =====
// Dates en heure locale, persistance unique, formulaire d'événement partagé.
(function () {
    var STORAGE_KEY = 'eprof-events';
    var SETTINGS_KEY = 'eprof-agenda-settings';
    var NOTIFIED_KEY = 'eprof-agenda-notified';

    var COLORS = [
        { value: '#e53935', label: 'Rouge' },
        { value: '#fb8c00', label: 'Orange' },
        { value: '#fdd835', label: 'Jaune' },
        { value: '#43a047', label: 'Vert' },
        { value: '#00acc1', label: 'Cyan' },
        { value: '#1e88e5', label: 'Bleu' },
        { value: '#8e24aa', label: 'Violet' },
        { value: '#6d4c41', label: 'Brun' },
        { value: '#546e7a', label: 'Gris' }
    ];

    var EMOJIS = ['📌', '✅', '📝', '📚', '🧪', '🎯', '⏰', '📞', '✉️', '👥', '🏫', '🚌', '🍽️', '💡', '⚠️', '🔥', '🎉', '🩺', '💰', '🖨️', '🧹', '📊', '🎓', '🌱'];

    var TYPES = [
        { value: 'cours', label: '📚 Cours' },
        { value: 'event', label: '📅 Événement' },
        { value: 'todo', label: '📝 Tâche' },
        { value: 'rdv', label: '🤝 Rendez-vous' }
    ];

    var REMINDER_OPTIONS = [
        { value: '', label: 'Aucun rappel' },
        { value: '0', label: 'À l\'heure' },
        { value: '5', label: '5 minutes avant' },
        { value: '15', label: '15 minutes avant' },
        { value: '30', label: '30 minutes avant' },
        { value: '60', label: '1 heure avant' },
        { value: '120', label: '2 heures avant' },
        { value: '1440', label: '1 jour avant' },
        { value: '2880', label: '2 jours avant' },
        { value: '10080', label: '1 semaine avant' }
    ];

    var JOURS = [
        { value: 1, short: 'Lun', label: 'Lundi' },
        { value: 2, short: 'Mar', label: 'Mardi' },
        { value: 3, short: 'Mer', label: 'Mercredi' },
        { value: 4, short: 'Jeu', label: 'Jeudi' },
        { value: 5, short: 'Ven', label: 'Vendredi' },
        { value: 6, short: 'Sam', label: 'Samedi' },
        { value: 0, short: 'Dim', label: 'Dimanche' }
    ];

    var JOURS_MAP = {
        dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6
    };

    var FIN_COURS = {
        '2025-2026': '2026-07-04',
        '2026-2027': '2027-07-03',
        '2027-2028': '2028-07-08'
    };

    var DEFAULT_CAL_PREFS = {
        heureDebut: '08:00',
        heureFin: '20:00',
        afficherSamedi: false,
        ligneDebut: '08:00',
        ligneFin: '17:10',
        pauseMatinDebut: '09:50',
        pauseMatinFin: '10:05',
        pauseMidiDebut: '11:55',
        pauseMidiFin: '13:15',
        pauseApresDebut: '15:05',
        pauseApresFin: '15:20'
    };

    var DEFAULT_AGENDA_SETTINGS = { notificationsActives: false, rappelParDefaut: '60', afficherTermines: false };

    var formBound = false;
    var formCallbacks = { onSaved: null, onDeleted: null, occurrenceEdit: null };
    var notificationTimer = null;
    var closedDayCache = {};

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function isUuid(value) {
        return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }

    function readParametres() {
        try { return JSON.parse(localStorage.getItem('parametres') || '{}'); } catch (e) { return {}; }
    }

    function getAnneeScolaire() {
        return readParametres().anneeScolaire || '2026-2027';
    }

    function getCalendarPrefs() {
        return Object.assign({}, DEFAULT_CAL_PREFS, readParametres().calendrier || {});
    }

    function getCalendarDisplayPrefs() {
        var c = getCalendarPrefs();
        function toSlot(t, fallback) {
            var v = String(t || fallback);
            return v.length === 5 ? v + ':00' : v;
        }
        return {
            slotMinTime: toSlot(c.heureDebut, '08:00'),
            slotMaxTime: toSlot(c.heureFin, '20:00'),
            hiddenDays: c.afficherSamedi ? [0] : [0, 6],
            ligneDebut: c.ligneDebut || '08:00',
            ligneFin: c.ligneFin || '17:10',
            pauses: [
                { start: c.pauseMatinDebut, end: c.pauseMatinFin },
                { start: c.pauseMidiDebut, end: c.pauseMidiFin },
                { start: c.pauseApresDebut, end: c.pauseApresFin }
            ]
        };
    }

    function parseHm(str) {
        var p = String(str || '0:0').split(':');
        return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
    }

    function schoolYearStart(annee) {
        var y1 = parseInt(String(annee || getAnneeScolaire()).split('-')[0], 10) || 2026;
        return y1 + '-09-01';
    }

    function schoolYearEnd(annee) {
        var key = annee || getAnneeScolaire();
        if (FIN_COURS[key]) return FIN_COURS[key];
        var y2 = parseInt(String(key).split('-')[1], 10);
        return (y2 || 2027) + '-07-04';
    }

    function toYmdLocal(input) {
        if (input == null || input === '') return '';
        if (typeof input === 'string') {
            var s = input.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
            if (/T12:00:00(\.000)?Z$/.test(s)) return s.slice(0, 10);
        }
        var d = input instanceof Date ? input : new Date(input);
        if (isNaN(d.getTime())) return '';
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function addDaysYmd(ymd, n) {
        var parts = String(ymd).slice(0, 10).split('-').map(Number);
        var dt = new Date(parts[0], parts[1] - 1, parts[2] + n);
        return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
    }

    function isoWeekNumberFromYmd(ymd) {
        var parts = String(ymd || '').slice(0, 10).split('-').map(Number);
        if (parts.length < 3 || !parts[0]) return 0;
        var utc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        var dayNum = utc.getUTCDay() || 7;
        utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
        var yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
        return Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
    }

    function weekAbFromYmd(ymd) {
        var n = isoWeekNumberFromYmd(ymd);
        return n % 2 === 0 ? 'A' : 'B';
    }

    function normalizeWeekAb(value) {
        var v = String(value || '').trim().toUpperCase();
        if (v === 'A' || v === 'PAIR' || v === 'PAIRE' || v === 'EVEN') return 'A';
        if (v === 'B' || v === 'IMPAIR' || v === 'IMPAIRE' || v === 'ODD') return 'B';
        return null;
    }

    function matchesWeekAb(ymd, weekAb) {
        var ab = normalizeWeekAb(weekAb);
        if (!ab) return true;
        return weekAbFromYmd(ymd) === ab;
    }

    function weekAbLabel(weekAb) {
        var ab = normalizeWeekAb(weekAb);
        if (ab === 'A') return 'semaine A (paires)';
        if (ab === 'B') return 'semaine B (impaires)';
        return '';
    }

    function toLocalDateTimeInput(input) {
        if (input == null || input === '') return '';
        if (typeof input === 'string') {
            var s = input.trim();
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && s.indexOf('Z') === -1 && !/[+-]\d{2}:\d{2}$/.test(s)) {
                return s.slice(0, 16);
            }
        }
        var d = input instanceof Date ? input : new Date(input);
        if (isNaN(d.getTime())) return '';
        return toYmdLocal(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function toInputValue(value, allDay) {
        if (!value) return '';
        return allDay ? toYmdLocal(value) : toLocalDateTimeInput(value);
    }

    function localDateTimeToIso(value) {
        if (!value) return null;
        var d = new Date(value);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }

    function allDayToStored(ymd) {
        return String(ymd).slice(0, 10) + 'T12:00:00.000Z';
    }

    function parseAllDayYmd(value) {
        return toYmdLocal(value);
    }

    function parseAllDayExclusiveEnd(startVal, endVal) {
        var startYmd = parseAllDayYmd(startVal);
        if (!endVal) return addDaysYmd(startYmd, 1);
        if (typeof endVal === 'string' && /T12:00:00(\.000)?Z$/.test(endVal)) {
            var noonYmd = endVal.slice(0, 10);
            return noonYmd > startYmd ? noonYmd : addDaysYmd(startYmd, 1);
        }
        if (typeof endVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endVal.trim())) {
            var raw = endVal.trim();
            return raw > startYmd ? raw : addDaysYmd(startYmd, 1);
        }
        var d = new Date(endVal);
        if (isNaN(d.getTime())) return addDaysYmd(startYmd, 1);
        var ymd = toYmdLocal(d);
        if (d.getHours() === 23) return addDaysYmd(ymd, 1);
        if (d.getHours() === 0 && d.getMinutes() === 0 && ymd > startYmd) return ymd;
        if (ymd === startYmd) return addDaysYmd(startYmd, 1);
        return addDaysYmd(ymd, 1);
    }

    function allDayEndInclusive(startVal, endVal) {
        var exclusive = parseAllDayExclusiveEnd(startVal, endVal);
        return addDaysYmd(exclusive, -1);
    }

    function formToStartEnd(startRaw, endRaw, allDay) {
        if (allDay) {
            var start = String(startRaw).slice(0, 10);
            var inc = endRaw ? String(endRaw).slice(0, 10) : start;
            if (inc < start) inc = start;
            return {
                start: allDayToStored(start),
                end: allDayToStored(addDaysYmd(inc, 1))
            };
        }
        return {
            start: localDateTimeToIso(startRaw),
            end: endRaw ? localDateTimeToIso(endRaw) : null
        };
    }

    function timeFrom(value) {
        if (!value) return '';
        if (typeof value === 'string' && /^\d{2}:\d{2}/.test(value)) {
            return value.length === 5 ? value + ':00' : value.slice(0, 8);
        }
        var d = value instanceof Date ? value : new Date(value);
        if (isNaN(d.getTime())) return '';
        return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00';
    }

    function formatHm(value) {
        var t = timeFrom(value);
        return t ? t.slice(0, 5) : '';
    }

    function typeLabel(type) {
        var found = TYPES.find(function (t) { return t.value === type; });
        return found ? found.label : '📅 Événement';
    }

    function jourNames(days) {
        return (days || []).map(function (n) {
            var j = JOURS.find(function (x) { return x.value === Number(n); });
            return j ? j.label : '';
        }).filter(Boolean).join(', ');
    }

    function formatDateTime(item, occurrence) {
        var startSrc = occurrence || item.start;
        if (!startSrc) return '';
        if (item.daysOfWeek && item.daysOfWeek.length) {
            var jours = jourNames(item.daysOfWeek);
            var h1 = item.startTime ? formatHm(item.startTime) : formatHm(item.start);
            var h2 = item.endTime ? formatHm(item.endTime) : (item.end ? formatHm(item.end) : '');
            var until = item.endRecur ? toYmdLocal(item.endRecur) : '';
            var untilStr = until ? ' jusqu\'au ' + new Date(until + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '';
            var abStr = weekAbLabel(item.weekAb);
            var cadence = abStr ? ' (' + abStr + ')' : '';
            if (item.allDay) return 'Tous les ' + jours + cadence + untilStr;
            return 'Tous les ' + jours + cadence + (h1 ? ' à ' + h1 : '') + (h2 ? ' → ' + h2 : '') + untilStr;
        }
        if (item.allDay) {
            var startYmd = parseAllDayYmd(item.start);
            var startDate = new Date(startYmd + 'T12:00:00');
            var dateStr = startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            if (item.end) {
                var inc = allDayEndInclusive(item.start, item.end);
                if (inc > startYmd) {
                    var endDate = new Date(inc + 'T12:00:00');
                    return 'du ' + dateStr + ' au ' + endDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
                }
            }
            return dateStr;
        }
        var start = new Date(startSrc);
        var dateStr2 = start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        var heure = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        var fin = item.end ? ' → ' + new Date(item.end).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
        return dateStr2 + ' à ' + heure + fin;
    }

    function nextOccurrence(item, fromDate) {
        var from = fromDate ? new Date(fromDate) : new Date();
        if (!item.daysOfWeek || !item.daysOfWeek.length) {
            if (!item.start) return null;
            if (item.allDay) {
                var ymd0 = parseAllDayYmd(item.start);
                return new Date(ymd0 + 'T00:00:00');
            }
            var d = new Date(item.start);
            return isNaN(d.getTime()) ? null : d;
        }
        var startRecur = parseAllDayYmd(item.startRecur || item.start);
        var endRecur = item.endRecur ? parseAllDayYmd(item.endRecur) : '';
        var hhmm = (item.startTime || timeFrom(item.start) || '08:00:00').split(':');
        var cursor = new Date(from);
        cursor.setHours(0, 0, 0, 0);
        if (startRecur) {
            var sr = new Date(startRecur + 'T00:00:00');
            if (cursor < sr) cursor = sr;
        }
        var days = item.daysOfWeek.map(Number);
        var excluded = normalizeExcludeDates(item.excludeDates);
        for (var i = 0; i < 450; i++) {
            var ymd = toYmdLocal(cursor);
            if (endRecur && ymd >= endRecur) return null;
            if (days.indexOf(cursor.getDay()) !== -1 && excluded.indexOf(ymd) === -1 && !isClosedDay(ymd) && matchesWeekAb(ymd, item.weekAb)) {
                var occ = new Date(cursor);
                occ.setHours(parseInt(hhmm[0], 10) || 0, parseInt(hhmm[1], 10) || 0, 0, 0);
                if (occ.getTime() >= from.getTime() - 60000) return occ;
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return null;
    }

    function normalizeExcludeDates(value) {
        if (!value) return [];
        if (!Array.isArray(value)) return [];
        return value.map(function (v) { return String(v || '').slice(0, 10); }).filter(function (v) {
            return /^\d{4}-\d{2}-\d{2}$/.test(v);
        });
    }

    function parseInstanceId(id) {
        var s = String(id || '');
        var i = s.lastIndexOf('::');
        if (i < 0) return { seriesId: s, occurrenceDate: null };
        var datePart = s.slice(i + 2);
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return { seriesId: s.slice(0, i), occurrenceDate: datePart };
        return { seriesId: s, occurrenceDate: null };
    }

    function getItemById(id) {
        var parsed = parseInstanceId(id);
        return readLocalCache().find(function (ev) { return ev.id === parsed.seriesId; }) || null;
    }

    function isClosedDay(ymd, annee) {
        var key = annee || getAnneeScolaire();
        if (!closedDayCache[key]) {
            var set = {};
            getSchoolCalendarEvents(key).forEach(function (ev) {
                if (ev.display === 'background' && ev.start && ev.end) {
                    var cursor = ev.start;
                    var guard = 0;
                    while (cursor < ev.end && guard++ < 500) {
                        set[cursor] = true;
                        cursor = addDaysYmd(cursor, 1);
                    }
                } else if (ev.allDay && ev.start) {
                    set[String(ev.start).slice(0, 10)] = true;
                }
            });
            closedDayCache[key] = set;
        }
        return !!closedDayCache[key][ymd];
    }

    function itemStartYmd(item) {
        var raw = item && (item.startRecur || item.start);
        if (!raw) return '';
        if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
        return parseAllDayYmd(raw) || '';
    }

    function itemEndYmd(item) {
        var raw = item && (item.endRecur || item.end);
        if (!raw) return itemStartYmd(item);
        if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
        return parseAllDayYmd(raw) || itemStartYmd(item);
    }

    function eventOutsideRange(item, fromYmd, toYmd) {
        if (!fromYmd || !toYmd || !item) return false;
        var start = itemStartYmd(item);
        var end = itemEndYmd(item) || start;
        if (!start) return false;
        if (end < fromYmd) return true;
        if (start >= toYmd) return true;
        return false;
    }

    function listOccurrenceYmds(item, fromYmd, toYmd) {
        if (!item.daysOfWeek || !item.daysOfWeek.length) return [];
        var start = parseAllDayYmd(item.startRecur || item.start) || schoolYearStart();
        var end = parseAllDayYmd(item.endRecur) || schoolYearEnd();
        if (fromYmd && fromYmd > start) start = fromYmd;
        if (toYmd && toYmd < end) end = toYmd;
        if (!start || !end || start >= end) return [];
        var days = item.daysOfWeek.map(Number);
        var excluded = normalizeExcludeDates(item.excludeDates);
        var out = [];
        var cursor = new Date(start + 'T00:00:00');
        if (isNaN(cursor.getTime())) return [];
        var guard = 0;
        var maxDays = 450;
        if (fromYmd && toYmd) {
            var span = Math.round((new Date(toYmd + 'T00:00:00') - cursor) / 86400000) + 2;
            if (span > 0 && span < 450) maxDays = span;
        }
        while (toYmdLocal(cursor) < end && guard++ < maxDays) {
            var ymd = toYmdLocal(cursor);
            if (days.indexOf(cursor.getDay()) !== -1 && excluded.indexOf(ymd) === -1 && !isClosedDay(ymd) && matchesWeekAb(ymd, item.weekAb)) {
                out.push(ymd);
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return out;
    }

    function loadAgendaSettings() {
        try {
            return Object.assign({}, DEFAULT_AGENDA_SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
        } catch (e) {
            return Object.assign({}, DEFAULT_AGENDA_SETTINGS);
        }
    }

    function saveAgendaSettings(settings) {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
    }

    function readLocalCache() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
    }

    function writeLocalCache(events) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); } catch (e) {}
    }

    function upsertLocalItem(item) {
        var cache = readLocalCache();
        var index = cache.findIndex(function (ev) { return ev.id && ev.id === item.id; });
        if (index >= 0) cache[index] = item; else cache.push(item);
        writeLocalCache(cache);
    }

    function removeLocalItem(id) {
        writeLocalCache(readLocalCache().filter(function (ev) { return ev.id !== id; }));
    }

    function normalizeDays(value) {
        if (!value) return null;
        if (Array.isArray(value) && value.length) return value.map(Number);
        return null;
    }

    function rowToItem(row) {
        return {
            id: row.id,
            title: row.title,
            start: row.start_at,
            end: row.end_at || null,
            allDay: !!row.all_day,
            description: row.description || '',
            type: row.event_type || 'event',
            lieu: row.lieu || '',
            color: row.color || '#1e88e5',
            emoji: row.emoji || '📌',
            done: !!row.done,
            reminderMinutes: (row.reminder_minutes === null || row.reminder_minutes === undefined) ? null : Number(row.reminder_minutes),
            source: row.source || 'calendar',
            className: row.class_name || '',
            daysOfWeek: normalizeDays(row.days_of_week),
            startRecur: row.start_recur || null,
            endRecur: row.end_recur || null,
            startTime: row.start_time || null,
            endTime: row.end_time || null,
            excludeDates: normalizeExcludeDates(row.exclude_dates),
            weekAb: normalizeWeekAb(row.week_ab)
        };
    }

    function itemToRow(item, teacherId) {
        var days = normalizeDays(item.daysOfWeek);
        var startTime = item.startTime || (days && !item.allDay ? timeFrom(item.start) : null);
        var endTime = item.endTime || (days && !item.allDay && item.end ? timeFrom(item.end) : null);
        return {
            teacher_id: teacherId,
            title: item.title,
            event_type: item.type || 'event',
            lieu: item.lieu || null,
            description: item.description || null,
            start_at: item.start,
            end_at: item.end || null,
            all_day: !!item.allDay,
            color: item.color || null,
            emoji: item.emoji || null,
            done: !!item.done,
            reminder_minutes: (item.reminderMinutes === null || item.reminderMinutes === undefined || item.reminderMinutes === '') ? null : Number(item.reminderMinutes),
            source: item.source || 'calendar',
            class_name: item.className || null,
            days_of_week: days,
            start_recur: item.startRecur || (days ? schoolYearStart() : null),
            end_recur: item.endRecur || (days ? schoolYearEnd() : null),
            start_time: startTime,
            end_time: endTime,
            exclude_dates: normalizeExcludeDates(item.excludeDates),
            week_ab: days ? (normalizeWeekAb(item.weekAb) || null) : null
        };
    }

    async function isOnline() {
        return !!(window.EprofStore && await window.EprofStore.isOnlineReady());
    }

    function notifyChanged(detail) {
        document.dispatchEvent(new CustomEvent('eprof-events-changed', { detail: detail || {} }));
    }

    async function loadAllEvents() {
        if (await isOnline()) {
            var teacherId = await window.EprofStore.getTeacherId();
            var result = await window.EprofStore.list('calendar_events', { filters: { teacher_id: teacherId }, orderBy: 'start_at' });
            if (!result.error && result.data) {
                var items = result.data.map(rowToItem);
                writeLocalCache(items);
                return items;
            }
            console.warn('⚠️ Calendrier : bascule sur le cache local (Supabase indisponible).', result.error);
        }
        return readLocalCache();
    }

    async function persistEvent(item) {
        if (!item.source) item.source = 'calendar';
        if (item.daysOfWeek && item.daysOfWeek.length) {
            item.startRecur = item.startRecur || schoolYearStart();
            item.endRecur = item.endRecur || schoolYearEnd();
            if (!item.allDay) {
                item.startTime = item.startTime || timeFrom(item.start);
                item.endTime = item.endTime || (item.end ? timeFrom(item.end) : null);
            }
            item.excludeDates = normalizeExcludeDates(
                (item.excludeDates && item.excludeDates.length)
                    ? item.excludeDates
                    : ((item.id && getItemById(item.id) || {}).excludeDates)
            );
            item.weekAb = normalizeWeekAb(item.weekAb);
        } else {
            item.daysOfWeek = null;
            item.startRecur = null;
            item.endRecur = null;
            item.startTime = null;
            item.endTime = null;
            item.excludeDates = [];
            item.weekAb = null;
        }
        if (await isOnline()) {
            var teacherId = await window.EprofStore.getTeacherId();
            if (teacherId) {
                var row = itemToRow(item, teacherId);
                var result = isUuid(item.id)
                    ? await window.EprofStore.update('calendar_events', item.id, row)
                    : await window.EprofStore.insert('calendar_events', row);
                if (result.error && /class_name|days_of_week|start_recur|start_time|exclude_dates|week_ab/.test(String(result.error.message || ''))) {
                    delete row.class_name;
                    delete row.days_of_week;
                    delete row.start_recur;
                    delete row.end_recur;
                    delete row.start_time;
                    delete row.end_time;
                    delete row.exclude_dates;
                    delete row.week_ab;
                    result = isUuid(item.id)
                        ? await window.EprofStore.update('calendar_events', item.id, row)
                        : await window.EprofStore.insert('calendar_events', row);
                }
                if (!result.error && result.data) item.id = result.data.id;
            }
        }
        if (!item.id) item.id = 'local-' + Date.now() + '-' + Math.random().toString(16).slice(2);
        upsertLocalItem(item);
        notifyChanged({ item: item, action: 'save' });
        return item;
    }

    async function deleteEvent(id) {
        if (isUuid(id) && await isOnline()) {
            await window.EprofStore.remove('calendar_events', id);
        }
        removeLocalItem(id);
        notifyChanged({ id: id, action: 'delete' });
    }

    async function skipOccurrence(seriesId, ymd) {
        var series = getItemById(seriesId);
        if (!series) return null;
        var dates = normalizeExcludeDates(series.excludeDates);
        if (dates.indexOf(ymd) === -1) dates.push(ymd);
        series.excludeDates = dates;
        return persistEvent(series);
    }

    async function detachOccurrence(seriesId, ymd, patch) {
        await skipOccurrence(seriesId, ymd);
        var series = getItemById(seriesId) || {};
        var oneOff = Object.assign({}, series, patch || {}, {
            id: null,
            daysOfWeek: null,
            startRecur: null,
            endRecur: null,
            startTime: null,
            endTime: null,
            excludeDates: [],
            weekAb: null,
            source: series.source || 'calendar'
        });
        return persistEvent(oneOff);
    }

    function stripTitlePrefix(title, emoji) {
        var t = String(title || '');
        if (emoji && t.indexOf(emoji + ' ') === 0) return t.slice(emoji.length + 1);
        return t.replace(/^📝 |^📅 |^📍 |^📚 |^🤝 /, '');
    }

    function toFcEvent(item) {
        var emoji = item.emoji || '';
        var color = item.color || (item.className && window.getClassColor ? window.getClassColor(item.className) : '') || undefined;
        var base = {
            id: item.id,
            title: (emoji ? emoji + ' ' : '') + item.title,
            backgroundColor: color,
            borderColor: color,
            editable: true,
            extendedProps: {
                type: item.type || 'event',
                lieu: item.lieu || '',
                description: item.description || '',
                color: item.color || '',
                emoji: emoji,
                done: !!item.done,
                reminderMinutes: item.reminderMinutes,
                source: item.source || 'calendar',
                className: item.className || '',
                daysOfWeek: item.daysOfWeek || null,
                startRecur: item.startRecur || null,
                endRecur: item.endRecur || null,
                startTime: item.startTime || null,
                endTime: item.endTime || null,
                excludeDates: normalizeExcludeDates(item.excludeDates),
                weekAb: normalizeWeekAb(item.weekAb),
                seriesId: item.id,
                occurrenceDate: null
            }
        };
        if (item.allDay) {
            return Object.assign(base, {
                start: parseAllDayYmd(item.start),
                end: parseAllDayExclusiveEnd(item.start, item.end),
                allDay: true
            });
        }
        return Object.assign(base, {
            start: item.start,
            end: item.end || undefined,
            allDay: false
        });
    }

    function toFcEvents(item, fromYmd, toYmd) {
        if (!item.daysOfWeek || !item.daysOfWeek.length) {
            if (eventOutsideRange(item, fromYmd, toYmd)) return [];
            return [toFcEvent(item)];
        }
        var st = item.startTime || timeFrom(item.start) || '08:00:00';
        var et = item.endTime || (item.end ? timeFrom(item.end) : null);
        return listOccurrenceYmds(item, fromYmd, toYmd).map(function (ymd) {
            var clone = Object.assign({}, item, {
                daysOfWeek: null,
                startRecur: null,
                endRecur: null,
                start: item.allDay ? allDayToStored(ymd) : (ymd + 'T' + st),
                end: item.allDay ? allDayToStored(addDaysYmd(ymd, 1)) : (et ? ymd + 'T' + et : null)
            });
            var ev = toFcEvent(clone);
            ev.id = item.id + '::' + ymd;
            ev.extendedProps.daysOfWeek = item.daysOfWeek;
            ev.extendedProps.startRecur = item.startRecur;
            ev.extendedProps.endRecur = item.endRecur;
            ev.extendedProps.startTime = st;
            ev.extendedProps.endTime = et;
            ev.extendedProps.excludeDates = normalizeExcludeDates(item.excludeDates);
            ev.extendedProps.weekAb = normalizeWeekAb(item.weekAb);
            ev.extendedProps.seriesId = item.id;
            ev.extendedProps.occurrenceDate = ymd;
            return ev;
        });
    }

    function fcEventToItem(ev) {
        var parsed = parseInstanceId(ev.id);
        var series = getItemById(parsed.seriesId);
        if (series) {
            return Object.assign({}, series, { _occurrenceDate: parsed.occurrenceDate || ev.extendedProps && ev.extendedProps.occurrenceDate || null });
        }
        var xp = ev.extendedProps || {};
        var days = normalizeDays(xp.daysOfWeek);
        var item = {
            id: parsed.seriesId || ev.id,
            title: stripTitlePrefix(ev.title, xp.emoji),
            allDay: !!ev.allDay,
            description: xp.description || '',
            type: xp.type || 'event',
            lieu: xp.lieu || '',
            color: xp.color || ev.backgroundColor || '',
            emoji: xp.emoji || '',
            done: !!xp.done,
            reminderMinutes: (xp.reminderMinutes === null || xp.reminderMinutes === undefined) ? null : Number(xp.reminderMinutes),
            source: xp.source || 'calendar',
            className: xp.className || '',
            daysOfWeek: days,
            startRecur: xp.startRecur || null,
            endRecur: xp.endRecur || null,
            startTime: xp.startTime || null,
            endTime: xp.endTime || null,
            excludeDates: normalizeExcludeDates(xp.excludeDates),
            weekAb: normalizeWeekAb(xp.weekAb),
            _occurrenceDate: parsed.occurrenceDate || xp.occurrenceDate || null
        };
        if (ev.allDay) {
            item.start = allDayToStored(toYmdLocal(ev.start));
            item.end = ev.end ? allDayToStored(toYmdLocal(ev.end)) : allDayToStored(addDaysYmd(toYmdLocal(ev.start), 1));
        } else {
            item.start = ev.start ? ev.start.toISOString() : null;
            item.end = ev.end ? ev.end.toISOString() : null;
        }
        return item;
    }

    function oneOffFromFcEvent(ev) {
        var xp = ev.extendedProps || {};
        return {
            title: stripTitlePrefix(ev.title, xp.emoji),
            allDay: !!ev.allDay,
            description: xp.description || '',
            type: xp.type || 'event',
            lieu: xp.lieu || '',
            color: xp.color || ev.backgroundColor || '',
            emoji: xp.emoji || '',
            done: false,
            reminderMinutes: xp.reminderMinutes,
            source: xp.source || 'calendar',
            className: xp.className || '',
            start: ev.allDay ? allDayToStored(toYmdLocal(ev.start)) : (ev.start ? ev.start.toISOString() : null),
            end: ev.allDay
                ? (ev.end ? allDayToStored(toYmdLocal(ev.end)) : allDayToStored(addDaysYmd(toYmdLocal(ev.start), 1)))
                : (ev.end ? ev.end.toISOString() : null)
        };
    }

    function isUserEvent(ev) {
        return !!(ev && ev.extendedProps && typeof ev.extendedProps.type !== 'undefined');
    }

    function getTeacherClasses() {
        if (window.getTeacherClassNames) return window.getTeacherClassNames().slice().sort();
        return [];
    }

    function defaultUpcomingHour() {
        var now = new Date();
        now.setMinutes(0, 0, 0);
        now.setHours(now.getHours() + 1);
        return now;
    }

    function fillClassSelect(select, selected) {
        var classes = getTeacherClasses();
        select.innerHTML = '<option value="">Aucune</option>' + classes.map(function (nom) {
            return '<option value="' + escapeHtml(nom) + '"' + (nom === selected ? ' selected' : '') + '>' + escapeHtml(nom) + '</option>';
        }).join('');
    }

    function selectedInGroup(form, selector) {
        var el = form.querySelector(selector + '.selected');
        return el;
    }

    function selectInGroup(form, groupSelector, predicate) {
        form.querySelectorAll(groupSelector).forEach(function (el) {
            el.classList.toggle('selected', predicate(el));
        });
    }

    function applyAllDayMode(form) {
        var allDay = form.querySelector('#event-all-day').checked;
        ['#event-start', '#event-end'].forEach(function (sel) {
            var input = form.querySelector(sel);
            var value = input.value;
            input.type = allDay ? 'date' : 'datetime-local';
            if (allDay) input.value = value ? value.substring(0, 10) : '';
            else input.value = value.length === 10 ? value + 'T08:00' : value;
        });
    }

    function applyRecurringMode(form) {
        var on = form.querySelector('#event-recurring').checked;
        var box = form.querySelector('#event-recur-options');
        if (box) box.style.display = on ? 'block' : 'none';
    }

    function collectDaysOfWeek(form) {
        return Array.prototype.map.call(form.querySelectorAll('.event-dow-chip.selected'), function (btn) {
            return Number(btn.getAttribute('data-day'));
        });
    }

    function collectWeekAb(form) {
        var selected = form.querySelector('.event-week-chip.selected');
        return selected ? normalizeWeekAb(selected.getAttribute('data-ab')) : null;
    }

    function setWeekAbChips(form, weekAb) {
        var ab = normalizeWeekAb(weekAb) || '';
        form.querySelectorAll('.event-week-chip').forEach(function (btn) {
            var on = (btn.getAttribute('data-ab') || '') === ab;
            btn.classList.toggle('selected', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    function bindEventForm() {
        if (formBound) return;
        var modal = document.getElementById('event-modal');
        var form = document.getElementById('event-form');
        if (!modal || !form) return;
        formBound = true;

        var reminder = form.querySelector('#event-reminder');
        if (reminder && !reminder.options.length) {
            reminder.innerHTML = REMINDER_OPTIONS.map(function (o) {
                return '<option value="' + o.value + '">' + o.label + '</option>';
            }).join('');
        }
        var colors = form.querySelector('#event-colors');
        if (colors && !colors.children.length) {
            colors.innerHTML = COLORS.map(function (c, i) {
                return '<button type="button" class="agenda-color' + (i === 5 ? ' selected' : '') + '" data-color="' + c.value + '" style="background:' + c.value + '" title="' + c.label + '"></button>';
            }).join('');
        }
        var emojis = form.querySelector('#event-emojis');
        if (emojis && !emojis.children.length) {
            emojis.innerHTML = EMOJIS.map(function (e, i) {
                return '<button type="button" class="agenda-emoji' + (i === 0 ? ' selected' : '') + '" data-emoji="' + e + '">' + e + '</button>';
            }).join('');
        }
        var dow = form.querySelector('#event-dow-chips');
        if (dow && !dow.children.length) {
            dow.innerHTML = JOURS.map(function (j) {
                return '<button type="button" class="event-dow-chip" data-day="' + j.value + '" aria-pressed="false">' + j.short + '</button>';
            }).join('');
        }

        form.querySelector('#event-all-day').addEventListener('change', function () { applyAllDayMode(form); });
        form.querySelector('#event-recurring').addEventListener('change', function () { applyRecurringMode(form); });
        form.querySelector('#event-class').addEventListener('change', function () {
            var nom = form.querySelector('#event-class').value;
            if (!nom || !window.getClassColor) return;
            var color = window.getClassColor(nom);
            selectInGroup(form, '.agenda-color', function (el) { return el.dataset.color === color; });
        });
        form.querySelectorAll('.agenda-color').forEach(function (btn) {
            btn.addEventListener('click', function () {
                selectInGroup(form, '.agenda-color', function (el) { return el === btn; });
            });
        });
        form.querySelectorAll('.agenda-emoji').forEach(function (btn) {
            btn.addEventListener('click', function () {
                selectInGroup(form, '.agenda-emoji', function (el) { return el === btn; });
            });
        });
        form.querySelectorAll('.event-dow-chip').forEach(function (btn) {
            btn.addEventListener('click', function () {
                btn.classList.toggle('selected');
                btn.setAttribute('aria-pressed', btn.classList.contains('selected') ? 'true' : 'false');
            });
        });
        form.querySelectorAll('.event-week-chip').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setWeekAbChips(form, btn.getAttribute('data-ab'));
            });
        });

        function closeModal() {
            modal.style.display = 'none';
            form.reset();
            formCallbacks.onSaved = null;
            formCallbacks.onDeleted = null;
            formCallbacks.occurrenceEdit = null;
            var banner = document.getElementById('event-occurrence-banner');
            if (banner) banner.hidden = true;
        }

        document.getElementById('close-event-modal').addEventListener('click', closeModal);
        document.getElementById('event-cancel-btn').addEventListener('click', closeModal);
        modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
        });

        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            var allDay = form.querySelector('#event-all-day').checked;
            var startRaw = form.querySelector('#event-start').value;
            var endRaw = form.querySelector('#event-end').value;
            if (!startRaw) return;
            var range = formToStartEnd(startRaw, endRaw, allDay);
            var recurring = form.querySelector('#event-recurring').checked;
            var days = recurring ? collectDaysOfWeek(form) : [];
            if (recurring && !days.length) {
                var probe = allDay ? new Date(startRaw + 'T12:00:00') : new Date(startRaw);
                days = [probe.getDay()];
            }
            var reminderRaw = form.querySelector('#event-reminder').value;
            var colorEl = selectedInGroup(form, '.agenda-color');
            var emojiEl = selectedInGroup(form, '.agenda-emoji');
            var existingId = form.querySelector('#event-item-id').value || null;
            var item = {
                id: existingId || null,
                title: form.querySelector('#event-title').value.trim(),
                type: form.querySelector('#event-type').value,
                allDay: allDay,
                start: range.start,
                end: range.end,
                lieu: form.querySelector('#event-lieu').value.trim(),
                description: form.querySelector('#event-desc').value.trim(),
                color: colorEl ? colorEl.dataset.color : '#1e88e5',
                emoji: emojiEl ? emojiEl.dataset.emoji : '📌',
                reminderMinutes: reminderRaw === '' ? null : Number(reminderRaw),
                className: form.querySelector('#event-class').value,
                daysOfWeek: days.length ? days : null,
                weekAb: days.length ? collectWeekAb(form) : null,
                startRecur: recurring ? (allDay ? String(startRaw).slice(0, 10) : String(startRaw).slice(0, 10)) : null,
                endRecur: recurring ? (form.querySelector('#event-until').value || schoolYearEnd()) : null,
                done: form.querySelector('#event-item-done').value === '1',
                source: form.querySelector('#event-item-source').value || 'calendar'
            };
            if (days.length && !allDay) {
                item.startTime = timeFrom(startRaw);
                item.endTime = endRaw ? timeFrom(endRaw) : null;
            }
            if (!item.title || !item.start) return;
            var occEdit = formCallbacks.occurrenceEdit;
            var cb = formCallbacks.onSaved;
            if (occEdit) {
                item.id = null;
                item.daysOfWeek = null;
                item.startRecur = null;
                item.endRecur = null;
                item.weekAb = null;
                await skipOccurrence(occEdit.seriesId, occEdit.date);
            }
            var saved = await persistEvent(item);
            closeModal();
            if (occEdit && cb) {
                var series = getItemById(occEdit.seriesId);
                if (series) cb(series);
            }
            if (cb) cb(saved);
        });
    }

    function openEventForm(options) {
        bindEventForm();
        var modal = document.getElementById('event-modal');
        var form = document.getElementById('event-form');
        if (!modal || !form) return;
        form.reset();
        var item = options && options.item;
        var allDay = item ? !!item.allDay : !!(options && options.allDay);
        var settings = loadAgendaSettings();
        formCallbacks.onSaved = options && options.onSaved ? options.onSaved : null;
        formCallbacks.onDeleted = options && options.onDeleted ? options.onDeleted : null;
        formCallbacks.occurrenceEdit = options && options.occurrenceEdit ? options.occurrenceEdit : null;

        var occEdit = formCallbacks.occurrenceEdit;
        var banner = document.getElementById('event-occurrence-banner');
        if (banner) banner.hidden = !occEdit;
        if (occEdit) {
            document.getElementById('event-modal-title').textContent = 'Modifier cette séance';
            var src = options.item || item;
            if (src) {
                var ymd = occEdit.date;
                var stOcc = src.startTime || timeFrom(src.start) || '08:00:00';
                var etOcc = src.endTime || (src.end ? timeFrom(src.end) : null);
                item = Object.assign({}, src, {
                    id: null,
                    daysOfWeek: null,
                    startRecur: null,
                    endRecur: null,
                    weekAb: null,
                    start: src.allDay ? allDayToStored(ymd) : (ymd + 'T' + stOcc),
                    end: src.allDay ? allDayToStored(addDaysYmd(ymd, 1)) : (etOcc ? ymd + 'T' + etOcc : null)
                });
                allDay = !!src.allDay;
            }
        } else {
            document.getElementById('event-modal-title').textContent = item ? 'Modifier l\'événement' : 'Nouvel événement';
        }
        form.querySelector('#event-item-id').value = item && item.id ? item.id : '';
        form.querySelector('#event-item-done').value = item && item.done ? '1' : '0';
        form.querySelector('#event-item-source').value = item && item.source ? item.source : (options && options.source) || 'calendar';
        form.querySelector('#event-title').value = item ? item.title : '';
        form.querySelector('#event-type').value = item ? (item.type || 'event') : ((options && options.defaultType) || 'event');
        form.querySelector('#event-lieu').value = item ? (item.lieu || '') : '';
        form.querySelector('#event-desc').value = item ? (item.description || '') : '';
        form.querySelector('#event-all-day').checked = allDay;
        form.querySelector('#event-reminder').value = item
            ? (item.reminderMinutes === null || item.reminderMinutes === undefined ? '' : String(item.reminderMinutes))
            : String(settings.rappelParDefaut || '');
        fillClassSelect(form.querySelector('#event-class'), item ? (item.className || '') : '');

        var startInput = form.querySelector('#event-start');
        var endInput = form.querySelector('#event-end');
        applyAllDayMode(form);

        if (item && item.start) {
            if (item.allDay) {
                startInput.value = parseAllDayYmd(item.start);
                endInput.value = item.end ? allDayEndInclusive(item.start, item.end) : parseAllDayYmd(item.start);
            } else if (item.daysOfWeek && item.daysOfWeek.length) {
                var day = item.startRecur || parseAllDayYmd(item.start) || toYmdLocal(new Date());
                var st = formatHm(item.startTime || item.start) || '08:00';
                var et = formatHm(item.endTime || item.end);
                startInput.value = day + 'T' + st;
                endInput.value = et ? day + 'T' + et : '';
            } else {
                startInput.value = toLocalDateTimeInput(item.start);
                endInput.value = item.end ? toLocalDateTimeInput(item.end) : '';
            }
        } else if (options && options.start) {
            if (allDay) {
                startInput.value = String(options.start).slice(0, 10);
                endInput.value = options.end ? String(options.end).slice(0, 10) : startInput.value;
            } else {
                startInput.value = String(options.start).slice(0, 16);
                endInput.value = options.end ? String(options.end).slice(0, 16) : '';
            }
        } else {
            var now = defaultUpcomingHour();
            startInput.value = toLocalDateTimeInput(now);
            endInput.value = '';
        }

        var recurring = !!(item && item.daysOfWeek && item.daysOfWeek.length);
        form.querySelector('#event-recurring').checked = recurring && !occEdit;
        form.querySelector('#event-recurring').disabled = !!occEdit;
        applyRecurringMode(form);
        form.querySelectorAll('.event-dow-chip').forEach(function (btn) {
            var day = Number(btn.getAttribute('data-day'));
            var on = recurring && item.daysOfWeek && item.daysOfWeek.map(Number).indexOf(day) !== -1;
            btn.classList.toggle('selected', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        setWeekAbChips(form, recurring ? (item && item.weekAb) : null);
        form.querySelector('#event-until').value = recurring
            ? toYmdLocal(item.endRecur || schoolYearEnd())
            : schoolYearEnd();

        var color = item ? (item.color || '#1e88e5') : '#1e88e5';
        var emoji = item ? (item.emoji || '📌') : '📌';
        selectInGroup(form, '.agenda-color', function (el) { return el.dataset.color === color; });
        selectInGroup(form, '.agenda-emoji', function (el) { return el.dataset.emoji === emoji; });

        modal.style.display = 'flex';
        setTimeout(function () { form.querySelector('#event-title').focus(); }, 30);
    }

    function closeEventForm() {
        var modal = document.getElementById('event-modal');
        if (modal) modal.style.display = 'none';
    }

    function detailHtml(item, occurrence) {
        var rows = [];
        function row(label, value) {
            if (!value) return;
            rows.push('<div class="event-detail-row"><span class="event-detail-label">' + escapeHtml(label) + '</span><span class="event-detail-value">' + value + '</span></div>');
        }
        var title = escapeHtml((item.emoji ? item.emoji + ' ' : '') + (item.title || ''));
        row('Nature', escapeHtml(typeLabel(item.type)));
        row('Quand', escapeHtml(formatDateTime(item, occurrence)));
        if (occurrence && item.daysOfWeek) {
            row('Prochaine fois', escapeHtml(occurrence.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })));
        }
        row('Classe', escapeHtml(item.className || ''));
        row('Lieu', escapeHtml(item.lieu || ''));
        row('Rappel', item.reminderMinutes != null ? '🔔 ' + escapeHtml(String(item.reminderMinutes)) + ' min avant' : '');
        if (item.description) {
            rows.push('<div class="event-detail-desc">' + escapeHtml(item.description) + '</div>');
        }
        return '<h4 class="event-detail-title">' + title + '</h4>' + rows.join('');
    }

    function openDetailModal(item, handlers) {
        var modal = document.getElementById('event-detail-modal');
        var content = document.getElementById('event-detail-content');
        var actions = document.getElementById('event-detail-actions');
        handlers = handlers || {};
        if (!modal || !content) {
            openEventForm({ item: item, onSaved: handlers.onSaved, onDeleted: handlers.onDeleted });
            return;
        }
        var occDate = item._occurrenceDate || null;
        var isSeries = !!(item.daysOfWeek && item.daysOfWeek.length);
        var occ = occDate ? new Date(occDate + 'T12:00:00') : (item._occurrence || null);
        content.innerHTML = detailHtml(item, occ) + (isSeries && occDate
            ? '<p class="event-detail-scope">Séance du ' + escapeHtml(new Date(occDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })) + '</p>'
            : '');
        if (actions) {
            actions.innerHTML = isSeries
                ? '<button type="button" id="edit-occurrence-btn" class="btn-primary">Modifier cette séance</button>' +
                  '<button type="button" id="edit-event-btn">Modifier la série</button>' +
                  '<button type="button" id="delete-occurrence-btn" class="btn-danger-light">Supprimer cette séance</button>' +
                  '<button type="button" id="delete-event-btn">Supprimer la série</button>' +
                  '<button type="button" id="close-detail-btn">Fermer</button>'
                : '<button type="button" id="edit-event-btn">Modifier</button>' +
                  '<button type="button" id="delete-event-btn">Supprimer</button>' +
                  '<button type="button" id="close-detail-btn">Fermer</button>';
        }
        modal.style.display = 'flex';
        function closeModal() { modal.style.display = 'none'; }
        document.getElementById('close-detail-modal').onclick = closeModal;
        var closeBtn = document.getElementById('close-detail-btn');
        if (closeBtn) closeBtn.onclick = closeModal;
        modal.onclick = function (e) { if (e.target === modal) closeModal(); };

        var editBtn = document.getElementById('edit-event-btn');
        if (editBtn) {
            editBtn.onclick = function () {
                closeModal();
                openEventForm({ item: item, onSaved: handlers.onSaved, onDeleted: handlers.onDeleted });
            };
        }
        var delBtn = document.getElementById('delete-event-btn');
        if (delBtn) {
            delBtn.onclick = async function () {
                if (!confirm(isSeries ? 'Supprimer toute la série « ' + item.title + ' » ?' : 'Supprimer « ' + item.title + ' » ?')) return;
                await deleteEvent(item.id);
                closeModal();
                if (handlers.onDeleted) handlers.onDeleted(item.id);
            };
        }
        var editOcc = document.getElementById('edit-occurrence-btn');
        if (editOcc && occDate) {
            editOcc.onclick = function () {
                closeModal();
                openEventForm({
                    item: item,
                    occurrenceEdit: { seriesId: item.id, date: occDate },
                    onSaved: handlers.onSaved
                });
            };
        }
        var delOcc = document.getElementById('delete-occurrence-btn');
        if (delOcc && occDate) {
            delOcc.onclick = async function () {
                if (!confirm('Supprimer uniquement la séance du ' + new Date(occDate + 'T12:00:00').toLocaleDateString('fr-FR') + ' ?')) return;
                var series = await skipOccurrence(item.id, occDate);
                closeModal();
                if (handlers.onSaved && series) handlers.onSaved(series);
            };
        }
    }

    function formatYmd(date) {
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    function easterSunday(year) {
        var a = year % 19;
        var b = Math.floor(year / 100);
        var c = year % 100;
        var d = Math.floor(b / 4);
        var e = b % 4;
        var f = Math.floor((b + 8) / 25);
        var g = Math.floor((b - f + 1) / 3);
        var h = (19 * a + b - d - g + 15) % 30;
        var i = Math.floor(c / 4);
        var k = c % 4;
        var l = (32 + 2 * e + 2 * i - h - k) % 7;
        var m = Math.floor((a + 11 * h + 22 * l) / 451);
        var month = Math.floor((h + l - 7 * m + 114) / 31);
        var day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }

    function addDays(date, n) {
        var d = new Date(date.getTime());
        d.setDate(d.getDate() + n);
        return d;
    }

    function feriesPourAnneeCivile(year) {
        var paques = easterSunday(year);
        return [
            { title: '🎉 Jour de l\'An', start: year + '-01-01' },
            { title: '🌱 Lundi de Pâques', start: formatYmd(addDays(paques, 1)) },
            { title: '🏭 Fête du Travail', start: year + '-05-01' },
            { title: '🎖️ Victoire 1945', start: year + '-05-08' },
            { title: '☁️ Ascension', start: formatYmd(addDays(paques, 39)) },
            { title: '🌼 Lundi de Pentecôte', start: formatYmd(addDays(paques, 50)) },
            { title: '🇫🇷 Fête Nationale', start: year + '-07-14' },
            { title: '☀️ Assomption', start: year + '-08-15' },
            { title: '🍂 Toussaint', start: year + '-11-01' },
            { title: '🪖 Armistice', start: year + '-11-11' },
            { title: '🎄 Noël', start: year + '-12-25' }
        ].map(function (ev) { return Object.assign({ allDay: true, editable: false }, ev); });
    }

    function getSchoolCalendarEvents(annee) {
        var key = annee || getAnneeScolaire();
        var parts = String(key).split('-');
        var y1 = parseInt(parts[0], 10) || 2026;
        var y2 = parseInt(parts[1], 10) || (y1 + 1);
        var debut = new Date(y1, 8, 1);
        var fin = new Date(y2, 7, 31);
        var feries = feriesPourAnneeCivile(y1).concat(feriesPourAnneeCivile(y2)).filter(function (ev) {
            var d = new Date(ev.start);
            return d >= debut && d <= fin;
        });
        var fond = function (title, start, end, color) {
            return { title: title, start: start, end: end, display: 'background', backgroundColor: color, allDay: true, editable: false };
        };
        var vacancesParAnnee = {
            '2025-2026': [
                fond('🏖️ Vacances de la Toussaint', '2025-10-18', '2025-11-03', '#fef3c7'),
                fond('🎄 Vacances de Noël', '2025-12-20', '2026-01-05', '#dbeafe'),
                fond('⛷️ Vacances d\'hiver', '2026-02-07', '2026-02-23', '#e0e7ff'),
                fond('🌸 Vacances de printemps', '2026-04-04', '2026-04-20', '#fce7f3'),
                fond('☀️ Vacances d\'été', '2026-07-04', '2026-09-01', '#fef08a')
            ],
            '2026-2027': [
                fond('🏖️ Vacances de la Toussaint', '2026-10-17', '2026-11-02', '#fef3c7'),
                fond('🎄 Vacances de Noël', '2026-12-19', '2027-01-04', '#dbeafe'),
                fond('⛷️ Vacances d\'hiver', '2027-02-13', '2027-03-01', '#e0e7ff'),
                fond('🌸 Vacances de printemps', '2027-04-10', '2027-04-26', '#fce7f3'),
                fond('☀️ Vacances d\'été', '2027-07-03', '2027-09-01', '#fef08a')
            ],
            '2027-2028': [
                fond('🏖️ Vacances de la Toussaint', '2027-10-23', '2027-11-03', '#fef3c7'),
                fond('🎄 Vacances de Noël', '2027-12-18', '2028-01-03', '#dbeafe'),
                fond('⛷️ Vacances d\'hiver', '2028-02-19', '2028-03-06', '#e0e7ff'),
                fond('🌸 Vacances de printemps', '2028-04-15', '2028-05-02', '#fce7f3'),
                fond('☀️ Vacances d\'été', '2028-07-08', '2028-09-04', '#fef08a')
            ]
        };
        return feries.concat(vacancesParAnnee[key] || vacancesParAnnee['2026-2027']);
    }

    function parseEmploiCsv(csv) {
        var lines = String(csv).replace(/^\uFEFF/, '').split(/\r?\n/).filter(function (l) { return l.trim(); });
        if (!lines.length) return [];
        var startIndex = /titre/i.test(lines[0]) ? 1 : 0;
        var items = [];
        var yearStart = schoolYearStart();
        var yearEnd = schoolYearEnd();
        for (var i = startIndex; i < lines.length; i++) {
            var parts = lines[i].split(';');
            if (parts.length < 4) continue;
            var titre = parts[0].trim();
            var jour = parts[1].trim();
            var heureDebut = parts[2].trim();
            var heureFin = parts[3].trim();
            var recurrent = parts[4] ? parts[4].trim().toLowerCase() === 'oui' : false;
            var classe = parts[5] ? parts[5].trim() : '';
            var semaine = parts[6] ? parts[6].trim() : '';
            if (!titre || !jour || !heureDebut || !heureFin) continue;
            var item = {
                title: titre,
                type: 'cours',
                allDay: false,
                lieu: '',
                description: '',
                color: classe && window.getClassColor ? window.getClassColor(classe) : '#1e88e5',
                emoji: '📚',
                done: false,
                reminderMinutes: null,
                source: 'calendar',
                className: classe
            };
            if (/^\d{4}-\d{2}-\d{2}$/.test(jour)) {
                item.start = localDateTimeToIso(jour + 'T' + heureDebut);
                item.end = localDateTimeToIso(jour + 'T' + heureFin);
            } else {
                var jourNum = JOURS_MAP[jour.toLowerCase()];
                if (jourNum === undefined) continue;
                if (recurrent) {
                    item.daysOfWeek = [jourNum];
                    item.startRecur = yearStart;
                    item.endRecur = yearEnd;
                    item.startTime = heureDebut.length === 5 ? heureDebut + ':00' : heureDebut;
                    item.endTime = heureFin.length === 5 ? heureFin + ':00' : heureFin;
                    item.start = yearStart + 'T' + item.startTime;
                    item.end = yearStart + 'T' + item.endTime;
                    item.weekAb = normalizeWeekAb(semaine);
                } else {
                    var today = new Date();
                    var daysUntilTarget = (jourNum - today.getDay() + 7) % 7;
                    if (daysUntilTarget === 0 && today.getHours() > parseInt(heureFin.split(':')[0], 10)) daysUntilTarget = 7;
                    var target = new Date(today);
                    target.setDate(today.getDate() + daysUntilTarget);
                    var dateStr = toYmdLocal(target);
                    item.start = localDateTimeToIso(dateStr + 'T' + heureDebut);
                    item.end = localDateTimeToIso(dateStr + 'T' + heureFin);
                }
            }
            items.push(item);
        }
        return items;
    }

    function eventsToCsv(items) {
        var joursNoms = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        var csv = 'Titre;Jour;Heure début;Heure fin;Récurrent;Classe;Semaine\n';
        items.forEach(function (item) {
            if (!item || item.display === 'background') return;
            var titre = String(item.title || '').replace(/;/g, ',');
            var jour = '';
            var h1 = '';
            var h2 = '';
            var rec = 'Non';
            var semaine = '';
            if (item.daysOfWeek && item.daysOfWeek.length) {
                jour = joursNoms[item.daysOfWeek[0]] || '';
                h1 = formatHm(item.startTime || item.start);
                h2 = formatHm(item.endTime || item.end);
                rec = 'Oui';
                semaine = normalizeWeekAb(item.weekAb) || 'Toutes';
            } else if (item.start) {
                if (item.allDay) {
                    jour = parseAllDayYmd(item.start);
                    h1 = '00:00';
                    h2 = '23:59';
                } else {
                    var start = new Date(item.start);
                    var end = item.end ? new Date(item.end) : start;
                    jour = toYmdLocal(start);
                    h1 = pad(start.getHours()) + ':' + pad(start.getMinutes());
                    h2 = pad(end.getHours()) + ':' + pad(end.getMinutes());
                }
            }
            csv += titre + ';' + jour + ';' + h1 + ';' + h2 + ';' + rec + ';' + (item.className || '') + ';' + semaine + '\n';
        });
        return csv;
    }

    function icsEscape(text) {
        return String(text || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    }

    function toIcsDate(value, allDay) {
        if (allDay) {
            return toYmdLocal(value).replace(/-/g, '');
        }
        var d = value instanceof Date ? value : new Date(value);
        return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
    }

    function eventsToIcs(items) {
        var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//eProf//Calendrier//FR', 'CALSCALE:GREGORIAN'];
        items.forEach(function (item) {
            if (!item || (!item.start && !item.daysOfWeek)) return;
            function pushEvent(uid, startVal, endVal, allDay) {
                lines.push('BEGIN:VEVENT');
                lines.push('UID:' + uid + '@eprof');
                lines.push('SUMMARY:' + icsEscape((item.emoji ? item.emoji + ' ' : '') + item.title));
                if (item.description) lines.push('DESCRIPTION:' + icsEscape(item.description));
                if (item.lieu) lines.push('LOCATION:' + icsEscape(item.lieu));
                if (allDay) {
                    lines.push('DTSTART;VALUE=DATE:' + toIcsDate(startVal, true));
                    if (endVal) lines.push('DTEND;VALUE=DATE:' + toYmdLocal(endVal).replace(/-/g, ''));
                } else {
                    lines.push('DTSTART:' + toIcsDate(startVal, false));
                    if (endVal) lines.push('DTEND:' + toIcsDate(endVal, false));
                }
                lines.push('END:VEVENT');
            }
            if (item.daysOfWeek && item.daysOfWeek.length) {
                var st = formatHm(item.startTime || item.start) || '08:00';
                var et = formatHm(item.endTime || item.end) || '09:00';
                listOccurrenceYmds(item).forEach(function (ymd) {
                    if (item.allDay) pushEvent(item.id + '-' + ymd, ymd, addDaysYmd(ymd, 1), true);
                    else pushEvent(item.id + '-' + ymd, new Date(ymd + 'T' + st), new Date(ymd + 'T' + et), false);
                });
                return;
            }
            if (item.allDay) {
                pushEvent(item.id, item.start, item.end ? parseAllDayExclusiveEnd(item.start, item.end) : addDaysYmd(parseAllDayYmd(item.start), 1), true);
            } else {
                pushEvent(item.id, item.start, item.end, false);
            }
        });
        lines.push('END:VCALENDAR');
        return lines.join('\r\n');
    }

    function downloadText(filename, content, mime) {
        var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    }

    function readNotified() {
        try { return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]'); } catch (e) { return []; }
    }

    function markNotified(key) {
        var list = readNotified();
        list.push(key);
        try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(list.slice(-200))); } catch (e) {}
    }

    async function checkReminders() {
        var settings = loadAgendaSettings();
        if (!settings.notificationsActives) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        var items = readLocalCache();
        var now = Date.now();
        var notified = readNotified();
        items.forEach(function (item) {
            if (item.done || item.reminderMinutes === null || item.reminderMinutes === undefined) return;
            var start = nextOccurrence(item, new Date(now - Number(item.reminderMinutes) * 60000 - 600000));
            if (!start) return;
            var startTs = start.getTime();
            var triggerTs = startTs - Number(item.reminderMinutes) * 60000;
            var key = item.id + '@' + triggerTs;
            if (now >= triggerTs && now < triggerTs + 600000 && notified.indexOf(key) === -1) {
                new Notification((item.emoji || '📌') + ' ' + item.title, {
                    body: formatDateTime(item, start) + (item.lieu ? '\n📍 ' + item.lieu : '')
                });
                markNotified(key);
            }
        });
    }

    function startNotificationWatcher() {
        if (notificationTimer) return;
        notificationTimer = setInterval(checkReminders, 60000);
        checkReminders();
    }

    async function listUpcoming(limit) {
        try { await loadAllEvents(); } catch (e) { /* cache local */ }
        var now = new Date();
        var horizon = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        var todayYmd = toYmdLocal(now);
        var out = [];
        readLocalCache().forEach(function (ev) {
            if (!ev || ev.done || ev.display === 'background') return;
            var occ = nextOccurrence(ev, now);
            if (!occ || occ > horizon) return;
            if (ev.allDay) {
                if (toYmdLocal(occ) < todayYmd) return;
            } else if (occ.getTime() < now.getTime() - 15 * 60 * 1000) {
                return;
            }
            out.push(Object.assign({}, ev, { start: occ.toISOString(), _occurrence: occ }));
        });
        out.sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
        return out.slice(0, limit || 80);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindEventForm);
    } else {
        bindEventForm();
    }
    if (loadAgendaSettings().notificationsActives) startNotificationWatcher();

    window.EprofCalendarUtils = {
        COLORS: COLORS,
        EMOJIS: EMOJIS,
        TYPES: TYPES,
        REMINDER_OPTIONS: REMINDER_OPTIONS,
        JOURS: JOURS,
        escapeHtml: escapeHtml,
        isUuid: isUuid,
        getAnneeScolaire: getAnneeScolaire,
        getCalendarPrefs: getCalendarPrefs,
        getCalendarDisplayPrefs: getCalendarDisplayPrefs,
        parseHm: parseHm,
        schoolYearStart: schoolYearStart,
        schoolYearEnd: schoolYearEnd,
        toYmdLocal: toYmdLocal,
        addDaysYmd: addDaysYmd,
        isoWeekNumberFromYmd: isoWeekNumberFromYmd,
        weekAbFromYmd: weekAbFromYmd,
        toLocalDateTimeInput: toLocalDateTimeInput,
        toInputValue: toInputValue,
        parseAllDayYmd: parseAllDayYmd,
        parseAllDayExclusiveEnd: parseAllDayExclusiveEnd,
        allDayEndInclusive: allDayEndInclusive,
        formToStartEnd: formToStartEnd,
        formatDateTime: formatDateTime,
        nextOccurrence: nextOccurrence,
        typeLabel: typeLabel,
        loadAgendaSettings: loadAgendaSettings,
        saveAgendaSettings: saveAgendaSettings,
        readLocalCache: readLocalCache,
        writeLocalCache: writeLocalCache,
        loadAllEvents: loadAllEvents,
        persistEvent: persistEvent,
        deleteEvent: deleteEvent,
        skipOccurrence: skipOccurrence,
        detachOccurrence: detachOccurrence,
        parseInstanceId: parseInstanceId,
        toFcEvent: toFcEvent,
        toFcEvents: toFcEvents,
        fcEventToItem: fcEventToItem,
        oneOffFromFcEvent: oneOffFromFcEvent,
        isUserEvent: isUserEvent,
        isClosedDay: isClosedDay,
        openEventForm: openEventForm,
        closeEventForm: closeEventForm,
        openDetailModal: openDetailModal,
        detailHtml: detailHtml,
        getSchoolCalendarEvents: getSchoolCalendarEvents,
        parseEmploiCsv: parseEmploiCsv,
        eventsToCsv: eventsToCsv,
        eventsToIcs: eventsToIcs,
        downloadText: downloadText,
        startNotificationWatcher: startNotificationWatcher,
        listUpcoming: listUpcoming,
        getTeacherClasses: getTeacherClasses,
        notifyChanged: notifyChanged
    };
})();
