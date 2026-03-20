$communityDir = 'community'
$outputFile   = 'communities_all.csv'

# Collect all individual community CSVs sorted by name
$csvFiles = Get-ChildItem -Path $communityDir -Filter 'c_*.csv' | Sort-Object Name

$headerWritten = $false
$sb = [System.Text.StringBuilder]::new()

foreach ($file in $csvFiles) {
    $lines = Get-Content $file.FullName
    if ($lines.Count -lt 2) { continue }

    $header = $lines[0]
    $data   = $lines[1]

    # Split header and data
    $cols = $header -split ','
    $vals = $data   -split ','

    # Write header once
    if (-not $headerWritten) {
        [void]$sb.AppendLine($header)
        $headerWritten = $true
    }

    # Blank out T1_Score and all _t1 indicator columns
    $newVals = for ($i = 0; $i -lt $cols.Count; $i++) {
        $col = $cols[$i].Trim()
        if ($col -eq 'T1_Score' -or $col -match '_t1$') {
            ''
        } else {
            $vals[$i]
        }
    }

    [void]$sb.AppendLine(($newVals -join ','))
}

Set-Content -Path $outputFile -Value $sb.ToString().TrimEnd() -Encoding UTF8
$count = $csvFiles.Count
Write-Host "Done! Merged $count communities into '$outputFile'."
