"""
Testes de es_de_elements.py — guarda de regressão pras armadilhas já
documentadas no CLAUDE.md (instancesPerView "single" pros primários).
"""

from app.schema.es_de_elements import ELEMENTS

PRIMARY_TAGS = {"carousel", "grid", "textlist"}
# helpsystem é secundário mas "single" (só faz sentido uma barra de ajuda
# por view) e SEM size/zIndex — ao contrário de todo outro elemento, real
# no ES-DE (cruzado contra o tema Iconic), não uma omissão.
SECONDARY_MULTIPLE_TAGS = {"image", "text", "video", "badges", "rating", "datetime", "gamelistinfo"}
SECONDARY_SINGLE_NO_SIZE_TAGS = {"helpsystem"}


def test_all_expected_elements_present():
    assert set(ELEMENTS.keys()) == PRIMARY_TAGS | SECONDARY_MULTIPLE_TAGS | SECONDARY_SINGLE_NO_SIZE_TAGS


def test_primary_elements_are_single_instance_per_view():
    for tag in PRIMARY_TAGS:
        assert ELEMENTS[tag].group == "primary"
        assert ELEMENTS[tag].instances_per_view == "single"


def test_secondary_elements_allow_multiple_instances():
    for tag in SECONDARY_MULTIPLE_TAGS:
        assert ELEMENTS[tag].group == "secondary"
        assert ELEMENTS[tag].instances_per_view == "multiple"


def test_helpsystem_is_single_instance_without_size_or_zindex():
    helpsystem = ELEMENTS["helpsystem"]
    assert helpsystem.group == "secondary"
    assert helpsystem.instances_per_view == "single"
    prop_names = {p.name for p in helpsystem.properties}
    assert "size" not in prop_names
    assert "zIndex" not in prop_names
    assert {"pos", "origin"} <= prop_names


def test_every_element_except_helpsystem_has_common_transform_properties():
    common = {"pos", "size", "origin", "zIndex"}
    for tag, element_def in ELEMENTS.items():
        if tag in SECONDARY_SINGLE_NO_SIZE_TAGS:
            continue
        prop_names = {p.name for p in element_def.properties}
        missing = common - prop_names
        assert not missing, f"<{tag}> não tem {missing}"
