#!/usr/bin/env bash
set -euo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

IFS= read -r -s -p 'Nové heslo pro admin (alespoň 15 znaků): ' admin_password </dev/tty
printf '\n'
IFS= read -r -s -p 'Zadej stejné heslo znovu: ' admin_confirmation </dev/tty
printf '\n'

if [[ "$admin_password" != "$admin_confirmation" ]]; then
  printf 'Hesla se neshodují.\n' >&2
  exit 1
fi

printf '%s' "$admin_password" | node -e '
const { readFileSync } = require("node:fs");
const sqlite = require("sqlite3");
const { hashPassword } = require(process.argv[1]);

function reportError(error) {
  console.error(error.message);
  process.exitCode = 1;
}

async function createAdmin() {
  const password = readFileSync(0, "utf8");
  if ([...password].length < 15) {
    throw new Error("Heslo musí mít alespoň 15 znaků.");
  }

  const hash = await hashPassword(password);
  const db = new sqlite.Database(process.argv[2], sqlite.OPEN_READWRITE, error => {
    if (error) return reportError(error);

    db.run(
      `INSERT INTO users (username, password_hash, role)
       SELECT ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = ?)`,
      ["admin", hash, "admin", "admin"],
      function (error) {
        if (error) reportError(error);
        const created = !error && this.changes === 1;
        db.close(closeError => {
          if (closeError) return reportError(closeError);
          if (!error) {
            console.log(created ? "Účet admin byl vytvořen." : "Správce už existuje.");
          }
        });
      }
    );
  });
}

createAdmin().catch(reportError);
' "$script_dir/passwords.js" "$HOME/teacher-data/teacher.db"
