"""
Serializer: modelo interno -> theme.xml (ES-DE).

Inverso do parser.py. Gera XML formatado (indentado) para ficar legível e
diffável em controle de versão, já que o usuário provavelmente vai versionar
o tema com git.
"""

from lxml import etree

from .schema.es_de_elements import PropType


def _format_value(value, prop_type: PropType) -> str:
    if prop_type == PropType.NORMALIZED_PAIR:
        x, y = value
        return f"{x:.5f} {y:.5f}"
    if prop_type == PropType.BOOLEAN:
        return "true" if value else "false"
    if prop_type == PropType.FLOAT:
        return f"{value:.5f}".rstrip("0").rstrip(".")
    if prop_type == PropType.UNSIGNED_INTEGER:
        return str(int(value))
    return str(value)


def serialize_theme(model: dict) -> bytes:
    from .schema.es_de_elements import ELEMENTS

    root = etree.Element("theme")

    variables = model.get("variables") or {}
    if variables:
        variables_node = etree.SubElement(root, "variables")
        for var_name, var_value in variables.items():
            var_node = etree.SubElement(variables_node, var_name)
            var_node.text = str(var_value)

    for view_name, elements in model.get("views", {}).items():
        if not elements:
            continue
        view_node = etree.SubElement(root, "view", name=view_name)

        for element in elements:
            element_def = ELEMENTS[element["type"]]
            prop_defs_by_name = {p.name: p for p in element_def.properties}

            element_node = etree.SubElement(view_node, element["type"], name=element["name"])
            for prop_name, value in element["properties"].items():
                prop_def = prop_defs_by_name.get(prop_name)
                if prop_def is None:
                    continue  # não deveria acontecer se o modelo veio do parser/editor
                prop_node = etree.SubElement(element_node, prop_name)
                prop_node.text = _format_value(value, prop_def.type)

    return etree.tostring(root, pretty_print=True, xml_declaration=False, encoding="UTF-8")
