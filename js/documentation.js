// ===== DOCUMENTATION =====
// Tutoriels pour les nouveaux utilisateurs. Ouverture depuis le bouton du footer.

(function () {
    const TUTOS = [
        {
            id: 'demarrage',
            icon: '🚀',
            title: 'Premiers pas',
            lead: 'Les 5 minutes essentielles pour commencer à utiliser eProf.',
            tool: null,
            steps: [
                'Connectez-vous avec l’identifiant fourni par l’établissement (sans taper @jeannedelanoue.com : il est déjà ajouté).',
                'À la première connexion, choisissez vos classes et, si besoin, les matières associées. Vous pourrez les modifier plus tard dans Paramètres.',
                'Vérifiez le badge en haut à droite : <strong>🟢 En ligne</strong> signifie que vos données se synchronisent. <strong>⚪ Hors ligne</strong> : vous pouvez continuer, la synchro reprendra ensuite.',
                'L’accueil et le menu de gauche donnent accès à tous les outils. En haut de l’accueil : prochains rendez-vous, vos classes et les outils récemment ouverts. Cliquez une carte ou un lien pour ouvrir un module. Le bouton ◀ en haut du menu réduit la barre latérale pour gagner de la place.',
                'Revenez ici dès que vous avez un doute : chaque tutoriel décrit un outil, étape par étape.'
            ],
            tip: 'Une idée ou un blocage ? Le bouton « Suggestions & bugs » du footer transmet votre message à l’administrateur.'
        },
        {
            id: 'parametres',
            icon: '⚙️',
            title: 'Paramètres',
            lead: 'Configurez votre profil, vos classes, l’affichage et le barème.',
            tool: 'parametres',
            steps: [
                'Ouvrez <strong>Paramètres</strong> dans le menu ou depuis l’accueil. Le sommaire en haut permet d’aller directement à une section ; chaque bloc se replie.',
                'Renseignez nom, prénom, matière et e-mail. En ligne, le profil de l’établissement est utilisé en priorité.',
                'Cliquez <strong>Gérer mes classes et matières</strong> : cochez vos classes à gauche (groupées par niveau), puis leurs matières à droite.',
                'Choisissez l’année scolaire (trombinoscopes, vacances du calendrier) puis le thème, la taille de police et le mode mobile — l’aperçu est immédiat.',
                'Dans Calendrier, réglez la plage horaire, les lignes de début/fin de journée, les récréations et l’éventuel samedi. Dans Notation, choisissez le barème (sur 20 ou sur 10) et les seuils d’alertes (oublis, mots) utilisés dans le suivi.',
                'La section « Mon compte » permet de changer l’identifiant ou le mot de passe. Le bouton Enregistrer, toujours visible en bas, sauvegarde le reste.'
            ],
            tip: 'Sans classes sélectionnées, plusieurs outils restent vides. C’est presque toujours la première chose à régler.'
        },
        {
            id: 'calendrier',
            icon: '📅',
            title: 'Calendrier',
            lead: 'Planning de la semaine, emploi du temps et documents de l’année.',
            tool: 'calendar',
            steps: [
                'Ouvrez <strong>Calendrier</strong> dans le menu ou depuis l’accueil.',
                'Cliquez-glissez sur le planning pour créer un événement aux bons horaires, ou le bouton <strong>Nouvel événement</strong>.',
                'Renseignez l’intitulé, la nature (cours, tâche, rendez-vous…), éventuellement la classe, la couleur et un rappel.',
                'Pour un cours d’emploi du temps, cochez <strong>Répéter chaque semaine</strong>, les jours (ils passent en bleu) et éventuellement <strong>semaine A</strong> (n° pair) ou <strong>B</strong> (n° impair). La série s’arrête aux vacances d’été et saute les vacances et jours fériés.',
                'Cliquez un cours récurrent : vous pouvez modifier ou supprimer <strong>cette séance</strong> seulement, ou toute la série. Un glisser-déposer ne change que la séance déplacée.',
                'Le menu <strong>Emploi du temps</strong> permet d’importer/exporter un CSV et d’exporter un fichier iCal (.ics).',
                'Le menu <strong>Calendrier scolaire</strong> ouvre le calendrier de l’année (Zone B), les dates de stage et les périodes.',
                'Filtrez par classe ou par nature. Les heures affichées, le samedi et les pauses se règlent dans Paramètres → Calendrier.'
            ],
            tip: 'L’agenda liste les mêmes événements. Un changement d’un côté se retrouve de l’autre.'
        },
        {
            id: 'agenda',
            icon: '🗓️',
            title: 'Agenda',
            lead: 'Vos prochains cours, tâches et rendez-vous, avec rappels si vous le souhaitez.',
            tool: 'agenda',
            steps: [
                'Ouvrez <strong>Agenda</strong> dans le menu de gauche.',
                'Vous y voyez d’abord <strong>aujourd’hui</strong>, puis les jours qui viennent. Les retards sont repliés en bas pour ne pas masquer la suite.',
                'Ajoutez une entrée : même formulaire que le calendrier (horaire ou journée, répétition hebdomadaire, classe, couleur).',
                'Cochez « journée ou période » pour un événement sans horaire. La date de fin est le dernier jour inclus.',
                'Activez un rappel si vous voulez une notification (l’application doit rester ouverte).',
                'Les tâches peuvent être marquées comme terminées. Les cours et rendez-vous restent dans le planning.'
            ],
            tip: 'L’agenda et le calendrier partagent les mêmes événements : une modification d’un côté se retrouve de l’autre.'
        },
        {
            id: 'notes',
            icon: '📒',
            title: 'Carnet de notes',
            lead: 'Saisissez les évaluations, calculez les moyennes et suivez les absences.',
            tool: 'notes',
            steps: [
                'Ouvrez <strong>Carnet de notes</strong> : l’outil s’ouvre dans un nouvel onglet.',
                'Choisissez la classe, puis créez une évaluation (nom, date, coefficient, barème).',
                'Saisissez les notes dans le tableau. Tapez <strong>a</strong> pour une absence : elle est convertie automatiquement.',
                'La colonne <strong>Moy.</strong>, juste à droite du nom, affiche la moyenne générale de la période choisie, sans ouvrir la fiche de l’élève. Les moyennes par matière restent en fin de groupe.',
                'Vous pouvez exporter ou imprimer une fiche, et revenir à eProf sans perdre le carnet (sauvegarde en ligne si vous êtes connecté).'
            ],
            tip: 'Les moyennes d’un élève sont aussi visibles dans le suivi des élèves, onglet « Moyennes ».'
        },
        {
            id: 'eleves',
            icon: '👨‍🎓',
            title: 'Suivi des élèves',
            lead: 'Oublis de matériel, mots à mettre, notes personnelles et aperçu des moyennes, classe par classe.',
            tool: 'eleves',
            steps: [
                'Ouvrez <strong>Suivi des élèves</strong> et cliquez la classe concernée.',
                'Cliquez un élève pour ouvrir sa fiche.',
                'Onglet <strong>Oublis</strong> : cochez le matériel manquant (manuel, cours, travail non fait…), choisissez la date, puis Ajouter.',
                'Onglet <strong>Mots à mettre</strong> : saisissez le motif et la date.',
                'Onglet <strong>Notes</strong> : ajoutez des observations personnelles. Elles se synchronisent en ligne pour votre compte uniquement.',
                'Onglet <strong>Moyennes</strong> : consultez les résultats issus du carnet de notes.',
                'Depuis la classe, générez une <strong>liste d’émargement</strong> ou une <strong>fiche de suivi</strong> (classe entière ou un élève, en choisissant oublis, mots, notes et moyennes).'
            ],
            tip: 'Les badges rouges apparaissent quand le nombre d’oublis ou de mots dépasse le seuil fixé dans Paramètres.'
        },
        {
            id: 'plan-classe',
            icon: '🪑',
            title: 'Plan de classe',
            lead: 'Placez les élèves dans la salle, en organisation par défaut ou personnalisée.',
            tool: 'plan-classe',
            steps: [
                'Ouvrez <strong>Plan de classe</strong>, puis déployez <strong>Configuration de la classe</strong>.',
                'Choisissez une organisation par défaut, ou une organisation personnalisée (nombre de places, clic pour poser les tables).',
                'Importez les élèves : liste enregistrée de vos classes, import brut (un nom par ligne) ou fichier Excel.',
                'Glissez un élève sur une table. Cliquez une table pour la griser (place inactive).',
                'Enregistrez le plan pour le retrouver plus tard (image ou fichier proposé par l’outil).'
            ],
            tip: 'Les listes officielles sont importées par l’administrateur. Si une classe manque, vérifiez vos classes dans Paramètres.'
        },
        {
            id: 'trombinoscopes',
            icon: '📸',
            title: 'Trombinoscopes',
            lead: 'Retrouvez les photos des élèves de vos classes.',
            tool: 'trombinoscopes',
            steps: [
                'Ouvrez <strong>Trombinoscopes</strong> dans le menu.',
                'Sélectionnez une de vos classes pour afficher la grille de photos.',
                'Utilisez le trombinoscope pour mémoriser les prénoms ou préparer un appel visuel.',
                'Les archives (anciennes années) sont réservées à l’administrateur.'
            ],
            tip: 'Si une classe n’apparaît pas, elle n’est probablement pas cochée dans votre configuration enseignant.'
        },
        {
            id: 'jeu',
            icon: '🎮',
            title: 'Jeux pédagogiques',
            lead: 'Rangez vos liens de jeux (Genially, LearningApps, Wordwall…) dans des dossiers.',
            tool: 'jeu',
            steps: [
                'Ouvrez <strong>Jeux pédagogiques</strong>.',
                'Dans « Ajouter un jeu », saisissez un titre et une adresse http(s), choisissez un dossier, puis Ajouter.',
                'Créez un dossier (Quiz, Géographie…) pour classer vos activités.',
                'Cliquez une carte pour lancer le jeu dans un nouvel onglet.',
                'Glissez une carte pour changer l’ordre ou de dossier. Les boutons ✏️ et 🗑️ du dossier permettent de le renommer ou de le supprimer : les jeux déjà enregistrés gardent leur titre et leur lien (ils passent dans Général si le dossier est supprimé).'
            ],
            tip: 'Le bouton « Sauvegarder la liste » exporte un fichier à remettre dans js/ si vous voulez une copie portable hors ligne.'
        },
        {
            id: 'ressources',
            icon: '📚',
            title: 'Ressources pédagogiques',
            lead: 'Vos liens de cours, en privé ou partagés avec les collègues.',
            tool: 'ressources',
            steps: [
                'Ouvrez <strong>Ressources pédagogiques</strong>.',
                'Ajoutez un titre et un lien, puis choisissez le dossier de destination.',
                'Créez un dossier <strong>privé</strong> (visible par vous seul) ou <strong>public</strong> (visible par tous les enseignants).',
                'Le dossier ministériel / officiel est géré par l’administrateur.',
                'Sur un dossier à vous : ✏️ pour renommer ou changer privé/public, 🗑️ pour le supprimer. Les cartes déjà enregistrées ne changent pas de contenu ; elles vont dans Général si le dossier est retiré.',
                'Sur un dossier partagé par un collègue, utilisez <strong>Masquer</strong> s’il ne vous est pas utile. Vous pourrez le réafficher plus tard.'
            ],
            tip: 'Vous pouvez aussi modifier le titre ou le lien d’une ressource avec le crayon sur la carte, sans toucher aux autres.'
        },
        {
            id: 'messagerie',
            icon: '💬',
            title: 'Messagerie',
            lead: 'Échangez en interne avec vos collègues, sans quitter eProf.',
            tool: 'messagerie',
            steps: [
                'Ouvrez <strong>Messagerie</strong> dans le menu. Un badge indique les messages non lus.',
                'Choisissez une discussion existante, ou démarrez une conversation avec un collègue.',
                'Saisissez votre message et envoyez-le. La conversation se met à jour pour les deux côtés.',
                'Revenez régulièrement : le badge du menu se met à jour même depuis un autre outil.'
            ],
            tip: 'La messagerie est interne à eProf. Pour Teams ou EcoleDirecte, utilisez les raccourcis en haut de page.'
        },
        {
            id: 'tableau-blanc',
            icon: '📋',
            title: 'Tableau blanc',
            lead: 'Un tableau de séance dans un onglet séparé : dessin, tirage d’élèves, chrono, dé… Les classes viennent du compte déjà connecté, sans nouvelle identification.',
            tool: 'tableau-blanc',
            steps: [
                'Cliquez <strong>Tableau blanc</strong> : l’outil s’ouvre dans un nouvel onglet.',
                'Le bouton <strong>✏️</strong> ouvre une grille d’outils (crayon, surligneur, formes, texte, laser, gomme), chacun nommé. Couleur (pastilles) et épaisseur restent collées à la barre, sans masquer le tableau.',
                '<strong>Ctrl+Z</strong> / <strong>Ctrl+Y</strong> annulent et rétablissent <em>sur la page en cours</em>. Les flèches changent de page. 💾 exporte la page avec le fond (image, ligné, PDF posé…).',
                'Dans <strong>🙋 Tirage</strong>, cochez une ou plusieurs classes, marquez les absents, et utilisez la file « déjà tirés ». Le bouton <strong>🎲</strong> est réservé au dé.',
                'Les groupes se glissent d’une carte à l’autre. Un PDF peut être posé en fond de page pour annoter par-dessus.',
                'Le bouton <strong>🏠 Retour</strong> reste toujours visible (haut gauche) et ramène à eProf. À côté, <strong>📌</strong> épingle les barres pour qu’elles ne se masquent plus. Sinon, survolez la pastille en bas pour ramener la barre ; un clic sur le tableau la masque.'
            ],
            tip: 'Plein écran : F11 ou 🖥️. Fonds dans ⚙️ : Images (dossier img), blanc, noir, ligné, quadrillé. Sur un fond sombre, le crayon passe automatiquement en blanc si vous n’avez pas choisi une autre couleur.'
        },
        {
            id: 'converter',
            icon: '🔄',
            title: 'Conversion de fichiers',
            lead: 'Convertissez un document (Word, Excel, PDF, image…) sans quitter la plateforme.',
            tool: 'converter',
            steps: [
                'Ouvrez <strong>Conversion de fichier</strong>.',
                'Déposez ou sélectionnez le fichier à convertir.',
                'Choisissez le format d’arrivée parmi les options proposées pour ce type de fichier.',
                'Cliquez <strong>Convertir</strong>, puis téléchargez le résultat.'
            ],
            tip: 'La conversion se fait dans le navigateur. Aucun fichier n’est stocké dans eProf après le téléchargement.'
        },
        {
            id: 'suggestions',
            icon: '💡',
            title: 'Suggestions et bugs',
            lead: 'Signalez un problème ou proposez une amélioration.',
            tool: null,
            steps: [
                'Cliquez <strong>Suggestions & bugs</strong> en bas de page (footer).',
                'Choisissez le type (bug, amélioration, nouveauté), le module concerné et l’importance.',
                'Donnez un titre court et décrivez ce que vous avez fait, ce que vous attendiez, et ce qui s’est passé.',
                'Envoyez. Vous pouvez suivre l’avancement de vos demandes dans la même fenêtre, et soutenir celles des collègues.'
            ],
            tip: 'Un message précis (outil, classe, action) aide à corriger plus vite. Pas besoin d’écrire à part : tout passe par ce bouton.'
        }
    ];

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function matchesQuery(tuto, query) {
        if (!query) return true;
        const blob = [tuto.title, tuto.lead].concat(tuto.steps).join(' ').toLowerCase();
        return blob.indexOf(query) !== -1;
    }

    function articleHtml(tuto) {
        if (!tuto) {
            return '<p class="docs-empty">Aucun tutoriel ne correspond à votre recherche.</p>';
        }
        const steps = tuto.steps.map(function (step) {
            return '<li>' + step + '</li>';
        }).join('');
        const openBtn = tuto.tool
            ? '<div class="docs-open-tool"><button type="button" class="btn-primary docs-open-btn" data-tool="' +
                escapeHtml(tuto.tool) + '">Ouvrir l’outil</button></div>'
            : '';
        const tip = tuto.tip ? '<p class="docs-tip">💡 ' + tuto.tip + '</p>' : '';
        return (
            '<h3>' + tuto.icon + ' ' + escapeHtml(tuto.title) + '</h3>' +
            '<p class="docs-article-lead">' + tuto.lead + '</p>' +
            '<ol class="docs-steps">' + steps + '</ol>' +
            tip +
            openBtn
        );
    }

    function render(container, options) {
        options = options || {};
        const openTool = typeof options.openTool === 'function' ? options.openTool : null;
        let selectedId = options.startId || 'demarrage';
        let query = '';

        container.innerHTML = `
            <div id="documentation-module">
                <h2>📖 Documentation</h2>
                <p class="docs-intro">Tutoriels pour prendre eProf en main. Choisissez un thème à gauche, puis suivez les étapes.</p>
                <div class="docs-layout">
                    <aside class="docs-nav">
                        <input type="search" class="docs-search" id="docs-search" placeholder="Rechercher un tutoriel…">
                        <div class="docs-nav-list" id="docs-nav-list"></div>
                    </aside>
                    <article class="docs-article" id="docs-article"></article>
                </div>
            </div>
        `;

        const nav = container.querySelector('#docs-nav-list');
        const article = container.querySelector('#docs-article');
        const search = container.querySelector('#docs-search');

        function tutoById(id) {
            return TUTOS.find(function (t) { return t.id === id; }) || null;
        }

        function paint() {
            const visibles = TUTOS.filter(function (t) { return matchesQuery(t, query); });
            if (visibles.length && !visibles.some(function (t) { return t.id === selectedId; })) {
                selectedId = visibles[0].id;
            }
            if (!visibles.length) selectedId = '';
            nav.innerHTML = visibles.length
                ? visibles.map(function (t) {
                    return (
                        '<button type="button" class="docs-nav-btn' + (t.id === selectedId ? ' is-active' : '') + '" data-id="' + t.id + '">' +
                        '<span class="docs-nav-icon">' + t.icon + '</span>' +
                        '<span>' + escapeHtml(t.title) + '</span>' +
                        '</button>'
                    );
                }).join('')
                : '<p class="docs-empty">Aucun résultat.</p>';
            article.innerHTML = articleHtml(tutoById(selectedId));

            nav.querySelectorAll('.docs-nav-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    selectedId = btn.getAttribute('data-id');
                    paint();
                });
            });
            const openBtn = article.querySelector('.docs-open-btn');
            if (openBtn && openTool) {
                openBtn.addEventListener('click', function () {
                    openTool(openBtn.getAttribute('data-tool'));
                });
            }
        }

        search.addEventListener('input', function () {
            query = (search.value || '').trim().toLowerCase();
            paint();
        });

        paint();
    }

    window.EprofDocumentation = { render: render };
})();
