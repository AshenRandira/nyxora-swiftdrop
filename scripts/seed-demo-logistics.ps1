[CmdletBinding()]
param(
    [string]$ApiBaseUrl = "http://localhost:8080",
    [string]$AdminEmail = "admin@swiftdrop.lk",
    [string]$AdminPassword = "Admin@SwiftDrop2026!",
    [switch]$SkipQuoteVerification
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-SwiftDropApi {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("GET", "POST", "PUT")]
        [string]$Method,
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [hashtable]$Headers = @{},
        [AllowNull()]
        [object]$Body = $null
    )

    $request = @{
        Uri         = "$($ApiBaseUrl.TrimEnd('/'))$Path"
        Method      = $Method
        Headers     = $Headers
        ContentType = "application/json"
    }
    if ($null -ne $Body) {
        $request.Body = $Body | ConvertTo-Json -Depth 8
    }

    try {
        return Invoke-RestMethod @request
    }
    catch {
        $detail = $_.ErrorDetails.Message
        if ([string]::IsNullOrWhiteSpace($detail)) {
            $detail = $_.Exception.Message
        }
        throw "SwiftDrop API request failed: $Method $Path - $detail"
    }
}

function ConvertTo-ItemArray {
    param([AllowNull()][object]$Value)
    if ($null -eq $Value) {
        return @()
    }
    return @($Value | ForEach-Object { $_ })
}

function Get-RuleKey {
    param(
        [Parameter(Mandatory = $true)][int]$OriginZoneId,
        [Parameter(Mandatory = $true)][int]$DestinationZoneId,
        [Parameter(Mandatory = $true)][string]$ParcelSize
    )
    return "$OriginZoneId|$DestinationZoneId|$ParcelSize"
}

function Get-RouteKey {
    param(
        [Parameter(Mandatory = $true)][string]$FirstZoneCode,
        [Parameter(Mandatory = $true)][string]$SecondZoneCode
    )
    $orderedCodes = @($FirstZoneCode, $SecondZoneCode) | Sort-Object
    return "$($orderedCodes[0])|$($orderedCodes[1])"
}

$demoZones = @(
    [pscustomobject]@{ zoneCode = "NP-COL-01"; zoneName = "Colombo 01"; district = "Colombo"; baseSurcharge = 25.00 },
    [pscustomobject]@{ zoneCode = "NP-KAN-02"; zoneName = "Kandy 01"; district = "Kandy"; baseSurcharge = 25.00 },
    [pscustomobject]@{ zoneCode = "SP-GAL-01"; zoneName = "Galle City"; district = "Galle"; baseSurcharge = 40.00 },
    [pscustomobject]@{ zoneCode = "NP-JAF-01"; zoneName = "Jaffna City"; district = "Jaffna"; baseSurcharge = 90.00 },
    [pscustomobject]@{ zoneCode = "NW-KUR-01"; zoneName = "Kurunegala Central"; district = "Kurunegala"; baseSurcharge = 50.00 },
    [pscustomobject]@{ zoneCode = "EP-TRI-01"; zoneName = "Trincomalee City"; district = "Trincomalee"; baseSurcharge = 75.00 }
)

# Approximate road-distance bands are used only to generate coherent demo rates.
# They are not intended to be treated as production tariff data.
$routeDistancesKm = @{
    "EP-TRI-01|NP-COL-01" = 260
    "EP-TRI-01|NP-JAF-01" = 230
    "EP-TRI-01|NP-KAN-02" = 180
    "EP-TRI-01|NW-KUR-01" = 180
    "EP-TRI-01|SP-GAL-01" = 300
    "NP-COL-01|NP-JAF-01" = 400
    "NP-COL-01|NP-KAN-02" = 115
    "NP-COL-01|NW-KUR-01" = 95
    "NP-COL-01|SP-GAL-01" = 125
    "NP-JAF-01|NP-KAN-02" = 320
    "NP-JAF-01|NW-KUR-01" = 305
    "NP-JAF-01|SP-GAL-01" = 520
    "NP-KAN-02|NW-KUR-01" = 105
    "NP-KAN-02|SP-GAL-01" = 225
    "NW-KUR-01|SP-GAL-01" = 200
}

