"""Testes de capabilities.py — parser de <colorScheme> em capabilities.xml."""

import pytest

from app.capabilities import CapabilitiesParseError, parse_capabilities_xml


def test_parse_color_schemes_with_and_without_display_name():
    xml = b"""
    <ripple>
      <colorScheme name="dark">
        <displayName>Dark</displayName>
      </colorScheme>
      <colorScheme name="light"></colorScheme>
    </ripple>
    """

    schemes = parse_capabilities_xml(xml)

    assert schemes == [
        {"name": "dark", "displayName": "Dark"},
        {"name": "light", "displayName": "light"},
    ]


def test_parse_no_color_schemes_returns_empty_list():
    assert parse_capabilities_xml(b"<ripple></ripple>") == []


def test_malformed_xml_raises():
    with pytest.raises(CapabilitiesParseError):
        parse_capabilities_xml(b"<ripple>")
