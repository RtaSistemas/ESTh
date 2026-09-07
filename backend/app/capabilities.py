"""
Parser de capabilities.xml (ES-DE).

Escopo desta rodada: apenas <colorScheme>. `<variant>`, `<fontSize>`,
`<aspectRatio>`, `<language>`, `<transitions>` seguem fora do escopo,
mesma decisão registrada para o item 1 do editor.
"""

from lxml import etree


class CapabilitiesParseError(Exception):
    pass


def parse_capabilities_xml(xml_bytes: bytes) -> list[dict]:
    """
    Retorna: [{"name": "dark", "displayName": "Dark"}, ...]
    """
    try:
        root = etree.fromstring(xml_bytes)
    except etree.XMLSyntaxError as exc:
        raise CapabilitiesParseError(f"XML malformado: {exc}") from exc

    schemes = []
    for node in root.findall("colorScheme"):
        name = node.get("name", "")
        display_name_node = node.find("displayName")
        display_name = display_name_node.text.strip() if display_name_node is not None and display_name_node.text else name
        schemes.append({"name": name, "displayName": display_name})

    return schemes
