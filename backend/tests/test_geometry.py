"""
Testes de geometry.py — conversão normalizado <-> pixel.

Cobre o princípio central documentado no módulo: resolve_element_box e
box_top_left_to_pos precisam ser exatamente inversas uma da outra pra não
acumular erro de arredondamento ao alternar entre editar visualmente e
editar valor numérico.
"""

import pytest

from app.geometry import PixelPoint, box_top_left_to_pos, resolve_element_box

REFERENCE = (1920, 1080)


def test_resolve_element_box_origin_top_left():
    box = resolve_element_box(pos=(0.1, 0.2), size=(0.3, 0.4), origin=(0.0, 0.0), reference=REFERENCE)

    assert box.x == pytest.approx(0.1 * 1920)
    assert box.y == pytest.approx(0.2 * 1080)
    assert box.width == pytest.approx(0.3 * 1920)
    assert box.height == pytest.approx(0.4 * 1080)


def test_resolve_element_box_origin_center():
    # origin (0.5, 0.5) com pos (0.5, 0.5) centraliza o elemento na tela —
    # comportamento documentado no THEMES-DEV.md.
    box = resolve_element_box(pos=(0.5, 0.5), size=(0.2, 0.2), origin=(0.5, 0.5), reference=REFERENCE)

    center_x = box.x + box.width / 2
    center_y = box.y + box.height / 2
    assert center_x == pytest.approx(1920 / 2)
    assert center_y == pytest.approx(1080 / 2)


@pytest.mark.parametrize(
    "pos,size,origin",
    [
        ((0.0, 0.0), (0.25, 0.155), (0.0, 0.0)),
        ((0.5, 0.5), (0.8, 0.8), (0.5, 0.5)),
        ((1.0, 1.0), (0.1, 0.1), (1.0, 1.0)),
        ((0.27, 0.32), (0.12, 0.41), (0.5, 0.5)),
    ],
)
def test_resolve_and_invert_round_trip(pos, size, origin):
    box = resolve_element_box(pos=pos, size=size, origin=origin, reference=REFERENCE)
    top_left = PixelPoint(x=box.x, y=box.y)

    recovered_pos = box_top_left_to_pos(top_left, size=size, origin=origin, reference=REFERENCE)

    assert recovered_pos[0] == pytest.approx(pos[0])
    assert recovered_pos[1] == pytest.approx(pos[1])
