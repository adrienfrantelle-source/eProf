// Emplois du temps par classe (images partagées, import admin).
(function () {
    const BUCKET = 'class-timetables';
    const MAX_BYTES = 5 * 1024 * 1024;
    const TYPES_OK = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function anneeScolaire() {
        try {
            return JSON.parse(localStorage.getItem('parametres') || '{}').anneeScolaire || '2026-2027';
        } catch (e) {
            return '2026-2027';
        }
    }

    function slugClasse(nom) {
        return String(nom || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase() || 'classe';
    }

    function extension(file) {
        const mime = (file && file.type) || '';
        if (mime === 'image/png') return 'png';
        if (mime === 'image/webp') return 'webp';
        if (mime === 'image/gif') return 'gif';
        return 'jpg';
    }

    function storagePath(classe, file) {
        return anneeScolaire() + '/' + slugClasse(classe) + '.' + extension(file);
    }

    async function isAdmin() {
        if (window.EprofAdmin && window.EprofAdmin.isCurrentUserAdmin) {
            try { return !!await window.EprofAdmin.isCurrentUserAdmin(); } catch (e) { return false; }
        }
        return false;
    }

    async function getRow(classe) {
        if (!window.EprofStore || !await window.EprofStore.isOnlineReady()) {
            return { data: null, error: new Error('Connectez-vous pour consulter les emplois du temps.') };
        }
        const { data, error } = await window.EprofStore.list('class_timetables', {
            filters: { classe: classe, annee_scolaire: anneeScolaire() }
        });
        if (error) return { data: null, error: error };
        return { data: data && data[0] ? data[0] : null, error: null };
    }

    async function listRows() {
        if (!window.EprofStore || !await window.EprofStore.isOnlineReady()) {
            return { data: [], error: new Error('Hors ligne') };
        }
        return window.EprofStore.list('class_timetables', {
            filters: { annee_scolaire: anneeScolaire() },
            orderBy: 'classe'
        });
    }

    async function signedUrl(path) {
        const { data, error } = await window.EprofStore.createSignedUrl(BUCKET, path, 3600);
        if (error || !data) return null;
        return data.signedUrl || null;
    }

    function compresser(file) {
        return new Promise(function (resolve, reject) {
            if (!file || !TYPES_OK.includes(file.type)) {
                reject(new Error('Formats acceptés : PNG, JPEG, WebP, GIF.'));
                return;
            }
            if (file.size <= 900000 && file.type !== 'image/png') {
                resolve(file);
                return;
            }
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = function () {
                URL.revokeObjectURL(url);
                const maxDim = 2000;
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                    const ratio = Math.min(maxDim / w, maxDim / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                canvas.toBlob(function (blob) {
                    if (!blob) {
                        resolve(file);
                        return;
                    }
                    resolve(new File([blob], (file.name || 'edt').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.85);
            };
            img.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('Impossible de lire cette image.'));
            };
            img.src = url;
        });
    }

    async function importer(classe, file) {
        if (!await isAdmin()) return { error: new Error('Seul l’administrateur peut importer un emploi du temps.') };
        if (!window.EprofStore || !await window.EprofStore.isOnlineReady()) {
            return { error: new Error('Connexion en ligne requise pour enregistrer l’emploi du temps.') };
        }
        let prepared;
        try {
            prepared = await compresser(file);
        } catch (err) {
            return { error: err };
        }
        if (prepared.size > MAX_BYTES) {
            return { error: new Error('Image trop lourde (maximum 5 Mo).') };
        }
        const existant = await getRow(classe);
        if (existant.error) return existant;
        const path = storagePath(classe, prepared);
        if (existant.data && existant.data.storage_path && existant.data.storage_path !== path) {
            await window.EprofStore.removeFile(BUCKET, existant.data.storage_path);
        }
        const up = await window.EprofStore.uploadFile(BUCKET, path, prepared, {
            upsert: true,
            contentType: prepared.type || 'image/jpeg'
        });
        if (up.error) return { error: up.error };
        const teacherId = await window.EprofStore.getTeacherId();
        const saved = await window.EprofStore.upsert('class_timetables', [{
            classe: classe,
            annee_scolaire: anneeScolaire(),
            storage_path: path,
            mime_type: prepared.type || 'image/jpeg',
            original_name: file.name || 'edt.jpg',
            uploaded_by: teacherId,
            updated_at: new Date().toISOString()
        }], { onConflict: 'classe,annee_scolaire' });
        if (saved.error) return { error: saved.error };
        if (window.EprofAdmin && window.EprofAdmin.logAction) {
            window.EprofAdmin.logAction('edt_importe', classe, { annee: anneeScolaire() });
        }
        return { error: null };
    }

    async function supprimer(classe) {
        if (!await isAdmin()) return { error: new Error('Seul l’administrateur peut supprimer un emploi du temps.') };
        const existant = await getRow(classe);
        if (existant.error) return existant;
        if (!existant.data) return { error: null };
        if (existant.data.storage_path) {
            await window.EprofStore.removeFile(BUCKET, existant.data.storage_path);
        }
        const { error } = await window.EprofStore.remove('class_timetables', existant.data.id);
        if (error) return { error: error };
        if (window.EprofAdmin && window.EprofAdmin.logAction) {
            window.EprofAdmin.logAction('edt_supprime', classe, { annee: anneeScolaire() });
        }
        return { error: null };
    }

    function fermerModale() {
        const existing = document.getElementById('calendar-image-modal');
        if (existing) existing.remove();
    }

    function openImageModal(opts) {
        fermerModale();
        const modal = document.createElement('div');
        modal.id = 'calendar-image-modal';
        modal.className = 'calendar-image-modal';
        const extra = opts.extraHeaderHtml || '';
        const corps = opts.src
            ? '<img alt="' + esc(opts.alt || '') + '" />'
            : '<p class="calendar-image-empty">' + (opts.emptyHtml || 'Aucune image.') + '</p>';
        modal.innerHTML =
            '<div class="calendar-image-backdrop" data-close="true"></div>' +
            '<div class="calendar-image-dialog">' +
                '<div class="calendar-image-header">' +
                    '<h3>' + opts.titre + '</h3>' +
                    '<div class="calendar-image-header-actions">' + extra +
                    '<button type="button" class="calendar-image-close" aria-label="Fermer">×</button></div>' +
                '</div>' +
                corps +
            '</div>';
        document.body.appendChild(modal);
        if (opts.src) {
            const img = modal.querySelector('img');
            if (img) img.src = opts.src;
        }
        modal.querySelector('.calendar-image-close').addEventListener('click', fermerModale);
        modal.querySelector('.calendar-image-backdrop').addEventListener('click', fermerModale);
        return modal;
    }

    function choisirFichier() {
        return new Promise(function (resolve) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/png,image/jpeg,image/webp,image/gif';
            input.addEventListener('change', function () {
                resolve(input.files && input.files[0] ? input.files[0] : null);
            });
            input.click();
        });
    }

    async function ouvrir(classe) {
        if (!classe) return;
        const admin = await isAdmin();
        const row = await getRow(classe);
        if (row.error && !admin) {
            alert(row.error.message || 'Impossible de charger l’emploi du temps.');
            return;
        }
        let src = null;
        if (row.data && row.data.storage_path) {
            src = await signedUrl(row.data.storage_path);
        }
        const extra = admin
            ? '<button type="button" class="btn-secondary edt-import-btn">📥 Importer</button>' +
              (src ? '<button type="button" class="btn-secondary edt-delete-btn">🗑️</button>' : '')
            : '';
        const empty = admin
            ? 'Aucun emploi du temps pour cette classe. Importez une image (PNG ou JPEG).'
            : 'Aucun emploi du temps n’a encore été importé pour cette classe.';
        const modal = openImageModal({
            titre: 'EDT — ' + esc(classe),
            src: src,
            alt: 'Emploi du temps ' + classe,
            extraHeaderHtml: extra,
            emptyHtml: empty
        });
        const importBtn = modal.querySelector('.edt-import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', async function () {
                const file = await choisirFichier();
                if (!file) return;
                importBtn.disabled = true;
                const result = await importer(classe, file);
                importBtn.disabled = false;
                if (result.error) {
                    alert(result.error.message || 'Import impossible.');
                    return;
                }
                ouvrir(classe);
            });
        }
        const deleteBtn = modal.querySelector('.edt-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async function () {
                if (!confirm('Supprimer l’emploi du temps de « ' + classe + ' » ?')) return;
                const result = await supprimer(classe);
                if (result.error) {
                    alert(result.error.message || 'Suppression impossible.');
                    return;
                }
                ouvrir(classe);
            });
        }
    }

    window.EprofOpenImageModal = openImageModal;
    window.EprofEdtClasses = {
        anneeScolaire: anneeScolaire,
        isAdmin: isAdmin,
        getRow: getRow,
        listRows: listRows,
        signedUrl: signedUrl,
        importer: importer,
        supprimer: supprimer,
        ouvrir: ouvrir,
        choisirFichier: choisirFichier
    };
})();
