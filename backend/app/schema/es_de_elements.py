"""
Schema declarativo dos elementos de tema ES-DE.

Fonte: THEMES-DEV.md (gitlab.com/es-de/emulationstation-de) + tema Iconic
(github.com/Siddy212/iconic-es-de) como referência de uso real.

Este é o ÚNICO lugar onde "o que é um elemento ES-DE e quais propriedades
ele aceita" é definido no backend. O parser, o serializer e a validação
leem daqui. Não deve haver conhecimento duplicado do schema em outro
arquivo Python.

Escopo: elementos necessários para posicionar objetos visualmente, dos
primários (`carousel`, `grid`, `textlist`) aos secundários mais comuns
(`image`, `text`, `video`, `badges`, `rating`, `datetime`, `gamelistinfo`).

NOTA DE PRECISÃO: `carousel`, `image` e `text` foram cruzados diretamente
contra o THEMES-DEV.md e o tema Iconic (ver conversa que originou o
projeto). Os elementos adicionados na rodada de expansão (`grid`,
`textlist`, `video`, `badges`, `rating`, `datetime`, `gamelistinfo`) seguem
o mesmo padrão estrutural, mas o conjunto exato de propriedades é um
subconjunto de melhor esforço focado em geometria/posicionamento — vale
revalidar contra o THEMES-DEV.md antes de expandir além disso. `sound`,
`helpsystem`, `<variant>`, `<aspectRatio>` continuam fora do escopo.
"""

from dataclasses import dataclass, field
from enum import Enum


class PropType(str, Enum):
    NORMALIZED_PAIR = "NORMALIZED_PAIR"  # "x y", 0..1 (pode passar de 1)
    PATH = "PATH"
    BOOLEAN = "BOOLEAN"
    COLOR = "COLOR"                       # hex RGB ou RGBA
    UNSIGNED_INTEGER = "UNSIGNED_INTEGER"
    FLOAT = "FLOAT"
    STRING = "STRING"


@dataclass(frozen=True)
class PropertyDef:
    name: str
    type: PropType
    default: object
    min_value: float | None = None
    max_value: float | None = None
    valid_values: tuple[str, ...] | None = None  # para STRING com enum fechado
    only_when: str | None = None  # nota textual de restrição condicional (ex: "type == horizontalWheel")


@dataclass(frozen=True)
class ElementDef:
    tag: str                    # nome da tag XML, ex: "carousel"
    group: str                  # "primary" | "secondary"
    views: tuple[str, ...]      # views onde pode aparecer: "system", "gamelist"
    instances_per_view: str     # "single" (primário) ou "multiple" (secundário)
    default_z_index: int
    properties: tuple[PropertyDef, ...]


# ---------------------------------------------------------------------------
# Propriedades comuns a praticamente todo elemento visual (pos/size/origin)
# ---------------------------------------------------------------------------
COMMON_TRANSFORM_PROPS = (
    PropertyDef("pos", PropType.NORMALIZED_PAIR, default=(0.0, 0.0)),
    PropertyDef("size", PropType.NORMALIZED_PAIR, default=(0.25, 0.155)),
    PropertyDef("origin", PropType.NORMALIZED_PAIR, default=(0.0, 0.0),
                min_value=0.0, max_value=1.0),
    PropertyDef("zIndex", PropType.UNSIGNED_INTEGER, default=None),  # default varia por elemento
)


