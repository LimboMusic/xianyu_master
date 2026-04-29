$desktop = [Environment]::GetFolderPath('Desktop')
$wshell = New-Object -ComObject WScript.Shell
$sc = $wshell.CreateShortcut("$desktop\xianyu_auto.lnk")
$sc.TargetPath = "D:\工作\xianyu_master\启动闲鱼助手.bat"
$sc.WorkingDirectory = "D:\工作\xianyu_master"
$sc.Description = "闲鱼自动化助手"
$sc.Save()
Write-Host "快捷方式已创建: $desktop\xianyu_auto.lnk"
