import { useEffect, useState } from "react";
import {
  Stage,
  Layer,
  Rect,
  Text as KonvaText,
  Image as KonvaImage,
  Label,
  Tag,
  Group,
  Star,
  RegularPolygon,
} from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { resolveElementBox, boxTopLeftToPos, boxToPosAndSize } from "../geometry";
import type { PixelBox } from "../geometry";
import { resolveVariable } from "../schema/types";
import type { ThemeElement, ViewName } from "../schema/types";

interface CanvasProps {
  elements: ThemeElement[];
  view: ViewName;
  reference: [number, number];
  selectedIndices: number[];
  // additive = shift pressionado (adiciona/remove do conjunto); sem
  // shift, substitui a seleção inteira por esse único índice.
  onSelect: (index: number, additive: boolean) => void;
  onMove: (index: number, newPos: [number, number]) => void;
  // Arrastar qualquer elemento de um grupo multi-selecionado move todos
  // juntos, preservando a posição relativa entre eles.
  onMoveMany: (indices: number[], delta: [number, number]) => void;
  // Resize por handle: um único commit de modelo pra todos os elementos
  // afetados (1 quando é seleção única, N quando é grupo).
  onResizeMany: (updates: Array<{ index: number; size: [number, number]; pos: [number, number] }>) => void;
  // path do asset (conforme referenciado no XML, ex "./core/frame.png") -> objectURL local
  assetMap: Record<string, string>;
  // variáveis resolvidas da colorScheme atualmente selecionada (pode ser undefined)
  variables?: Record<string, string>;
  displayScale?: number;
}

// Só os tons que aparecem na referência de esquema de cores do app
// ($primary): nada de laranja/amarelo/magenta/verde/vermelho inventados.
// Cada hex checado com validate_palette.js `contrast()` contra
// --bg-canvas #141620 — as 3 primeiras >= 3.84:1, a 4ª (usada só como
// contorno de seleção, nunca como fill) em 7.16:1.
const CANVAS_HEX = {
  slateBlue: "#5d80ab", // contraste 4.41
  teal: "#458487", // contraste 4.21
  indigo: "#6272a5", // contraste 3.84
  lightBlue: "#7aa2f7", // contraste 7.16 — reservado pro contorno de seleção
} as const;

// Só 3 matizes reais disponíveis (o 4º é reservado pro contorno de
// seleção) — 13 tipos de elemento então diferenciam por tier de opacidade,
// não por matiz: containers primários ficam mais translúcidos (item de
// exemplo desenha por cima), secundários mais opacos (o preenchimento É
// o conteúdo visível).
const FALLBACK_COLOR: Record<string, string> = {
  carousel: `${CANVAS_HEX.indigo}66`,
  grid: `${CANVAS_HEX.teal}66`,
  textlist: `${CANVAS_HEX.slateBlue}66`,
  image: `${CANVAS_HEX.slateBlue}e6`,
  text: `${CANVAS_HEX.teal}e6`,
  video: `${CANVAS_HEX.indigo}e6`,
  badges: `${CANVAS_HEX.slateBlue}b3`,
  rating: `${CANVAS_HEX.teal}b3`,
  datetime: `${CANVAS_HEX.indigo}73`,
  gamelistinfo: `${CANVAS_HEX.slateBlue}73`,
  helpsystem: `${CANVAS_HEX.teal}73`,
  clock: `${CANVAS_HEX.teal}4d`,
  systemstatus: `${CANVAS_HEX.indigo}4d`,
};

const SELECTION_COLOR = CANVAS_HEX.lightBlue;

// Dados fake só para dar volume visual ao preview estático de
// carousel/grid/textlist — não representam jogos reais nem vêm de nenhuma
// fonte (DAT, gamelist.xml, etc.), é fora de escopo ler isso.
const SAMPLE_ITEM_COLORS = [CANVAS_HEX.slateBlue, CANVAS_HEX.teal, CANVAS_HEX.indigo];

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

// Nº de estrelas de exemplo e nota fixa só pra mostrar preenchimento
// parcial — não vem de nenhuma gamelist real, é fora de escopo ler isso.
const SAMPLE_RATING_STARS = 5;
const SAMPLE_RATING_VALUE = 3.5;

