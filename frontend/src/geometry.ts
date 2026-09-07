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