# ---------------------------------------------------------------------------
# carousel (primário) — subset das propriedades mais usadas para posicionamento
# (o schema completo do THEMES-DEV.md tem ~40 propriedades; aqui priorizamos
# geometria/posição, que é o escopo do item 1)
# ---------------------------------------------------------------------------
CAROUSEL = ElementDef(
    tag="carousel",
    group="primary",
    views=("system", "gamelist"),
    instances_per_view="single",
    default_z_index=50,
    properties=COMMON_TRANSFORM_PROPS + (
        PropertyDef("type", PropType.STRING, default="horizontal",
                    valid_values=("horizontal", "vertical", "horizontalWheel", "verticalWheel")),
        PropertyDef("itemSize", PropType.NORMALIZED_PAIR, default=(0.25, 0.155),
                    min_value=0.05, max_value=1.0),
        PropertyDef("itemScale", PropType.FLOAT, default=1.2, min_value=0.2, max_value=3.0),
        PropertyDef("maxItemCount", PropType.FLOAT, default=3.0, min_value=0.5, max_value=30.0,
                    only_when="type in (horizontal, vertical)"),
        PropertyDef("horizontalOffset", PropType.FLOAT, default=0.0, min_value=-1.0, max_value=1.0),
        PropertyDef("verticalOffset", PropType.FLOAT, default=0.0, min_value=-1.0, max_value=1.0),
    ),
)

# ---------------------------------------------------------------------------
# image (secundário)
# ---------------------------------------------------------------------------
IMAGE = ElementDef(
    tag="image",
    group="secondary",
    views=("system", "gamelist"),
    instances_per_view="multiple",
    default_z_index=30,
    properties=COMMON_TRANSFORM_PROPS + (
        PropertyDef("path", PropType.PATH, default=None),
        PropertyDef("tile", PropType.BOOLEAN, default=False),
        PropertyDef("color", PropType.COLOR, default="FFFFFFFF"),
        PropertyDef("imageCornerRadius", PropType.FLOAT, default=0.0, min_value=0.0, max_value=0.5),
    ),
)

# ---------------------------------------------------------------------------
# text (secundário)
# ---------------------------------------------------------------------------
TEXT = ElementDef(
    tag="text",
    group="secondary",
    views=("system", "gamelist"),
    instances_per_view="multiple",
    default_z_index=40,
    properties=COMMON_TRANSFORM_PROPS + (
        PropertyDef("text", PropType.STRING, default=""),
        PropertyDef("fontPath", PropType.PATH, default=None),
        PropertyDef("fontSize", PropType.FLOAT, default=0.045),
        PropertyDef("color", PropType.COLOR, default="000000FF"),
        PropertyDef("horizontalAlignment", PropType.STRING, default="left",
                    valid_values=("left", "center", "right")),
        PropertyDef("verticalAlignment", PropType.STRING, default="center",
                    valid_values=("top", "center", "bottom")),
        PropertyDef("letterCase", PropType.STRING, default="none",
                    valid_values=("none", "uppercase", "lowercase", "capitalize")),
    ),
)

# ---------------------------------------------------------------------------
# grid (primário) — geometria + parâmetros de layout de grade
# ---------------------------------------------------------------------------
GRID = ElementDef(
    tag="grid",
    group="primary",
    views=("system", "gamelist"),
    instances_per_view="single",
    default_z_index=50,
    properties=COMMON_TRANSFORM_PROPS + (
        PropertyDef("itemSize", PropType.NORMALIZED_PAIR, default=(0.15, 0.2)),
        PropertyDef("itemScale", PropType.FLOAT, default=1.05, min_value=0.2, max_value=3.0),
        PropertyDef("itemSpacing", PropType.NORMALIZED_PAIR, default=(0.01, 0.01)),
        PropertyDef("rows", PropType.FLOAT, default=3.0, min_value=1.0, max_value=20.0),
        PropertyDef("columns", PropType.FLOAT, default=5.0, min_value=1.0, max_value=20.0),
    ),
)

# ---------------------------------------------------------------------------
# textlist (primário) — geometria + tipografia/seleção
# ---------------------------------------------------------------------------
TEXTLIST = ElementDef(
    tag="textlist",
    group="primary",
    views=("system", "gamelist"),
    instances_per_view="single",
    default_z_index=50,
    properties=COMMON_TRANSFORM_PROPS + (
        PropertyDef("selectorHeight", PropType.FLOAT, default=0.056, min_value=0.01, max_value=1.0),
        PropertyDef("fontSize", PropType.FLOAT, default=0.045),
        PropertyDef("horizontalAlignment", PropType.STRING, default="left",
                    valid_values=("left", "center", "right")),
        PropertyDef("color", PropType.COLOR, default="000000FF"),
        PropertyDef("selectorColor", PropType.COLOR, default="0000FFFF"),
    ),
)

