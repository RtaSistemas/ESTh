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
