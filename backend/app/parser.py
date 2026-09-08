"""
Parser: theme.xml (ES-DE) -> modelo interno.

Escopo: <view><elemento name="...">...</elemento></view> e <variables>
direto sob <theme>. `<variant>`, `<colorScheme>`, `<aspectRatio>` e
`<include>` continuam fora do escopo (documentado no README).
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

    model = {"views": {"system": [], "gamelist": []}, "warnings": [], "variables": {}}

    # <variables> direto sob <theme> — variáveis globais do tema (fontes,
    # paths de imagem sem colorScheme, etc.), independentes de colorScheme.
    # Achado testando com o tema.xml real do Iconic: ele tem um bloco desses
    # com `spacerImage`/`fontRegular`/`fontBold`/`fontLogo`/`fontItalic`.
    # As variáveis específicas de colorScheme (colors.xml) continuam
    # separadas, importadas via /variables/parse e mescladas no frontend.
    variables_node = root.find("variables")
    if variables_node is not None:
        model["variables"] = {
            child.tag: (child.text or "").strip() for child in variables_node
        }

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
                    try:
                        properties[prop_name] = _parse_value(prop_node.text or "", prop_def.type)
                    except ThemeParseError as exc:
                        # Achado testando com o theme.xml real do Iconic: uma
                        # única propriedade com valor não interpretável (ex:
                        # <height>${systemClockSize}</height> — variável
                        # embutida num FLOAT) derrubava a importação do tema
                        # inteiro com um 422, mesmo com dezenas de outros
                        # elementos válidos no mesmo arquivo. Isolar o erro
                        # por propriedade (like propriedade desconhecida) é
                        # consistente com o resto do parser: nunca quebra o
                        # documento inteiro por causa de um valor pontual que
                        # foge do escopo (variável embutida, resolvida só
                        # dinamicamente pelo ES-DE).
                        model["warnings"].append(
                            f"propriedade <{prop_name}> de <{tag} name=\"{name}\"> "
                            f"ignorada (valor não interpretável): {exc}"
                        )

                # Propriedade ausente no XML: preenche com o default real do
                # ES-DE quando o schema declara um (es_de_elements.py). Nem
                # todo elemento tem default de pos/size — quando o schema
                # também não tem (default=None), a propriedade fica de fora
                # do dict propositalmente: significa que o próprio ES-DE
                # exige um valor explícito ali (tipicamente vindo de um
                # <include>/<aspectRatio> que este parser ainda não processa),
                # não que este editor "esqueceu" de aplicar um valor.
                for prop_def in element_def.properties:
                    if prop_def.name not in properties and prop_def.default is not None:
                        properties[prop_def.name] = prop_def.default

                model["views"][view_name].append({
                    "type": tag,
                    "name": name,
                    "properties": properties,
                })

    return model
