# -*- coding: utf-8 -*-
"""
Genera íconos PNG simples para la PWA (sin dependencias externas).
Usa módulos estándar de Python.
"""

import math
import struct
import zlib
import os

AQUI = os.path.dirname(os.path.abspath(__file__))


def png(size):
    """Genera un PNG cuadrado de tamaño x tamaño px, fondo azul oscuro con una B blanca."""
    pixels = []
    cx, cy = size // 2, size // 2
    r = int(size * 0.38)

    for y in range(size):
        row = []
        for x in range(size):
            dx, dy = x - cx, y - cy
            dist = math.sqrt(dx * dx + dy * dy)

            # Borde exterior (círculo)
            if r - 2 < dist <= r:
                row.extend([26, 35, 126, 255])  # azul oscuro
                continue

            # Interior del círculo (fondo azul)
            if dist <= r:
                # Dibujar letra "B" simplificada
                bx, by = x - (cx - r * 0.15), y - cy
                bw, bh = r * 0.45, r * 0.7
                in_bar = -1 < bx < 0 and -bh * 0.9 < by < bh * 0.9
                in_top = 0 <= bx < bw * 0.7 and -bh < by < -bh * 0.45
                in_bot = 0 <= bx < bw * 0.7 and bh * 0.25 < by < bh
                in_mid = 0 <= bx < bw * 0.7 and -bh * 0.2 < by < bh * 0.05
                in_top_curve = bx >= 0 and bx < bw * 0.7 and -bh < by < bh * 0.1 and abs(by + bh * 0.45) > bw * 0.3
                in_bot_curve = bx >= 0 and bx < bw * 0.7 and -bh * 0.1 < by < bh and abs(by - bh * 0.4) > bw * 0.3

                if in_bar or in_mid:
                    row.extend([255, 255, 255, 255])
                else:
                    # Borde del círculo interior
                    if dist <= r - 1:
                        row.extend([26, 35, 126, 255])
                    else:
                        row.extend([0, 0, 0, 0])
                continue

            # Fuera del círculo = transparente
            row.extend([0, 0, 0, 0])

        pixels.append(bytes([0] + row))  # 0 = filter byte

    raw = b"".join(pixels)
    compressed = zlib.compress(raw)

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", compressed)
        + chunk(b"IEND", b"")
    )


def main():
    out_dir = os.path.join(AQUI, "static")
    os.makedirs(out_dir, exist_ok=True)
    for sz in (192, 512):
        path = os.path.join(out_dir, f"icon-{sz}.png")
        with open(path, "wb") as f:
            f.write(png(sz))
        print(f"Generado: {path} ({sz}x{sz})")


if __name__ == "__main__":
    main()