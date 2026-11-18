# Budget Josh : deploiement en une commande (lot Fondations).
#
#   npm run deploy            tests, push GitHub, deploiement complet sur o2switch
#   npm run deploy:simuler    montre ce qui partirait, sans rien modifier
#
# Prerequis (deja faits le 18 novembre 2026) : alias SSH "budgetjosh" dans ~/.ssh/config,
# cle autorisee dans cPanel, IP du PC autorisee dans le pare-feu SSH d'o2switch.
param(
    [switch]$Simuler,
    [switch]$SansTests
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$OutputEncoding = [System.Text.Encoding]::UTF8
$Site = 'https://depensesjosh.brightlightmind.online'

function Etape($texte) { Write-Host "`n>> $texte" -ForegroundColor Cyan }
function Arret($texte) { Write-Host "`nARRET : $texte" -ForegroundColor Red; exit 1 }

Etape 'Verification de Git'
$branche = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branche -ne 'master') { Arret "tu es sur la branche '$branche', pas sur master." }
$modifs = git status --porcelain --untracked-files=no
if ($modifs) { Arret "des fichiers suivis ne sont pas commites :`n$modifs" }
Write-Host 'Git propre, branche master.'

if (-not $SansTests -and -not $Simuler) {
    Etape 'Tests automatiques (base de test separee)'
    npx playwright test --reporter=line
    if ($LASTEXITCODE -ne 0) { Arret 'des tests echouent. Rien n''a ete envoye.' }
}

if (-not $Simuler) {
    Etape 'Envoi sur GitHub'
    git push origin master
    if ($LASTEXITCODE -ne 0) { Arret 'le push GitHub a echoue.' }
}
$local = (git rev-parse --short HEAD).Trim()

Etape ('Deploiement sur o2switch' + $(if ($Simuler) { ' (simulation)' } else { '' }))
$script = (Get-Content -Raw -Encoding UTF8 'bin/remote-deploy.sh') -replace "`r", ''
$arguments = if ($Simuler) { 'bash -s -- --dry-run' } else { 'bash -s' }
$script | ssh -o BatchMode=yes budgetjosh $arguments
if ($LASTEXITCODE -ne 0) {
    Arret "le serveur a signale une erreur (code $LASTEXITCODE). Si la connexion est refusee, ton IP a peut-etre change : ajoute-la dans cPanel > Autorisation SSH."
}
if ($Simuler) { exit 0 }

Etape 'Verification du site en ligne'
$distant = (ssh -o BatchMode=yes budgetjosh 'git -C ~/repositories/buget-josh rev-parse --short HEAD' 2>$null | Select-Object -Last 1).Trim()
if ($distant -ne $local) { Arret "le serveur est sur $distant au lieu de $local." }
try { $login = Invoke-WebRequest "$Site/login.php" -UseBasicParsing -TimeoutSec 20 } catch { Arret 'la page de connexion ne repond pas.' }
$protege = $false
try { Invoke-WebRequest "$Site/api.php?action=bootstrap" -UseBasicParsing -TimeoutSec 20 | Out-Null } catch { $protege = ($_.Exception.Response.StatusCode.value__ -eq 401) }
if (-not $protege) { Arret 'ATTENTION : l''API ne semble plus protegee par la connexion.' }

Write-Host "`nTERMINE : production sur $local, site en ligne, donnees protegees." -ForegroundColor Green