$parcelSizes = @(
    [pscustomobject]@{ name = "SMALL"; multiplier = 1.00 },
    [pscustomobject]@{ name = "MEDIUM"; multiplier = 1.25 },
    [pscustomobject]@{ name = "LARGE"; multiplier = 1.50 }
)

Write-Host "Authenticating demo seeder against $ApiBaseUrl ..."
$login = Invoke-SwiftDropApi -Method POST -Path "/api/v1/auth/login" -Body @{
    email = $AdminEmail
    password = $AdminPassword
}
if ([string]::IsNullOrWhiteSpace([string]$login.accessToken)) {
    throw "Login response did not contain an access token."
}
$adminHeaders = @{ Authorization = "Bearer $($login.accessToken)" }

$zonePayload = Invoke-SwiftDropApi -Method GET -Path "/api/v1/zones" -Headers $adminHeaders
$zones = ConvertTo-ItemArray -Value $zonePayload
$zoneByCode = @{}
foreach ($zone in $zones) {
    $zoneByCode[[string]$zone.zoneCode] = $zone
}

$createdZoneCount = 0
$skippedZoneCount = 0
foreach ($desiredZone in $demoZones) {
    if ($zoneByCode.ContainsKey($desiredZone.zoneCode)) {
        $skippedZoneCount++
        Write-Host "Zone exists:  $($desiredZone.zoneCode)"
        continue
    }

    $createdZone = Invoke-SwiftDropApi -Method POST -Path "/api/v1/zones" -Headers $adminHeaders -Body @{
        zoneCode = $desiredZone.zoneCode
        zoneName = $desiredZone.zoneName
        district = $desiredZone.district
        baseSurcharge = $desiredZone.baseSurcharge
    }
    $zoneByCode[[string]$createdZone.zoneCode] = $createdZone
    $createdZoneCount++
    Write-Host "Zone created: $($createdZone.zoneCode)"
}

$rulePayload = Invoke-SwiftDropApi -Method GET -Path "/api/v1/pricing/rules" -Headers $adminHeaders
$rules = ConvertTo-ItemArray -Value $rulePayload
$ruleKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($rule in $rules) {
    [void]$ruleKeys.Add((Get-RuleKey -OriginZoneId ([int]$rule.originZone.id) -DestinationZoneId ([int]$rule.destinationZone.id) -ParcelSize ([string]$rule.parcelSize)))
}

$createdRuleCount = 0
$skippedRuleCount = 0
foreach ($originDefinition in $demoZones) {
    foreach ($destinationDefinition in $demoZones) {
        if ($originDefinition.zoneCode -eq $destinationDefinition.zoneCode) {
            continue
        }

        $originZone = $zoneByCode[$originDefinition.zoneCode]
        $destinationZone = $zoneByCode[$destinationDefinition.zoneCode]
        $routeKey = Get-RouteKey -FirstZoneCode $originDefinition.zoneCode -SecondZoneCode $destinationDefinition.zoneCode
        if (-not $routeDistancesKm.ContainsKey($routeKey)) {
            throw "No demo distance configured for route $routeKey."
        }

        $distanceKm = [decimal]$routeDistancesKm[$routeKey]
        $baseFee = [math]::Round([decimal]180 + ($distanceKm * [decimal]1.50), 2)
        $ratePerKg = [math]::Round([decimal]55 + ([math]::Ceiling([double]$distanceKm / 100.0) * [decimal]10), 2)

        foreach ($parcelSize in $parcelSizes) {
            $ruleKey = Get-RuleKey -OriginZoneId ([int]$originZone.id) -DestinationZoneId ([int]$destinationZone.id) -ParcelSize $parcelSize.name
            if ($ruleKeys.Contains($ruleKey)) {
                $skippedRuleCount++
                continue
            }

            $createdRule = Invoke-SwiftDropApi -Method POST -Path "/api/v1/pricing/rules" -Headers $adminHeaders -Body @{
                originZoneId = [int]$originZone.id
                destinationZoneId = [int]$destinationZone.id
                baseFee = $baseFee
                ratePerKg = $ratePerKg
                parcelSize = $parcelSize.name
                sizeMultiplier = $parcelSize.multiplier
            }
            [void]$ruleKeys.Add((Get-RuleKey -OriginZoneId ([int]$createdRule.originZone.id) -DestinationZoneId ([int]$createdRule.destinationZone.id) -ParcelSize ([string]$createdRule.parcelSize)))
            $createdRuleCount++
        }
    }
}

