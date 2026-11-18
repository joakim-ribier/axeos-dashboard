"""Sets every screenshot's width on a docs page to the shots' one scale.

Each image is taken at 2x by screenshots.mjs; on the page it is shown at
0.736 of its CSS width (a full-width band = 736px, the docs column), capped
at the column -- an app control the same size in every shot.

usage: python3 docs/scripts/image-widths.py docs/<page>.md [...]
"""

import re
import struct
import sys
from pathlib import Path

SCALE = 0.736
COLUMN = 736
DOCS = Path(__file__).resolve().parent.parent

IMAGE = re.compile(
    r"(!\[[^\]]*\]\(\{\{ '/assets/images/([\w.-]+\.png)' \| relative_url \}\}\))"
    r"(\{: width=\"\d+\" \})?"
)


def png_width(path: Path) -> int:
    with path.open("rb") as f:
        head = f.read(24)
    return struct.unpack(">I", head[16:20])[0]


for page in sys.argv[1:]:
    path = Path(page)
    text = path.read_text()

    def sized(match: re.Match) -> str:
        css = png_width(DOCS / "assets" / "images" / match.group(2)) / 2
        width = round(min(css * SCALE, COLUMN))
        print(f"{match.group(2)}: {width}")
        return match.group(1) + '{: width="%d" }' % width

    path.write_text(IMAGE.sub(sized, text))
