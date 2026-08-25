/*
Ce fichier contiendra les fonctions de conversion de fichiers (PDF, Excel, CSV, DOCX, etc.)
*/

// Exemple d'export pour usage dans app.js
export function renderFileConverter(container) {
    container.innerHTML = `<div id="file-converter-module">
        <h3>Conversion de fichiers</h3>
        <input type="file" id="file-input" multiple />
        <select id="convert-type">
            <option value="csv2xlsx">CSV → Excel (XLSX)</option>
            <option value="xlsx2csv">Excel (XLSX) → CSV</option>
        </select>
        <button id="convert-btn">Convertir</button>
        <div id="convert-result"></div>
        <p style="font-size:0.9em;color:#888;">Conversion PDF/DOCX à venir (limite navigateur)</p>
    </div>`;

    const fileInput = container.querySelector('#file-input');
    const convertType = container.querySelector('#convert-type');
    const convertBtn = container.querySelector('#convert-btn');
    const resultDiv = container.querySelector('#convert-result');

    convertBtn.onclick = async () => {
        if (!fileInput.files.length) {
            resultDiv.innerHTML = '<span style="color:red">Sélectionnez un fichier à convertir.</span>';
            return;
        }
        const file = fileInput.files[0];
        const type = convertType.value;
        if (type === 'csv2xlsx') {
            const text = await file.text();
            const rows = text.split(/\r?\n/).map(l => l.split(';'));
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'Feuille1');
            const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
            downloadFile(new Blob([wbout]), file.name.replace(/\.csv$/i, '.xlsx'));
            resultDiv.innerHTML = 'Conversion terminée !';
        } else if (type === 'xlsx2csv') {
            const reader = new FileReader();
            reader.onload = function(e) {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, {type:'array'});
                const ws = wb.Sheets[wb.SheetNames[0]];
                const csv = XLSX.utils.sheet_to_csv(ws, {FS:';'});
                downloadFile(new Blob([csv]), file.name.replace(/\.xlsx$/i, '.csv'));
                resultDiv.innerHTML = 'Conversion terminée !';
            };
            reader.readAsArrayBuffer(file);
        } else {
            resultDiv.innerHTML = '<span style="color:red">Type de conversion non supporté pour le moment.</span>';
        }
    };

    // Ajout dynamique de SheetJS (XLSX) si besoin
    if (!window.XLSX) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.onload = () => {};
        document.body.appendChild(script);
    }

    function downloadFile(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        }, 100);
    }
}
