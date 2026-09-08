"""
Schema declarativo dos elementos de tema ES-DE.

Fonte: THEMES.md real (baixado de
gitlab.com/es-de/emulationstation-de/-/raw/master/THEMES.md) + tema Iconic
(github.com/Siddy212/iconic-es-de) como referência de uso real.

Este é o ÚNICO lugar onde "o que é um elemento ES-DE e quais propriedades
ele aceita" é definido no backend. O parser, o serializer e a validação
leem daqui. Não deve haver conhecimento duplicado do schema em outro
arquivo Python.

Escopo: elementos necessários para posicionar objetos visualmente, dos
primários (`carousel`, `grid`, `textlist`) aos secundários mais comuns
(`image`, `text`, `video`, `badges`, `rating`, `datetime`, `gamelistinfo`)
e especiais (`helpsystem`, `clock`, `systemstatus`).

NOTA DE PRECISÃO (validado contra o THEMES.md real, não por memória): os
valores `default=` de `pos`/`size`/`origin`/`zIndex` abaixo foram
conferidos um a um contra a documentação oficial. Achados relevantes:
- Nem todo elemento tem default de `pos`/`size` — `image`, `video`,
  `animation`, `text`, `datetime`, `gamelistinfo` **não têm nenhum**
  (o THEMES.md não lista "Default is" para essas props nesses
  elementos); `badges`/`rating` têm default de `size` mas não de `pos`.
  Nesses casos o `default` fica `None` de propósito — não é uma lacuna,
  é o próprio ES-DE que exige valor explícito no tema (normalmente vindo
  de um arquivo de `<include>`/`<aspectRatio>` que este editor ainda não
  processa).
- `carousel`/`grid`/`textlist` (primários) têm `pos`+`size`+`origin`
  default reais e distintos entre si — não é uma caixa genérica.
- `helpsystem` é `instances_per_view="multiple"` (o THEMES.md diz
  literalmente "Instances per view: unlimited" e descreve como dividir
  entradas entre várias instâncias) — a suposição anterior de que seria
  `single` estava errada, não confirmada contra a doc real na época.
  Mesma correção vale por natureza para `clock`/`systemstatus`.

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
# Propriedades comuns a praticamente todo elemento visual (pos/size/origin).
#
# `pos` e `size` NÃO têm default genérico real no ES-DE — cada elemento
# documenta o seu (ou nenhum). Por isso ficam `None` aqui; cada ElementDef
# sobrescreve com o `PropertyDef` real quando o THEMES.md documenta um
# default para aquele elemento específico. `origin` é a única das quatro
# que É consistentemente `0 0` em todo elemento com essa prop — por isso
# fica fixa aqui.
# ---------------------------------------------------------------------------
COMMON_TRANSFORM_PROPS = (
    PropertyDef("pos", PropType.NORMALIZED_PAIR, default=None),
    PropertyDef("size", PropType.NORMALIZED_PAIR, default=None),
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
    properties=(
        PropertyDef("pos", PropType.NORMALIZED_PAIR, default=(0.0, 0.38378)),
        PropertyDef("size", PropType.NORMALIZED_PAIR, default=(1.0, 0.2324),
                    min_value=0.05, max_value=2.0),
        PropertyDef("origin", PropType.NORMALIZED_PAIR, default=(0.0, 0.0),
                    min_value=0.0, max_value=1.0),
        PropertyDef("zIndex", PropType.UNSIGNED_INTEGER, default=None),
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
    properties=(
        PropertyDef("pos", PropType.NORMALIZED_PAIR, default=(0.0, 0.1)),
        PropertyDef("size", PropType.NORMALIZED_PAIR, default=(1.0, 0.8),
                    min_value=0.05, max_value=2.0),
        PropertyDef("origin", PropType.NORMALIZED_PAIR, default=(0.0, 0.0),
                    min_value=0.0, max_value=1.0),
        PropertyDef("zIndex", PropType.UNSIGNED_INTEGER, default=None),
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
    properties=(
        PropertyDef("pos", PropType.NORMALIZED_PAIR, default=(0.0, 0.1)),
        PropertyDef("size", PropType.NORMALIZED_PAIR, default=(1.0, 0.8),
                    min_value=0.05, max_value=2.0),
        PropertyDef("origin", PropType.NORMALIZED_PAIR, default=(0.0, 0.0),
                    min_value=0.0, max_value=1.0),
        PropertyDef("zIndex", PropType.UNSIGNED_INTEGER, default=None),
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
    properties=(
        PropertyDef("pos", PropType.NORMALIZED_PAIR, default=None),
        PropertyDef("size", PropType.NORMALIZED_PAIR, default=(0.15, 0.20),
                    min_value=0.03, max_value=1.0),
        PropertyDef("origin", PropType.NORMALIZED_PAIR, default=(0.0, 0.0),
                    min_value=0.0, max_value=1.0),
        PropertyDef("zIndex", PropType.UNSIGNED_INTEGER, default=None),
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
    default_z_index=45,
    properties=(
        PropertyDef("pos", PropType.NORMALIZED_PAIR, default=None),
        PropertyDef("size", PropType.NORMALIZED_PAIR, default=(0.0, 0.06),
                    min_value=0.01, max_value=1.0),
        PropertyDef("origin", PropType.NORMALIZED_PAIR, default=(0.0, 0.0),
                    min_value=0.0, max_value=1.0),
        PropertyDef("zIndex", PropType.UNSIGNED_INTEGER, default=None),
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
    default_z_index=45,
    properties=COMMON_TRANSFORM_PROPS + (
        PropertyDef("fontSize", PropType.FLOAT, default=0.035),
        PropertyDef("color", PropType.COLOR, default="000000FF"),
        PropertyDef("horizontalAlignment", PropType.STRING, default="right",
                    valid_values=("left", "center", "right")),
    ),
)

# ---------------------------------------------------------------------------
# helpsystem (especial) — a barra de dicas de botão no rodapé.
#
# Valores conferidos contra o THEMES.md real (não por memória). Correções
# em relação à versão anterior deste schema:
# - `instances_per_view` era "single" — a doc real diz "unlimited" e
#   descreve explicitamente como dividir entradas entre várias instâncias
#   de helpsystem. Corrigido para "multiple".
# - `pos`/`origin`/`posDimmed`/`originDimmed`/`fontSize`/`entrySpacing`/
#   `iconTextSpacing` tinham valores estimados; substituídos pelos
#   defaults documentados (a doc lista dois defaults, para telas na
#   horizontal e na vertical — usamos o valor "horizontal", já que
#   REFERENCE_RESOLUTION é 1920x1080).
# Continua sem `size`/`zIndex` — o ES-DE real não tem essas props pra
# este elemento (sempre desenha por cima de tudo, exceto o menu).
# `customButtonIcon` (ícone por botão, um elemento repetido com atributo
# `button`) existe no tema real mas não cabe no modelo de propriedade
# plana usado aqui — fica de fora, cai como propriedade não suportada.
# ---------------------------------------------------------------------------
HELPSYSTEM = ElementDef(
    tag="helpsystem",
    group="secondary",
    views=("system", "gamelist"),
    instances_per_view="multiple",
    default_z_index=900,  # sem prop zIndex própria; alto só de referência (desenha por cima)
    properties=(
        PropertyDef("pos", PropType.NORMALIZED_PAIR, default=(0.012, 0.9515)),
        PropertyDef("origin", PropType.NORMALIZED_PAIR, default=(0.0, 0.0),
                    min_value=0.0, max_value=1.0),
        PropertyDef("posDimmed", PropType.NORMALIZED_PAIR, default=(0.012, 0.9515)),
        PropertyDef("originDimmed", PropType.NORMALIZED_PAIR, default=(0.0, 0.0),
                    min_value=0.0, max_value=1.0),
        PropertyDef("fontPath", PropType.PATH, default=None),
        PropertyDef("fontSize", PropType.FLOAT, default=0.035, min_value=0.001, max_value=1.5),
        PropertyDef("entrySpacing", PropType.FLOAT, default=0.00833, min_value=0.0, max_value=0.04),
        PropertyDef("iconTextSpacing", PropType.FLOAT, default=0.00416, min_value=0.0, max_value=0.04),
        PropertyDef("textColor", PropType.COLOR, default="777777FF"),
        PropertyDef("textColorDimmed", PropType.COLOR, default="777777FF"),
        PropertyDef("iconColor", PropType.COLOR, default="777777FF"),
        PropertyDef("iconColorDimmed", PropType.COLOR, default="777777FF"),
    ),
)

# ---------------------------------------------------------------------------
# clock (especial) — relógio/data. Sem `zIndex` própria (sempre desenha por
# cima, igual helpsystem/systemstatus). `size` não tem default fixo no
# ES-DE real: "0 0" tem semântica própria de auto-ajuste ao texto (não é
# "sem valor", é um comportamento especial que este editor não simula) —
# por isso fica `None` aqui, igual aos elementos sem default nenhum.
# ---------------------------------------------------------------------------
CLOCK = ElementDef(
    tag="clock",
    group="secondary",
    views=("system", "gamelist"),
    instances_per_view="multiple",
    default_z_index=900,
    properties=(
        PropertyDef("pos", PropType.NORMALIZED_PAIR, default=(0.018, 0.016)),
        PropertyDef("size", PropType.NORMALIZED_PAIR, default=None),
        PropertyDef("origin", PropType.NORMALIZED_PAIR, default=(0.0, 0.0),
                    min_value=0.0, max_value=1.0),
        PropertyDef("fontPath", PropType.PATH, default=None),
        PropertyDef("fontSize", PropType.FLOAT, default=0.035, min_value=0.001, max_value=1.5),
        PropertyDef("horizontalAlignment", PropType.STRING, default="left",
                    valid_values=("left", "center", "right")),
        PropertyDef("verticalAlignment", PropType.STRING, default="center",
                    valid_values=("top", "center", "bottom")),
        PropertyDef("color", PropType.COLOR, default="FFFFFFFF"),
        PropertyDef("format", PropType.STRING, default="%H:%M"),
    ),
)

# ---------------------------------------------------------------------------
# systemstatus (especial) — indicadores de bluetooth/wi-fi/bateria. Sem
# `size` própria (largura é calculada automaticamente pelos ícones; altura
# vem de `height`, análogo a `fontSize`) e sem `zIndex` (mesma razão do
# helpsystem/clock).
# ---------------------------------------------------------------------------
SYSTEMSTATUS = ElementDef(
    tag="systemstatus",
    group="secondary",
    views=("system", "gamelist"),
    instances_per_view="multiple",
    default_z_index=900,
    properties=(
        PropertyDef("pos", PropType.NORMALIZED_PAIR, default=(0.982, 0.016)),
        PropertyDef("origin", PropType.NORMALIZED_PAIR, default=(1.0, 0.0),
                    min_value=0.0, max_value=1.0),
        PropertyDef("height", PropType.FLOAT, default=0.035, min_value=0.01, max_value=0.5),
    ),
)

ELEMENTS: dict[str, ElementDef] = {
    e.tag: e for e in (
        CAROUSEL, IMAGE, TEXT,
        GRID, TEXTLIST, VIDEO, BADGES, RATING, DATETIME, GAMELISTINFO,
        HELPSYSTEM, CLOCK, SYSTEMSTATUS,
    )
}

# Resolução de referência para converter normalizado <-> pixel no preview.
# Full HD, conforme decidido para o editor (16:9 é o aspectRatio-alvo inicial,
# espelhando o arquivo aspect-ratio-16-9-detailed.xml do tema Iconic).
REFERENCE_RESOLUTION = (1920, 1080)
