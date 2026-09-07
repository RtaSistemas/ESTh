import { useEffect, useState } from "react";
import { Stage, Layer, Rect, Text as KonvaText, Image as KonvaImage, Label, Tag, Group } from "react-konva";
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

// Dados fake só para dar volume visual ao preview estático de
// carousel/grid/textlist — não representam jogos reais nem vêm de nenhuma
// fonte (DAT, gamelist.xml, etc.), é fora de escopo ler isso.
const SAMPLE_ITEM_COLORS = [
  "#5b8cff",
  "#9b6bff",
  "#f2994a",
  "#27ae60",
  "#eb5757",
  "#56ccf2",
  "#f2c94c",
  "#bb6bd9",
];

const SAMPLE_GAME_NAMES = [
  "Super Mario World",
  "Sonic the Hedgehog",
  "Street Fighter II",
  "Chrono Trigger",
  "Metroid",
  "Castlevania",
  "Mega Man X",
  "Contra",
];

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

// ---------------------------------------------------------------------------
// Preview estático dos elementos primários (carousel/grid/textlist): só
// posição e exibição dos itens, sem navegação/animação/item-ativo-real —
// é um cálculo de layout a partir das próprias propriedades do schema
// (itemSize/itemScale/itemSpacing/rows/columns/maxItemCount), não uma
// simulação do comportamento do ES-DE.
// ---------------------------------------------------------------------------

function renderCarouselItems(
  element: ThemeElement,
  box: { x: number; y: number; width: number; height: number },
  reference: [number, number],
  displayScale: number
) {
  const props = element.properties;
  const type = (props.type as string) ?? "horizontal";
  // horizontalWheel/verticalWheel são tratados no mesmo eixo de
  // horizontal/vertical — a geometria em leque do wheel não está no schema
  // (só posição/exibição básica é o escopo aqui).
  const isVerticalAxis = type.startsWith("vertical");
  const [refW, refH] = reference;
  const itemSizeNorm = (props.itemSize as [number, number]) ?? [0.25, 0.155];
  const itemW = itemSizeNorm[0] * refW;
  const itemH = itemSizeNorm[1] * refH;
  const itemScale = (props.itemScale as number) ?? 1;
  const count = Math.max(1, Math.round((props.maxItemCount as number) ?? 3));
  const horizontalOffset = (props.horizontalOffset as number) ?? 0;
  const verticalOffset = (props.verticalOffset as number) ?? 0;
  const centerIndex = Math.floor((count - 1) / 2);

  const nodes = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const isCenter = i === centerIndex;
    const scale = isCenter ? itemScale : 1;
    const w = itemW * scale;
    const h = itemH * scale;
    const cx = isVerticalAxis
      ? box.x + box.width / 2 + horizontalOffset * itemW
      : box.x + t * box.width;
    const cy = isVerticalAxis
      ? box.y + t * box.height
      : box.y + box.height / 2 + verticalOffset * itemH;

    nodes.push(
      <Rect
        key={`carousel-item-${i}`}
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        cornerRadius={4 / displayScale}
        fill={SAMPLE_ITEM_COLORS[i % SAMPLE_ITEM_COLORS.length]}
        opacity={isCenter ? 1 : 0.5}
        stroke={isCenter ? "#ffffff" : undefined}
        strokeWidth={isCenter ? 1.5 / displayScale : 0}
        listening={false}
      />
    );
  }
  return nodes;
}

