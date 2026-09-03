/* Extraction autonome des trombinoscopes PDF (modèle Pronote : photo puis nom). */
(function (global) {
    var WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    var CLASS_CODES = {
        TSAPA: 'Tle SAPAT A',
        TSAPB: 'Tle SAPAT B'
    };

    function ensurePdfJs() {
        return new Promise(function (resolve, reject) {
            if (global.pdfjsLib) {
                if (global.pdfjsLib.GlobalWorkerOptions && !global.pdfjsLib.GlobalWorkerOptions.workerSrc) {
                    global.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
                }
                resolve(global.pdfjsLib);
                return;
            }
            reject(new Error('pdf.js n’est pas chargé.'));
        });
    }

    function fold(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/['’]/g, '')
            .replace(/--/g, '-')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    }

    function compact(value) {
        return fold(value).replace(/[^A-Z0-9]+/g, '');
    }

    function parseName(text) {
        var cleaned = String(text || '').replace(/\|/g, ' ').replace(/--/g, '-').replace(/\s+/g, ' ').trim();
        var parts = cleaned.split(' ');
        var nomParts = [];
        var prenomParts = [];
        var switched = false;
        parts.forEach(function (part) {
            var letters = fold(part).replace(/[^A-Z]/g, '');
            if (!switched && letters && letters === letters.toUpperCase() && part === part.toUpperCase()) {
                nomParts.push(part.replace(/--/g, '-'));
            } else {
                switched = true;
                prenomParts.push(part);
            }
        });
        if (!prenomParts.length && nomParts.length) prenomParts = [nomParts.pop()];
        return { nom: nomParts.join(' '), prenom: prenomParts.join(' ') };
    }

    function makeKey(nom, prenom) {
        return fold(nom) + '|' + fold(prenom);
    }

    function guessClasse(text, filename, classNames) {
        var header = String(text || '').match(/Classe\s*:\s*([A-Z0-9]+)/i);
        if (header) {
            var code = header[1].toUpperCase();
            if (CLASS_CODES[code]) return CLASS_CODES[code];
        }
        var fileKey = compact(filename || '');
        var names = classNames || [];
        var i;
        for (i = 0; i < names.length; i++) {
            if (fileKey.indexOf(compact(names[i])) !== -1) return names[i];
        }
        var codes = Object.keys(CLASS_CODES);
        for (i = 0; i < codes.length; i++) {
            if (fileKey.indexOf(compact(CLASS_CODES[codes[i]])) !== -1) return CLASS_CODES[codes[i]];
        }
        return '';
    }

    function multiply(a, b) {
        return [
            a[0] * b[0] + a[2] * b[1],
            a[1] * b[0] + a[3] * b[1],
            a[0] * b[2] + a[2] * b[3],
            a[1] * b[2] + a[3] * b[3],
            a[0] * b[4] + a[2] * b[5] + a[4],
            a[1] * b[4] + a[3] * b[5] + a[5]
        ];
    }

    function applyMat(m, x, y) {
        return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
    }

    function loadImageObj(page, name) {
        return new Promise(function (resolve) {
            var done = false;
            function finish(data) {
                if (done) return;
                if (data) {
                    done = true;
                    resolve(data);
                    return;
                }
                page.commonObjs.get(name, function (common) {
                    if (done) return;
                    done = true;
                    resolve(common || null);
                });
            }
            try {
                page.objs.get(name, finish);
            } catch (err) {
                finish(null);
            }
            setTimeout(function () {
                if (!done) finish(null);
            }, 1500);
        });
    }

    function imageToDataUrl(img) {
        if (!img || !img.width || !img.height) return null;
        var canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        var ctx = canvas.getContext('2d');
        if (img.bitmap) {
            ctx.drawImage(img.bitmap, 0, 0);
            return canvas.toDataURL('image/jpeg', 0.92);
        }
        var data = img.data;
        if (!data) return null;
        var imageData = ctx.createImageData(img.width, img.height);
        var dst = imageData.data;
        var i;
        var p = 0;
        if (data.length === img.width * img.height * 4) {
            dst.set(data);
        } else if (img.kind === 2 || data.length === img.width * img.height * 3) {
            for (i = 0; i < data.length; i += 3) {
                dst[p++] = data[i];
                dst[p++] = data[i + 1];
                dst[p++] = data[i + 2];
                dst[p++] = 255;
            }
        } else {
            for (i = 0; i < data.length; i++) {
                dst[p++] = data[i];
                dst[p++] = data[i];
                dst[p++] = data[i];
                dst[p++] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.92);
    }

    function collectNameBlocks(items, viewport) {
        var raw = [];
        items.forEach(function (item) {
            var str = (item.str || '').trim();
            if (!str) return;
            if (/^Classe/i.test(str)) return;
            if (/^\d{4}\s*-\s*\d{4}$/.test(str)) return;
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return;
            var tr = item.transform || [1, 0, 0, 1, 0, 0];
            var w = item.width || 0;
            var h = item.height || Math.abs(tr[3]) || 10;
            var x0 = tr[4];
            var y0 = tr[5];
            raw.push({
                text: str,
                x0: x0,
                y0: y0,
                x1: x0 + w,
                y1: y0 + h,
                cx: x0 + w / 2
            });
        });
        raw.sort(function (a, b) { return b.y0 - a.y0 || a.x0 - b.x0; });
        var blocks = [];
        raw.forEach(function (item) {
            var last = blocks[blocks.length - 1];
            if (last && Math.abs(item.cx - last.cx) < 40 && Math.abs(item.y0 - last.y0) < 14) {
                last.text += ' ' + item.text;
                last.x0 = Math.min(last.x0, item.x0);
                last.x1 = Math.max(last.x1, item.x1);
                last.y0 = Math.min(last.y0, item.y0);
                last.y1 = Math.max(last.y1, item.y1);
                last.cx = (last.x0 + last.x1) / 2;
            } else {
                blocks.push({
                    text: item.text,
                    x0: item.x0,
                    y0: item.y0,
                    x1: item.x1,
                    y1: item.y1,
                    cx: item.cx
                });
            }
        });
        return blocks.map(function (b) {
            var tl = viewport.convertToViewportPoint(b.x0, b.y1);
            var br = viewport.convertToViewportPoint(b.x1, b.y0);
            return {
                text: b.text,
                cx: b.cx,
                y0: b.y0,
                y1: b.y1,
                vx: Math.min(tl[0], br[0]),
                vy: Math.min(tl[1], br[1]),
                vw: Math.abs(br[0] - tl[0]),
                vh: Math.abs(br[1] - tl[1])
            };
        });
    }

    async function extractImages(page, pdfjsLib, viewport) {
        var ops = await page.getOperatorList();
        var current = [1, 0, 0, 1, 0, 0];
        var stack = [];
        var found = [];
        var fn, args, name, img, dataUrl, p0, p1, p2, p3, xs, ys;
        for (var i = 0; i < ops.fnArray.length; i++) {
            fn = ops.fnArray[i];
            args = ops.argsArray[i] || [];
            if (fn === pdfjsLib.OPS.save) {
                stack.push(current.slice());
            } else if (fn === pdfjsLib.OPS.restore) {
                current = stack.pop() || current;
            } else if (fn === pdfjsLib.OPS.transform) {
                current = multiply(current, args);
            } else if (
                fn === pdfjsLib.OPS.paintImageXObject ||
                fn === pdfjsLib.OPS.paintJpegXObject ||
                fn === pdfjsLib.OPS.paintInlineImageXObject
            ) {
                name = typeof args[0] === 'string' ? args[0] : null;
                img = name ? await loadImageObj(page, name) : args[0];
                if (!img || (img.width || 0) < 60 || (img.height || 0) < 80) continue;
                dataUrl = imageToDataUrl(img);
                if (!dataUrl) continue;
                p0 = applyMat(current, 0, 0);
                p1 = applyMat(current, 1, 0);
                p2 = applyMat(current, 1, 1);
                p3 = applyMat(current, 0, 1);
                xs = [p0.x, p1.x, p2.x, p3.x];
                ys = [p0.y, p1.y, p2.y, p3.y];
                var x0 = Math.min.apply(null, xs);
                var x1 = Math.max.apply(null, xs);
                var y0 = Math.min.apply(null, ys);
                var y1 = Math.max.apply(null, ys);
                found.push({
                    dataUrl: dataUrl,
                    cx: (x0 + x1) / 2,
                    y0: y0,
                    y1: y1,
                    width: img.width,
                    height: img.height
                });
            }
        }
        found.sort(function (a, b) { return b.y1 - a.y1 || a.cx - b.cx; });
        return found;
    }

    function matchNamesToImages(images, names) {
        var used = {};
        var students = [];
        images.forEach(function (img) {
            var candidates = [];
            names.forEach(function (block, idx) {
                if (used[idx]) return;
                if (block.y1 > img.y1 + 6) return;
                if (img.y0 - block.y1 > 58) return;
                if (Math.abs(block.cx - img.cx) > 58) return;
                candidates.push({
                    dist: Math.abs(block.cx - img.cx) + Math.max(0, img.y0 - block.y1) * 0.2,
                    idx: idx,
                    block: block
                });
            });
            if (!candidates.length) return;
            candidates.sort(function (a, b) { return a.dist - b.dist; });
            var parts = [];
            candidates.forEach(function (c) {
                if (Math.abs(c.block.cx - img.cx) <= 45) {
                    parts.push(c.block.text);
                    used[c.idx] = true;
                }
            });
            var parsed = parseName(parts.join(' '));
            if (!parsed.nom && !parsed.prenom) return;
            students.push({
                nom: parsed.nom,
                prenom: parsed.prenom,
                dataUrl: img.dataUrl
            });
        });
        return students;
    }

    async function fallbackCrops(page, viewport, names) {
        var canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
        var photoW = 53 * viewport.scale;
        var photoH = 71 * viewport.scale;
        var gap = 9 * viewport.scale;
        var students = [];
        names.forEach(function (block) {
            var parsed = parseName(block.text);
            if (!parsed.nom && !parsed.prenom) return;
            var cx = block.vx + block.vw / 2;
            var left = Math.round(cx - photoW / 2);
            var top = Math.round(block.vy - gap - photoH);
            if (left < 0 || top < 0) return;
            var crop = document.createElement('canvas');
            crop.width = Math.round(photoW);
            crop.height = Math.round(photoH);
            crop.getContext('2d').drawImage(
                canvas,
                left, top, crop.width, crop.height,
                0, 0, crop.width, crop.height
            );
            students.push({
                nom: parsed.nom,
                prenom: parsed.prenom,
                dataUrl: crop.toDataURL('image/jpeg', 0.92)
            });
        });
        return students;
    }

    function matchStudent(nom, prenom, liste) {
        var list = liste || [];
        var key = makeKey(nom, prenom);
        var i;
        var nNom = fold(nom);
        var nPrenom = fold(prenom);
        for (i = 0; i < list.length; i++) {
            if (makeKey(list[i].nom, list[i].prenom) === key) return list[i];
        }
        var hits = [];
        for (i = 0; i < list.length; i++) {
            if (fold(list[i].nom) === nNom && (
                fold(list[i].prenom).indexOf(nPrenom) !== -1 ||
                nPrenom.indexOf(fold(list[i].prenom)) !== -1
            )) hits.push(list[i]);
        }
        if (hits.length === 1) return hits[0];
        hits = [];
        for (i = 0; i < list.length; i++) {
            if (fold(list[i].nom) === nNom) hits.push(list[i]);
        }
        return hits.length === 1 ? hits[0] : null;
    }

    function dataUrlToBlob(dataUrl) {
        var parts = String(dataUrl || '').split(',');
        var mimeMatch = parts[0] && parts[0].match(/:(.*?);/);
        var mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        var bin = atob(parts[1] || '');
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: mime });
    }

    async function parseFile(file, options) {
        options = options || {};
        var pdfjsLib = await ensurePdfJs();
        var buf = await file.arrayBuffer();
        var pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        var students = [];
        var fullText = [];
        var page, viewport, textContent, names, images, pageStudents, i;
        for (i = 1; i <= pdf.numPages; i++) {
            page = await pdf.getPage(i);
            viewport = page.getViewport({ scale: 1 });
            textContent = await page.getTextContent();
            fullText.push(textContent.items.map(function (it) { return it.str; }).join(' '));
            names = collectNameBlocks(textContent.items, viewport);
            images = await extractImages(page, pdfjsLib, viewport);
            pageStudents = matchNamesToImages(images, names);
            if (!pageStudents.length) {
                viewport = page.getViewport({ scale: 2 });
                names = collectNameBlocks(textContent.items, viewport);
                pageStudents = await fallbackCrops(page, viewport, names);
            }
            students = students.concat(pageStudents);
        }
        return {
            classe: guessClasse(fullText.join('\n'), file && file.name, options.classNames),
            students: students
        };
    }

    global.EprofTrombiPdf = {
        CLASS_CODES: CLASS_CODES,
        fold: fold,
        parseName: parseName,
        makeKey: makeKey,
        guessClasse: guessClasse,
        matchStudent: matchStudent,
        dataUrlToBlob: dataUrlToBlob,
        parseFile: parseFile
    };
})(window);
