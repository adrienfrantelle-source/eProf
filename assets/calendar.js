/*
Ce fichier contiendra les fonctions de calendrier (affichage, import, gestion vacances)
*/

// Exemple d'export pour usage dans app.js
export function renderCalendar(container) {
    container.innerHTML = `<div id="calendar-module">
        <h3>Calendrier interactif</h3>
        <div id="calendar-controls">
            <button id="prev-month">&lt;</button>
            <span id="calendar-month-label"></span>
            <button id="next-month">&gt;</button>
            <button id="import-ics">Importer emploi du temps (.ics)</button>
            <button id="add-holidays">Ajouter vacances scolaires</button>
        </div>
        <div id="calendar-view"></div>
    </div>`;

    const monthLabel = container.querySelector('#calendar-month-label');
    const calendarView = container.querySelector('#calendar-view');
    let current = new Date();
    current.setDate(1);

    function renderMonth(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        monthLabel.textContent = `${date.toLocaleString('fr-FR', { month: 'long' })} ${year}`;
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let html = '<table class="calendar-table"><thead><tr>';
        const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        for (let d of days) html += `<th>${d}</th>`;
        html += '</tr></thead><tbody><tr>';
        let dayOfWeek = (firstDay + 6) % 7; // Lundi=0
        for (let i = 0; i < dayOfWeek; i++) html += '<td></td>';
        for (let d = 1; d <= daysInMonth; d++) {
            if ((dayOfWeek % 7) === 0 && d !== 1) html += '</tr><tr>';
            html += `<td>${d}</td>`;
            dayOfWeek++;
        }
        while (dayOfWeek % 7 !== 0) { html += '<td></td>'; dayOfWeek++; }
        html += '</tr></tbody></table>';
        calendarView.innerHTML = html;
    }

    renderMonth(current);
    container.querySelector('#prev-month').onclick = () => {
        current.setMonth(current.getMonth() - 1);
        renderMonth(current);
    };
    container.querySelector('#next-month').onclick = () => {
        current.setMonth(current.getMonth() + 1);
        renderMonth(current);
    };
}
