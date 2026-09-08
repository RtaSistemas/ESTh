"""
Testes de es_de_elements.py — guarda de regressão pra fatos conferidos
contra o THEMES.md real (gitlab.com/es-de/emulationstation-de), documentados
no CLAUDE.md.
"""

from app.schema.es_de_elements import ELEMENTS

PRIMARY_TAGS = {"carousel", "grid", "textlist"}
SECONDARY_MULTIPLE_TAGS = {
    "image", "text", "video", "badges", "rating", "datetime", "gamelistinfo",
    "helpsystem", "clock", "systemstatus",
}
# helpsystem/clock/systemstatus são elementos especiais: sempre desenham por
# cima de tudo (exceto o menu) e não têm prop `zIndex` no ES-DE real.
SPECIAL_NO_ZINDEX_TAGS = {"helpsystem", "clock", "systemstatus"}
# helpsystem/systemstatus também não têm `size` — systemstatus usa `height`
# em vez disso; clock TEM `size` (default None, semântica de auto-ajuste).
SPECIAL_NO_SIZE_TAGS = {"helpsystem", "systemstatus"}


def test_all_expected_elements_present():
    assert set(ELEMENTS.keys()) == PRIMARY_TAGS | SECONDARY_MULTIPLE_TAGS


def test_primary_elements_are_single_instance_per_view():
    for tag in PRIMARY_TAGS:
        assert ELEMENTS[tag].group == "primary"
        assert ELEMENTS[tag].instances_per_view == "single"


def test_secondary_elements_allow_multiple_instances():
    for tag in SECONDARY_MULTIPLE_TAGS:
        assert ELEMENTS[tag].group == "secondary"
        assert ELEMENTS[tag].instances_per_view == "multiple"


def test_helpsystem_has_no_size_or_zindex_but_has_pos_and_origin():
    helpsystem = ELEMENTS["helpsystem"]
    prop_names = {p.name for p in helpsystem.properties}
    assert "size" not in prop_names
    assert "zIndex" not in prop_names
    assert {"pos", "origin"} <= prop_names


def test_systemstatus_has_no_size_or_zindex_but_has_pos_origin_and_height():
    systemstatus = ELEMENTS["systemstatus"]
    prop_names = {p.name for p in systemstatus.properties}
    assert "size" not in prop_names
    assert "zIndex" not in prop_names
    assert {"pos", "origin", "height"} <= prop_names


def test_clock_has_size_prop_but_no_default_and_no_zindex():
    clock = ELEMENTS["clock"]
    prop_by_name = {p.name: p for p in clock.properties}
    assert "size" in prop_by_name
    assert prop_by_name["size"].default is None
    assert "zIndex" not in prop_by_name
    assert prop_by_name["pos"].default == (0.018, 0.016)


def test_every_element_has_pos_and_origin_props():
    # pos/origin existem em todo elemento do schema (mesmo quando pos não
    # tem default real) — só size/zIndex variam por elemento especial.
    for tag, element_def in ELEMENTS.items():
        prop_names = {p.name for p in element_def.properties}
        assert {"pos", "origin"} <= prop_names, f"<{tag}> não tem pos/origin"


def test_every_element_except_special_no_size_has_size_prop():
    for tag, element_def in ELEMENTS.items():
        if tag in SPECIAL_NO_SIZE_TAGS:
            continue
        prop_names = {p.name for p in element_def.properties}
        assert "size" in prop_names, f"<{tag}> não tem size"


def test_every_element_except_special_no_zindex_has_zindex_prop():
    for tag, element_def in ELEMENTS.items():
        if tag in SPECIAL_NO_ZINDEX_TAGS:
            continue
        prop_names = {p.name for p in element_def.properties}
        assert "zIndex" in prop_names, f"<{tag}> não tem zIndex"


def test_primary_elements_have_real_documented_pos_size_origin_defaults():
    # carousel/grid/textlist têm defaults reais e distintos entre si — não
    # é uma caixa genérica compartilhada (bug corrigido: COMMON_TRANSFORM_PROPS
    # não deve mais alimentar esses três com um default inventado).
    expected = {
        "carousel": {"pos": (0.0, 0.38378), "size": (1.0, 0.2324)},
        "grid": {"pos": (0.0, 0.1), "size": (1.0, 0.8)},
        "textlist": {"pos": (0.0, 0.1), "size": (1.0, 0.8)},
    }
    for tag, expected_values in expected.items():
        prop_by_name = {p.name: p for p in ELEMENTS[tag].properties}
        assert prop_by_name["pos"].default == expected_values["pos"]
        assert prop_by_name["size"].default == expected_values["size"]
        assert prop_by_name["origin"].default == (0.0, 0.0)


def test_elements_without_any_real_pos_size_default_stay_none():
    # image/video/text/datetime/gamelistinfo: o ES-DE real não documenta
    # NENHUM default pra pos/size desses elementos — herdar um valor
    # inventado seria menos honesto que deixar `None` (o próprio tema tem
    # que fornecer, normalmente via <include>/<aspectRatio> ainda não
    # suportado por este editor).
    for tag in ("image", "video", "text", "datetime", "gamelistinfo"):
        prop_by_name = {p.name: p for p in ELEMENTS[tag].properties}
        assert prop_by_name["pos"].default is None, tag
        assert prop_by_name["size"].default is None, tag


def test_badges_and_rating_have_size_default_but_no_pos_default():
    assert {p.name: p for p in ELEMENTS["badges"].properties}["size"].default == (0.15, 0.20)
    assert {p.name: p for p in ELEMENTS["badges"].properties}["pos"].default is None
    assert {p.name: p for p in ELEMENTS["rating"].properties}["size"].default == (0.0, 0.06)
    assert {p.name: p for p in ELEMENTS["rating"].properties}["pos"].default is None
