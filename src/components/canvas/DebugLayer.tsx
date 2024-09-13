import { useEffect, useRef } from 'react';
import raf from 'raf';
import { Canvas } from '../../logic/Canvas.js';

export interface DebugLayerProps {
	canvas: Canvas;
}

export function DebugLayer({ canvas: logicalCanvas }: DebugLayerProps) {
	const ref = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const loop = () => {
			const canvas = ref.current;
			if (!canvas) return;

			const ctx = canvas.getContext('2d');
			if (!ctx) return;

			const viewport = logicalCanvas.viewport;
			canvas.width = viewport.size.width * viewport.zoomValue;
			canvas.height = viewport.size.height * viewport.zoomValue;

			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.lineWidth = 1;
			ctx.setLineDash([]);
			ctx.textBaseline = 'top';
			ctx.font = '12px monospace';

			// crosshair at origin
			ctx.strokeStyle = 'black';
			ctx.setLineDash([5, 5]);
			ctx.beginPath();
			const origin = viewport.worldToViewport({ x: 0, y: 0 });
			ctx.moveTo(origin.x, origin.y - 10);
			ctx.lineTo(origin.x, origin.y + 10);
			ctx.moveTo(origin.x - 10, origin.y);
			ctx.lineTo(origin.x + 10, origin.y);
			ctx.stroke();

			ctx.strokeStyle = 'red';
			ctx.fillStyle = 'red';

			for (const objectId of logicalCanvas.objects.ids) {
				const entry = logicalCanvas.objects.getEntry(objectId);
				if (!entry) continue;
				const origin = viewport.worldToViewport(entry.origin.value);
				const size = viewport.worldSizeToViewport(entry.size.value);
				// const origin = entry.origin.value;
				// const size = entry.size.value;
				ctx.strokeRect(origin.x, origin.y, size.width, size.height);
				ctx.fillText(objectId, origin.x, origin.y);
			}

			ctx.strokeStyle = 'blue';
			ctx.fillStyle = 'blue';
			ctx.lineWidth = 1;
			for (const containerId of logicalCanvas.containers.ids) {
				const entry = logicalCanvas.containers.getEntry(containerId);
				if (!entry) continue;
				const origin = viewport.worldToViewport(entry.origin.value);
				const size = viewport.worldSizeToViewport(entry.size.value);
				ctx.strokeRect(origin.x, origin.y, size.width, size.height);
				ctx.fillText(containerId, origin.x, origin.y);
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
	}, [logicalCanvas]);

	return (
		<canvas
			ref={ref}
			style={{
				position: 'absolute',
				inset: 0,
				zIndex: 1000,
				pointerEvents: 'none',
				width: '100%',
				height: '100%',
			}}
		/>
	);
}