$expectedRuleCount = $demoZones.Count * ($demoZones.Count - 1) * $parcelSizes.Count
$missingRules = [System.Collections.Generic.List[string]]::new()
foreach ($originDefinition in $demoZones) {
    foreach ($destinationDefinition in $demoZones) {
        if ($originDefinition.zoneCode -eq $destinationDefinition.zoneCode) {
            continue
        }
        $originZone = $zoneByCode[$originDefinition.zoneCode]
        $destinationZone = $zoneByCode[$destinationDefinition.zoneCode]
        foreach ($parcelSize in $parcelSizes) {
            $ruleKey = Get-RuleKey -OriginZoneId ([int]$originZone.id) -DestinationZoneId ([int]$destinationZone.id) -ParcelSize $parcelSize.name
            if (-not $ruleKeys.Contains($ruleKey)) {
                $missingRules.Add("$($originDefinition.zoneCode) -> $($destinationDefinition.zoneCode) [$($parcelSize.name)]")
            }
        }
    }
}
if ($missingRules.Count -gt 0) {
    throw "Demo pricing coverage is incomplete: $($missingRules -join ', ')"
}

$verifiedQuoteCount = 0
if (-not $SkipQuoteVerification) {
    Write-Host "Verifying all $expectedRuleCount standard quote combinations ..."
    foreach ($originDefinition in $demoZones) {
        foreach ($destinationDefinition in $demoZones) {
            if ($originDefinition.zoneCode -eq $destinationDefinition.zoneCode) {
                continue
            }
            $originZone = $zoneByCode[$originDefinition.zoneCode]
            $destinationZone = $zoneByCode[$destinationDefinition.zoneCode]
            foreach ($parcelSize in $parcelSizes) {
                $quote = Invoke-SwiftDropApi -Method POST -Path "/api/v1/parcels/quote" -Body @{
                    originZoneId = [int]$originZone.id
                    destinationZoneId = [int]$destinationZone.id
                    weightKg = 2.50
                    parcelSize = $parcelSize.name
                    tier = "STANDARD"
                }
                if ([decimal]$quote.totalFee -le 0) {
                    throw "Quote verification returned a non-positive total for $($originDefinition.zoneCode) -> $($destinationDefinition.zoneCode) [$($parcelSize.name)]."
                }
                $verifiedQuoteCount++
            }
        }
    }

    $sampleOrigin = $zoneByCode["NP-COL-01"]
    $sampleDestination = $zoneByCode["NP-KAN-02"]
    foreach ($tier in @("EXPRESS", "MERCHANT")) {
        $quote = Invoke-SwiftDropApi -Method POST -Path "/api/v1/parcels/quote" -Body @{
            originZoneId = [int]$sampleOrigin.id
            destinationZoneId = [int]$sampleDestination.id
            weightKg = 3.50
            parcelSize = "MEDIUM"
            tier = $tier
        }
        if ([decimal]$quote.totalFee -le 0) {
            throw "$tier quote verification returned a non-positive total."
        }
        $verifiedQuoteCount++
    }
}

Write-Host ""
Write-Host "SwiftDrop demo logistics data is ready."
Write-Host "Zones created:          $createdZoneCount"
Write-Host "Zones already present:  $skippedZoneCount"
Write-Host "Rules created:          $createdRuleCount"
Write-Host "Rules already present:  $skippedRuleCount"
Write-Host "Demo rule coverage:     $expectedRuleCount / $expectedRuleCount"
Write-Host "Quotes verified:        $verifiedQuoteCount"
