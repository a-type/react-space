import { useEffect, useRef } from 'react';
import { useCanvas } from './CanvasProvider.js';
import raf from 'raf';

export interface DebugLayerProps {}

export function DebugLayer({}: DebugLayerProps) {
	const logicalCanvas = useCanvas();

	const ref = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const loop = () => {
			const ctx = ref.current?.getContext('2d');
			if (!ctx) return;
			ctx.clearRect(
				logicalCanvas.viewport.topLeft.x,
				logicalCanvas.viewport.topLeft.y,
				logicalCanvas.viewport.size.width,
				logicalCanvas.viewport.size.height,
			);

			ctx.strokeStyle = 'red';
			ctx.lineWidth = 1;
			for (const objectId of logicalCanvas.bounds.ids) {
				const entry = logicalCanvas.bounds.getEntry(objectId);
				if (!entry) continue;
				const origin = entry.origin.value;
				const size = entry.size.value;
				ctx.strokeRect(origin.x, origin.y, size.width, size.height);
			}

			ctx.strokeStyle = 'blue';
			ctx.lineWidth = 1;
			for (const containerId of logicalCanvas.containers.ids) {
				const entry = logicalCanvas.containers.getEntry(containerId);
				if (!entry) continue;
				const origin = entry.origin.value;
				const size = entry.size.value;
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
			}}
		/>
	);
}