function renderRatingStars(
  box: { x: number; y: number; width: number; height: number },
  displayScale: number,
  color: string
) {
  const fillHex = hexColorToRgba(color);
  const fillOpacity = hexAlpha(color);
  const slot = box.width / SAMPLE_RATING_STARS;
  const outerRadius = Math.min(slot, box.height) * 0.42;

  const nodes = [];
  for (let i = 0; i < SAMPLE_RATING_STARS; i++) {
    const filled = i + 1 <= SAMPLE_RATING_VALUE;
    nodes.push(
      <Star
        key={`rating-star-${i}`}
        x={box.x + slot * (i + 0.5)}
        y={box.y + box.height / 2}
        numPoints={5}
        innerRadius={outerRadius * 0.45}
        outerRadius={outerRadius}
        fill={filled ? fillHex : "#ffffff33"}
        opacity={filled ? fillOpacity : 1}
        stroke={filled ? undefined : "#ffffff66"}
        strokeWidth={filled ? 0 : 1 / displayScale}
        listening={false}
      />
    );
  }
  return nodes;
}

// Contagem de exemplo só pra ter volume visual — badges reais viriam de
// metadados de gamelist.xml (gênero, região etc.), fora de escopo ler.
const SAMPLE_BADGE_COUNT = 6;

