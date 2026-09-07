// Espelha backend/app/geometry.py — mesma lógica, para o canvas não depender
// de round-trip com o backend a cada frame de drag.

export interface PixelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function resolveElementBox(
  pos: [number, number],
  size: [number, number],
  origin: [number, number],
  reference: [number, number]
): PixelBox {
  const [refW, refH] = reference;
  const posPxX = pos[0] * refW;
  const posPxY = pos[1] * refH;
  const sizePxX = size[0] * refW;
  const sizePxY = size[1] * refH;

  return {
    x: posPxX - origin[0] * sizePxX,
    y: posPxY - origin[1] * sizePxY,
    width: sizePxX,
    height: sizePxY,
  };
}

// Inverso — usado no onDragEnd do Konva para regravar `pos` normalizado.
export function boxTopLeftToPos(
  topLeft: { x: number; y: number },
  size: [number, number],
  origin: [number, number],
  reference: [number, number]
): [number, number] {
  const [refW, refH] = reference;
  const sizePxX = size[0] * refW;
  const sizePxY = size[1] * refH;

  const posPxX = topLeft.x + origin[0] * sizePxX;
  const posPxY = topLeft.y + origin[1] * sizePxY;

  return [posPxX / refW, posPxY / refH];
}

// Inverso de resolveElementBox quando pos E size mudam junto (resize por
// arraste de handle) — dado o retângulo final em pixels e a origin atual,
// devolve pos e size normalizados prontos para gravar no modelo.
export function boxToPosAndSize(
  box: PixelBox,
  origin: [number, number],
  reference: [number, number]
): { pos: [number, number]; size: [number, number] } {
  const [refW, refH] = reference;
  const size: [number, number] = [box.width / refW, box.height / refH];
  const pos = boxTopLeftToPos({ x: box.x, y: box.y }, size, origin, reference);
  return { pos, size };
}
