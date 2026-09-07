import { useEffect, useState } from "react";
import { Stage, Layer, Rect, Text as KonvaText, Image as KonvaImage, Label, Tag } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { resolveElementBox, boxTopLeftToPos } from "../geometry";
import { resolveVariable } from "../schema/types";
import type { ThemeElement, ViewName } from "../schema/types";

interface CanvasProps {
  elements: ThemeElement[];
  view: ViewName;
  reference: [number, number];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onMove: (index: number, newPos: [number, number]) => void;
  // path do asset (conforme referenciado no XML, ex "./core/frame.png") -> objectURL local
  assetMap: Record<string, string>;
  // variáveis resolvidas da colorScheme atualmente selecionada (pode ser undefined)
  variables?: Record<string, string>;
  displayScale?: number;
}

const FALLBACK_COLOR: Record<string, string> = {
  carousel: "#5b7fff88",
  grid: "#5b7fff66",
  textlist: "#5b7fff44",
  image: "#f2994a55",
  text: "#27ae6055",
  video: "#eb5757aa",
  badges: "#bb6bd9aa",
  rating: "#f2c94caa",
  datetime: "#56ccf2aa",
  gamelistinfo: "#828282aa",
};

const SELECTION_COLOR = "#5b8cff";

// Carrega uma HTMLImageElement nativa a partir de um objectURL e força
// re-render quando termina de carregar. Sem dependência extra (evita
// puxar "use-image" só para isso).
function useHtmlImage(src: string | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImg(null);
      return;
    }
    const image = new window.Image();
    image.onload = () => setImg(image);
    image.onerror = () => setImg(null);
    image.src = src;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [src]);

  return img;
}

const HEX_COLOR_RE = /^[0-9A-Fa-f]{6,8}$/;

function hexColorToRgba(hex: string): string {
  // ES-DE usa RRGGBB ou RRGGBBAA. Konva aceita hex de 6 dígitos direto,
  // então convertemos AA (se houver) para opacity separado.
  const clean = hex.replace("#", "");
  if (!HEX_COLOR_RE.test(clean)) {
    // Valor não é hex válido — provavelmente uma referência "${var}" que
    // ainda não foi resolvida (colorScheme correspondente não importada).
    return "#999999";
  }
  return `#${clean.slice(0, 6)}`;
}

function hexAlpha(hex: string): number {
  const clean = hex.replace("#", "");
  if (!HEX_COLOR_RE.test(clean)) return 1;
  if (clean.length === 8) {
    return parseInt(clean.slice(6, 8), 16) / 255;
  }
  return 1;
}

interface ElementVisualProps {
  element: ThemeElement;
  index: number;
  box: { x: number; y: number; width: number; height: number };
  isSelected: boolean;
  reference: [number, number];
  assetMap: Record<string, string>;
  variables?: Record<string, string>;
  displayScale: number;
  onSelect: (index: number) => void;
  onDragEnd: (index: number, topLeft: { x: number; y: number }) => void;
}

function ElementVisual({
  element,
  index,
  box,
  isSelected,
  reference,
  assetMap,
  variables,
  displayScale,
  onSelect,
  onDragEnd,
}: ElementVisualProps) {
  const commonHandlers = {
    draggable: true,
    onClick: () => onSelect(index),
    onTap: () => onSelect(index),
    onDragEnd: (e: KonvaEventObject<DragEvent>) =>
      onDragEnd(index, { x: e.target.x(), y: e.target.y() }),
  };

  const rawPath = element.type === "image" ? (element.properties.path as string) ?? "" : "";
  const resolvedPath = resolveVariable(rawPath, variables);
  const assetUrl = element.type === "image" ? assetMap[resolvedPath] : undefined;
  // Chamado incondicionalmente (Rules of Hooks) mesmo quando o elemento não
  // é "image" — nesse caso assetUrl é undefined e o hook não faz nada.
  const img = useHtmlImage(assetUrl);

  if (element.type === "image") {
    if (img) {
      return (
        <KonvaImage
          image={img}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          stroke={isSelected ? SELECTION_COLOR : undefined}
          strokeWidth={isSelected ? 2 / displayScale : 0}
          {...commonHandlers}
        />
      );
    }
    // Fallback: asset não resolvido (ainda não importou a pasta de assets,
    // ou path aponta para arquivo que não existe no mapa) — placeholder.
    return (
      <Rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        fill={FALLBACK_COLOR.image}
        cornerRadius={4 / displayScale}
        stroke={isSelected ? SELECTION_COLOR : "#00000000"}
        strokeWidth={isSelected ? 2 / displayScale : 0}
        {...commonHandlers}
      />
    );
  }

  if (element.type === "text") {
    const rawColor = (element.properties.color as string) ?? "000000FF";
    const resolvedColor = resolveVariable(rawColor, variables);
    const [, refH] = reference;
    const fontSizeNorm = (element.properties.fontSize as number) ?? 0.045;
    const fontSizePx = fontSizeNorm * refH;
    const align = (element.properties.horizontalAlignment as string) ?? "left";
    const verticalAlign = (element.properties.verticalAlignment as string) ?? "center";
    const text = (element.properties.text as string) || element.name;

    return (
      <KonvaText
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        text={text}
        fontSize={fontSizePx}
        fill={hexColorToRgba(resolvedColor)}
        opacity={hexAlpha(resolvedColor)}
        align={align}
        verticalAlign={verticalAlign}
        stroke={isSelected ? SELECTION_COLOR : undefined}
        strokeWidth={isSelected ? 1 / displayScale : 0}
        {...commonHandlers}
      />
    );
  }

  // carousel e demais: continua placeholder (renderização real fora do
  // escopo desta rodada — carrossel não é um retângulo estático)
  return (
    <Rect
      x={box.x}
      y={box.y}
      width={box.width}
      height={box.height}
      fill={FALLBACK_COLOR[element.type] ?? "#88888855"}
      cornerRadius={4 / displayScale}
      stroke={isSelected ? SELECTION_COLOR : "#00000000"}
      strokeWidth={isSelected ? 2 / displayScale : 0}
      {...commonHandlers}
    />
  );
}

