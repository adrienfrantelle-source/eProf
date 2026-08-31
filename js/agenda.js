// ===== AGENDA DU PROFESSEUR =====
// Mêmes données que le calendrier. L’affichage privilégie ce qui arrive.

(function () {
    const U = function () { return window.EprofCalendarUtils; };

    function startOfDay(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function formatDayTitle(date, opts) {
        return date.toLocaleDateString('fr-FR', opts || { weekday: 'long', day: 'numeric', month: 'long' });
    }

    function overdueItems(items) {
        const utils = U();
        const today = startOfDay(new Date());
        return items.filter(function (item) {
            if (!item || item.done || (item.daysOfWeek && item.daysOfWeek.length)) return false;
            const occ = item.start ? new Date(item.start) : null;
            if (!occ || isNaN(occ.getTime())) return false;
            return startOfDay(occ) < today;
        }).sort(function (a, b) {
            return new Date(a.start) - new Date(b.start);
        });
    }

    function doneItems(items, show) {
        if (!show) return [];
        return items.filter(function (item) { return item && item.done; });
    }

    function laterItems(items, afterYmd) {
        const utils = U();
        const horizon = utils.addDaysYmd(afterYmd, 1);
        return items.filter(function (item) {
            if (!item || item.done) return false;
            const occ = utils.nextOccurrence(item);
            if (!occ) return true;
            return utils.toYmdLocal(occ) >= horizon;
        }).sort(function (a, b) {
            const ta = utils.nextOccurrence(a);
            const tb = utils.nextOccurrence(b);
            if (!ta) return 1;
            if (!tb) return -1;
            return ta - tb;
        });
    }

    function compactRowHtml(item, occYmd) {
        const utils = U();
        const esc = utils.escapeHtml;
        const tagged = Object.assign({}, item);
        if (occYmd) tagged._occurrence = new Date(occYmd + 'T12:00:00');
        const when = utils.formatDateTime(tagged, tagged._occurrence);
        const type = utils.typeLabel ? utils.typeLabel(item.type) : '';
        const showDone = item.type === 'todo';
        return `
            <div class="agenda-row${item.done ? ' agenda-row-done' : ''}" data-id="${esc(item.id)}" data-occ="${esc(occYmd || '')}" style="--agenda-accent:${esc(item.color || '#1e88e5')}">
                ${showDone ? `<label class="agenda-check"><input type="checkbox" class="agenda-done-toggle" ${item.done ? 'checked' : ''} title="Marquer comme terminé"></label>` : ''}
                <button type="button" class="agenda-row-main">
                    <span class="agenda-chip-title">${esc(item.emoji || '📌')} ${esc(item.title)}</span>
                    <span class="agenda-chip-meta">${esc(when)}${item.className ? ' · ' + esc(item.className) : ''}${item.lieu ? ' · ' + esc(item.lieu) : ''}</span>
                    <span class="agenda-chip-type">${esc(type)}</span>
                </button>
                <button type="button" class="agenda-delete-btn" title="Supprimer">🗑️</button>
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
                    <div>
                        <h2>🗓️ Mon agenda</h2>
                        <p class="agenda-hint">Aujourd’hui d’abord, puis les jours qui viennent — mêmes événements que le calendrier.</p>
                    </div>
                    <div class="agenda-header-actions">
                        <button id="agenda-new-btn" class="btn-primary">➕ Nouvel élément</button>
                        <label class="agenda-inline-check">
                            <input type="checkbox" id="agenda-show-done" ${settings.afficherTermines ? 'checked' : ''}> Terminés
                        </label>
                        <label class="agenda-inline-check">
                            <input type="checkbox" id="agenda-notif-toggle" ${settings.notificationsActives ? 'checked' : ''}> 🔔 Rappels
                        </label>
                    </div>
                </div>
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
                <div id="agenda-board" class="agenda-board"><p class="agenda-loading">Chargement…</p></div>
            </div>`;

        const boardEl = container.querySelector('#agenda-board');
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

        function renderBoard() {
            const list = filteredItems();
            const today = startOfDay(new Date());
            const todayYmd = utils.toYmdLocal(today);
            const tomorrowYmd = utils.addDaysYmd(todayYmd, 1);
            const weekEndYmd = utils.addDaysYmd(todayYmd, 7);
            const todayEntries = utils.listInstancesInRange(list, todayYmd, tomorrowYmd);
            const upcoming = utils.listInstancesInRange(list, tomorrowYmd, weekEndYmd);
            const later = laterItems(list, utils.addDaysYmd(todayYmd, 6));
            const overdue = overdueItems(list);
            const done = doneItems(list, container.querySelector('#agenda-show-done').checked);

            const dayCols = [];
            for (let i = 1; i <= 6; i++) {
                const ymd = utils.addDaysYmd(todayYmd, i);
                const date = new Date(ymd + 'T12:00:00');
                const entries = upcoming.filter(function (e) { return e.ymd === ymd; });
                dayCols.push({ ymd: ymd, date: date, entries: entries });
            }

            const todayLabel = formatDayTitle(today);
            const weekNum = utils.isoWeekNumberFromYmd ? utils.isoWeekNumberFromYmd(todayYmd) : '';
            const weekAb = utils.weekAbFromYmd ? utils.weekAbFromYmd(todayYmd) : '';

            let html = `
                <section class="agenda-today">
                    <header class="agenda-today-head">
                        <div>
                            <p class="agenda-kicker">Aujourd’hui</p>
                            <h3>${utils.escapeHtml(todayLabel)}</h3>
                        </div>
                        <span class="agenda-week-pill agenda-week-${weekAb.toLowerCase()}" title="Semaine ISO ${weekNum}">S${weekNum} · ${weekAb}</span>
                    </header>
                    ${todayEntries.length
                        ? `<div class="agenda-today-list">${todayEntries.map(function (e) { return utils.instanceButtonHtml(e, 'slot'); }).join('')}</div>`
                        : '<p class="agenda-today-empty">Rien de prévu aujourd’hui. Profitez-en, ou ajoutez un élément.</p>'}
                </section>
                <section class="agenda-upcoming">
                    <header class="agenda-section-head">
                        <h3>Les jours qui viennent</h3>
                    </header>
                    <div class="agenda-days">
                        ${dayCols.map(function (col) {
                            const isTomorrow = col.ymd === tomorrowYmd;
                            const name = isTomorrow ? 'Demain' : col.date.toLocaleDateString('fr-FR', { weekday: 'short' });
                            const num = col.date.getDate();
                            return `<article class="agenda-day${col.entries.length ? '' : ' is-empty'}">
                                <h4><span>${utils.escapeHtml(name)}</span><strong>${num}</strong></h4>
                                ${col.entries.length
                                    ? col.entries.map(function (e) { return utils.instanceButtonHtml(e, 'chip'); }).join('')
                                    : '<p class="agenda-day-free">Libre</p>'}
                            </article>`;
                        }).join('')}
                    </div>
                </section>`;

            if (later.length) {
                html += `<section class="agenda-later">
                    <h3>Plus loin <span class="agenda-count">${later.length}</span></h3>
                    <div class="agenda-later-list">${later.map(function (item) {
                        const occ = utils.nextOccurrence(item);
                        return compactRowHtml(item, occ ? utils.toYmdLocal(occ) : '');
                    }).join('')}</div>
                </section>`;
            }

            if (overdue.length) {
                html += `<details class="agenda-drawer agenda-drawer-overdue">
                    <summary>À rattraper <span class="agenda-count">${overdue.length}</span><span class="agenda-drawer-hint">replié pour laisser la place à la suite</span></summary>
                    <div>${overdue.map(function (item) { return compactRowHtml(item, ''); }).join('')}</div>
                </details>`;
            }

            if (done.length) {
                html += `<details class="agenda-drawer">
                    <summary>Terminés <span class="agenda-count">${done.length}</span></summary>
                    <div>${done.map(function (item) { return compactRowHtml(item, ''); }).join('')}</div>
                </details>`;
            }

            if (!todayEntries.length && !upcoming.length && !later.length && !overdue.length && !done.length) {
                html = '<p class="agenda-empty">Aucun élément pour ces filtres. Cliquez sur « ➕ Nouvel élément » ou créez un cours dans le calendrier.</p>';
            }

            boardEl.innerHTML = html;
        }

        function refreshFromCache(saved) {
            if (saved && saved.id) {
                const index = items.findIndex(function (i) { return i.id === saved.id; });
                if (index >= 0) items[index] = saved; else items.push(saved);
            }
            items = utils.readLocalCache();
            renderBoard();
        }

        function openFromCard(item, occYmd) {
            if (!item) return;
            if (item.daysOfWeek && item.daysOfWeek.length) {
                utils.openDetailModal(Object.assign({}, item, { _occurrenceDate: occYmd || null }), {
                    onSaved: refreshFromCache,
                    onDeleted: function () { items = utils.readLocalCache(); renderBoard(); }
                });
                return;
            }
            utils.openEventForm({
                item: item,
                source: item.source || 'agenda',
                defaultType: item.type || 'todo',
                onSaved: refreshFromCache
            });
        }

        container.querySelector('#agenda-new-btn').addEventListener('click', function () {
            utils.openEventForm({
                source: 'agenda',
                defaultType: 'todo',
                onSaved: refreshFromCache
            });
        });

        ['#agenda-search', '#agenda-filter-type', '#agenda-filter-class'].forEach(function (sel) {
            container.querySelector(sel).addEventListener('input', renderBoard);
            container.querySelector(sel).addEventListener('change', renderBoard);
        });

        boardEl.addEventListener('click', async function (e) {
            const del = e.target.closest('.agenda-delete-btn');
            const trigger = e.target.closest('.agenda-slot, .agenda-chip, .agenda-row-main, .agenda-delete-btn');
            if (!trigger) return;
            const wrap = trigger.closest('[data-id]');
            if (!wrap) return;
            const item = items.find(function (i) { return i.id === wrap.dataset.id; });
            if (!item) return;
            const occYmd = wrap.dataset.occ || '';

            if (del) {
                if (item.daysOfWeek && item.daysOfWeek.length) {
                    openFromCard(item, occYmd);
                    return;
                }
                if (!confirm('Supprimer « ' + item.title + ' » ?')) return;
                await utils.deleteEvent(item.id);
                items = items.filter(function (i) { return i.id !== item.id; });
                renderBoard();
                return;
            }
            openFromCard(item, occYmd);
        });

        boardEl.addEventListener('change', async function (e) {
            if (!e.target.classList.contains('agenda-done-toggle')) return;
            const wrap = e.target.closest('[data-id]');
            const item = items.find(function (i) { return i.id === wrap.dataset.id; });
            if (!item) return;
            item.done = e.target.checked;
            await utils.persistEvent(item);
            renderBoard();
        });

        container.querySelector('#agenda-show-done').addEventListener('change', function (e) {
            const s = utils.loadAgendaSettings();
            s.afficherTermines = e.target.checked;
            utils.saveAgendaSettings(s);
            renderBoard();
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
            renderBoard();
        };
        document.addEventListener('eprof-events-changed', onChanged);

        items = await utils.loadAllEvents();
        renderBoard();
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
