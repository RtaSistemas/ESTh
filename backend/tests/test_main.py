"""Testes de API (main.py) via TestClient — cobre o contrato dos endpoints
que o frontend consome (GET /schema, POST /theme/parse|serialize, etc)."""

import io

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_schema_returns_reference_resolution_and_elements():
    res = client.get("/schema")

    assert res.status_code == 200
    body = res.json()
    assert body["referenceResolution"] == [1920, 1080]
    assert len(body["elements"]) == 11
    assert "carousel" in body["elements"]


def test_theme_parse_roundtrip_through_api():
    xml = b'<theme><view name="gamelist"><image name="frame1"><pos>0.1 0.1</pos></image></view></theme>'

    parse_res = client.post(
        "/theme/parse", files={"file": ("theme.xml", io.BytesIO(xml), "application/xml")}
    )
    assert parse_res.status_code == 200
    model = parse_res.json()
    assert model["views"]["gamelist"][0]["properties"]["pos"] == [0.1, 0.1]

    serialize_res = client.post("/theme/serialize", json=model)
    assert serialize_res.status_code == 200
    assert b"<pos>0.10000 0.10000</pos>" in serialize_res.content


def test_theme_parse_malformed_xml_returns_422():
    res = client.post(
        "/theme/parse", files={"file": ("theme.xml", io.BytesIO(b"<theme><view>"), "application/xml")}
    )
    assert res.status_code == 422


def test_capabilities_parse():
    xml = b'<ripple><colorScheme name="dark"><displayName>Dark</displayName></colorScheme></ripple>'

    res = client.post(
        "/capabilities/parse", files={"file": ("capabilities.xml", io.BytesIO(xml), "application/xml")}
    )

    assert res.status_code == 200
    assert res.json() == {"colorSchemes": [{"name": "dark", "displayName": "Dark"}]}


def test_variables_parse():
    xml = b"<theme><variables><gameNameColor>000000FF</gameNameColor></variables></theme>"

    res = client.post(
        "/variables/parse?scheme_name=dark",
        files={"file": ("variables.xml", io.BytesIO(xml), "application/xml")},
    )

    assert res.status_code == 200
    assert res.json() == {"schemeName": "dark", "variables": {"gameNameColor": "000000FF"}}
