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


def test_parse_color_scheme_with_label_tag():
    # Achado testando com o capabilities.xml real do tema Iconic (CC0,
    # github.com/Siddy212/iconic-es-de): usa <label>, não <displayName> —
    # antes disso, todo colorScheme do tema caía no fallback (nome cru em
    # vez do rótulo legível).
    xml = b"""
    <themeCapabilities>
      <colorScheme name="light-default">
        <label>Default - Light</label>
      </colorScheme>
    </themeCapabilities>
    """

    assert parse_capabilities_xml(xml) == [
        {"name": "light-default", "displayName": "Default - Light"},
    ]


def test_label_takes_precedence_over_display_name_when_both_present():
    xml = b"""
    <ripple>
      <colorScheme name="dark">
        <label>Label Value</label>
        <displayName>DisplayName Value</displayName>
      </colorScheme>
    </ripple>
    """

    assert parse_capabilities_xml(xml) == [{"name": "dark", "displayName": "Label Value"}]


def test_parse_no_color_schemes_returns_empty_list():
    assert parse_capabilities_xml(b"<ripple></ripple>") == []


def test_malformed_xml_raises():
    with pytest.raises(CapabilitiesParseError):
        parse_capabilities_xml(b"<ripple>")
