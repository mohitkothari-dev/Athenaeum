import type {
  ArrowElement,
  CanvasElement,
  CircleElement,
  LineElement,
  RectangleElement,
  StrokeElement,
  TextElement,
  TriangleElement,
} from '@/types/canvas';

export function renderStroke(ctx: CanvasRenderingContext2D, element: StrokeElement): void {
  if (element.points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = element.color;
  ctx.lineWidth = element.strokeWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  element.points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  // Pencil is deliberately softer and slightly doubled without random redraw jitter.
  if (element.tool === 'pencil') {
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = Math.max(1, element.strokeWidth * 0.55);
    ctx.beginPath();
    element.points.forEach((point, index) => {
      const offset = index % 2 === 0 ? 0.65 : -0.65;
      if (index === 0) ctx.moveTo(point.x + offset, point.y - offset);
      else ctx.lineTo(point.x + offset, point.y - offset);
    });
    ctx.stroke();
  }
  ctx.restore();
}

function applyShapeStyle(ctx: CanvasRenderingContext2D, color: string, strokeWidth: number): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = 'round';
}

export function renderRectangle(ctx: CanvasRenderingContext2D, element: RectangleElement): void {
  ctx.save();
  applyShapeStyle(ctx, element.color, element.strokeWidth);
  ctx.beginPath();
  ctx.rect(element.position.x, element.position.y, element.width, element.height);
  if (element.filled) ctx.fill(); else ctx.stroke();
  ctx.restore();
}

export function renderCircle(ctx: CanvasRenderingContext2D, element: CircleElement): void {
  ctx.save();
  applyShapeStyle(ctx, element.color, element.strokeWidth);
  ctx.beginPath();
  ctx.arc(element.position.x, element.position.y, element.radius, 0, Math.PI * 2);
  if (element.filled) ctx.fill(); else ctx.stroke();
  ctx.restore();
}

export function renderTriangle(ctx: CanvasRenderingContext2D, element: TriangleElement): void {
  ctx.save();
  applyShapeStyle(ctx, element.color, element.strokeWidth);
  ctx.beginPath();
  ctx.moveTo(element.position.x + element.width / 2, element.position.y);
  ctx.lineTo(element.position.x + element.width, element.position.y + element.height);
  ctx.lineTo(element.position.x, element.position.y + element.height);
  ctx.closePath();
  if (element.filled) ctx.fill(); else ctx.stroke();
  ctx.restore();
}

export function renderArrow(ctx: CanvasRenderingContext2D, element: ArrowElement): void {
  ctx.save();
  applyShapeStyle(ctx, element.color, element.strokeWidth);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(element.position.x, element.position.y);
  ctx.lineTo(element.endPoint.x, element.endPoint.y);
  ctx.stroke();
  const angle = Math.atan2(element.endPoint.y - element.position.y, element.endPoint.x - element.position.x);
  ctx.beginPath();
  ctx.moveTo(element.endPoint.x, element.endPoint.y);
  ctx.lineTo(element.endPoint.x - Math.cos(angle - Math.PI / 6) * element.headSize, element.endPoint.y - Math.sin(angle - Math.PI / 6) * element.headSize);
  ctx.lineTo(element.endPoint.x - Math.cos(angle + Math.PI / 6) * element.headSize, element.endPoint.y - Math.sin(angle + Math.PI / 6) * element.headSize);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function renderLine(ctx: CanvasRenderingContext2D, element: LineElement): void {
  ctx.save();
  applyShapeStyle(ctx, element.color, element.strokeWidth);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(element.position.x, element.position.y);
  ctx.lineTo(element.endPoint.x, element.endPoint.y);
  ctx.stroke();
  ctx.restore();
}

export function renderText(ctx: CanvasRenderingContext2D, element: TextElement): void {
  ctx.save();
  ctx.font = `${element.fontSize}px ${element.fontFamily}`;
  ctx.fillStyle = element.color;
  ctx.textBaseline = 'top';
  const lines = element.content.split('\n');
  const lineHeight = element.fontSize * 1.3;
  lines.forEach((line, index) => {
    ctx.fillText(line, element.position.x, element.position.y + index * lineHeight);
  });
  ctx.restore();
}

export function renderElement(ctx: CanvasRenderingContext2D, element: CanvasElement): void {
  switch (element.type) {
    case 'stroke': return renderStroke(ctx, element);
    case 'rectangle': return renderRectangle(ctx, element);
    case 'circle': return renderCircle(ctx, element);
    case 'triangle': return renderTriangle(ctx, element);
    case 'arrow': return renderArrow(ctx, element);
    case 'line': return renderLine(ctx, element);
    case 'text': return renderText(ctx, element);
  }
}