function renderGridItems(
  element: ThemeElement,
  box: { x: number; y: number; width: number; height: number },
  reference: [number, number],
  displayScale: number
) {
  const props = element.properties;
  const [refW, refH] = reference;
  const itemSizeNorm = (props.itemSize as [number, number]) ?? [0.15, 0.2];
  const spacingNorm = (props.itemSpacing as [number, number]) ?? [0.01, 0.01];
  const itemScale = (props.itemScale as number) ?? 1;
  const itemW = itemSizeNorm[0] * refW;
  const itemH = itemSizeNorm[1] * refH;
  const spacingX = spacingNorm[0] * refW;
  const spacingY = spacingNorm[1] * refH;
  // Cap de exibição — rows/columns podem ir até 20 no schema, mas isso é só
  // um preview estático, não precisa desenhar centenas de retângulos.
  const rows = Math.min(6, Math.max(1, Math.round((props.rows as number) ?? 3)));
  const columns = Math.min(8, Math.max(1, Math.round((props.columns as number) ?? 5)));

  const nodes = [];
  let colorIndex = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const isFocused = r === 0 && c === 0;
      const scale = isFocused ? itemScale : 1;
      const w = itemW * scale;
      const h = itemH * scale;
      const baseX = box.x + c * (itemW + spacingX);
      const baseY = box.y + r * (itemH + spacingY);
      // Escala ancorada no centro do item pra não desalinhar a grade.
      const x = baseX - (w - itemW) / 2;
      const y = baseY - (h - itemH) / 2;

      nodes.push(
        <Rect
          key={`grid-item-${r}-${c}`}
          x={x}
          y={y}
          width={w}
          height={h}
          cornerRadius={3 / displayScale}
          fill={SAMPLE_ITEM_COLORS[colorIndex % SAMPLE_ITEM_COLORS.length]}
          opacity={isFocused ? 1 : 0.5}
          stroke={isFocused ? "#ffffff" : undefined}
          strokeWidth={isFocused ? 1.5 / displayScale : 0}
          listening={false}
        />
      );
      colorIndex++;
    }
  }
  return nodes;
}

function renderTextlistItems(
  element: ThemeElement,
  box: { x: number; y: number; width: number; height: number },
  reference: [number, number],
  displayScale: number,
  variables: Record<string, string> | undefined
) {
  const props = element.properties;
  const [, refH] = reference;
  const rowHeightNorm = (props.selectorHeight as number) ?? 0.056;
  const rowHeightPx = rowHeightNorm * refH;
  const fontSizeNorm = (props.fontSize as number) ?? 0.045;
  const fontSizePx = fontSizeNorm * refH;
  const align = (props.horizontalAlignment as string) ?? "left";
  const textColor = resolveVariable((props.color as string) ?? "000000FF", variables);
  const selectorColor = resolveVariable((props.selectorColor as string) ?? "0000FFFF", variables);

  const maxRowsThatFit = Math.max(1, Math.floor(box.height / Math.max(rowHeightPx, 1)));
  const rowCount = Math.min(maxRowsThatFit, SAMPLE_GAME_NAMES.length);

  const nodes = [];
  for (let i = 0; i < rowCount; i++) {
    const y = box.y + i * rowHeightPx;
    if (i === 0) {
      // Linha 0 representa o item "selecionado" — só pra mostrar a cor/altura
      // do seletor, sem navegação real.
      nodes.push(
        <Rect
          key="textlist-selector"
          x={box.x}
          y={y}
          width={box.width}
          height={rowHeightPx}
          fill={hexColorToRgba(selectorColor)}
          opacity={hexAlpha(selectorColor)}
          listening={false}
        />
      );
    }
    nodes.push(
      <KonvaText
        key={`textlist-row-${i}`}
        x={box.x + 6 / displayScale}
        y={y}
        width={box.width - 12 / displayScale}
        height={rowHeightPx}
        text={SAMPLE_GAME_NAMES[i]}
        fontSize={fontSizePx}
        align={align}
        verticalAlign="middle"
        fill={hexColorToRgba(textColor)}
        opacity={hexAlpha(textColor)}
        listening={false}
      />
    );
  }
  return nodes;
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

  if (element.type === "carousel" || element.type === "grid" || element.type === "textlist") {
    return (
      <Group>
        {/* Fundo + hit target: seleção/drag continuam agindo sobre a área
            inteira do elemento, não sobre os itens de exemplo desenhados
            por cima. */}
        <Rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          fill={FALLBACK_COLOR[element.type]}
          cornerRadius={4 / displayScale}
          stroke={isSelected ? SELECTION_COLOR : "#00000000"}
          strokeWidth={isSelected ? 2 / displayScale : 0}
          {...commonHandlers}
        />
        <Group listening={false} clipX={box.x} clipY={box.y} clipWidth={box.width} clipHeight={box.height}>
          {element.type === "carousel" && renderCarouselItems(element, box, reference, displayScale)}
          {element.type === "grid" && renderGridItems(element, box, reference, displayScale)}
          {element.type === "textlist" && renderTextlistItems(element, box, reference, displayScale, variables)}
        </Group>
      </Group>
    );
  }

  // demais tipos (video, badges, rating, datetime, gamelistinfo): continuam
  // placeholder — sem renderização real de vídeo/badges/etc. neste escopo.
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
