"""
Testes de es_de_elements.py — guarda de regressão pras armadilhas já
documentadas no CLAUDE.md (instancesPerView "single" pros primários).
"""

from app.schema.es_de_elements import ELEMENTS

PRIMARY_TAGS = {"carousel", "grid", "textlist"}
SECONDARY_TAGS = {"image", "text", "video", "badges", "rating", "datetime", "gamelistinfo"}


def test_all_expected_elements_present():
    assert set(ELEMENTS.keys()) == PRIMARY_TAGS | SECONDARY_TAGS


def test_primary_elements_are_single_instance_per_view():
    for tag in PRIMARY_TAGS:
        assert ELEMENTS[tag].group == "primary"
        assert ELEMENTS[tag].instances_per_view == "single"


def test_secondary_elements_allow_multiple_instances():
    for tag in SECONDARY_TAGS:
        assert ELEMENTS[tag].group == "secondary"
        assert ELEMENTS[tag].instances_per_view == "multiple"


def test_every_element_has_common_transform_properties():
    common = {"pos", "size", "origin", "zIndex"}
    for tag, element_def in ELEMENTS.items():
        prop_names = {p.name for p in element_def.properties}
        missing = common - prop_names
        assert not missing, f"<{tag}> não tem {missing}"
