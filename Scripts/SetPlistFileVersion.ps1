# This script is used to set the version in the Info.plist file for the iOS app

$filePath = get-ChildItem Info.plist -Path IsraelHiking.Web/ios/App/App | Select-Object -first 1 | select -expand FullName
$fileXml = [xml](Get-Content $filePath)
Select-Xml -xml $fileXml -XPath "//dict/key[. = 'CFBundleShortVersionString']/following-sibling::string[1]" |
%{ 	
        $_.Node.InnerXml = $env:VERSION
}
            
Select-Xml -xml $fileXml -XPath "//dict/key[. = 'CFBundleVersion']/following-sibling::string[1]" |
%{ 	
    $_.Node.InnerXml = $env:VERSION
}
$fileXml.Save($filePath)
# fix issue with plist and c# xml save: https://stackoverflow.com/questions/18615749/how-to-modify-a-plist-file-using-c
(Get-Content -path $filePath -Raw) -replace '"\[\]>', '">' | Set-Content -Path $filePath