@echo off
echo ========================================
echo   Regeneration de listes-eleves.js
echo ========================================
echo.
echo Ce script convertit les fichiers CSV en JavaScript
echo pour eviter les problemes CORS.
echo.

cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -Command ^
"$csvFiles = Get-ChildItem 'Trombinoscopes\2025-2026\Listes\*.csv' -Exclude '_EXEMPLE.csv'; ^
$jsContent = '// Listes des eleves par classe`n// Genere automatiquement depuis les fichiers CSV`n`nconst LISTES_ELEVES = {`n'; ^
foreach ($file in $csvFiles) { ^
    $className = [System.IO.Path]::GetFileNameWithoutExtension($file.Name); ^
    $content = Get-Content $file.FullName -Encoding UTF8; ^
    $lines = $content ^| Where-Object { $_ -and $_ -notmatch '^Nom,Prenom,Sexe' }; ^
    $jsContent += '    `\"' + $className + '`\": [`n'; ^
    foreach ($line in $lines) { ^
        $parts = $line -split ','; ^
        if ($parts.Count -ge 3) { ^
            $nom = $parts[0].Trim(); ^
            $prenom = $parts[1].Trim(); ^
            $sexe = $parts[2].Trim(); ^
            $jsContent += '        { nom: `\"' + $nom + '`\", prenom: `\"' + $prenom + '`\", sexe: `\"' + $sexe + '`\" },`n' ^
        } ^
    }; ^
    $jsContent = $jsContent.TrimEnd(',`n') + '`n    ],`n' ^
}; ^
$jsContent = $jsContent.TrimEnd(',`n') + '`n};`n'; ^
Set-Content -Path 'listes-eleves.js' -Value $jsContent -Encoding UTF8; ^
Write-Host ''; ^
Write-Host '========================================' -ForegroundColor Green; ^
Write-Host '   REGENERATION TERMINEE' -ForegroundColor Green; ^
Write-Host '========================================' -ForegroundColor Green; ^
Write-Host ''; ^
Write-Host 'Fichier genere : listes-eleves.js' -ForegroundColor Cyan; ^
Write-Host 'Classes incluses :' -ForegroundColor Yellow; ^
$csvFiles ^| ForEach-Object { Write-Host '  - ' $_.BaseName -ForegroundColor Gray }; ^
Write-Host ''"

echo.
pause
