// ===== AGENDA DU PROFESSEUR =====
// Module autonome : tout ce qui concerne l'agenda vit ici (données, UI, notifications).
// Les éléments sont stockés dans la table calendar_events avec source = 'agenda',
// ce qui les fait apparaître automatiquement dans le calendrier de l'application.
// Hors ligne, on retombe sur le même cache localStorage que le calendrier.

(function () {
    const STORAGE_KEY = 'eprof-events';
    const SETTINGS_KEY = 'eprof-agenda-settings';
    const NOTIFIED_KEY = 'eprof-agenda-notified';

    const COLORS = [
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

    const EMOJIS = ['📌', '✅', '📝', '📚', '🧪', '🎯', '⏰', '📞', '✉️', '👥', '🏫', '🚌', '🍽️', '💡', '⚠️', '🔥', '🎉', '🩺', '💰', '🖨️', '🧹', '📊', '🎓', '🌱'];

    const REMINDER_OPTIONS = [
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

    const DEFAULT_SETTINGS = { notificationsActives: false, rappelParDefaut: '60', afficherTermines: false };

    // ---------- Utilitaires ----------
    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function isUuid(value) {
        return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }

    function loadSettings() {
        try {
            return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
        } catch (e) {
            return Object.assign({}, DEFAULT_SETTINGS);
        }
    }

    function saveSettings(settings) {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
    }

    function startOfDay(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function formatDateTime(item) {
        if (!item.start) return '';
        const start = new Date(item.start);
        const dateStr = start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        if (item.allDay) {
            if (item.end) {
                // FullCalendar utilise une fin exclusive pour les éléments "journée entière"
                const end = new Date(item.end);
                end.setDate(end.getDate() - 1);
                if (end > start) {
                    return `du ${dateStr} au ${end.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`;
                }
            }
            return dateStr;
        }
        const heure = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const fin = item.end ? ' → ' + new Date(item.end).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
        return `${dateStr} à ${heure}${fin}`;
    }

    // ---------- Accès aux données ----------
    function readLocalCache() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
    }

    function writeLocalCache(events) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); } catch (e) {}
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
            source: row.source || 'calendar'
        };
    }

    function itemToRow(item, teacherId) {
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
            source: 'agenda'
        };
    }

    async function isOnline() {
        return !!(window.EprofStore && await window.EprofStore.isOnlineReady());
    }

    async function loadItems() {
        if (await isOnline()) {
            const teacherId = await window.EprofStore.getTeacherId();
            const result = await window.EprofStore.list('calendar_events', { filters: { teacher_id: teacherId, source: 'agenda' }, orderBy: 'start_at' });
            if (!result.error && result.data) {
                const items = result.data.map(rowToItem);
                // On rafraîchit le cache partagé avec le calendrier sans écraser ses propres événements
                const others = readLocalCache().filter(function (ev) { return ev.source !== 'agenda'; });
                writeLocalCache(others.concat(items));
                return items;
            }
            console.warn('⚠️ Agenda : bascule sur le cache local (Supabase indisponible).', result.error);
        }
        return readLocalCache().filter(function (ev) { return ev.source === 'agenda'; });
    }

    function upsertLocalItem(item) {
        const cache = readLocalCache();
        const index = cache.findIndex(function (ev) { return ev.id && ev.id === item.id; });
        if (index >= 0) cache[index] = item; else cache.push(item);
        writeLocalCache(cache);
    }

    function removeLocalItem(id) {
        writeLocalCache(readLocalCache().filter(function (ev) { return ev.id !== id; }));
    }

    async function persistItem(item) {
        if (await isOnline()) {
            const teacherId = await window.EprofStore.getTeacherId();
            if (teacherId) {
                const row = itemToRow(item, teacherId);
                const result = isUuid(item.id)
                    ? await window.EprofStore.update('calendar_events', item.id, row)
                    : await window.EprofStore.insert('calendar_events', row);
                if (!result.error && result.data) item.id = result.data.id;
            }
        }
        if (!item.id) item.id = 'local-' + Date.now() + '-' + Math.random().toString(16).slice(2);
        item.source = 'agenda';
        upsertLocalItem(item);
        return item;
    }

    async function deleteItem(id) {
        if (isUuid(id) && await isOnline()) {
            await window.EprofStore.remove('calendar_events', id);
        }
        removeLocalItem(id);
    }

    // ---------- Notifications ----------
    let notificationTimer = null;

    function readNotified() {
        try { return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '[]'); } catch (e) { return []; }
    }

    function markNotified(key) {
        const list = readNotified();
        list.push(key);
        // On ne conserve que les 200 derniers rappels pour éviter que la clé n'enfle indéfiniment
        try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(list.slice(-200))); } catch (e) {}
    }

    async function checkReminders() {
        const settings = loadSettings();
        if (!settings.notificationsActives) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const items = readLocalCache().filter(function (ev) { return ev.source === 'agenda'; });
        const now = Date.now();
        const notified = readNotified();

        items.forEach(function (item) {
            if (item.done || !item.start || item.reminderMinutes === null || item.reminderMinutes === undefined) return;
            const startTs = new Date(item.start).getTime();
            const triggerTs = startTs - Number(item.reminderMinutes) * 60000;
            const key = item.id + '@' + triggerTs;
            // Fenêtre de 10 min : évite les rappels d'événements largement passés (onglet rouvert plus tard)
            if (now >= triggerTs && now < triggerTs + 600000 && notified.indexOf(key) === -1) {
                new Notification((item.emoji || '📌') + ' ' + item.title, {
                    body: formatDateTime(item) + (item.lieu ? '\n📍 ' + item.lieu : '')
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

    // ---------- Regroupement intelligent ----------
    function groupItems(items, afficherTermines) {
        const today = startOfDay(new Date());
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const afterTomorrow = new Date(today); afterTomorrow.setDate(today.getDate() + 2);
        const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + 7);

        const groups = {
            retard: { titre: '⏳ En retard', items: [] },
            aujourdhui: { titre: '📍 Aujourd\'hui', items: [] },
            demain: { titre: '➡️ Demain', items: [] },
            semaine: { titre: '🗓️ Cette semaine', items: [] },
            plusTard: { titre: '🔭 Plus tard', items: [] },
            termines: { titre: '✅ Terminés', items: [] }
        };

        items.slice().sort(function (a, b) { return new Date(a.start) - new Date(b.start); }).forEach(function (item) {
            if (item.done) {
                if (afficherTermines) groups.termines.items.push(item);
                return;
            }
            const start = new Date(item.start);
            const day = startOfDay(start);
            if (day < today) groups.retard.items.push(item);
            else if (day < tomorrow) groups.aujourdhui.items.push(item);
            else if (day < afterTomorrow) groups.demain.items.push(item);
            else if (day < endOfWeek) groups.semaine.items.push(item);
            else groups.plusTard.items.push(item);
        });

        return groups;
    }

    // ---------- Interface ----------
    function itemCardHtml(item) {
        return `
            <div class="agenda-card${item.done ? ' agenda-card-done' : ''}" data-id="${escapeHtml(item.id)}" style="border-left-color:${escapeHtml(item.color || '#1e88e5')}">
                <label class="agenda-check">
                    <input type="checkbox" class="agenda-done-toggle" ${item.done ? 'checked' : ''} title="Marquer comme terminé">
                </label>
                <div class="agenda-card-body">
                    <div class="agenda-card-title">${escapeHtml(item.emoji || '📌')} ${escapeHtml(item.title)}</div>
                    <div class="agenda-card-meta">${escapeHtml(formatDateTime(item))}${item.lieu ? ' · 📍 ' + escapeHtml(item.lieu) : ''}${item.reminderMinutes !== null && item.reminderMinutes !== undefined ? ' · 🔔' : ''}</div>
                    ${item.description ? `<div class="agenda-card-desc">${escapeHtml(item.description)}</div>` : ''}
                </div>
                <div class="agenda-card-actions">
                    <button type="button" class="agenda-edit-btn" title="Modifier">✏️</button>
                    <button type="button" class="agenda-delete-btn" title="Supprimer">🗑️</button>
                </div>
            </div>`;
    }

    function formHtml(settings) {
        return `
            <form id="agenda-form" class="agenda-form" style="display:none;">
                <input type="hidden" id="agenda-item-id">
                <div class="agenda-form-row">
                    <label>Intitulé
                        <input type="text" id="agenda-title" required placeholder="Ex : corriger les copies de 2nde SAPAT A">
                    </label>
                    <label>Nature
                        <select id="agenda-type">
                            <option value="todo">📝 Tâche à faire</option>
                            <option value="event">📅 Événement</option>
                            <option value="rdv">🤝 Rendez-vous</option>
                        </select>
                    </label>
                </div>
                <div class="agenda-form-row">
                    <label class="agenda-inline-check">
                        <input type="checkbox" id="agenda-all-day"> Sur une journée / une période (sans horaire)
                    </label>
                </div>
                <div class="agenda-form-row">
                    <label>Début
                        <input type="datetime-local" id="agenda-start" required>
                    </label>
                    <label>Fin (facultatif)
                        <input type="datetime-local" id="agenda-end">
                    </label>
                </div>
                <div class="agenda-form-row">
                    <label>Lieu (facultatif)
                        <input type="text" id="agenda-lieu" placeholder="Salle, établissement...">
                    </label>
                    <label>Rappel
                        <select id="agenda-reminder">
                            ${REMINDER_OPTIONS.map(function (o) { return `<option value="${o.value}"${o.value === settings.rappelParDefaut ? ' selected' : ''}>${o.label}</option>`; }).join('')}
                        </select>
                    </label>
                </div>
                <div class="agenda-form-row">
                    <label>Note (facultatif)
                        <textarea id="agenda-desc" rows="2" placeholder="Détails, matériel à prévoir..."></textarea>
                    </label>
                </div>
                <div class="agenda-form-row">
                    <div class="agenda-picker">
                        <span class="agenda-picker-label">Couleur</span>
                        <div class="agenda-colors">
                            ${COLORS.map(function (c, i) { return `<button type="button" class="agenda-color${i === 5 ? ' selected' : ''}" data-color="${c.value}" style="background:${c.value}" title="${c.label}"></button>`; }).join('')}
                        </div>
                    </div>
                    <div class="agenda-picker">
                        <span class="agenda-picker-label">Icône</span>
                        <div class="agenda-emojis">
                            ${EMOJIS.map(function (e, i) { return `<button type="button" class="agenda-emoji${i === 0 ? ' selected' : ''}" data-emoji="${e}">${e}</button>`; }).join('')}
                        </div>
                    </div>
                </div>
                <div class="agenda-form-actions">
                    <button type="submit" class="btn-primary">💾 Enregistrer</button>
                    <button type="button" id="agenda-cancel-btn" class="btn-secondary">Annuler</button>
                </div>
            </form>`;
    }

    async function render(container) {
        const settings = loadSettings();

        container.innerHTML = `
            <div id="agenda-module">
                <div class="agenda-header">
                    <h2>🗓️ Mon agenda</h2>
                    <div class="agenda-header-actions">
                        <button id="agenda-new-btn" class="btn-primary">➕ Nouvel élément</button>
                        <label class="agenda-inline-check">
                            <input type="checkbox" id="agenda-show-done" ${settings.afficherTermines ? 'checked' : ''}> Afficher les terminés
                        </label>
                        <label class="agenda-inline-check">
                            <input type="checkbox" id="agenda-notif-toggle" ${settings.notificationsActives ? 'checked' : ''}> 🔔 Notifications
                        </label>
                    </div>
                </div>
                <p class="agenda-hint">Chaque élément de l'agenda apparaît automatiquement dans le calendrier de l'application.</p>
                ${formHtml(settings)}
                <div id="agenda-list" class="agenda-list"><p class="agenda-loading">Chargement…</p></div>
            </div>`;

        const form = container.querySelector('#agenda-form');
        const listEl = container.querySelector('#agenda-list');
        let items = [];

        function selectedColor() {
            const el = form.querySelector('.agenda-color.selected');
            return el ? el.dataset.color : '#1e88e5';
        }
        function selectedEmoji() {
            const el = form.querySelector('.agenda-emoji.selected');
            return el ? el.dataset.emoji : '📌';
        }
        function selectInGroup(groupSelector, predicate) {
            form.querySelectorAll(groupSelector).forEach(function (el) {
                el.classList.toggle('selected', predicate(el));
            });
        }

        function renderList() {
            const groups = groupItems(items, container.querySelector('#agenda-show-done').checked);
            const html = Object.keys(groups).map(function (key) {
                const group = groups[key];
                if (!group.items.length) return '';
                return `<section class="agenda-group agenda-group-${key}">
                    <h3>${group.titre} <span class="agenda-count">${group.items.length}</span></h3>
                    ${group.items.map(itemCardHtml).join('')}
                </section>`;
            }).join('');
            listEl.innerHTML = html || '<p class="agenda-empty">Aucun élément dans l\'agenda pour le moment. Cliquez sur « ➕ Nouvel élément » pour commencer.</p>';
        }

        function openForm(item) {
            form.style.display = 'block';
            form.querySelector('#agenda-item-id').value = item ? item.id : '';
            form.querySelector('#agenda-title').value = item ? item.title : '';
            form.querySelector('#agenda-type').value = item ? (item.type || 'todo') : 'todo';
            form.querySelector('#agenda-all-day').checked = item ? !!item.allDay : false;
            form.querySelector('#agenda-lieu').value = item ? (item.lieu || '') : '';
            form.querySelector('#agenda-desc').value = item ? (item.description || '') : '';
            form.querySelector('#agenda-reminder').value = item
                ? (item.reminderMinutes === null || item.reminderMinutes === undefined ? '' : String(item.reminderMinutes))
                : loadSettings().rappelParDefaut;

            const startInput = form.querySelector('#agenda-start');
            const endInput = form.querySelector('#agenda-end');
            if (item && item.start) {
                startInput.value = toInputValue(item.start, item.allDay);
                endInput.value = item.end ? toInputValue(item.end, item.allDay) : '';
            } else {
                const now = new Date();
                now.setMinutes(0, 0, 0);
                now.setHours(now.getHours() + 1);
                startInput.value = toInputValue(now.toISOString(), false);
                endInput.value = '';
            }
            applyAllDayMode();

            selectInGroup('.agenda-color', function (el) { return el.dataset.color === (item ? item.color : '#1e88e5'); });
            selectInGroup('.agenda-emoji', function (el) { return el.dataset.emoji === (item ? item.emoji : '📌'); });
            form.querySelector('#agenda-title').focus();
        }

        function toInputValue(iso, allDay) {
            const d = new Date(iso);
            const pad = function (n) { return String(n).padStart(2, '0'); };
            const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            return allDay ? datePart : `${datePart}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }

        // Le même champ sert de sélecteur de date seule ou de date+heure selon le mode choisi
        function applyAllDayMode() {
            const allDay = form.querySelector('#agenda-all-day').checked;
            ['#agenda-start', '#agenda-end'].forEach(function (sel) {
                const input = form.querySelector(sel);
                const value = input.value;
                input.type = allDay ? 'date' : 'datetime-local';
                input.value = allDay ? value.substring(0, 10) : (value.length === 10 ? value + 'T08:00' : value);
            });
        }

        function closeForm() {
            form.style.display = 'none';
            form.reset();
        }

        container.querySelector('#agenda-new-btn').addEventListener('click', function () {
            if (form.style.display === 'block' && !form.querySelector('#agenda-item-id').value) closeForm();
            else openForm(null);
        });

        container.querySelector('#agenda-cancel-btn').addEventListener('click', closeForm);
        form.querySelector('#agenda-all-day').addEventListener('change', applyAllDayMode);

        form.querySelectorAll('.agenda-color').forEach(function (btn) {
            btn.addEventListener('click', function () {
                selectInGroup('.agenda-color', function (el) { return el === btn; });
            });
        });
        form.querySelectorAll('.agenda-emoji').forEach(function (btn) {
            btn.addEventListener('click', function () {
                selectInGroup('.agenda-emoji', function (el) { return el === btn; });
            });
        });

        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            const allDay = form.querySelector('#agenda-all-day').checked;
            const startRaw = form.querySelector('#agenda-start').value;
            const endRaw = form.querySelector('#agenda-end').value;
            if (!startRaw) return;

            const existingId = form.querySelector('#agenda-item-id').value;
            const existing = items.find(function (i) { return i.id === existingId; });
            const reminderRaw = form.querySelector('#agenda-reminder').value;

            const item = {
                id: existingId || null,
                title: form.querySelector('#agenda-title').value.trim(),
                type: form.querySelector('#agenda-type').value,
                allDay: allDay,
                start: new Date(allDay ? startRaw + 'T00:00' : startRaw).toISOString(),
                end: endRaw ? new Date(allDay ? endRaw + 'T23:59' : endRaw).toISOString() : null,
                lieu: form.querySelector('#agenda-lieu').value.trim(),
                description: form.querySelector('#agenda-desc').value.trim(),
                color: selectedColor(),
                emoji: selectedEmoji(),
                reminderMinutes: reminderRaw === '' ? null : Number(reminderRaw),
                done: existing ? existing.done : false,
                source: 'agenda'
            };

            const saved = await persistItem(item);
            const index = items.findIndex(function (i) { return i.id === saved.id; });
            if (index >= 0) items[index] = saved; else items.push(saved);
            closeForm();
            renderList();
        });

        listEl.addEventListener('click', async function (e) {
            const card = e.target.closest('.agenda-card');
            if (!card) return;
            const item = items.find(function (i) { return i.id === card.dataset.id; });
            if (!item) return;

            if (e.target.classList.contains('agenda-edit-btn')) {
                openForm(item);
                form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else if (e.target.classList.contains('agenda-delete-btn')) {
                if (!confirm('Supprimer « ' + item.title + ' » de l\'agenda ?')) return;
                await deleteItem(item.id);
                items = items.filter(function (i) { return i.id !== item.id; });
                renderList();
            }
        });

        listEl.addEventListener('change', async function (e) {
            if (!e.target.classList.contains('agenda-done-toggle')) return;
            const card = e.target.closest('.agenda-card');
            const item = items.find(function (i) { return i.id === card.dataset.id; });
            if (!item) return;
            item.done = e.target.checked;
            await persistItem(item);
            renderList();
        });

        container.querySelector('#agenda-show-done').addEventListener('change', function (e) {
            const s = loadSettings();
            s.afficherTermines = e.target.checked;
            saveSettings(s);
            renderList();
        });

        container.querySelector('#agenda-notif-toggle').addEventListener('change', async function (e) {
            const s = loadSettings();
            if (e.target.checked) {
                if (!('Notification' in window)) {
                    alert('Votre navigateur ne prend pas en charge les notifications.');
                    e.target.checked = false;
                    return;
                }
                const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
                if (permission !== 'granted') {
                    alert('Notifications refusées par le navigateur. Autorisez-les dans les paramètres du site pour recevoir les rappels.');
                    e.target.checked = false;
                    return;
                }
            }
            s.notificationsActives = e.target.checked;
            saveSettings(s);
            if (s.notificationsActives) startNotificationWatcher();
        });

        items = await loadItems();
        renderList();
        if (loadSettings().notificationsActives) startNotificationWatcher();
    }

    // Le surveillant démarre aussi hors de la vue Agenda pour que les rappels
    // fonctionnent tant que l'application est ouverte.
    if (loadSettings().notificationsActives) startNotificationWatcher();

    async function listUpcoming(limit) {
        try { await loadItems(); } catch (e) { /* cache local */ }
        const now = Date.now() - 15 * 60 * 1000;
        return readLocalCache().filter(function (ev) {
            if (!ev || !ev.start || ev.done || ev.display === 'background') return false;
            const t = new Date(ev.start).getTime();
            return !isNaN(t) && t >= now;
        }).sort(function (a, b) {
            return new Date(a.start) - new Date(b.start);
        }).slice(0, limit || 3);
    }

    window.EprofAgenda = { render, loadItems, listUpcoming, COLORS, EMOJIS };
})();
