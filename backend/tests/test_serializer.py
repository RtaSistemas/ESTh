"""
Testes de serializer.py e do round-trip completo parser <-> serializer.

README.md registra esse round-trip como validado manualmente contra o
exemplo do THEMES-DEV.md — aqui isso vira teste automatizado.
"""

from app.parser import parse_theme_xml
from app.serializer import serialize_theme

THEMES_DEV_EXAMPLE = b"""
<theme>
  <view name="gamelist">
    <text name="gameName">
      <pos>0.27 0.32</pos>
      <size>0.12 0.41</size>
      <origin>0.5 0.5</origin>
      <zIndex>40</zIndex>
      <text>Super Mario World</text>
      <fontSize>0.045</fontSize>
      <color>000000FF</color>
      <horizontalAlignment>left</horizontalAlignment>
      <verticalAlignment>center</verticalAlignment>
      <letterCase>none</letterCase>
    </text>
    <image name="frame1">
      <pos>0.5 0.5</pos>
      <size>0.8 0.8</size>
      <origin>0.5 0.5</origin>
      <zIndex>10</zIndex>
      <path>./core/frame.png</path>
      <tile>false</tile>
      <color>FFFFFFFF</color>
      <imageCornerRadius>0</imageCornerRadius>
    </image>
  </view>
</theme>
"""


def test_round_trip_parse_serialize_parse_preserves_model():
    model = parse_theme_xml(THEMES_DEV_EXAMPLE)

    xml_bytes = serialize_theme(model)
    reparsed = parse_theme_xml(xml_bytes)

    assert reparsed["warnings"] == []
    assert reparsed["views"]["gamelist"] == model["views"]["gamelist"]


def test_serialize_formats_normalized_pair_with_five_decimals():
    model = {"views": {"gamelist": [
        {"type": "image", "name": "frame1", "properties": {"pos": (0.5, 0.5)}}
    ]}}

    xml_bytes = serialize_theme(model)

    assert b"<pos>0.50000 0.50000</pos>" in xml_bytes


def test_serialize_formats_boolean_as_true_false():
    model = {"views": {"gamelist": [
        {"type": "image", "name": "frame1", "properties": {"tile": True}}
    ]}}

    xml_bytes = serialize_theme(model)

    assert b"<tile>true</tile>" in xml_bytes


def test_serialize_strips_trailing_zeros_from_float():
    model = {"views": {"gamelist": [
        {"type": "text", "name": "gameName", "properties": {"fontSize": 0.045}}
    ]}}

    xml_bytes = serialize_theme(model)

    assert b"<fontSize>0.045</fontSize>" in xml_bytes


def test_serialize_skips_unknown_property_silently():
    model = {"views": {"gamelist": [
        {"type": "image", "name": "frame1", "properties": {"notInSchema": "whatever", "pos": (0.0, 0.0)}}
    ]}}

    xml_bytes = serialize_theme(model)

    assert b"notInSchema" not in xml_bytes
    assert b"<pos>" in xml_bytes


def test_serialize_omits_views_with_no_elements():
    model = {"views": {"system": [], "gamelist": []}}

    xml_bytes = serialize_theme(model)

    assert b"<view" not in xml_bytes
