"""Testes de variables.py — parser de arquivo de variáveis por colorScheme."""

import pytest

from app.variables import VariablesParseError, parse_variables_xml


def test_parse_variables_returns_flat_dict():
    xml = b"""
    <theme>
      <variables>
        <gameNameColor>000000FF</gameNameColor>
        <systemCarouselColor>445566FF</systemCarouselColor>
      </variables>
    </theme>
    """

    variables = parse_variables_xml(xml)

    assert variables == {
        "gameNameColor": "000000FF",
        "systemCarouselColor": "445566FF",
    }


def test_missing_variables_block_raises():
    with pytest.raises(VariablesParseError):
        parse_variables_xml(b"<theme></theme>")


def test_malformed_xml_raises():
    with pytest.raises(VariablesParseError):
        parse_variables_xml(b"<theme>")


# Formato real do colors.xml do tema Iconic (CC0,
# github.com/Siddy212/iconic-es-de): múltiplos <colorScheme> com nomes
# separados por vírgula, cada um com seu próprio <variables> aninhado —
# incompatível com a suposição original de "um <variables> só por arquivo",
# que fazia esse formato falhar (nenhum <variables> direto sob <theme>).
MULTI_SCHEME_XML = b"""
<theme>
  <colorScheme name="dark-modern,dark-custom,dark-default">
    <variables>
      <backgroundColor>090909</backgroundColor>
      <helpTextColor>999999</helpTextColor>
    </variables>
  </colorScheme>
  <colorScheme name="light-modern,light-custom">
    <variables>
      <backgroundColor>dedede</backgroundColor>
      <helpTextColor>54585a</helpTextColor>
    </variables>
  </colorScheme>
</theme>
"""


def test_parse_multi_scheme_file_by_matching_name_in_comma_list():
    variables = parse_variables_xml(MULTI_SCHEME_XML, scheme_name="dark-custom")
    assert variables == {"backgroundColor": "090909", "helpTextColor": "999999"}

    variables = parse_variables_xml(MULTI_SCHEME_XML, scheme_name="light-modern")
    assert variables == {"backgroundColor": "dedede", "helpTextColor": "54585a"}


def test_multi_scheme_file_without_scheme_name_raises():
    with pytest.raises(VariablesParseError):
        parse_variables_xml(MULTI_SCHEME_XML)


def test_multi_scheme_file_with_unknown_scheme_name_raises():
    with pytest.raises(VariablesParseError):
        parse_variables_xml(MULTI_SCHEME_XML, scheme_name="does-not-exist")
