"""
Parser: theme.xml (ES-DE) -> modelo interno.

Escopo do item 1 (editor): parseia apenas <view><elemento name="...">...</elemento></view>
diretamente sob <theme>. `<variant>`, `<colorScheme>`, `<aspectRatio>`,
`<include>` e `<variables>` ficam para a expansão de escopo (item 2+),
documentado em es-theme-editor.md.
"""

from lxml import etree

from .schema.es_de_elements import ELEMENTS, PropType


class ThemeParseError(Exception):
    pass


def _parse_value(raw_text: str, prop_type: PropType):
    text = raw_text.strip()
    if prop_type == PropType.NORMALIZED_PAIR:
        parts = text.split()
        if len(parts) != 2:
            raise ThemeParseError(f"NORMALIZED_PAIR inválido: '{text}'")
        try:
            return (float(parts[0]), float(parts[1]))
        except ValueError as exc:
            # Achado testando com o tema Iconic de verdade: um valor real
            # era "0.478${systemNamePos}" (variável embutida no meio do
            # token, resolvida só por dimensão de fontSize — fora do
            # escopo hoje). Não interpretamos isso, mas o parser nunca
            # pode quebrar sem controle por causa de um valor assim.
            raise ThemeParseError(f"NORMALIZED_PAIR com valor não numérico: '{text}'") from exc
    if prop_type == PropType.BOOLEAN:
        return text in ("true", "1")
    if prop_type == PropType.FLOAT:
        try:
            return float(text)
        except ValueError as exc:
            raise ThemeParseError(f"FLOAT inválido: '{text}'") from exc
    if prop_type == PropType.UNSIGNED_INTEGER:
        try:
            return int(text)
        except ValueError as exc:
            raise ThemeParseError(f"UNSIGNED_INTEGER inválido: '{text}'") from exc
    # PATH, COLOR, STRING permanecem string
    return text


def parse_theme_xml(xml_bytes: bytes) -> dict:
    """
    Retorna um modelo interno no formato:

    {
      "views": {
        "system": [ {"type": "carousel", "name": "systemCarousel", "properties": {...}}, ... ],
        "gamelist": [ ... ]
      },
      "warnings": ["elemento/propriedade desconhecida ignorada: ..."]
    }
    """
    try:
        root = etree.fromstring(xml_bytes)
    except etree.XMLSyntaxError as exc:
        raise ThemeParseError(f"XML malformado: {exc}") from exc

    if root.tag != "theme":
        raise ThemeParseError(f"Raiz esperada <theme>, encontrado <{root.tag}>")

    model = {"views": {"system": [], "gamelist": []}, "warnings": []}

    for view_node in root.findall("view"):
        view_names = [v.strip() for v in view_node.get("name", "").split(",")]
        for view_name in view_names:
            if view_name not in model["views"]:
                # "all" (navegação/sons) fora do escopo do item 1
                model["warnings"].append(f"view '{view_name}' ignorada (fora do escopo do editor)")
                continue

            for element_node in view_node:
                tag = element_node.tag
                element_def = ELEMENTS.get(tag)
                if element_def is None:
                    model["warnings"].append(f"elemento <{tag}> ainda não suportado pelo editor")
                    continue

                name = element_node.get("name", "")
                properties: dict = {}
                prop_defs_by_name = {p.name: p for p in element_def.properties}

                for prop_node in element_node:
                    prop_name = prop_node.tag
                    prop_def = prop_defs_by_name.get(prop_name)
                    if prop_def is None:
                        model["warnings"].append(
                            f"propriedade <{prop_name}> de <{tag} name=\"{name}\"> ainda não suportada"
                        )
                        continue
                    properties[prop_name] = _parse_value(prop_node.text or "", prop_def.type)

                model["views"][view_name].append({
                    "type": tag,
                    "name": name,
                    "properties": properties,
                })

    return model
