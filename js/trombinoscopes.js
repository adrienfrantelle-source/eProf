/* Trombinoscopes — photos, recherche, impression, ouverture de la fiche suivi. */
(function (global) {
    var E = function () { return global.EprofEleves || {}; };

    function elevesPourTrombi(classe, listes) {
        var fromList = ((listes || {})[classe] || []).slice();
        if (fromList.length) return fromList;
        if (global.EprofTrombiPhotos && typeof global.EprofTrombiPhotos.studentsForClass === 'function') {
            return global.EprofTrombiPhotos.studentsForClass(classe) || [];
        }
        return [];
    }

    function matchesSearch(eleve, query) {
        if (!query) return true;
        var hay = E().fold((eleve.prenom || '') + ' ' + (eleve.nom || ''));
        return hay.indexOf(E().fold(query)) !== -1;
    }

    function renderTrombinoscopes(container) {
        var annee = E().getAnneeScolaire();
        var listes = E().getListsForTeacher();
        var classes = E().getVisibleTeacherClasses();

        if (!classes.length) {
            container.innerHTML =
                '<div id="suivi-eleves-module">' +
                '<h2>📸 Trombinoscopes - Année ' + annee + '</h2>' +
                E().emptyTeacherClassesHtml() +
                '</div>';
            return;
        }

        container.innerHTML =
            '<div id="suivi-eleves-module" class="trombi-module">' +
            '<h2>📸 Trombinoscopes - Année ' + annee + '</h2>' +
            '<div class="selection-classe-suivi">' +
            '<h3>Sélectionnez une classe</h3>' +
            '<div class="classes-grid">' +
            classes.map(function (classe) {
                return E().classeBtnHtml(classe, elevesPourTrombi(classe, listes).length);
            }).join('') +
            '</div></div>' +
            '<div id="trombi-contenu" class="trombi-contenu" hidden>' +
            '<div class="trombi-toolbar">' +
            '<h3 id="trombi-titre"></h3>' +
            '<div class="trombi-toolbar-actions">' +
            '<label class="trombi-search-wrap">🔍 <input type="search" id="trombi-recherche" class="trombi-search" placeholder="Rechercher un élève" aria-label="Rechercher un élève"></label>' +
            '<button type="button" id="trombi-imprimer" class="btn-secondary">🖨️ Imprimer</button>' +
            '<button type="button" id="trombi-retour" class="btn-secondary">← Retour</button>' +
            '</div></div>' +
            '<div id="trombi-grille" class="trombi-grille"></div>' +
            '</div></div>';

        var contenu = container.querySelector('#trombi-contenu');
        var selection = container.querySelector('.selection-classe-suivi');
        var grille = container.querySelector('#trombi-grille');
        var searchInput = container.querySelector('#trombi-recherche');
        var classeCourante = '';
        var elevesCourants = [];

        function paint() {
            var query = searchInput ? searchInput.value : '';
            var visibles = elevesCourants.filter(function (e) { return matchesSearch(e, query); });
            container.querySelector('#trombi-titre').textContent =
                classeCourante + ' — ' + visibles.length + ' élève(s)' +
                (query && visibles.length !== elevesCourants.length ? ' sur ' + elevesCourants.length : '');
            if (!visibles.length) {
                grille.innerHTML = '<p class="trombi-empty">Aucun élève ne correspond à la recherche.</p>';
                return;
            }
            grille.innerHTML = visibles.map(function (e) {
                var nomComplet = ((e.prenom || '') + ' ' + String(e.nom || '').toUpperCase()).trim();
                return '<button type="button" class="trombi-carte" data-eleve="' + nomComplet.replace(/"/g, '&quot;') + '">' +
                    E().photoHtml(classeCourante, e) +
                    '<div class="trombi-nom">' + (e.prenom || '') + '</div>' +
                    '<div class="trombi-nom-famille">' + (e.nom || '') + '</div>' +
                    '</button>';
            }).join('');
            grille.querySelectorAll('.trombi-carte').forEach(function (card) {
                card.addEventListener('click', function () {
                    E().openTool('eleves', {
                        classe: classeCourante,
                        eleve: card.getAttribute('data-eleve')
                    });
                });
            });
        }

        container.querySelectorAll('.classe-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                classeCourante = this.dataset.classe;
                elevesCourants = elevesPourTrombi(classeCourante, listes)
                    .sort(function (a, b) {
                        return (a.nom + a.prenom).localeCompare(b.nom + b.prenom);
                    });
                if (searchInput) searchInput.value = '';
                paint();
                selection.hidden = true;
                contenu.hidden = false;
                elevesCourants = await E().resolvePhotoUrls(elevesCourants, classeCourante);
                paint();
            });
        });

        if (searchInput) {
            searchInput.addEventListener('input', paint);
        }

        container.querySelector('#trombi-retour').addEventListener('click', function () {
            contenu.hidden = true;
            selection.hidden = false;
        });

        container.querySelector('#trombi-imprimer').addEventListener('click', function () {
            window.print();
        });
    }

    global.EprofTrombinoscopes = { render: renderTrombinoscopes };
})(window);
