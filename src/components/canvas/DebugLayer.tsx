import { useEffect, useRef } from 'react';
import raf from 'raf';
import { Canvas } from '../../logic/Canvas.js';
import { Viewport } from '../../viewport.js';

export interface DebugLayerProps {
	canvas?: Canvas;
	viewport?: Viewport;
}

export function DebugLayer({
	canvas: logicalCanvas,
	viewport: logicalViewport,
}: DebugLayerProps) {
	const ref = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const loop = () => {
			const canvas = ref.current;
			if (!canvas) return;

			const ctx = canvas.getContext('2d');
			if (!ctx) return;

			const viewport = logicalViewport ?? logicalCanvas?.viewport;
			if (!viewport) return;

			canvas.width = viewport.size.width * viewport.zoomValue;
			canvas.height = viewport.size.height * viewport.zoomValue;

			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.lineWidth = 1;
			ctx.setLineDash([]);
			ctx.textBaseline = 'top';
			ctx.font = '12px monospace';

			// crosshair at origin
			ctx.strokeStyle = 'white';
			ctx.beginPath();
			const origin = viewport.worldToViewport({ x: 0, y: 0 });
			ctx.moveTo(origin.x, origin.y - 10);
			ctx.lineTo(origin.x, origin.y + 10);
			ctx.moveTo(origin.x - 10, origin.y);
			ctx.lineTo(origin.x + 10, origin.y);
			ctx.stroke();

			// draw pan limits
			ctx.setLineDash([10, 10]);
			ctx.strokeStyle = 'gray';
			const panLimits = viewport.config.panLimits;
			if (panLimits) {
				const min = viewport.worldToViewport(panLimits.min);
				const max = viewport.worldToViewport(panLimits.max);
				ctx.strokeRect(min.x, min.y, max.x - min.x, max.y - min.y);
			}

			if (logicalCanvas) {
				ctx.setLineDash([5, 5]);
				ctx.strokeStyle = 'red';
				ctx.fillStyle = 'red';
				for (const objectId of logicalCanvas.bounds.ids) {
					const entry = logicalCanvas.bounds.get(objectId);
					if (!entry) continue;
					if (entry.data.type === 'container') {
						ctx.strokeStyle = 'blue';
						ctx.fillStyle = 'blue';
					} else {
						ctx.strokeStyle = 'red';
						ctx.fillStyle = 'red';
					}
					const origin = viewport.worldToViewport(
						entry.transform.worldOrigin.value,
					);
					const size = viewport.worldSizeToViewport(entry.transform.size.value);
					// const origin = entry.origin.value;
					// const size = entry.size.value;
					ctx.strokeRect(origin.x, origin.y, size.width, size.height);
					ctx.fillText(objectId, origin.x, origin.y);
				}

				ctx.setLineDash([]);
				ctx.strokeStyle = 'black';
				for (const objectId of logicalCanvas.bounds.ids) {
					const entry = logicalCanvas.bounds.get(objectId);
					if (!entry) continue;
					// draw a 3x3 crosshair at world position
					const position = viewport.worldToViewport(
						entry.transform.worldPosition.value,
					);
					ctx.beginPath();
					ctx.moveTo(position.x - 3, position.y);
					ctx.lineTo(position.x + 3, position.y);
					ctx.moveTo(position.x, position.y - 3);
					ctx.lineTo(position.x, position.y + 3);
					ctx.stroke();
				}
			}
			// print viewport zoom level and center point in top left
			ctx.fillStyle = 'black';
			ctx.fillText(
				`zoom: ${viewport.zoomValue.toFixed(2)} center: ${viewport.center.x.toFixed(2)}, ${viewport.center.y.toFixed(2)}`,
				10,
				10,
			);

			handle = raf(loop);
		};
		let handle = raf(loop);
		return () => raf.cancel(handle);
	}, [logicalCanvas, logicalViewport]);

	return (
		<canvas
			ref={ref}
			style={{
				position: 'absolute',
				inset: 0,
				opacity: 0.5,
				zIndex: 1000,
				pointerEvents: 'none',
				width: '100%',
				height: '100%',
			}}
		/>
	);
}
