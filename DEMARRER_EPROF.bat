@echo off
REM ================================================
REM   Lanceur eProf - Tableau de bord enseignant
REM ================================================

echo.
echo ========================================
echo   Demarrage de eProf...
echo ========================================
echo.

REM Obtenir le chemin du script (fonctionne même si la lettre de la clé USB change)
cd /d "%~dp0"

REM Ouvrir index.html dans le navigateur par défaut
start "" "index.html"

echo.
echo eProf a ete lance dans votre navigateur !
echo Vous pouvez fermer cette fenetre.
echo.

REM Attendre 3 secondes avant de fermer
timeout /t 3 /nobreak >nul

exit
