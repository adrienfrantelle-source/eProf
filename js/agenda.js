// ===== AGENDA DU PROFESSEUR =====
// Liste de tous les événements (mêmes données que le calendrier).
// Formulaire, dates et persistance : EprofCalendarUtils.

(function () {
    const U = function () { return window.EprofCalendarUtils; };

    function startOfDay(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function groupItems(items, afficherTermines) {
        const today = startOfDay(new Date());
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const afterTomorrow = new Date(today); afterTomorrow.setDate(today.getDate() + 2);
        const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + 7);
        const utils = U();

        const groups = {
            retard: { titre: '⏳ En retard', items: [] },
            aujourdhui: { titre: '📍 Aujourd\'hui', items: [] },
            demain: { titre: '➡️ Demain', items: [] },
            semaine: { titre: '🗓️ Cette semaine', items: [] },
            plusTard: { titre: '🔭 Plus tard', items: [] },
            termines: { titre: '✅ Terminés', items: [] }
        };

        items.slice().forEach(function (item) {
            if (item.done) {
                if (afficherTermines) groups.termines.items.push(item);
                return;
            }
            const occ = utils && utils.nextOccurrence ? utils.nextOccurrence(item) : (item.start ? new Date(item.start) : null);
            if (!occ) {
                groups.plusTard.items.push(item);
                return;
            }
            const day = startOfDay(occ);
            const tagged = Object.assign({}, item, { _occurrence: occ, start: occ.toISOString() });
            if (!item.daysOfWeek && day < today) groups.retard.items.push(item);
            else if (day < tomorrow) groups.aujourdhui.items.push(tagged);
            else if (day < afterTomorrow) groups.demain.items.push(tagged);
            else if (day < endOfWeek) groups.semaine.items.push(tagged);
            else groups.plusTard.items.push(tagged);
        });

        Object.keys(groups).forEach(function (key) {
            groups[key].items.sort(function (a, b) {
                const ta = a._occurrence || a.start;
                const tb = b._occurrence || b.start;
                return new Date(ta) - new Date(tb);
            });
        });
        return groups;
    }

    function itemCardHtml(item) {
        const utils = U();
        const esc = utils ? utils.escapeHtml : function (s) { return String(s || ''); };
        const when = utils ? utils.formatDateTime(item, item._occurrence) : '';
        const type = utils && utils.typeLabel ? utils.typeLabel(item.type) : (item.type || '');
        const showDone = item.type === 'todo';
        return `
            <div class="agenda-card${item.done ? ' agenda-card-done' : ''}" data-id="${esc(item.id)}" style="border-left-color:${esc(item.color || '#1e88e5')}">
                ${showDone ? `<label class="agenda-check">
                    <input type="checkbox" class="agenda-done-toggle" ${item.done ? 'checked' : ''} title="Marquer comme terminé">
                </label>` : '<span class="agenda-check-spacer"></span>'}
                <div class="agenda-card-body">
                    <div class="agenda-card-title">${esc(item.emoji || '📌')} ${esc(item.title)}</div>
                    <div class="agenda-card-meta">${esc(when)}${item.className ? ' · 👥 ' + esc(item.className) : ''}${item.lieu ? ' · 📍 ' + esc(item.lieu) : ''}${item.reminderMinutes !== null && item.reminderMinutes !== undefined ? ' · 🔔' : ''}${item.daysOfWeek && item.daysOfWeek.length ? ' · 🔁' : ''}</div>
                    ${item.description ? `<div class="agenda-card-desc">${esc(item.description)}</div>` : ''}
                    <div class="agenda-card-type">${esc(type)}</div>
                </div>
                <div class="agenda-card-actions">
                    <button type="button" class="agenda-edit-btn" title="Modifier">✏️</button>
                    <button type="button" class="agenda-delete-btn" title="Supprimer">🗑️</button>
                </div>
            </div>`;
    }

    async function render(container) {
        const utils = U();
        if (!utils) {
            container.innerHTML = '<p class="agenda-empty">Le module agenda n’a pas pu démarrer.</p>';
            return;
        }
        const settings = utils.loadAgendaSettings();
        const classes = utils.getTeacherClasses();

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
                <p class="agenda-hint">Même planning que le calendrier : cours, tâches, rendez-vous et événements. Cliquez une ligne pour modifier.</p>
                <div class="agenda-filters">
                    <input type="search" id="agenda-search" placeholder="Rechercher un intitulé, un lieu…" class="agenda-search">
                    <select id="agenda-filter-type" class="cal-filter">
                        <option value="">Toutes les natures</option>
                        <option value="cours">Cours</option>
                        <option value="event">Événements</option>
                        <option value="todo">Tâches</option>
                        <option value="rdv">Rendez-vous</option>
                    </select>
                    <select id="agenda-filter-class" class="cal-filter">
                        <option value="">Toutes les classes</option>
                        ${classes.map(function (nom) { return `<option value="${utils.escapeHtml(nom)}">${utils.escapeHtml(nom)}</option>`; }).join('')}
                    </select>
                </div>
                <div id="agenda-list" class="agenda-list"><p class="agenda-loading">Chargement…</p></div>
            </div>`;

        const listEl = container.querySelector('#agenda-list');
        let items = [];

        function filteredItems() {
            const q = (container.querySelector('#agenda-search').value || '').trim().toLowerCase();
            const type = container.querySelector('#agenda-filter-type').value;
            const cls = container.querySelector('#agenda-filter-class').value;
            return items.filter(function (item) {
                if (type && item.type !== type) return false;
                if (cls && item.className !== cls) return false;
                if (q) {
                    const hay = ((item.title || '') + ' ' + (item.lieu || '') + ' ' + (item.description || '') + ' ' + (item.className || '')).toLowerCase();
                    if (hay.indexOf(q) === -1) return false;
                }
                return true;
            });
        }

        function renderList() {
            const groups = groupItems(filteredItems(), container.querySelector('#agenda-show-done').checked);
            const html = Object.keys(groups).map(function (key) {
                const group = groups[key];
                if (!group.items.length) return '';
                return `<section class="agenda-group agenda-group-${key}">
                    <h3>${group.titre} <span class="agenda-count">${group.items.length}</span></h3>
                    ${group.items.map(itemCardHtml).join('')}
                </section>`;
            }).join('');
            listEl.innerHTML = html || '<p class="agenda-empty">Aucun élément pour ces filtres. Cliquez sur « ➕ Nouvel élément » ou créez un cours dans le calendrier.</p>';
        }

        function openItem(item) {
            utils.openEventForm({
                item: item,
                source: item ? item.source : 'agenda',
                defaultType: item ? item.type : 'todo',
                onSaved: async function (saved) {
                    const index = items.findIndex(function (i) { return i.id === saved.id; });
                    if (index >= 0) items[index] = saved; else items.push(saved);
                    renderList();
                }
            });
        }

        container.querySelector('#agenda-new-btn').addEventListener('click', function () {
            openItem(null);
        });

        ['#agenda-search', '#agenda-filter-type', '#agenda-filter-class'].forEach(function (sel) {
            container.querySelector(sel).addEventListener('input', renderList);
            container.querySelector(sel).addEventListener('change', renderList);
        });

        listEl.addEventListener('click', async function (e) {
            const card = e.target.closest('.agenda-card');
            if (!card) return;
            const item = items.find(function (i) { return i.id === card.dataset.id; });
            if (!item) return;

            if (e.target.classList.contains('agenda-edit-btn') || e.target.closest('.agenda-card-body') || e.target.classList.contains('agenda-delete-btn')) {
                if (item.daysOfWeek && item.daysOfWeek.length) {
                    const occ = item._occurrence || utils.nextOccurrence(item);
                    const ymd = occ ? utils.toYmdLocal(occ) : null;
                    utils.openDetailModal(Object.assign({}, item, { _occurrenceDate: ymd }), {
                        onSaved: function () {
                            items = utils.readLocalCache();
                            renderList();
                        },
                        onDeleted: function (id) {
                            items = items.filter(function (i) { return i.id !== id; });
                            renderList();
                        }
                    });
                    return;
                }
                if (e.target.classList.contains('agenda-delete-btn')) {
                    if (!confirm('Supprimer « ' + item.title + ' » ?')) return;
                    await utils.deleteEvent(item.id);
                    items = items.filter(function (i) { return i.id !== item.id; });
                    renderList();
                    return;
                }
                openItem(item);
            }
        });

        listEl.addEventListener('change', async function (e) {
            if (!e.target.classList.contains('agenda-done-toggle')) return;
            const card = e.target.closest('.agenda-card');
            const item = items.find(function (i) { return i.id === card.dataset.id; });
            if (!item) return;
            item.done = e.target.checked;
            await utils.persistEvent(item);
            renderList();
        });

        container.querySelector('#agenda-show-done').addEventListener('change', function (e) {
            const s = utils.loadAgendaSettings();
            s.afficherTermines = e.target.checked;
            utils.saveAgendaSettings(s);
            renderList();
        });

        container.querySelector('#agenda-notif-toggle').addEventListener('change', async function (e) {
            const s = utils.loadAgendaSettings();
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
            utils.saveAgendaSettings(s);
            if (s.notificationsActives) utils.startNotificationWatcher();
        });

        const onChanged = function () {
            if (!container.querySelector('#agenda-module')) {
                document.removeEventListener('eprof-events-changed', onChanged);
                return;
            }
            items = utils.readLocalCache();
            renderList();
        };
        document.addEventListener('eprof-events-changed', onChanged);

        items = await utils.loadAllEvents();
        renderList();
        if (utils.loadAgendaSettings().notificationsActives) utils.startNotificationWatcher();
    }

    async function listUpcoming(limit) {
        const utils = U();
        if (utils) return utils.listUpcoming(limit);
        return [];
    }

    if (U() && U().loadAgendaSettings().notificationsActives) U().startNotificationWatcher();

    window.EprofAgenda = {
        render: render,
        loadItems: function () { return U() ? U().loadAllEvents() : Promise.resolve([]); },
        listUpcoming: listUpcoming,
        COLORS: (U() && U().COLORS) || [],
        EMOJIS: (U() && U().EMOJIS) || []
    };
})();
