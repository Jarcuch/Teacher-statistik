# Teacher_control

## Serverová verze

Serverová verze podporuje přihlášení a oddělená data jednotlivých účtů. Správce může zakládat účty, spravovat jejich data a mazat prázdné běžné účty.

Backend v adresáři `backend/` poskytuje stránku a skripty z `frontend-next/`. Účty a data ukládá do SQLite databáze `~/teacher-data/teacher.db` pod účtem, který server spouští.

Pro spuštění na připraveném Raspberry Pi potřebujete Node.js, modul `sqlite3` a databázi s tabulkami `users` a `user_data`. Z kořene repozitáře spusťte:

```bash
node backend/server-with-user-management-ui.js
```

Server naslouchá na `127.0.0.1:3001`. Ve veřejném nasazení zajišťuje HTTPS a předávání požadavků Nginx.

### První spuštění na Raspberry Pi

Na Raspbianu používá tato verze balíčky `nodejs`, `node-sqlite3` a `sqlite3`.
Všechny následující příkazy spusťte z kořene repozitáře pod uživatelem, pod kterým poběží backend.

Pro novou instalaci vytvořte soukromý adresář a prázdnou databázi:

```bash
(
  set -e -o noclobber
  umask 077
  mkdir -p -- "$HOME/teacher-data"
  database="$HOME/teacher-data/teacher.db"
  : > "$database"
  sqlite3 -bail "$database" < backend/schema.sql
)
```

Příkaz skončí, pokud soubor databáze již existuje. Po úspěšném vytvoření databáze založte prvního správce:

```bash
bash backend/create-admin.sh
```

Skript si v terminálu dvakrát vyžádá heslo. Další běžné účty může správce založit po přihlášení v panelu **Správa uživatelů**.

## Původní verze pro GitHub Pages

Aplikace vychází z verze Partner Statistik 2.5. Pro nasazení na GitHub Pages rozbalte ZIP a nahrajte všechny soubory do kořene samostatného repozitáře.

Teacher_control má vlastní úložiště v prohlížeči. Náslechové záznamy i kontrolní činnost se ukládají v tomto zařízení; export/import v Nastavení přenáší učitele, kritéria a všechny záznamy. Zálohu uchovávejte v soukromí.

Bílé logo ve tvaru štítu s průhledným okolím se používá v aplikaci i jako ikona při přidání na plochu, včetně iPhonu.

