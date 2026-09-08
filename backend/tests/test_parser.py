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


def test_normalized_pair_with_embedded_variable_reference_raises_cleanly():
    # Achado testando com um clone real do tema Iconic (CC0,
    # github.com/Siddy212/iconic-es-de): aspect-ratio-16-9-detailed.xml
    # tem <pos>0.25 0.478${systemNamePos}</pos> — variável embutida no meio
    # do token, resolvida só pela dimensão de fontSize do ES-DE (fora do
    # nosso escopo). Antes disso, isso derrubava o processo com um
    # ValueError não tratado (viraria 500 na API); agora vira
    # ThemeParseError limpo (422), sem interpretar a variável.
    xml = b"""
    <theme>
      <view name="gamelist">
        <text name="system-name"><pos>0.25 0.478${systemNamePos}</pos></text>
      </view>
    </theme>
    """
    with pytest.raises(ThemeParseError):
        parse_theme_xml(xml)


def test_float_with_embedded_variable_reference_raises_cleanly():
    xml = b"""
    <theme>
      <view name="gamelist">
        <text name="games-count"><fontSize>${systemInfoFontSize}</fontSize></text>
      </view>
    </theme>
    """
    with pytest.raises(ThemeParseError):
        parse_theme_xml(xml)


def test_parses_real_iconic_theme_excerpt():
    # Excerto real (CC0) do tema Iconic
    # (github.com/Siddy212/iconic-es-de), início de
    # aspect-ratio-16-9-detailed.xml — view compartilhada entre
    # system/gamelist com helpsystem + duas images reais.
    xml = b"""
    <theme>
       <view name="system,gamelist">
          <helpsystem name="help">
             <posDimmed>0.5 0.965</posDimmed>
             <originDimmed>0.5 1</originDimmed>
             <fontSize>0.018</fontSize>
             <entrySpacing>0.0042</entrySpacing>
          </helpsystem>
           <image name="background-art-gradient">
             <pos>0 0.82</pos>
             <size>1 0.20</size>
          </image>
          <image name="background-art">
             <pos>0.5 0.5</pos>
             <size>1 1</size>
          </image>
       </view>
    </theme>
    """
    model = parse_theme_xml(xml)

    assert model["warnings"] == []
    for view_name in ("system", "gamelist"):
        types = [el["type"] for el in model["views"][view_name]]
        assert types == ["helpsystem", "image", "image"]

        [help_el, gradient_el, art_el] = model["views"][view_name]
        assert help_el["properties"]["posDimmed"] == (0.5, 0.965)
        assert help_el["properties"]["originDimmed"] == (0.5, 1.0)
        assert help_el["properties"]["fontSize"] == 0.018
        assert help_el["properties"]["entrySpacing"] == 0.0042
        assert "size" not in help_el["properties"]

        assert gradient_el["properties"]["pos"] == (0.0, 0.82)
        assert gradient_el["properties"]["size"] == (1.0, 0.20)
        assert art_el["properties"]["pos"] == (0.5, 0.5)
        assert art_el["properties"]["size"] == (1.0, 1.0)