function renderBadgeItems(
  element: ThemeElement,
  box: { x: number; y: number; width: number; height: number },
  displayScale: number
) {
  const props = element.properties;
  const direction = (props.direction as string) ?? "row";
  const itemsPerLine = Math.max(1, Math.round((props.itemsPerRow as number) ?? 4));
  const marginNorm = (props.itemMargin as [number, number]) ?? [0.007, 0.007];
  // itemMargin é normalizado (0..1 da tela) — aqui só precisamos da
  // proporção entre os eixos, então aplicamos direto sobre a altura como
  // referência (aproximação razoável pra um preview estático).
  const marginX = marginNorm[0] * box.height;
  const marginY = marginNorm[1] * box.height;

  const isRow = direction !== "column";
  const lines = Math.ceil(SAMPLE_BADGE_COUNT / itemsPerLine);
  // Tamanho do badge derivado do espaço disponível — o schema não define
  // um itemSize próprio pra badges (vem do ícone real no ES-DE).
  const badgeSize = isRow
    ? Math.min((box.width - marginX * (itemsPerLine - 1)) / itemsPerLine, box.height / lines)
    : Math.min((box.height - marginY * (itemsPerLine - 1)) / itemsPerLine, box.width / lines);

  const nodes = [];
  for (let i = 0; i < SAMPLE_BADGE_COUNT; i++) {
    const line = Math.floor(i / itemsPerLine);
    const posInLine = i % itemsPerLine;
    const x = isRow
      ? box.x + posInLine * (badgeSize + marginX)
      : box.x + line * (badgeSize + marginX);
    const y = isRow
      ? box.y + line * (badgeSize + marginY)
      : box.y + posInLine * (badgeSize + marginY);

    nodes.push(
      <Rect
        key={`badge-${i}`}
        x={x}
        y={y}
        width={badgeSize}
        height={badgeSize}
        cornerRadius={3 / displayScale}
        fill={SAMPLE_ITEM_COLORS[i % SAMPLE_ITEM_COLORS.length]}
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
  onSelect: (index: number, additive: boolean) => void;
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
    onClick: (e: KonvaEventObject<MouseEvent>) => onSelect(index, e.evt.shiftKey),
    onTap: () => onSelect(index, false),
    onDragEnd: (e: KonvaEventObject<DragEvent>) =>
      onDragEnd(index, { x: e.target.x(), y: e.target.y() }),
  };

  const rawPath = element.type === "image" ? (element.properties.path as string) ?? "" : "";
  const resolvedPath = resolveVariable(rawPath, variables);
  const assetUrl = element.type === "image" ? assetMap[resolvedPath] : undefined;
  // Chamado incondicionalmente (Rules of Hooks) mesmo quando o elemento não
  // é "image" — nesse caso assetUrl é undefined e o hook não faz nada.
  const img = useHtmlImage(assetUrl);

  // video mostra o poster (defaultImagePath) se resolvido — mesmo padrão
  // de "image" acima, reproduzido pro outro path que aponta pra asset.
  const rawPosterPath = element.type === "video" ? (element.properties.defaultImagePath as string) ?? "" : "";
  const resolvedPosterPath = resolveVariable(rawPosterPath, variables);
  const posterAssetUrl = element.type === "video" ? assetMap[resolvedPosterPath] : undefined;
  const posterImg = useHtmlImage(posterAssetUrl);

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

  if (element.type === "video") {
    const iconSize = Math.min(box.width, box.height) * 0.16;
    return (
      <Group>
        {posterImg ? (
          <KonvaImage
            image={posterImg}
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            stroke={isSelected ? SELECTION_COLOR : undefined}
            strokeWidth={isSelected ? 2 / displayScale : 0}
            {...commonHandlers}
          />
        ) : (
          <Rect
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            fill={FALLBACK_COLOR.video}
            cornerRadius={4 / displayScale}
            stroke={isSelected ? SELECTION_COLOR : "#00000000"}
            strokeWidth={isSelected ? 2 / displayScale : 0}
            {...commonHandlers}
          />
        )}
        {/* Ícone de play — só decorativo, distingue video de image mesmo
            quando o poster (defaultImagePath) já está resolvido. */}
        <RegularPolygon
          x={box.x + box.width / 2}
          y={box.y + box.height / 2}
          sides={3}
          radius={iconSize}
          rotation={90}
          fill="#ffffffcc"
          stroke="#00000066"
          strokeWidth={1 / displayScale}
          listening={false}
        />
      </Group>
    );
  }

  if (element.type === "rating" || element.type === "badges") {
    const rawColor = (element.properties.color as string) ?? "FFFFFFFF";
    const resolvedColor = resolveVariable(rawColor, variables);
    return (
      <Group>
        {/* Fundo + hit target — mesmo padrão de carousel/grid/textlist:
            seleção/drag agem na área inteira, itens só decoram por cima. */}
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
          {element.type === "rating" && renderRatingStars(box, displayScale, resolvedColor)}
          {element.type === "badges" && renderBadgeItems(element, box, displayScale)}
        </Group>
      </Group>
    );
  }

  // datetime/gamelistinfo: texto real com um valor de exemplo fixo — não
  // interpreta o strftime de `format` de verdade (fora de escopo), só
  // mostra cor/fonte/alinhamento reais.
  if (element.type === "datetime" || element.type === "gamelistinfo") {
    const rawColor = (element.properties.color as string) ?? "000000FF";
    const resolvedColor = resolveVariable(rawColor, variables);
    const [, refH] = reference;
    const fontSizeNorm = (element.properties.fontSize as number) ?? 0.035;
    const fontSizePx = fontSizeNorm * refH;
    const defaultAlign = element.type === "gamelistinfo" ? "right" : "left";
    const align = (element.properties.horizontalAlignment as string) ?? defaultAlign;
    const sampleText =
      element.type === "gamelistinfo"
        ? "42/128"
        : Boolean(element.properties.displayRelative)
          ? "há 3 dias"
          : "15/01/2024";

    return (
      <KonvaText
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        text={sampleText}
        fontSize={fontSizePx}
        fill={hexColorToRgba(resolvedColor)}
        opacity={hexAlpha(resolvedColor)}
        align={align}
        verticalAlign="middle"
        stroke={isSelected ? SELECTION_COLOR : undefined}
        strokeWidth={isSelected ? 1 / displayScale : 0}
        {...commonHandlers}
      />
    );
  }

  // fallback genérico — não deveria ser alcançado com os 13 tipos do
  // schema atual, mas cobre um tipo futuro ainda sem preview dedicado.
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

// ---------------------------------------------------------------------------
// Resize por arraste: 4 handles nos cantos do elemento selecionado. Move
// o canto oposto ao que está sendo arrastado fica fixo; o canto arrastado
// vira o novo x/y ou x+width/y+height, conforme o caso — dá pra calcular
// os dois a partir só do ponto fixo + ponto arrastado, sem se importar
// qual canto é qual.
// ---------------------------------------------------------------------------

type Corner = "nw" | "ne" | "sw" | "se";

const MIN_BOX_PX = 12; // tamanho mínimo em pixels de referência, evita size 0

function cornerPoint(corner: Corner, box: PixelBox): { x: number; y: number } {
  switch (corner) {
    case "nw":
      return { x: box.x, y: box.y };
    case "ne":
      return { x: box.x + box.width, y: box.y };
    case "sw":
      return { x: box.x, y: box.y + box.height };
    case "se":
      return { x: box.x + box.width, y: box.y + box.height };
  }
}

const OPPOSITE_CORNER: Record<Corner, Corner> = { nw: "se", ne: "sw", sw: "ne", se: "nw" };

function fixedPointForCorner(corner: Corner, box: PixelBox): { x: number; y: number } {
  return cornerPoint(OPPOSITE_CORNER[corner], box);
}

function boxFromTwoCorners(a: { x: number; y: number }, b: { x: number; y: number }): PixelBox {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.max(MIN_BOX_PX, Math.abs(b.x - a.x)),
    height: Math.max(MIN_BOX_PX, Math.abs(b.y - a.y)),
  };
}

// Alguns elementos (image/video/text/datetime/gamelistinfo — ver
// es_de_elements.py) genuinamente não têm default de `pos` no ES-DE real:
// o próprio tema tem que fornecer um valor explícito (normalmente vindo de
// um <include>/<aspectRatio> que este editor ainda não processa). Antes,
// todo elemento sem `pos` caía silenciosamente em [0,0] — no tema Iconic
// real isso empilhava vários elementos diferentes exatamente no mesmo
// canto, indistinguíveis uns dos outros (achado no teste de composição
// completa). Em vez de fingir uma posição real, escalona cada um por
// índice — dá pra selecionar e editar, mas visualmente é óbvio (contorno
// tracejado, ver isUnpositioned abaixo) que não é a posição real do tema.
const UNPOSITIONED_COLUMNS = 6;
const UNPOSITIONED_STEP = 0.05;
function fallbackPos(index: number): [number, number] {
  const slot = index % 24;
  return [
    0.02 + (slot % UNPOSITIONED_COLUMNS) * UNPOSITIONED_STEP,
    0.02 + Math.floor(slot / UNPOSITIONED_COLUMNS) * UNPOSITIONED_STEP,
  ];
}

function unionBox(boxes: PixelBox[]): PixelBox {
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Posição/tamanho de um membro do grupo como fração da caixa delimitadora
// do grupo inteiro — assim, redimensionar o grupo é só reaplicar essas
// frações sobre a nova caixa delimitadora, sem casos especiais pra 1 vs N
// elementos selecionados (1 elemento é só um grupo cuja fração é 100%).
interface ResizeMember {
  index: number;
  origin: [number, number];
  rel: { x: number; y: number; w: number; h: number };
}

interface ResizeState {
  corner: Corner;
  fixedPoint: { x: number; y: number };
  box: PixelBox;
  members: ResizeMember[];
}

function relativeBoxToAbsolute(groupBox: PixelBox, rel: ResizeMember["rel"]): PixelBox {
  return {
    x: groupBox.x + rel.x * groupBox.width,
    y: groupBox.y + rel.y * groupBox.height,
    width: rel.w * groupBox.width,
    height: rel.h * groupBox.height,
  };
}

export function Canvas({
  elements,
  reference,
  selectedIndices,
  onSelect,
  onMove,
  onMoveMany,
  onResizeMany,
  assetMap,
  variables,
  displayScale = 0.5,
}: CanvasProps) {
  const [refW, refH] = reference;
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);

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

    // Se o elemento arrastado faz parte de um grupo multi-selecionado,
    // move o grupo inteiro pela mesma variação — senão só ele mesmo.
    if (selectedIndices.length > 1 && selectedIndices.includes(index)) {
      const oldPos = (el.properties.pos as [number, number]) ?? fallbackPos(index);
      onMoveMany(selectedIndices, [newPos[0] - oldPos[0], newPos[1] - oldPos[1]]);
    } else {
      onMove(index, newPos);
    }
  }

  // Box "efetivo" de um elemento: durante o resize, cada membro do grupo
  // usa sua fração (rel) aplicada sobre a caixa delimitadora ao vivo
  // (resizeState.box) em vez do valor ainda gravado no modelo — é o que dá
  // o feedback visual imediato ao arrastar um handle, pro grupo inteiro.
  function effectiveBox(index: number, box: PixelBox): PixelBox {
    const member = resizeState?.members.find((m) => m.index === index);
    return member ? relativeBoxToAbsolute(resizeState!.box, member.rel) : box;
  }

  // Caixa delimitadora de todos os elementos selecionados — com 1 só
  // elemento, é a própria caixa dele (fração 100%), sem caso especial.
  const selectedBoxes = selectedIndices.map((index) => {
    const el = elements[index];
    const pos = (el.properties.pos as [number, number]) ?? fallbackPos(index);
    const size = (el.properties.size as [number, number]) ?? [0.2, 0.1];
    const origin = (el.properties.origin as [number, number]) ?? [0, 0];
    return { index, origin, box: effectiveBox(index, resolveElementBox(pos, size, origin, reference)) };
  });
  const selectedBox = selectedBoxes.length > 0 ? unionBox(selectedBoxes.map((s) => s.box)) : null;

  function handleResizeDragStart(corner: Corner) {
    if (!selectedBox || selectedBoxes.length === 0) return;
    const members: ResizeMember[] = selectedBoxes.map(({ index, origin, box }) => ({
      index,
      origin,
      rel: {
        x: (box.x - selectedBox.x) / selectedBox.width,
        y: (box.y - selectedBox.y) / selectedBox.height,
        w: box.width / selectedBox.width,
        h: box.height / selectedBox.height,
      },
    }));
    setResizeState({
      corner,
      fixedPoint: fixedPointForCorner(corner, selectedBox),
      box: selectedBox,
      members,
    });
  }

  function handleResizeDragMove(e: KonvaEventObject<DragEvent>, handleSize: number) {
    if (!resizeState) return;
    const draggedCorner = { x: e.target.x() + handleSize / 2, y: e.target.y() + handleSize / 2 };
    setResizeState({ ...resizeState, box: boxFromTwoCorners(resizeState.fixedPoint, draggedCorner) });
  }

  function handleResizeDragEnd(e: KonvaEventObject<DragEvent>, handleSize: number) {
    if (!resizeState) return;
    const draggedCorner = { x: e.target.x() + handleSize / 2, y: e.target.y() + handleSize / 2 };
    const finalGroupBox = boxFromTwoCorners(resizeState.fixedPoint, draggedCorner);
    const updates = resizeState.members.map((member) => {
      const finalBox = relativeBoxToAbsolute(finalGroupBox, member.rel);
      const { pos, size } = boxToPosAndSize(finalBox, member.origin, reference);
      return { index: member.index, size, pos };
    });
    onResizeMany(updates);
    setResizeState(null);
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
          const pos = (el.properties.pos as [number, number]) ?? fallbackPos(index);
          const size = (el.properties.size as [number, number]) ?? [0.2, 0.1];
          const origin = (el.properties.origin as [number, number]) ?? [0, 0];
          const box = effectiveBox(index, resolveElementBox(pos, size, origin, reference));

          return (
            <ElementVisual
              key={`${el.type}-${el.name}-${index}`}
              element={el}
              index={index}
              box={box}
              isSelected={selectedIndices.includes(index)}
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
        {/* Contorno tracejado pros elementos SEM pos real (nem no tema, nem
            default do schema) — sinaliza que a caixa é só um lugar pra
            editar, não a posição real do tema (achado no teste de
            composição completa com o Iconic: sem isso, vários elementos
            empilhados na mesma caixa pareciam "um só", indistinguíveis). */}
        {drawOrder.map(({ el, index }) => {
          if (el.properties.pos !== undefined) return null;
          const size = (el.properties.size as [number, number]) ?? [0.2, 0.1];
          const origin = (el.properties.origin as [number, number]) ?? [0, 0];
          const box = effectiveBox(index, resolveElementBox(fallbackPos(index), size, origin, reference));
          return (
            <Rect
              key={`unpositioned-${index}`}
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              stroke="#e8e9eccc"
              strokeWidth={1.5 / displayScale}
              dash={[6 / displayScale, 4 / displayScale]}
              listening={false}
            />
          );
        })}
        {drawOrder.map(({ el, index }) => {
          const pos = (el.properties.pos as [number, number]) ?? fallbackPos(index);
          const origin = (el.properties.origin as [number, number]) ?? [0, 0];
          const size = (el.properties.size as [number, number]) ?? [0.2, 0.1];
          const box = effectiveBox(index, resolveElementBox(pos, size, origin, reference));
          const isSelected = selectedIndices.includes(index);
          const isUnpositioned = el.properties.pos === undefined;
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
                text={isUnpositioned ? `${el.type}:${el.name} · sem pos real` : `${el.type}:${el.name}`}
                fontSize={fontSize}
                padding={4 / displayScale}
                fill={isSelected ? "#0b0c0f" : "#e8e9ec"}
                fontStyle={isSelected ? "bold" : "normal"}
              />
            </Label>
          );
        })}
        {/* Handles de resize — só no elemento selecionado. Cada um arrasta
            livremente; o canto oposto fica fixo (fixedPointForCorner) e o
            novo box é recalculado a cada frame (handleResizeDragMove) pra
            dar feedback visual imediato, sem esperar o commit no modelo. */}
        {selectedBox &&
          (["nw", "ne", "sw", "se"] as Corner[]).map((corner) => {
            const handleSize = 8 / displayScale;
            const point = cornerPoint(corner, selectedBox);
            return (
              <Rect
                key={`resize-handle-${corner}`}
                x={point.x - handleSize / 2}
                y={point.y - handleSize / 2}
                width={handleSize}
                height={handleSize}
                fill="#ffffff"
                stroke={SELECTION_COLOR}
                strokeWidth={1.5 / displayScale}
                cornerRadius={2 / displayScale}
                draggable
                onDragStart={() => handleResizeDragStart(corner)}
                onDragMove={(e) => handleResizeDragMove(e, handleSize)}
                onDragEnd={(e) => handleResizeDragEnd(e, handleSize)}
              />
            );
          })}
      </Layer>
    </Stage>
  );
}
