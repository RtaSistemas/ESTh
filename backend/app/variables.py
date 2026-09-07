"""
Parser de um arquivo de variáveis do ES-DE (o padrão usado por temas como o
Iconic para implementar colorScheme: um arquivo por esquema, incluído
condicionalmente via `${colorScheme.name}` no path do <include>).

Escopo: bloco <variables> plano (nome -> valor texto). Variáveis aninhadas
ou geradas por outras dimensões (fontSize, language) ficam fora por ora.
"""

from lxml import etree


class VariablesParseError(Exception):
    pass


def parse_variables_xml(xml_bytes: bytes) -> dict[str, str]:
    """
    Retorna: {"gameNameColor": "000000FF", "systemCarouselColor": "445566FF", ...}
    """
    try:
        root = etree.fromstring(xml_bytes)
    except etree.XMLSyntaxError as exc:
        raise VariablesParseError(f"XML malformado: {exc}") from exc

    variables_node = root.find("variables")
    if variables_node is None:
        raise VariablesParseError("Bloco <variables> não encontrado")

    return {
        child.tag: (child.text or "").strip()
        for child in variables_node
    }
