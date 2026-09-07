"""
API do editor de temas ES-DE.

Endpoints (escopo item 1):
  GET  /schema        -> schema declarativo dos elementos suportados (para o frontend
                          construir o inspetor de propriedades dinamicamente)
  POST /theme/parse    -> recebe theme.xml, devolve modelo interno (JSON)
  POST /theme/serialize -> recebe modelo interno (JSON), devolve theme.xml
"""

from dataclasses import asdict

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .capabilities import CapabilitiesParseError, parse_capabilities_xml
from .parser import ThemeParseError, parse_theme_xml
from .schema.es_de_elements import ELEMENTS, REFERENCE_RESOLUTION
from .serializer import serialize_theme
from .variables import VariablesParseError, parse_variables_xml

app = FastAPI(title="ES-DE Theme Editor API", version="0.1.0")

# CORS liberado para o dev server do frontend (Vite, porta padrão 5173).
# Restringir antes de qualquer deploy além de uso local.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/schema")
def get_schema():
    return {
        "referenceResolution": REFERENCE_RESOLUTION,
        "elements": {
            tag: {
                "group": el.group,
                "views": el.views,
                "instancesPerView": el.instances_per_view,
                "defaultZIndex": el.default_z_index,
                "properties": [
                    {
                        "name": p.name,
                        "type": p.type.value,
                        "default": p.default,
                        "minValue": p.min_value,
                        "maxValue": p.max_value,
                        "validValues": p.valid_values,
                        "onlyWhen": p.only_when,
                    }
                    for p in el.properties
                ],
            }
            for tag, el in ELEMENTS.items()
        },
    }


@app.post("/theme/parse")
async def parse_theme(file: UploadFile):
    xml_bytes = await file.read()
    try:
        return parse_theme_xml(xml_bytes)
    except ThemeParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/theme/serialize")
def serialize(model: dict):
    xml_bytes = serialize_theme(model)
    return Response(content=xml_bytes, media_type="application/xml")


@app.post("/capabilities/parse")
async def parse_capabilities(file: UploadFile):
    xml_bytes = await file.read()
    try:
        return {"colorSchemes": parse_capabilities_xml(xml_bytes)}
    except CapabilitiesParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/variables/parse")
async def parse_variables(file: UploadFile, scheme_name: str = ""):
    xml_bytes = await file.read()
    try:
        variables = parse_variables_xml(xml_bytes)
    except VariablesParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"schemeName": scheme_name, "variables": variables}