# ---------------------------------------------------------------------------
# video (secundário)
# ---------------------------------------------------------------------------
VIDEO = ElementDef(
    tag="video",
    group="secondary",
    views=("gamelist",),
    instances_per_view="multiple",
    default_z_index=30,
    properties=COMMON_TRANSFORM_PROPS + (
        PropertyDef("path", PropType.PATH, default=None),
        PropertyDef("defaultImagePath", PropType.PATH, default=None),
        PropertyDef("audio", PropType.BOOLEAN, default=True),
        PropertyDef("imageCornerRadius", PropType.FLOAT, default=0.0, min_value=0.0, max_value=0.5),
    ),
)

# ---------------------------------------------------------------------------
# badges (secundário)
# ---------------------------------------------------------------------------
BADGES = ElementDef(
    tag="badges",
    group="secondary",
    views=("gamelist",),
    instances_per_view="multiple",
    default_z_index=35,
    properties=COMMON_TRANSFORM_PROPS + (
        PropertyDef("direction", PropType.STRING, default="row", valid_values=("row", "column")),
        PropertyDef("itemsPerRow", PropType.FLOAT, default=4.0, min_value=1.0, max_value=10.0),
        PropertyDef("itemMargin", PropType.NORMALIZED_PAIR, default=(0.007, 0.007)),
    ),
)

# ---------------------------------------------------------------------------
# rating (secundário)
# ---------------------------------------------------------------------------
RATING = ElementDef(
    tag="rating",
    group="secondary",
    views=("gamelist",),
    instances_per_view="multiple",
    default_z_index=35,
    properties=COMMON_TRANSFORM_PROPS + (
        PropertyDef("filledPath", PropType.PATH, default=None),
        PropertyDef("unfilledPath", PropType.PATH, default=None),
        PropertyDef("color", PropType.COLOR, default="FFFFFFFF"),
    ),
)

# ---------------------------------------------------------------------------
# datetime (secundário)
# ---------------------------------------------------------------------------
DATETIME = ElementDef(
    tag="datetime",
    group="secondary",
    views=("gamelist",),
    instances_per_view="multiple",
    default_z_index=40,
    properties=COMMON_TRANSFORM_PROPS + (
        PropertyDef("fontSize", PropType.FLOAT, default=0.035),
        PropertyDef("color", PropType.COLOR, default="000000FF"),
        PropertyDef("format", PropType.STRING, default="%Y-%m-%d"),
        PropertyDef("displayRelative", PropType.BOOLEAN, default=False),
        PropertyDef("horizontalAlignment", PropType.STRING, default="left",
                    valid_values=("left", "center", "right")),
    ),
)

# ---------------------------------------------------------------------------
# gamelistinfo (secundário) — contador "X/Y jogos ocultos etc."
# ---------------------------------------------------------------------------
GAMELISTINFO = ElementDef(
    tag="gamelistinfo",
    group="secondary",
    views=("gamelist",),
    instances_per_view="multiple",
    default_z_index=40,
    properties=COMMON_TRANSFORM_PROPS + (
        PropertyDef("fontSize", PropType.FLOAT, default=0.035),
        PropertyDef("color", PropType.COLOR, default="000000FF"),
        PropertyDef("horizontalAlignment", PropType.STRING, default="right",
                    valid_values=("left", "center", "right")),
    ),
)

ELEMENTS: dict[str, ElementDef] = {
    e.tag: e for e in (
        CAROUSEL, IMAGE, TEXT,
        GRID, TEXTLIST, VIDEO, BADGES, RATING, DATETIME, GAMELISTINFO,
    )
}

# Resolução de referência para converter normalizado <-> pixel no preview.
# Full HD, conforme decidido para o editor (16:9 é o aspectRatio-alvo inicial,
# espelhando o arquivo aspect-ratio-16-9-detailed.xml do tema Iconic).
REFERENCE_RESOLUTION = (1920, 1080)
