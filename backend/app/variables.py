"""
Parser de um arquivo de variáveis do ES-DE, associado a uma colorScheme.

Suporta os dois formatos reais encontrados em temas ES-DE:

1. Um arquivo por esquema — `<theme><variables>...</variables></theme>`
   plano, sem `<colorScheme>`. Suposição original deste módulo.
2. Todos os esquemas em um arquivo só — o formato real do `colors.xml` do
   tema Iconic (CC0, github.com/Siddy212/iconic-es-de): múltiplos
   `<colorScheme name="a,b,c,...">` (nomes separados por vírgula, cada um
   casando com um `name` de capabilities.xml) cada um com seu próprio
   `<variables>` aninhado. Descoberto testando com o arquivo real — a
   suposição "um arquivo por esquema" não cobria esse caso e fazia
   `parse_variables_xml` falhar (nenhum `<variables>` direto sob `<theme>`
   nesse formato).
"""

from lxml import etree


class VariablesParseError(Exception):
    pass


def _variables_from_node(variables_node) -> dict[str, str]:
    return {child.tag: (child.text or "").strip() for child in variables_node}


def parse_variables_xml(xml_bytes: bytes, scheme_name: str | None = None) -> dict[str, str]:
    """
    Retorna: {"gameNameColor": "000000FF", "systemCarouselColor": "445566FF", ...}

    `scheme_name` só é necessário (e usado) no formato 2 acima, pra saber
    qual bloco `<colorScheme>` ler — no formato 1 (um `<variables>` só) é
    ignorado.
    """
    try:
        root = etree.fromstring(xml_bytes)
    except etree.XMLSyntaxError as exc:
        raise VariablesParseError(f"XML malformado: {exc}") from exc

    color_scheme_nodes = root.findall("colorScheme")
    if color_scheme_nodes:
        if not scheme_name:
            raise VariablesParseError(
                "Arquivo com múltiplos <colorScheme> — informe scheme_name"
            )
        for node in color_scheme_nodes:
            names = [n.strip() for n in node.get("name", "").split(",")]
            if scheme_name in names:
                variables_node = node.find("variables")
                if variables_node is None:
                    raise VariablesParseError(
                        f"colorScheme '{scheme_name}' não tem bloco <variables>"
                    )
                return _variables_from_node(variables_node)
        raise VariablesParseError(f"colorScheme '{scheme_name}' não encontrado no arquivo")

    variables_node = root.find("variables")
    if variables_node is None:
        raise VariablesParseError("Bloco <variables> não encontrado")

    return _variables_from_node(variables_node)
