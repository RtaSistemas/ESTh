"""
Geometria de posicionamento normalizado (0..1) do ES-DE.

Aplica o mesmo princípio de precisão geométrica usado no Box3D (onde um
invariante de referência - lá 8192px - ancora todo cálculo de escala):
aqui o invariante de referência é a REFERENCE_RESOLUTION do schema, e todo
pos/size/origin do tema é convertido para essa base antes de ir para o
canvas, e reconvertido para normalizado antes de voltar ao XML.

Isso garante que o editor nunca acumula erro de arredondamento visível ao
alternar entre "editar visualmente" e "editar valor numérico".
"""

from dataclasses import dataclass

from .schema.es_de_elements import REFERENCE_RESOLUTION


@dataclass(frozen=True)
class PixelPoint:
    x: float
    y: float


@dataclass(frozen=True)
class PixelBox:
    """Retângulo em pixels já resolvendo `origin`, pronto para desenhar no canvas."""
    x: float
    y: float
    width: float
    height: float


def normalized_to_pixels(
    value: tuple[float, float],
    reference: tuple[int, int] = REFERENCE_RESOLUTION,
) -> PixelPoint:
    """Converte um NORMALIZED_PAIR (pos ou size) para pixels na resolução de referência."""
    ref_w, ref_h = reference
    x, y = value
    return PixelPoint(x=x * ref_w, y=y * ref_h)


def pixels_to_normalized(
    point: PixelPoint,
    reference: tuple[int, int] = REFERENCE_RESOLUTION,
) -> tuple[float, float]:
    """Inverso de normalized_to_pixels — usado ao arrastar um elemento no canvas."""
    ref_w, ref_h = reference
    return (point.x / ref_w, point.y / ref_h)


def resolve_element_box(
    pos: tuple[float, float],
    size: tuple[float, float],
    origin: tuple[float, float] = (0.0, 0.0),
    reference: tuple[int, int] = REFERENCE_RESOLUTION,
) -> PixelBox:
    """
    Resolve pos + size + origin para um retângulo em pixels pronto para desenho.

    `origin` define qual ponto do elemento coincide com `pos`. Ex.: origin
    (0.5, 0.5) com pos (0.5, 0.5) centraliza o elemento na tela — replica o
    comportamento documentado no THEMES-DEV.md.
    """
    pos_px = normalized_to_pixels(pos, reference)
    size_px = normalized_to_pixels(size, reference)

    top_left_x = pos_px.x - (origin[0] * size_px.x)
    top_left_y = pos_px.y - (origin[1] * size_px.y)

    return PixelBox(x=top_left_x, y=top_left_y, width=size_px.x, height=size_px.y)


def box_top_left_to_pos(
    box_top_left: PixelPoint,
    size: tuple[float, float],
    origin: tuple[float, float] = (0.0, 0.0),
    reference: tuple[int, int] = REFERENCE_RESOLUTION,
) -> tuple[float, float]:
    """
    Inverso de resolve_element_box — usado quando o usuário arrasta um elemento
    no canvas e precisamos gravar de volta o `pos` normalizado no modelo/XML.
    """
    size_px = normalized_to_pixels(size, reference)
    pos_px_x = box_top_left.x + (origin[0] * size_px.x)
    pos_px_y = box_top_left.y + (origin[1] * size_px.y)
    return pixels_to_normalized(PixelPoint(pos_px_x, pos_px_y), reference)
