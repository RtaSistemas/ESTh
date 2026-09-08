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
        # ES-DE real (cruzado contra o tema Iconic) usa <label>, não
        # <displayName> — aceitamos os dois, `label` primeiro por ser o
        # que aparece em tema publicado de verdade, com `displayName`
        # como alternativa e o `name` cru como último recurso.
        display_name = name
        for tag in ("label", "displayName"):
            child = node.find(tag)
            if child is not None and child.text and child.text.strip():
                display_name = child.text.strip()
                break
        schemes.append({"name": name, "displayName": display_name})

    return schemes
