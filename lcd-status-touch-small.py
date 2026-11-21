import select
import struct
from array import array
from contextlib import closing
from datetime import datetime
from functools import lru_cache
from pathlib import Path
import sqlite3
import subprocess
import time

from PIL import Image, ImageDraw, ImageFont

DATA = Path("/home/jarcuchweb/teacher-data")
FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
WIDTH, HEIGHT = 480, 320


def font(size, bold=False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    try:
        return ImageFont.truetype(str(FONT_DIR / name), size)
    except OSError:
        return ImageFont.load_default(size=size)


TITLE = font(32, True)
LABEL = font(19)
SMALL = font(15)
VALUE = font(30, True)


def open_readonly(path):
    return sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=2)


@lru_cache(maxsize=32)
def valid_backup(path, modified_ns, size):
    with closing(open_readonly(path)) as db:
        db.execute("SELECT id, username FROM users LIMIT 0")
        db.execute("SELECT user_id, data FROM user_data LIMIT 0")
        return db.execute("PRAGMA quick_check").fetchall() == [("ok",)]


def last_backup():
    candidates = []
    for path in DATA.glob("backup.*/teacher.db"):
        try:
            info = path.stat()
            candidates.append((info.st_mtime_ns, path, info.st_size))
        except OSError:
            continue

    for modified_ns, path, size in sorted(candidates, reverse=True):
        try:
            if valid_backup(path, modified_ns, size):
                stamp = datetime.fromtimestamp(modified_ns / 1_000_000_000)
                return stamp.strftime("%d.%m.%Y %H:%M")
        except (OSError, sqlite3.Error):
            continue
    return "Nenalezena"


def app_status():
    try:
        result = subprocess.run(
            ["systemctl", "is-active", "teacher-statistic.service"],
            capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip() or "unknown"
    except (OSError, subprocess.TimeoutExpired):
        return "unknown"


def draw_screen(status, backup, updated):
    image = Image.new("RGB", (HEIGHT, WIDTH), "#101820")
    draw = ImageDraw.Draw(image)
    title = "Teacher_control"
    title_size = 32
    title_font = TITLE
    available = image.width - 22 - 10 - 84 - 8
    while draw.textlength(title, font=title_font) > available and title_size > 12:
        title_size -= 1
        title_font = font(title_size, True)
    draw.text((22, 15), title, font=title_font, fill="white")

    icon_path = Path(__file__).resolve().parent / "frontend-next" / "icon-192.png"
    with Image.open(icon_path) as original:
        logo = original.convert("RGBA")
    bounds = logo.getchannel("A").getbbox()
    if bounds:
        logo = logo.crop(bounds)
        logo.thumbnail((84, 84), Image.Resampling.LANCZOS)
        image.paste(logo, (image.width - logo.width - 10, 4), logo)

    states = {
        "active": ("Běží", "#62da96"),
        "activating": ("Spouští se", "#ffd166"),
        "inactive": ("Zastaveno", "#ff7979"),
        "failed": ("Chyba služby", "#ff7979"),
    }
    text, color = states.get(status, ("Stav neznámý", "#ffd166"))
    draw.ellipse((24, 76, 42, 94), fill=color)
    draw.text((56, 63), text, font=VALUE, fill=color)

    draw.text((22, 98), "Poslední aktualizace:", font=SMALL, fill="#b9c9d6")
    draw.text((56, 118), updated, font=SMALL, fill="#b9c9d6")
    draw.text((22, 143), "Poslední ověřená záloha:", font=SMALL, fill="#b9c9d6")
    draw.text((56, 163), backup, font=SMALL, fill="#b9c9d6")

    draw.line((22, 196, image.width - 22, 196), fill="#43515e", width=1)

    write_frame(image)


def write_frame(image):
    image = image.transpose(Image.Transpose.ROTATE_90)
    pixels = array("H", (
        ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
        for r, g, b in image.getdata()
    )).tobytes()
    stride = int(Path("/sys/class/graphics/fb0/stride").read_text())
    row_bytes = WIDTH * 2
    frame = bytearray(stride * HEIGHT)
    for y in range(HEIGHT):
        frame[y * stride:y * stride + row_bytes] = pixels[y * row_bytes:(y + 1) * row_bytes]

    with open("/dev/fb0", "r+b", buffering=0) as lcd:
        lcd.write(frame)



def draw_detail():
    image = Image.new("RGB", (HEIGHT, WIDTH), "#101820")
    draw = ImageDraw.Draw(image)
    draw.text((22, 18), "Teacher_control", font=font(22, True), fill="white")

    users = records = "—"
    try:
        with closing(open_readonly(DATA / "teacher.db")) as db:
            users, records = db.execute("""
                SELECT (SELECT COUNT(*) FROM users),
                       COALESCE(SUM(
                           COALESCE(json_array_length(data, '$.records'), 0) +
                           COALESCE(json_array_length(data, '$.controls'), 0)
                       ), 0)
                FROM user_data
            """).fetchone()
    except sqlite3.Error:
        pass

    draw.text((22, 88), "Počet registrovaných uživatelů:", font=SMALL, fill="#b9c9d6")
    draw.text((56, 120), str(users), font=font(22, True), fill="white")
    draw.text((22, 205), "Počet celkových záznamů:", font=SMALL, fill="#b9c9d6")
    draw.text((56, 237), str(records), font=font(22, True), fill="white")
    draw.text((22, 433), "Dotykem zpět", font=font(13), fill="#b9c9d6")
    write_frame(image)


def touchscreen_path():
    for device in Path("/sys/class/input").glob("event*"):
        if (device / "device/name").read_text().strip() == "ADS7846 Touchscreen":
            return Path("/dev/input") / device.name
    raise RuntimeError("Dotykový panel ADS7846 nebyl nalezen.")


def above_divider(x, y):
    # X roste dolů. Hranici určuje přímka mezi oběma změřenými konci.
    boundary_x = 1558 + (y - 477) * (1722 - 1558) / (3475 - 477)
    return x < boundary_x


def run():
    event = struct.Struct("@llHHi")
    detail = False
    pressed = False
    x = y = None
    next_draw = 0

    with touchscreen_path().open("rb", buffering=0) as touch:
        while True:
            if time.monotonic() >= next_draw:
                if detail:
                    draw_detail()
                else:
                    draw_screen(app_status(), last_backup(),
                                datetime.now().strftime("%d.%m.%Y %H:%M:%S"))
                next_draw = time.monotonic() + 30

            timeout = max(0, next_draw - time.monotonic())
            if not select.select([touch], [], [], timeout)[0]:
                continue

            _, _, kind, code, value = event.unpack(touch.read(event.size))
            if kind == 3 and code == 0:
                x = value
            elif kind == 3 and code == 1:
                y = value
            elif kind == 1 and code == 330:
                if value == 1:
                    pressed = True
                elif value == 0 and pressed:
                    pressed = False
                    if detail:
                        detail = False
                        next_draw = 0
                    elif x is not None and y is not None and above_divider(x, y):
                        detail = True
                        next_draw = 0


if __name__ == "__main__":
    run()
