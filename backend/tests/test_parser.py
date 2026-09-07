"""Testes de parser.py — theme.xml -> modelo interno."""

import pytest

from app.parser import ThemeParseError, parse_theme_xml

MINIMAL_THEME = b"""
<theme>
  <view name="gamelist">
    <image name="frame1">
      <pos>0.5 0.5</pos>
      <size>0.8 0.8</size>
      <origin>0.5 0.5</origin>
      <zIndex>10</zIndex>
      <path>./core/frame.png</path>
      <tile>true</tile>
      <color>FFFFFFFF</color>
    </image>
  </view>
</theme>
"""


def test_parse_minimal_theme():
    model = parse_theme_xml(MINIMAL_THEME)

    assert model["warnings"] == []
    assert model["views"]["system"] == []
    [element] = model["views"]["gamelist"]
    assert element["type"] == "image"
    assert element["name"] == "frame1"
    assert element["properties"]["pos"] == (0.5, 0.5)
    assert element["properties"]["size"] == (0.8, 0.8)
    assert element["properties"]["zIndex"] == 10
    assert element["properties"]["tile"] is True
    assert element["properties"]["path"] == "./core/frame.png"


def test_view_name_with_multiple_targets():
    xml = b"""
    <theme>
      <view name="system,gamelist">
        <text name="shared"><pos>0 0</pos><size>0.1 0.1</size></text>
      </view>
    </theme>
    """
    model = parse_theme_xml(xml)

    assert len(model["views"]["system"]) == 1
    assert len(model["views"]["gamelist"]) == 1
    assert model["views"]["system"][0]["name"] == "shared"
    assert model["views"]["gamelist"][0]["name"] == "shared"


def test_unsupported_view_generates_warning_and_is_skipped():
    xml = b"""
    <theme>
      <view name="all">
        <sound name="whatever"></sound>
      </view>
    </theme>
    """
    model = parse_theme_xml(xml)

    assert model["views"] == {"system": [], "gamelist": []}
    assert any("all" in w for w in model["warnings"])


def test_unsupported_element_generates_warning_and_is_skipped():
    xml = b"""
    <theme>
      <view name="gamelist">
        <sound name="click"><path>./click.wav</path></sound>
      </view>
    </theme>
    """
    model = parse_theme_xml(xml)

    assert model["views"]["gamelist"] == []
    assert any("sound" in w for w in model["warnings"])


def test_unsupported_property_generates_warning_and_is_skipped():
    xml = b"""
    <theme>
      <view name="gamelist">
        <image name="frame1">
          <pos>0 0</pos>
          <flipHorizontal>true</flipHorizontal>
        </image>
      </view>
    </theme>
    """
    model = parse_theme_xml(xml)

    [element] = model["views"]["gamelist"]
    assert "flipHorizontal" not in element["properties"]
    assert "pos" in element["properties"]
    assert any("flipHorizontal" in w for w in model["warnings"])


def test_malformed_xml_raises():
    with pytest.raises(ThemeParseError):
        parse_theme_xml(b"<theme><view>")


def test_wrong_root_tag_raises():
    with pytest.raises(ThemeParseError):
        parse_theme_xml(b"<notatheme></notatheme>")


def test_invalid_normalized_pair_raises():
    xml = b"""
    <theme>
      <view name="gamelist">
        <image name="frame1"><pos>0.5</pos></image>
      </view>
    </theme>
    """
    with pytest.raises(ThemeParseError):
        parse_theme_xml(xml)