export function Canvas({
  elements,
  reference,
  selectedIndex,
  onSelect,
  onMove,
  assetMap,
  variables,
  displayScale = 0.5,
}: CanvasProps) {
  const [refW, refH] = reference;

  // zIndex maior desenha por cima. Guardamos o índice original (não a
  // posição pós-sort) porque onSelect/onMove referenciam o modelo pelo
  // índice original no array de `elements`.
  const drawOrder = elements
    .map((el, index) => ({ el, index }))
    .sort((a, b) => {
      const za = (a.el.properties.zIndex as number) ?? 0;
      const zb = (b.el.properties.zIndex as number) ?? 0;
      return za - zb;
    });

  function handleDragEnd(index: number, topLeft: { x: number; y: number }) {
    const el = elements[index];
    const size = (el.properties.size as [number, number]) ?? [0.2, 0.1];
    const origin = (el.properties.origin as [number, number]) ?? [0, 0];
    const newPos = boxTopLeftToPos(topLeft, size, origin, reference);
    onMove(index, newPos);
  }

  return (
    <Stage
      width={refW * displayScale}
      height={refH * displayScale}
      scaleX={displayScale}
      scaleY={displayScale}
      className="canvas-frame"
    >
      <Layer>
        {drawOrder.map(({ el, index }) => {
          const pos = (el.properties.pos as [number, number]) ?? [0, 0];
          const size = (el.properties.size as [number, number]) ?? [0.2, 0.1];
          const origin = (el.properties.origin as [number, number]) ?? [0, 0];
          const box = resolveElementBox(pos, size, origin, reference);

          return (
            <ElementVisual
              key={`${el.type}-${el.name}-${index}`}
              element={el}
              index={index}
              box={box}
              isSelected={index === selectedIndex}
              reference={reference}
              assetMap={assetMap}
              variables={variables}
              displayScale={displayScale}
              onSelect={onSelect}
              onDragEnd={handleDragEnd}
            />
          );
        })}
        {/* Rótulos de identificação — tag flutuante ancorada acima do
            elemento (não sobre o conteúdo, bug da rodada anterior) para não
            se misturar visualmente com o que é desenhado por baixo. Quando o
            elemento está encostado no topo do canvas, a tag desce para
            dentro para não sair da área visível. */}
        {drawOrder.map(({ el, index }) => {
          const pos = (el.properties.pos as [number, number]) ?? [0, 0];
          const origin = (el.properties.origin as [number, number]) ?? [0, 0];
          const size = (el.properties.size as [number, number]) ?? [0.2, 0.1];
          const box = resolveElementBox(pos, size, origin, reference);
          const isSelected = index === selectedIndex;
          const fontSize = 11 / displayScale;
          const gap = 5 / displayScale;
          const tagHeight = fontSize + 8 / displayScale;
          const floatsAbove = box.y - gap - tagHeight >= 0;
          const y = floatsAbove ? box.y - gap - tagHeight : box.y + gap;

          return (
            <Label key={`label-${index}`} x={box.x} y={y} listening={false}>
              <Tag
                fill={isSelected ? SELECTION_COLOR : "#0b0c0fcc"}
                cornerRadius={3 / displayScale}
              />
              <KonvaText
                text={`${el.type}:${el.name}`}
                fontSize={fontSize}
                padding={4 / displayScale}
                fill={isSelected ? "#0b0c0f" : "#e8e9ec"}
                fontStyle={isSelected ? "bold" : "normal"}
              />
            </Label>
          );
        })}
      </Layer>
    </Stage>
  );
}
