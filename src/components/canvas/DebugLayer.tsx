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
			canvas.width = viewport.size.width;
			canvas.height = viewport.size.height;

			ctx.clearRect(0, 0, canvas.width, canvas.height);

			ctx.strokeStyle = 'red';
			ctx.lineWidth = 1;
			for (const objectId of logicalCanvas.objects.ids) {
				const entry = logicalCanvas.objects.getEntry(objectId);
				if (!entry) continue;
				const origin = viewport.worldToViewport(entry.origin.value);
				const size = viewport.worldSizeToViewport(entry.size.value);
				ctx.strokeRect(origin.x, origin.y, size.width, size.height);
			}

			ctx.strokeStyle = 'blue';
			ctx.lineWidth = 1;
			for (const containerId of logicalCanvas.containers.ids) {
				const entry = logicalCanvas.containers.getEntry(containerId);
				if (!entry) continue;
				const origin = viewport.worldToViewport(entry.origin.value);
				const size = viewport.worldSizeToViewport(entry.size.value);
				ctx.strokeRect(origin.x, origin.y, size.width, size.height);
			}

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
