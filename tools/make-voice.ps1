# Generates the scan announcement clips (web/public/sounds/{th,en}/<key>.wav) with Windows voices.
# Requires the Thai voice: Add-WindowsCapability -Online -Name "Language.TextToSpeech~~~th-TH~0.0.1.0"
# Usage: powershell -ExecutionPolicy Bypass -File tools\make-voice.ps1
# Edit the phrases below and re-run, then rebuild the web image (.\start.ps1 -Build).

$phrases = [ordered]@{
  check_in      = @('เข้างานสำเร็จ', 'Check in successful')
  check_out     = @('ออกงานสำเร็จ', 'Check out successful')
  duplicate     = @('สแกนแล้ว', 'Already scanned')
  NOT_FOUND     = @('ไม่พบบัตรในระบบ', 'Card not found')
  INVALID_QR    = @('คิวอาร์โค้ดไม่ถูกต้อง', 'Invalid QR code')
  CARD_MISMATCH = @('บัตรไม่ถูกต้อง', 'Invalid card')
  BLOCKED       = @('บัตรถูกระงับ', 'Card blocked')
  LOCKED        = @('บัตรถูกล็อก', 'Card locked')
  EXPIRED       = @('บัตรหมดอายุ', 'Card expired')
  NETWORK       = @('เชื่อมต่อไม่ได้', 'Connection error')
  UNAUTHORIZED  = @('กรุณาเข้าสู่ระบบใหม่', 'Please log in again')
}

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesisStream, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } |
  Select-Object -First 1
function Await($op, [type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(); $task.Result }

$all = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices
$voices = @{
  th = $all | Where-Object { $_.Language -eq 'th-TH' } | Select-Object -First 1
  en = ($all | Where-Object { $_.DisplayName -match 'Zira' } | Select-Object -First 1)
}
if (-not $voices.th) { throw 'Thai voice not installed (see header).' }
if (-not $voices.en) { $voices.en = $all | Where-Object { $_.Language -eq 'en-US' } | Select-Object -First 1 }

$root = Join-Path $PSScriptRoot '..\web\public\sounds'
foreach ($lang in 'th', 'en') {
  $dir = Join-Path $root $lang
  New-Item -ItemType Directory -Force $dir | Out-Null
  $s = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
  $s.Voice = $voices[$lang]
  $s.Options.SpeakingRate = 1.1
  $s.Options.AudioVolume = 1.0
  $i = if ($lang -eq 'th') { 0 } else { 1 }
  foreach ($k in $phrases.Keys) {
    $stream = Await ($s.SynthesizeTextToStreamAsync($phrases[$k][$i])) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
    $in = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
    $file = Join-Path $dir "$k.wav"
    $out = [System.IO.File]::Create($file)
    $in.CopyTo($out); $out.Close(); $in.Close()
    "{0}/{1}.wav  {2,6:N0} bytes  ({3})" -f $lang, $k, (Get-Item $file).Length, $voices[$lang].DisplayName
  }
}
