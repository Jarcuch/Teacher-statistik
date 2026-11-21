# Dotykový panel Teacher_control

Klepnutím nad čarou zobrazíte počet uživatelů a záznamů. Dalším klepnutím se vrátíte na přehled.

## Nastavení displeje

Nainstalujte balíček python3-pil. Po záloze souboru /boot/firmware/config.txt přidejte do sekce [all] řádek dtoverlay=piscreen,drm,speed=8000000 a restartujte Raspberry Pi.

## Automatické spuštění

Projekt umístěte do /home/jarcuchweb/teacher-statistic. Zkopírujte obsah deploy/systemd/ do /etc/systemd/system/ včetně podsložky teacher-lcd.service.d/. Potom spusťte sudo systemctl daemon-reload a sudo systemctl enable --now teacher-lcd.service.
