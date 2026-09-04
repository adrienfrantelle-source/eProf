# -*- coding: utf-8 -*-
"""One-shot extraction of suivi + plan de classe from app.js."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "js" / "app.js"
lines = APP.read_text(encoding="utf-8").splitlines(True)


def slice_lines(start, end):
    return "".join(lines[start - 1 : end])


SUIVI_ADAPTER = r"""/* Suivi des élèves — extraits de app.js */
(function (global) {
    var E = function () { return global.EprofEleves || {}; };
    function getAnneeScolaire() { return E().getAnneeScolaire(); }
    function getAlertesSeuils() { return E().getAlertesSeuils(); }
    function getVisibleTeacherClasses() { return E().getVisibleTeacherClasses(); }
    function getListsForTeacher() { return E().getListsForTeacher(); }
    function classeBtnHtml(classe, count) { return E().classeBtnHtml(classe, count); }
    function emptyTeacherClassesHtml() { return E().emptyTeacherClassesHtml(); }
    function getPlansForClasse(classe) { return E().getPlansForClasse(classe); }
    function mergeCloudPlansIntoLocal(rows) { E().mergeCloudPlansIntoLocal(rows); }
    function handleDashboardTool(tool, extra) { E().openTool(tool, extra); }
    function updateNotifications() {
        if (global.EprofAppHooks && typeof global.EprofAppHooks.updateNotifications === 'function') {
            global.EprofAppHooks.updateNotifications();
        }
    }
    function photoHtml(classe, eleve) { return E().photoHtml(classe, eleve, { compact: true }); }
    function resolvePhotoUrls(eleves, classe) { return E().resolvePhotoUrls(eleves, classe); }

"""

PLAN_ADAPTER = r"""/* Plan de classe — extraits de app.js */
(function (global) {
    var E = function () { return global.EprofEleves || {}; };
    function getAnneeScolaire() { return E().getAnneeScolaire(); }
    function getVisibleTeacherClasses() { return E().getVisibleTeacherClasses(); }
    function getListsForTeacher() { return E().getListsForTeacher(); }
    function planClasseLieeOptionsHtml(selected) { return E().planClasseLieeOptionsHtml(selected); }
    function setPlanClasseLieeSelect(container, classe) { E().setPlanClasseLieeSelect(container, classe); }
    function rememberLinkedClassPlan(plan, name) { return E().rememberLinkedClassPlan(plan, name); }
    function photoHtml(classe, eleve) { return E().photoHtml(classe, eleve, { compact: true }); }
    function parseEleveLabel(label) { return E().parseEleveLabel(label); }

"""

suivi_body = slice_lines(2668, 4800)
# Move page-load hydrate out of immediate execution
BOOT = """    if (window.teacherManager && window.teacherManager.getCurrentTeacher()) {
        chargerCarnetPourSuivi(true);
        chargerSuiviEnLigne().then(function (distant) {
            if (suiviHasContent(distant)) ecrireSuiviLocal(distant);
            updateNotifications();
        });
        if (window.EprofSuiviTableau) window.EprofSuiviTableau.hydrater();
    }
"""
if BOOT not in suivi_body:
    raise SystemExit("suivi boot block not found")
suivi_body = suivi_body.replace(BOOT, "")

suivi_footer = """
    function hydrateSuivi(hooks) {
        if (hooks && typeof hooks.updateNotifications === 'function') {
            global.EprofAppHooks = global.EprofAppHooks || {};
            global.EprofAppHooks.updateNotifications = hooks.updateNotifications;
        }
        if (window.teacherManager && window.teacherManager.getCurrentTeacher()) {
            chargerCarnetPourSuivi(true);
            chargerSuiviEnLigne().then(function (distant) {
                if (suiviHasContent(distant)) ecrireSuiviLocal(distant);
                updateNotifications();
            });
            if (window.EprofSuiviTableau) window.EprofSuiviTableau.hydrater();
        }
    }

    global.EprofSuiviEleves = {
        render: function (container, extra) {
            extra = extra || {};
            renderSuiviEleves(container, extra.classe, extra.eleve);
        },
        hydrate: hydrateSuivi
    };
})(window);
"""

plan_body = slice_lines(6876, 8141)
plan_footer = """
    global.EprofPlanClasse = {
        render: renderPlanClasse
    };
})(window);
"""

(ROOT / "js" / "suivi-eleves.js").write_text(SUIVI_ADAPTER + suivi_body + suivi_footer, encoding="utf-8")
(ROOT / "js" / "plan-classe.js").write_text(PLAN_ADAPTER + plan_body + plan_footer, encoding="utf-8")

# Rebuild app.js: drop extracted ranges and plan/photo helpers
keep = []
for i, line in enumerate(lines, 1):
    if 178 <= i <= 306:
        continue
    if 2583 <= i <= 2666:
        continue
    if 2668 <= i <= 4800:
        continue
    if 6876 <= i <= 8141:
        continue
    keep.append(line)

app = "".join(keep)
# Ensure file still closes DOMContentLoaded
if not app.rstrip().endswith("});"):
    app = app.rstrip() + "\n});\n"

APP.write_text(app, encoding="utf-8")
print("extracted suivi-eleves.js, plan-classe.js; slimmed app.js")
print("app.js lines:", len(app.splitlines()))
