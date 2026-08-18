$ErrorActionPreference = 'Stop'

$project = 'salem-1692-16b8b'
$namespace = 'salem-1692-16b8b-default-rtdb'
$functionBase = "http://127.0.0.1:5001/$project/us-central1"

function New-SimulatedUser([string]$name) {
  $auth = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=simulation' -ContentType 'application/json' -Body '{"returnSecureToken":true}'
  [pscustomobject]@{ Name = $name; Uid = $auth.localId; Token = $auth.idToken }
}

function Invoke-GameFunction([string]$name, $user, $data) {
  Invoke-RestMethod -Method Post -Uri "$functionBase/$name" -Headers @{ Authorization = "Bearer $($user.Token)" } -ContentType 'application/json' -Body (@{ data = $data } | ConvertTo-Json -Depth 12)
}

function Get-PublicState($gameId, $user) {
  Invoke-RestMethod -Uri "http://127.0.0.1:9000/games/$gameId/public.json?auth=$($user.Token)&ns=$namespace"
}

function Get-PrivateState($gameId, $user) {
  Invoke-RestMethod -Uri "http://127.0.0.1:9000/games/$gameId/private/$($user.Uid).json?auth=$($user.Token)&ns=$namespace"
}

function Find-LegalAction($privateState, [string]$type) {
  @($privateState.legalActions) | Where-Object { $_.type -eq $type } | Select-Object -First 1
}

$users = @(
  (New-SimulatedUser 'Abigail'),
  (New-SimulatedUser 'Samuel'),
  (New-SimulatedUser 'Mary'),
  (New-SimulatedUser 'John')
)

$created = Invoke-GameFunction 'createGame' $users[0] @{ displayName = $users[0].Name }
$gameId = $created.result.gameId
for ($index = 1; $index -lt $users.Count; $index += 1) {
  Invoke-GameFunction 'joinGame' $users[$index] @{ inviteCode = $created.result.inviteCode; displayName = $users[$index].Name } | Out-Null
}

function Invoke-Action($user, [string]$type, $payload = @{}) {
  $public = Get-PublicState $gameId $users[0]
  Invoke-GameFunction 'executeGameAction' $user @{
    gameId = $gameId
    action = @{ actionId = [guid]::NewGuid().ToString(); expectedVersion = $public.version; type = $type; payload = $payload }
  } | Out-Null
}

Invoke-Action $users[0] 'START_GAME'
$trace = [System.Collections.Generic.List[string]]::new()

for ($step = 1; $step -le 250; $step += 1) {
  $public = Get-PublicState $gameId $users[0]
  $trace.Add(("{0,3}. v{1} {2}/{3}" -f $step, $public.version, $public.phase, $public.subPhase))
  if ($public.phase -eq 'FINISHED') { break }

  $privateStates = @{}
  foreach ($user in $users) { $privateStates[$user.Uid] = Get-PrivateState $gameId $user }
  $acted = $false

  switch ($public.subPhase) {
    'BLACK_CAT_SELECTION' {
      $witch = $users | Where-Object { Find-LegalAction $privateStates[$_.Uid] 'SELECT_BLACK_CAT' } | Select-Object -First 1
      $action = Find-LegalAction $privateStates[$witch.Uid] 'SELECT_BLACK_CAT'
      Invoke-Action $witch 'SELECT_BLACK_CAT' @{ targetId = @($action.targets)[0] }
      $acted = $true
    }
    'WAITING_ACTION' {
      $current = $users | Where-Object Uid -eq $public.currentPlayerId | Select-Object -First 1
      if (Find-LegalAction $privateStates[$current.Uid] 'DRAW_CARDS') { Invoke-Action $current 'DRAW_CARDS'; $acted = $true }
    }
    'PLAY_CARDS' {
      $current = $users | Where-Object Uid -eq $public.currentPlayerId | Select-Object -First 1
      if (Find-LegalAction $privateStates[$current.Uid] 'END_TURN') { Invoke-Action $current 'END_TURN'; $acted = $true }
    }
    'CONSPIRACY_RESOLUTION' {
      foreach ($user in $users) {
        $private = Get-PrivateState $gameId $user
        $action = Find-LegalAction $private 'SELECT_CONSPIRACY_CARD'
        if ($action) { Invoke-Action $user 'SELECT_CONSPIRACY_CARD' @{ tryalCardIndex = @($action.tryalOptions)[0] }; $acted = $true }
      }
    }
    'WITCH_SELECTION' {
      foreach ($user in $users) {
        $private = Get-PrivateState $gameId $user
        $action = Find-LegalAction $private 'SELECT_WITCH_VICTIM'
        if ($action -and @($action.targets).Count) { Invoke-Action $user 'SELECT_WITCH_VICTIM' @{ targetId = @($action.targets)[0] }; $acted = $true }
      }
    }
    'CONSTABLE_SELECTION' {
      foreach ($user in $users) {
        $private = Get-PrivateState $gameId $user
        $action = Find-LegalAction $private 'SELECT_CONSTABLE_PROTECTION'
        if ($action -and @($action.targets).Count) { Invoke-Action $user 'SELECT_CONSTABLE_PROTECTION' @{ targetId = @($action.targets)[-1] }; $acted = $true; break }
      }
    }
    'CONFESSION' {
      foreach ($user in $users) {
        $private = Get-PrivateState $gameId $user
        if (Find-LegalAction $private 'PASS_CONFESSION') { Invoke-Action $user 'PASS_CONFESSION'; $acted = $true }
      }
    }
    'LAST_WORDS' {
      foreach ($user in $users) {
        if (Find-LegalAction $privateStates[$user.Uid] 'END_LAST_WORDS') { Invoke-Action $user 'END_LAST_WORDS'; $acted = $true; break }
      }
    }
    'TRYAL_SELECTION' {
      foreach ($user in $users) {
        $action = Find-LegalAction $privateStates[$user.Uid] 'SELECT_TRYAL'
        if ($action) { Invoke-Action $user 'SELECT_TRYAL' @{ targetId = $action.targetId; tryalCardId = @($action.tryalOptions)[0] }; $acted = $true; break }
      }
    }
  }

  if (-not $acted) {
    $trace | Select-Object -Last 40 | Write-Host
    throw "La simulacion $gameId se bloqueo en $($public.phase)/$($public.subPhase), version $($public.version)."
  }
}

$final = Get-PublicState $gameId $users[0]
if ($final.phase -ne 'FINISHED') { throw 'La simulacion supero 250 pasos sin alcanzar una victoria.' }

$trace | Select-Object -Last 40
[pscustomobject]@{
  GameId = $gameId
  InviteCode = $created.result.inviteCode
  Winner = $final.winner
  FinalVersion = $final.version
  HistoryEvents = @($final.history).Count
  Result = 'PASS'
} | Format-List
