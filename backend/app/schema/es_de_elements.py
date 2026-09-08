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
(`image`, `text`, `video`, `badges`, `rating`, `datetime`, `gamelistinfo`,
`helpsystem`).

NOTA DE PRECISÃO: `carousel`, `image`, `text` e `helpsystem` foram
cruzados diretamente contra um clone real do tema Iconic (CC0,
github.com/Siddy212/iconic-es-de, arquivo
aspect-ratio-16-9-detailed.xml). Os demais elementos adicionados na
rodada de expansão (`grid`, `textlist`, `video`, `badges`, `rating`,
`datetime`, `gamelistinfo`) seguem o mesmo padrão estrutural, mas o
conjunto exato de propriedades é um subconjunto de melhor esforço focado
em geometria/posicionamento — vale revalidar contra o THEMES-DEV.md antes
de expandir além disso.

`sound` fica de fora de propósito: só existe sob `<view name="all">`
(navegação/sons globais), que o modelo interno não representa (só
"system"/"gamelist") — antes de dar suporte, precisaria expandir o
modelo pra ter uma terceira chave de view, e `sound` não tem posição
visual nenhuma (só `path`), então nem se encaixa no "escopo" acima desta
docstring. `<variant>`, `<include>`, `<aspectRatio>` continuam fora do
escopo (confirmado que o tema Iconic real usa os três pesadamente).
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

# ---------------------------------------------------------------------------
# helpsystem (secundário) — a barra de dicas de botão no rodapé.
#
# Cruzado contra o tema Iconic de verdade (github.com/Siddy212/iconic-es-de,
# arquivo aspect-ratio-16-9-detailed.xml): ao contrário de todo outro
# elemento aqui, helpsystem NÃO tem `size` nem `zIndex` no ES-DE real — por
# isso não usa COMMON_TRANSFORM_PROPS. Tem uma variante "dimmed" de pos/
# origin (posDimmed/originDimmed) pra quando o help fica esmaecido.
# `customButtonIcon` (ícone por botão, um elemento repetido com atributo
# `button`) existe no tema real mas não cabe no modelo de propriedade
# plana usado aqui — fica de fora, cai como propriedade não suportada.
# ---------------------------------------------------------------------------
HELPSYSTEM = ElementDef(
    tag="helpsystem",
    group="secondary",
    views=("system", "gamelist"),
    instances_per_view="single",
    default_z_index=900,  # sem prop zIndex própria; alto só de referência (desenha por cima)
    properties=(
        PropertyDef("pos", PropType.NORMALIZED_PAIR, default=(0.5, 0.982)),
        PropertyDef("origin", PropType.NORMALIZED_PAIR, default=(0.5, 1.0),
                    min_value=0.0, max_value=1.0),
        PropertyDef("posDimmed", PropType.NORMALIZED_PAIR, default=(0.5, 0.965)),
        PropertyDef("originDimmed", PropType.NORMALIZED_PAIR, default=(0.5, 1.0),
                    min_value=0.0, max_value=1.0),
        PropertyDef("fontPath", PropType.PATH, default=None),
        PropertyDef("fontSize", PropType.FLOAT, default=0.018),
        PropertyDef("entrySpacing", PropType.FLOAT, default=0.004, min_value=0.0),
        PropertyDef("iconTextSpacing", PropType.FLOAT, default=0.002, min_value=0.0),
        PropertyDef("textColor", PropType.COLOR, default="777777FF"),
        PropertyDef("textColorDimmed", PropType.COLOR, default="777777FF"),
        PropertyDef("iconColor", PropType.COLOR, default="777777FF"),
        PropertyDef("iconColorDimmed", PropType.COLOR, default="777777FF"),
    ),
)

ELEMENTS: dict[str, ElementDef] = {
    e.tag: e for e in (
        CAROUSEL, IMAGE, TEXT,
        GRID, TEXTLIST, VIDEO, BADGES, RATING, DATETIME, GAMELISTINFO,
        HELPSYSTEM,
    )
}

# Resolução de referência para converter normalizado <-> pixel no preview.
# Full HD, conforme decidido para o editor (16:9 é o aspectRatio-alvo inicial,
# espelhando o arquivo aspect-ratio-16-9-detailed.xml do tema Iconic).
REFERENCE_RESOLUTION = (1920, 1080)
