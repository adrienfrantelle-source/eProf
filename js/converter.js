(function () {
    'use strict';

    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    var MAX_BYTES = 10 * 1024 * 1024;
    var A4_WIDTH_MM = 210;
    var A4_HEIGHT_MM = 297;

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' o';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
        return (bytes / 1048576).toFixed(1) + ' Mo';
    }

    function extOf(name) {
        var m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
        return m ? m[1] : '';
    }

    function getJsPdf() {
        if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
        if (window.jsPDF) return window.jsPDF;
        return null;
    }

    function ensurePdfJs() {
        return new Promise(function (resolve, reject) {
            if (window.pdfjsLib) {
                if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                }
                resolve(window.pdfjsLib);
                return;
            }
            var s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            s.onload = function () {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve(window.pdfjsLib);
            };
            s.onerror = function () { reject(new Error('Impossible de charger PDF.js')); };
            document.head.appendChild(s);
        });
    }

    function detectDelimiter(text) {
        var lines = String(text).split(/\r?\n/).slice(0, 12).filter(Boolean);
        var counts = { ';': 0, ',': 0, '\t': 0 };
        lines.forEach(function (line) {
            counts[';'] += (line.match(/;/g) || []).length;
            counts[','] += (line.match(/,/g) || []).length;
            counts['\t'] += (line.match(/\t/g) || []).length;
        });
        return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || ';';
    }

    function decodeBuffer(buffer) {
        var bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
        var utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        var bad = (utf8.match(/\uFFFD/g) || []).length;
        if (bad > 2) {
            try {
                return new TextDecoder('windows-1252').decode(bytes);
            } catch (e) { /* ignore */ }
        }
        return utf8;
    }

    function parseCsv(text, delimiter) {
        var rows = [];
        var row = [];
        var field = '';
        var inQuotes = false;
        var i = 0;
        var s = String(text).replace(/^\uFEFF/, '');
        while (i < s.length) {
            var c = s[i];
            if (inQuotes) {
                if (c === '"') {
                    if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
                    inQuotes = false;
                    i++;
                    continue;
                }
                field += c;
                i++;
                continue;
            }
            if (c === '"') { inQuotes = true; i++; continue; }
            if (c === delimiter) { row.push(field); field = ''; i++; continue; }
            if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
            if (c === '\r') { i++; continue; }
            field += c;
            i++;
        }
        if (field.length || row.length) {
            row.push(field);
            rows.push(row);
        }
        return rows.filter(function (r) { return r.some(function (cell) { return String(cell).trim() !== ''; }); });
    }

    function rowsToHtml(rows, markDiffs) {
        if (!rows || !rows.length) return '<p class="plan-empty-msg">Tableau vide</p>';
        var html = '<table class="conv-table"><tbody>';
        rows.forEach(function (row, ri) {
            html += '<tr>';
            (row || []).forEach(function (cell, ci) {
                var cls = (markDiffs && markDiffs[ri] && markDiffs[ri][ci]) ? ' class="conv-cell-diff"' : '';
                html += '<td' + cls + '>' + escapeHtml(cell) + '</td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function sheetToRows(ws) {
        return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    }

    function diffMaps(a, b) {
        var map = [];
        var maxR = Math.max(a.length, b.length);
        for (var r = 0; r < maxR; r++) {
            map[r] = [];
            var ra = a[r] || [];
            var rb = b[r] || [];
            var maxC = Math.max(ra.length, rb.length);
            for (var c = 0; c < maxC; c++) {
                map[r][c] = String(ra[c] == null ? '' : ra[c]) !== String(rb[c] == null ? '' : rb[c]);
            }
        }
        return map;
    }

    function canvasToMultiPagePdf(canvas) {
        var JsPDF = getJsPdf();
        var pdf = new JsPDF('p', 'mm', 'a4');
        var imgWidth = A4_WIDTH_MM;
        var pageHeightPx = Math.floor(canvas.width * (A4_HEIGHT_MM / A4_WIDTH_MM));
        var y = 0;
        var first = true;
        while (y < canvas.height - 1) {
            var sliceH = Math.min(pageHeightPx, canvas.height - y);
            var pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = sliceH;
            var ctx = pageCanvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
            var hMm = sliceH * imgWidth / canvas.width;
            if (!first) pdf.addPage();
            first = false;
            pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, imgWidth, hMm);
            y += pageHeightPx;
        }
        return pdf;
    }

    function htmlElementToPdf(el) {
        return html2canvas(el, {
            scale: 2,
            logging: false,
            backgroundColor: '#ffffff',
            useCORS: true
        }).then(function (canvas) {
            return canvasToMultiPagePdf(canvas);
        });
    }

    window.renderFileConverter = function renderFileConverter(container) {
        container.innerHTML = [
            '<div id="file-converter-module">',
            '  <h3>Conversion de fichiers</h3>',
            '  <p class="conv-intro">Conversions dans le navigateur. Aucun fichier n’est envoyé sur un serveur.</p>',
            '  <div id="conv-dropzone" class="conv-dropzone" tabindex="0">',
            '    <strong>Glissez-déposez vos fichiers ici</strong>',
            '    <span>ou cliquez pour parcourir</span>',
            '    <input type="file" id="file-input" multiple accept=".csv,.xlsx,.xls,.ods,.pdf,.docx,.doc,.html,.htm,.jpg,.jpeg,.png,.webp">',
            '  </div>',
            '  <div id="conv-file-meta" class="conv-file-meta" hidden></div>',
            '  <div class="converter-controls">',
            '    <label class="conv-opt" id="csv-opt" hidden>Séparateur CSV',
            '      <select id="csv-delimiter">',
            '        <option value="auto">Détection auto</option>',
            '        <option value=";">Point-virgule (;)</option>',
            '        <option value=",">Virgule (,)</option>',
            '        <option value="tab">Tabulation</option>',
            '      </select>',
            '    </label>',
            '    <label class="conv-opt" id="sheet-opt" hidden>Feuille Excel',
            '      <select id="sheet-select"></select>',
            '    </label>',
            '    <select id="convert-type">',
            '      <option value="">-- Sélectionnez une conversion --</option>',
            '    </select>',
            '    <button type="button" id="convert-btn">Convertir</button>',
            '  </div>',
            '  <div id="conv-progress" class="converter-progress" hidden>',
            '    <div class="converter-progress-track"><div id="conv-progress-bar" class="converter-progress-bar"></div></div>',
            '    <p id="conv-progress-label" class="converter-progress-label">Conversion en cours…</p>',
            '  </div>',
            '  <div class="converter-preview">',
            '    <div class="preview-panel">',
            '      <div class="preview-panel-head">',
            '        <h4>Aperçu original</h4>',
            '        <button type="button" id="fullscreen-original" class="btn-fullscreen conv-icon-btn" title="Plein écran">🔍 Plein écran</button>',
            '      </div>',
            '      <div id="preview-original" class="preview-content"></div>',
            '    </div>',
            '    <div class="preview-panel">',
            '      <div class="preview-panel-head">',
            '        <h4>Aperçu converti</h4>',
            '        <button type="button" id="fullscreen-converted" class="btn-fullscreen conv-icon-btn" title="Plein écran">🔍 Plein écran</button>',
            '      </div>',
            '      <div id="preview-converted" class="preview-content"></div>',
            '    </div>',
            '  </div>',
            '  <div id="convert-result"></div>',
            '  <div id="download-container" class="conv-download" hidden>',
            '    <button type="button" id="download-btn" class="btn-download">📥 Télécharger le fichier converti</button>',
            '  </div>',
            '</div>',
            '<div id="fullscreen-modal" class="conv-fullscreen" hidden>',
            '  <button type="button" id="close-fullscreen">✕ Fermer</button>',
            '  <div id="fullscreen-content"></div>',
            '</div>'
        ].join('\n');

        var fileInput = container.querySelector('#file-input');
        var dropzone = container.querySelector('#conv-dropzone');
        var convertType = container.querySelector('#convert-type');
        var convertBtn = container.querySelector('#convert-btn');
        var resultDiv = container.querySelector('#convert-result');
        var previewOriginal = container.querySelector('#preview-original');
        var previewConverted = container.querySelector('#preview-converted');
        var csvOpt = container.querySelector('#csv-opt');
        var sheetOpt = container.querySelector('#sheet-opt');
        var sheetSelect = container.querySelector('#sheet-select');
        var delimiterSelect = container.querySelector('#csv-delimiter');
        var fileMeta = container.querySelector('#conv-file-meta');
        var progressWrap = container.querySelector('#conv-progress');
        var progressBar = container.querySelector('#conv-progress-bar');
        var progressLabel = container.querySelector('#conv-progress-label');
        var downloadContainer = container.querySelector('#download-container');
        var downloadBtn = container.querySelector('#download-btn');
        var fullscreenModal = container.querySelector('#fullscreen-modal');
        var fullscreenContent = container.querySelector('#fullscreen-content');

        var currentFiles = [];
        var workbookCache = null;
        var lastOriginalRows = null;
        var lastConvertedRows = null;

        function setProgress(pct, label) {
            progressWrap.hidden = false;
            progressBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
            progressLabel.textContent = label || 'Conversion en cours…';
        }
        function hideProgress() {
            progressWrap.hidden = true;
            progressBar.style.width = '0%';
        }
        function setResult(html, kind) {
            resultDiv.className = kind ? 'conv-result conv-result-' + kind : 'conv-result';
            resultDiv.innerHTML = html;
        }
        function hideDownload() {
            downloadContainer.hidden = true;
        }
        function setupDownload(blob, filename) {
            downloadContainer.hidden = false;
            downloadBtn.onclick = function () { downloadFile(blob, filename); };
        }
        function downloadFile(blob, filename) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
            }, 120);
        }

        function optionsFor(files) {
            var names = files.map(function (f) { return f.name; });
            var exts = names.map(extOf);
            var first = exts[0] || '';
            var allPdf = exts.length > 1 && exts.every(function (e) { return e === 'pdf'; });
            var allImg = exts.length >= 1 && exts.every(function (e) { return ['jpg', 'jpeg', 'png', 'webp'].indexOf(e) !== -1; });
            var opts = [{ value: '', text: '-- Sélectionnez une conversion --' }];

            if (first === 'doc') {
                return [{ value: '', text: '-- Format .doc non supporté — enregistrez en .docx --' }];
            }
            if (allPdf) {
                opts.push({ value: 'pdfmerge', text: 'Fusionner les PDF' });
            }
            if (allImg) {
                opts.push({ value: 'images2pdf', text: 'Images → PDF' });
            }
            if (first === 'csv') {
                opts.push({ value: 'csv2xlsx', text: 'CSV → Excel (XLSX)' });
            }
            if (first === 'xlsx' || first === 'xls') {
                opts.push({ value: 'xlsx2csv', text: 'Excel → CSV' });
                opts.push({ value: 'xlsx2pdf', text: 'Excel → PDF' });
            }
            if (first === 'ods') {
                opts.push({ value: 'ods2xlsx', text: 'ODS → Excel (XLSX)' });
                opts.push({ value: 'xlsx2csv', text: 'ODS → CSV' });
                opts.push({ value: 'xlsx2pdf', text: 'ODS → PDF' });
            }
            if (first === 'docx') {
                opts.push({ value: 'docx2html', text: 'Word (DOCX) → HTML' });
                opts.push({ value: 'docx2pdf', text: 'Word (DOCX) → PDF' });
            }
            if (first === 'pdf' && files.length === 1) {
                opts.push({ value: 'pdf2text', text: 'PDF → Texte' });
                opts.push({ value: 'pdf2images', text: 'PDF → Images (PNG)' });
                opts.push({ value: 'pdfmerge', text: 'Fusionner des PDF (ajoutez d’autres fichiers)' });
            }
            if (first === 'html' || first === 'htm') {
                opts.push({ value: 'html2pdf', text: 'HTML → PDF' });
            }
            if (opts.length === 1) {
                opts[0].text = '-- Aucune conversion disponible pour ce format --';
            }
            return opts;
        }

        function fillConversionOptions(files) {
            var opts = optionsFor(files);
            convertType.innerHTML = '';
            opts.forEach(function (opt) {
                var o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.text;
                convertType.appendChild(o);
            });
        }

        function readFileAsArrayBuffer(file) {
            return new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onload = function () { resolve(reader.result); };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        }

        function loadWorkbook(file) {
            return readFileAsArrayBuffer(file).then(function (buf) {
                return XLSX.read(new Uint8Array(buf), { type: 'array' });
            });
        }

        function selectedSheet(wb) {
            var name = sheetSelect.value || (wb && wb.SheetNames[0]);
            return wb.Sheets[name];
        }

        function refreshSheetSelect(wb) {
            sheetSelect.innerHTML = '';
            (wb.SheetNames || []).forEach(function (name) {
                var o = document.createElement('option');
                o.value = name;
                o.textContent = name;
                sheetSelect.appendChild(o);
            });
            sheetOpt.hidden = !wb.SheetNames || wb.SheetNames.length < 1;
        }

        function validateFiles(files) {
            var list = Array.prototype.slice.call(files || []);
            if (!list.length) return { ok: false, message: 'Sélectionnez un fichier à convertir.' };
            var tooBig = list.filter(function (f) { return f.size > MAX_BYTES; });
            if (tooBig.length) {
                return {
                    ok: false,
                    message: 'Fichier trop volumineux (max. 10 Mo) : ' + tooBig.map(function (f) {
                        return f.name + ' (' + formatSize(f.size) + ')';
                    }).join(', ')
                };
            }
            var docFiles = list.filter(function (f) { return extOf(f.name) === 'doc'; });
            if (docFiles.length) {
                return {
                    ok: false,
                    doc: true,
                    message: 'Ce fichier .doc (ancien format Word) n’est pas supporté. Enregistrez-le au format .docx depuis Word : Fichier → Enregistrer sous → Document Word (*.docx).'
                };
            }
            return { ok: true, files: list };
        }

        function showFileMeta(files) {
            fileMeta.hidden = false;
            fileMeta.innerHTML = files.map(function (f) {
                var over = f.size > MAX_BYTES;
                return '<span class="conv-chip' + (over ? ' conv-chip-warn' : '') + '">' +
                    escapeHtml(f.name) + ' · ' + formatSize(f.size) +
                    (over ? ' — trop volumineux' : '') + '</span>';
            }).join('');
        }

        function showOriginalPreview(files) {
            var file = files[0];
            var ext = extOf(file.name);
            previewOriginal.innerHTML = '<p class="plan-empty-msg">Chargement de l’aperçu…</p>';
            previewConverted.innerHTML = '<p class="plan-empty-msg">Sélectionnez un format de conversion puis cliquez sur Convertir.</p>';
            lastOriginalRows = null;
            lastConvertedRows = null;
            csvOpt.hidden = ext !== 'csv';
            sheetOpt.hidden = ['xlsx', 'xls', 'ods'].indexOf(ext) === -1;
            workbookCache = null;

            if (ext === 'doc') {
                previewOriginal.innerHTML = '<p class="conv-error">' +
                    'Ce fichier .doc (ancien format Word) n’est pas supporté. Enregistrez-le au format .docx depuis Word (Fichier → Enregistrer sous).</p>';
                return;
            }
            if (ext === 'pdf') {
                previewOriginal.innerHTML = '<iframe class="conv-iframe" src="' + URL.createObjectURL(file) + '" title="Aperçu PDF"></iframe>';
                return;
            }
            if (['jpg', 'jpeg', 'png', 'webp'].indexOf(ext) !== -1) {
                previewOriginal.innerHTML = files.map(function (f) {
                    return '<img class="conv-thumb" src="' + URL.createObjectURL(f) + '" alt="' + escapeHtml(f.name) + '">';
                }).join('');
                return;
            }
            if (ext === 'html' || ext === 'htm') {
                file.text().then(function (html) {
                    previewOriginal.innerHTML = '<div class="conv-html-preview">' + html + '</div>';
                });
                return;
            }
            if (ext === 'csv') {
                readFileAsArrayBuffer(file).then(function (buf) {
                    var text = decodeBuffer(buf);
                    var delim = delimiterSelect.value === 'auto' ? detectDelimiter(text) : (delimiterSelect.value === 'tab' ? '\t' : delimiterSelect.value);
                    lastOriginalRows = parseCsv(text, delim);
                    previewOriginal.innerHTML = rowsToHtml(lastOriginalRows);
                });
                return;
            }
            if (['xlsx', 'xls', 'ods'].indexOf(ext) !== -1) {
                loadWorkbook(file).then(function (wb) {
                    workbookCache = wb;
                    refreshSheetSelect(wb);
                    lastOriginalRows = sheetToRows(selectedSheet(wb));
                    previewOriginal.innerHTML = rowsToHtml(lastOriginalRows);
                }).catch(function (err) {
                    previewOriginal.innerHTML = '<p class="conv-error">Erreur de lecture : ' + escapeHtml(err.message) + '</p>';
                });
                return;
            }
            if (ext === 'docx') {
                readFileAsArrayBuffer(file).then(function (buf) {
                    if (!window.mammoth) {
                        previewOriginal.innerHTML = '<p class="conv-error">Bibliothèque Mammoth non chargée.</p>';
                        return;
                    }
                    return mammoth.convertToHtml({ arrayBuffer: buf }).then(function (result) {
                        previewOriginal.innerHTML = '<div class="conv-html-preview">' + result.value + '</div>';
                    });
                }).catch(function (err) {
                    previewOriginal.innerHTML = '<p class="conv-error">Erreur : ' + escapeHtml(err.message) + '</p>';
                });
                return;
            }
            previewOriginal.innerHTML = '<p class="plan-empty-msg">Aperçu non disponible pour ce type de fichier.</p>';
        }

        function handleFiles(fileList) {
            var check = validateFiles(fileList);
            hideDownload();
            setResult('');
            if (!check.ok) {
                currentFiles = Array.prototype.slice.call(fileList || []);
                showFileMeta(currentFiles);
                fillConversionOptions(currentFiles);
                setResult(check.message, 'error');
                if (check.doc) {
                    previewOriginal.innerHTML = '<p class="conv-error">' + escapeHtml(check.message) + '</p>';
                }
                return;
            }
            currentFiles = check.files;
            showFileMeta(currentFiles);
            fillConversionOptions(currentFiles);
            showOriginalPreview(currentFiles);
        }

        dropzone.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
        });
        ['dragenter', 'dragover'].forEach(function (ev) {
            dropzone.addEventListener(ev, function (e) {
                e.preventDefault();
                dropzone.classList.add('is-dragover');
            });
        });
        ['dragleave', 'drop'].forEach(function (ev) {
            dropzone.addEventListener(ev, function (e) {
                e.preventDefault();
                dropzone.classList.remove('is-dragover');
            });
        });
        dropzone.addEventListener('drop', function (e) {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                handleFiles(e.dataTransfer.files);
            }
        });
        fileInput.addEventListener('change', function () {
            if (fileInput.files.length) handleFiles(fileInput.files);
        });

        delimiterSelect.addEventListener('change', function () {
            if (currentFiles[0] && extOf(currentFiles[0].name) === 'csv') showOriginalPreview(currentFiles);
        });
        sheetSelect.addEventListener('change', function () {
            if (!workbookCache) return;
            lastOriginalRows = sheetToRows(selectedSheet(workbookCache));
            previewOriginal.innerHTML = rowsToHtml(lastOriginalRows);
        });

        container.querySelector('#fullscreen-original').addEventListener('click', function () {
            showFullscreen(previewOriginal);
        });
        container.querySelector('#fullscreen-converted').addEventListener('click', function () {
            showFullscreen(previewConverted);
        });
        container.querySelector('#close-fullscreen').addEventListener('click', function () {
            fullscreenModal.hidden = true;
        });
        fullscreenModal.addEventListener('click', function (e) {
            if (e.target === fullscreenModal) fullscreenModal.hidden = true;
        });

        function showFullscreen(element) {
            fullscreenContent.innerHTML = element.innerHTML;
            fullscreenModal.hidden = false;
            Array.prototype.forEach.call(fullscreenContent.querySelectorAll('iframe'), function (iframe) {
                iframe.style.width = '100%';
                iframe.style.minHeight = 'calc(100vh - 80px)';
                iframe.style.border = 'none';
            });
        }

        function showTabularComparison() {
            if (!lastOriginalRows || !lastConvertedRows) return;
            var diffs = diffMaps(lastOriginalRows, lastConvertedRows);
            var hasDiff = diffs.some(function (row) { return row.some(Boolean); });
            previewOriginal.innerHTML = rowsToHtml(lastOriginalRows, diffs);
            previewConverted.innerHTML = rowsToHtml(lastConvertedRows, diffs);
            if (hasDiff) {
                previewConverted.insertAdjacentHTML('afterbegin',
                    '<p class="conv-diff-legend">Les cellules surlignées diffèrent de l’original (séparateur, feuille ou encodage).</p>');
            }
        }

        convertBtn.addEventListener('click', function () {
            if (!currentFiles.length) {
                setResult('Sélectionnez un fichier à convertir.', 'error');
                return;
            }
            var check = validateFiles(currentFiles);
            if (!check.ok) {
                setResult(check.message, 'error');
                return;
            }
            var type = convertType.value;
            if (!type) {
                setResult('Sélectionnez un format de conversion.', 'error');
                return;
            }
            hideDownload();
            performConversion(type).catch(function (err) {
                hideProgress();
                setResult('Erreur : ' + escapeHtml(err.message || err), 'error');
            });
        });

        function performConversion(type) {
            var file = currentFiles[0];
            setProgress(12, 'Préparation…');
            if (type === 'csv2xlsx') return convertCSVtoXLSX(file);
            if (type === 'xlsx2csv') return convertSheetToCSV(file);
            if (type === 'xlsx2pdf') return convertSheetToPDF(file);
            if (type === 'ods2xlsx') return convertODStoXLSX(file);
            if (type === 'docx2html') return convertDOCXtoHTML(file);
            if (type === 'docx2pdf') return convertDOCXtoPDF(file);
            if (type === 'pdf2text') return convertPDFtoText(file);
            if (type === 'pdf2images') return convertPDFtoImages(file);
            if (type === 'pdfmerge') return mergePdfs(currentFiles);
            if (type === 'images2pdf') return convertImagesToPdf(currentFiles);
            if (type === 'html2pdf') return convertHTMLtoPDF(file);
            return Promise.reject(new Error('Type de conversion non supporté.'));
        }

        function convertCSVtoXLSX(file) {
            return readFileAsArrayBuffer(file).then(function (buf) {
                setProgress(40, 'Analyse du CSV…');
                var text = decodeBuffer(buf);
                var delim = delimiterSelect.value === 'auto' ? detectDelimiter(text) : (delimiterSelect.value === 'tab' ? '\t' : delimiterSelect.value);
                var rows = parseCsv(text, delim);
                lastOriginalRows = rows;
                lastConvertedRows = rows.map(function (r) { return r.slice(); });
                var wb = XLSX.utils.book_new();
                var ws = XLSX.utils.aoa_to_sheet(rows);
                XLSX.utils.book_append_sheet(wb, ws, 'Feuille1');
                setProgress(80, 'Génération Excel…');
                var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                showTabularComparison();
                setupDownload(new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), file.name.replace(/\.csv$/i, '.xlsx'));
                hideProgress();
                setResult('Conversion CSV → Excel terminée.', 'ok');
            });
        }

        function getWorkbook(file) {
            if (workbookCache) return Promise.resolve(workbookCache);
            return loadWorkbook(file).then(function (wb) {
                workbookCache = wb;
                refreshSheetSelect(wb);
                return wb;
            });
        }

        function convertSheetToCSV(file) {
            return getWorkbook(file).then(function (wb) {
                setProgress(50, 'Export CSV…');
                var ws = selectedSheet(wb);
                lastOriginalRows = sheetToRows(ws);
                var csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
                lastConvertedRows = parseCsv(csv, ';');
                showTabularComparison();
                setupDownload(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), file.name.replace(/\.(xlsx|xls|ods)$/i, '.csv'));
                hideProgress();
                setResult('Conversion Excel → CSV terminée (séparateur ; , UTF-8).', 'ok');
            });
        }

        function convertSheetToPDF(file) {
            return getWorkbook(file).then(function (wb) {
                setProgress(45, 'Mise en page du tableau…');
                var ws = selectedSheet(wb);
                var rows = sheetToRows(ws);
                lastOriginalRows = rows;
                lastConvertedRows = rows;
                previewConverted.innerHTML = rowsToHtml(rows);
                var JsPDF = getJsPdf();
                if (!JsPDF) throw new Error('jsPDF non chargé');
                var pdf = new JsPDF('l', 'mm', 'a4');
                var head = rows.length ? [rows[0]] : [];
                var body = rows.slice(1);
                if (typeof pdf.autoTable === 'function') {
                    pdf.autoTable({
                        head: head,
                        body: body,
                        styles: { fontSize: 8, cellPadding: 1.5 },
                        headStyles: { fillColor: [37, 99, 235] }
                    });
                } else {
                    var y = 10;
                    pdf.setFontSize(9);
                    rows.forEach(function (row) {
                        pdf.text(row.map(String).join('  |  ').slice(0, 180), 10, y);
                        y += 6;
                        if (y > 190) { pdf.addPage(); y = 10; }
                    });
                }
                setProgress(90, 'Génération PDF…');
                setupDownload(pdf.output('blob'), file.name.replace(/\.(xlsx|xls|ods)$/i, '.pdf'));
                hideProgress();
                setResult('Conversion Excel → PDF terminée.', 'ok');
            });
        }

        function convertODStoXLSX(file) {
            return getWorkbook(file).then(function (wb) {
                setProgress(70, 'Conversion ODS → XLSX…');
                var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                var ws = selectedSheet(wb);
                lastOriginalRows = sheetToRows(ws);
                lastConvertedRows = lastOriginalRows;
                showTabularComparison();
                setupDownload(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), file.name.replace(/\.ods$/i, '.xlsx'));
                hideProgress();
                setResult('Conversion ODS → Excel terminée.', 'ok');
            });
        }

        function convertDOCXtoHTML(file) {
            if (!window.mammoth) return Promise.reject(new Error('Mammoth non chargé'));
            return readFileAsArrayBuffer(file).then(function (buf) {
                setProgress(40, 'Lecture du document Word…');
                return mammoth.convertToHtml({ arrayBuffer: buf });
            }).then(function (result) {
                var htmlContent = result.value;
                previewConverted.innerHTML = '<div class="conv-html-preview">' + htmlContent + '</div>';
                var blob = new Blob(
                    ['<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Converti</title></head><body>', htmlContent, '</body></html>'],
                    { type: 'text/html' }
                );
                setupDownload(blob, file.name.replace(/\.docx$/i, '.html'));
                hideProgress();
                setResult('Conversion Word → HTML terminée.', 'ok');
            });
        }

        function convertDOCXtoPDF(file) {
            if (!window.mammoth || !window.html2canvas) return Promise.reject(new Error('Bibliothèques manquantes'));
            return readFileAsArrayBuffer(file).then(function (buf) {
                setProgress(25, 'Lecture du document Word…');
                return mammoth.convertToHtml({ arrayBuffer: buf });
            }).then(function (result) {
                setProgress(50, 'Rendu des pages…');
                previewConverted.innerHTML = '<div class="conv-html-preview">' + result.value + '</div>';
                var temp = document.createElement('div');
                temp.className = 'conv-print-surface';
                temp.innerHTML = result.value;
                document.body.appendChild(temp);
                return htmlElementToPdf(temp).then(function (pdf) {
                    document.body.removeChild(temp);
                    setProgress(95, 'Assemblage du PDF…');
                    setupDownload(pdf.output('blob'), file.name.replace(/\.docx$/i, '.pdf'));
                    hideProgress();
                    setResult('Conversion Word → PDF terminée (document paginé).', 'ok');
                }).catch(function (err) {
                    if (temp.parentNode) document.body.removeChild(temp);
                    throw err;
                });
            });
        }

        function convertHTMLtoPDF(file) {
            if (!window.html2canvas) return Promise.reject(new Error('html2canvas non chargé'));
            return file.text().then(function (html) {
                setProgress(30, 'Rendu HTML…');
                previewConverted.innerHTML = '<div class="conv-html-preview">' + html + '</div>';
                var temp = document.createElement('div');
                temp.className = 'conv-print-surface';
                temp.innerHTML = html;
                document.body.appendChild(temp);
                return htmlElementToPdf(temp).then(function (pdf) {
                    document.body.removeChild(temp);
                    setupDownload(pdf.output('blob'), file.name.replace(/\.html?$/i, '.pdf'));
                    hideProgress();
                    setResult('Conversion HTML → PDF terminée.', 'ok');
                }).catch(function (err) {
                    if (temp.parentNode) document.body.removeChild(temp);
                    throw err;
                });
            });
        }

        function convertImagesToPdf(files) {
            var JsPDF = getJsPdf();
            if (!JsPDF) return Promise.reject(new Error('jsPDF non chargé'));
            var pdf = new JsPDF('p', 'mm', 'a4');
            var first = true;
            previewConverted.innerHTML = '';
            return files.reduce(function (chain, file, index) {
                return chain.then(function () {
                    setProgress(10 + (index / files.length) * 80, 'Page ' + (index + 1) + ' / ' + files.length);
                    return new Promise(function (resolve, reject) {
                        var img = new Image();
                        img.onload = function () {
                            var canvas = document.createElement('canvas');
                            canvas.width = img.naturalWidth || img.width;
                            canvas.height = img.naturalHeight || img.height;
                            canvas.getContext('2d').drawImage(img, 0, 0);
                            var dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                            var w = A4_WIDTH_MM;
                            var h = canvas.height * w / canvas.width;
                            if (h > A4_HEIGHT_MM) {
                                h = A4_HEIGHT_MM;
                                w = canvas.width * h / canvas.height;
                            }
                            if (!first) pdf.addPage();
                            first = false;
                            var x = (A4_WIDTH_MM - w) / 2;
                            var y = (A4_HEIGHT_MM - h) / 2;
                            pdf.addImage(dataUrl, 'JPEG', x, y, w, h);
                            previewConverted.insertAdjacentHTML('beforeend',
                                '<img class="conv-thumb" src="' + dataUrl + '" alt="' + escapeHtml(file.name) + '">');
                            resolve();
                        };
                        img.onerror = function () { reject(new Error('Impossible de lire ' + file.name)); };
                        img.src = URL.createObjectURL(file);
                    });
                });
            }, Promise.resolve()).then(function () {
                setupDownload(pdf.output('blob'), 'images.pdf');
                hideProgress();
                setResult('Conversion images → PDF terminée (' + files.length + ' page' + (files.length > 1 ? 's' : '') + ').', 'ok');
            });
        }

        function convertPDFtoText(file) {
            return ensurePdfJs().then(function (pdfjsLib) {
                setProgress(20, 'Lecture du PDF…');
                return readFileAsArrayBuffer(file).then(function (buf) {
                    return pdfjsLib.getDocument({ data: buf }).promise;
                });
            }).then(function (pdf) {
                var texts = [];
                var seq = Promise.resolve();
                for (var p = 1; p <= pdf.numPages; p++) {
                    (function (n) {
                        seq = seq.then(function () {
                            setProgress(20 + (n / pdf.numPages) * 70, 'Page ' + n + ' / ' + pdf.numPages);
                            return pdf.getPage(n).then(function (page) {
                                return page.getTextContent();
                            }).then(function (content) {
                                texts.push('--- Page ' + n + ' ---\n' + content.items.map(function (it) { return it.str; }).join(' '));
                            });
                        });
                    })(p);
                }
                return seq.then(function () { return texts.join('\n\n'); });
            }).then(function (text) {
                previewConverted.innerHTML = '<pre class="conv-pre">' + escapeHtml(text) + '</pre>';
                setupDownload(new Blob([text], { type: 'text/plain;charset=utf-8' }), file.name.replace(/\.pdf$/i, '.txt'));
                hideProgress();
                setResult('Extraction du texte terminée.', 'ok');
            });
        }

        function convertPDFtoImages(file) {
            return ensurePdfJs().then(function (pdfjsLib) {
                setProgress(15, 'Rendu des pages…');
                return readFileAsArrayBuffer(file).then(function (buf) {
                    return pdfjsLib.getDocument({ data: buf }).promise;
                });
            }).then(function (pdf) {
                var images = [];
                var seq = Promise.resolve();
                previewConverted.innerHTML = '';
                for (var p = 1; p <= pdf.numPages; p++) {
                    (function (n) {
                        seq = seq.then(function () {
                            setProgress(15 + (n / pdf.numPages) * 70, 'Page ' + n + ' / ' + pdf.numPages);
                            return pdf.getPage(n).then(function (page) {
                                var viewport = page.getViewport({ scale: 2 });
                                var canvas = document.createElement('canvas');
                                canvas.width = viewport.width;
                                canvas.height = viewport.height;
                                return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise.then(function () {
                                    images.push({ name: 'page-' + n + '.png', dataUrl: canvas.toDataURL('image/png') });
                                    previewConverted.insertAdjacentHTML('beforeend',
                                        '<img class="conv-thumb" src="' + canvas.toDataURL('image/png') + '" alt="Page ' + n + '">');
                                });
                            });
                        });
                    })(p);
                }
                return seq.then(function () { return images; });
            }).then(function (images) {
                if (images.length === 1) {
                    return fetch(images[0].dataUrl).then(function (r) { return r.blob(); }).then(function (blob) {
                        setupDownload(blob, file.name.replace(/\.pdf$/i, '.png'));
                    });
                }
                if (!window.JSZip) throw new Error('JSZip non chargé — impossible de regrouper les pages.');
                var zip = new JSZip();
                var chain = Promise.resolve();
                images.forEach(function (img) {
                    chain = chain.then(function () {
                        return fetch(img.dataUrl).then(function (r) { return r.blob(); }).then(function (blob) {
                            zip.file(img.name, blob);
                        });
                    });
                });
                return chain.then(function () { return zip.generateAsync({ type: 'blob' }); }).then(function (blob) {
                    setupDownload(blob, file.name.replace(/\.pdf$/i, '-pages.zip'));
                });
            }).then(function () {
                hideProgress();
                setResult('Conversion PDF → images terminée.', 'ok');
            });
        }

        function mergePdfs(files) {
            var pdfFiles = files.filter(function (f) { return extOf(f.name) === 'pdf'; });
            if (pdfFiles.length < 2) {
                return Promise.reject(new Error('Ajoutez au moins deux fichiers PDF pour les fusionner.'));
            }
            if (!window.PDFLib) return Promise.reject(new Error('pdf-lib non chargé'));
            setProgress(20, 'Fusion des PDF…');
            var merged = window.PDFLib.PDFDocument.create();
            return merged.then(function (doc) {
                var seq = Promise.resolve();
                pdfFiles.forEach(function (file, index) {
                    seq = seq.then(function () {
                        setProgress(20 + (index / pdfFiles.length) * 70, 'Ajout de ' + file.name);
                        return readFileAsArrayBuffer(file).then(function (buf) {
                            return window.PDFLib.PDFDocument.load(buf);
                        }).then(function (src) {
                            return doc.copyPages(src, src.getPageIndices());
                        }).then(function (pages) {
                            pages.forEach(function (page) { doc.addPage(page); });
                        });
                    });
                });
                return seq.then(function () { return doc.save(); });
            }).then(function (bytes) {
                var blob = new Blob([bytes], { type: 'application/pdf' });
                previewConverted.innerHTML = '<iframe class="conv-iframe" src="' + URL.createObjectURL(blob) + '" title="PDF fusionné"></iframe>';
                setupDownload(blob, 'fusion.pdf');
                hideProgress();
                setResult('Fusion de ' + pdfFiles.length + ' PDF terminée.', 'ok');
            });
        }
    };

    window.EprofConverter = { render: window.renderFileConverter };
})();
