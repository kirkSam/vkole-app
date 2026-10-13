#!/usr/bin/env python3
"""Draw the store icon, splash, and Play feature graphic. No third-party image library."""

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GREEN = (44, 94, 74, 255)
DEEP = (27, 61, 49, 255)
CREAM = (243, 234, 215, 255)
PAPER = (243, 238, 228, 255)
GOLD = (201, 132, 42, 255)

# 5x7 uppercase glyphs. Each row is five bits, left to right.
FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
}


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, width: int, height: int, pixels: bytearray) -> None:
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw.extend(pixels[y * stride : (y + 1) * stride])
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def fill(pixels: bytearray, width: int, color: tuple[int, int, int, int]) -> None:
    row = bytes(color) * width
    height = len(pixels) // (width * 4)
    for y in range(height):
        start = y * width * 4
        pixels[start : start + width * 4] = row


def blend(pixels: bytearray, width: int, x: int, y: int, color: tuple[int, int, int, int]) -> None:
    height = len(pixels) // (width * 4)
    if x < 0 or y < 0 or x >= width or y >= height:
        return
    i = (y * width + x) * 4
    src_a = color[3] / 255
    if src_a >= 1:
        pixels[i : i + 4] = bytes(color)
        return
    dst = pixels[i : i + 4]
    out = [int(color[c] * src_a + dst[c] * (1 - src_a)) for c in range(3)]
    pixels[i : i + 4] = bytes(out + [255])


def disc(pixels: bytearray, width: int, cx: int, cy: int, radius: int, color: tuple[int, int, int, int]) -> None:
    r2 = radius * radius
    for y in range(cy - radius, cy + radius + 1):
        for x in range(cx - radius, cx + radius + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                blend(pixels, width, x, y, color)


def rect(pixels: bytearray, width: int, x: int, y: int, w: int, h: int, color: tuple[int, int, int, int]) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            blend(pixels, width, xx, yy, color)


def mark(pixels: bytearray, width: int, cx: int, cy: int, scale: int) -> None:
    disc(pixels, width, cx, cy, 22 * scale, CREAM)
    rect(pixels, width, cx - 16 * scale, cy + 2 * scale, 32 * scale, 4 * scale, GREEN)
    rect(pixels, width, cx - 14 * scale, cy + 10 * scale, 28 * scale, 4 * scale, GREEN)
    disc(pixels, width, cx + 8 * scale, cy - 6 * scale, 4 * scale, GOLD)


def text(pixels: bytearray, width: int, words: str, x: int, y: int, scale: int, color: tuple[int, int, int, int]) -> None:
    cursor = x
    for ch in words:
        glyph = FONT[ch]
        for row, bits in enumerate(glyph):
            for col, bit in enumerate(bits):
                if bit == "1":
                    rect(pixels, width, cursor + col * scale, y + row * scale, scale, scale, color)
        cursor += 6 * scale


def icon(size: int) -> bytearray:
    pixels = bytearray(size * size * 4)
    fill(pixels, size, GREEN)
    mark(pixels, size, size // 2, size // 2, max(1, size // 64))
    return pixels


def splash(size: int) -> bytearray:
    pixels = bytearray(size * size * 4)
    fill(pixels, size, GREEN)
    mark(pixels, size, size // 2, size // 2, max(1, size // 90))
    return pixels


def feature() -> bytearray:
    width, height = 1024, 500
    pixels = bytearray(width * height * 4)
    fill(pixels, width, PAPER)
    rect(pixels, width, 0, 0, 280, height, GREEN)
    mark(pixels, width, 140, 250, 5)
    text(pixels, width, "DO THE IMPOSSIBLE", 320, 190, 8, DEEP)
    text(pixels, width, "VKOLE PRACTICE", 320, 280, 6, GREEN)
    return pixels


def main() -> None:
    write_png(ROOT / "mobile" / "assets" / "icon.png", 1024, 1024, icon(1024))
    write_png(ROOT / "mobile" / "assets" / "splash.png", 2732, 2732, splash(2732))
    write_png(ROOT / "docs" / "store" / "feature-graphic.png", 1024, 500, feature())
    write_png(ROOT / "docs" / "store" / "icon-1024.png", 1024, 1024, icon(1024))
    print("wrote icon, splash, and feature graphic")


if __name__ == "__main__":
    main()
