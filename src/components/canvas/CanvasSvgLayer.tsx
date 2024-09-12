import { CSSProperties, ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { react } from 'signia';
import { useRerasterize } from '../../logic/rerasterizeSignal.js';
import { useCanvas } from './CanvasProvider.js';

export interface CanvasSvgLayerProps {
	children: ReactNode;
	className?: string;
	id: string;
}

const baseStyle: CSSProperties = {
	position: 'absolute',
	pointerEvents: 'none',
	width: '100%',
	height: '100%',
};

export function CanvasSvgLayer({
	children,
	className,
	id,
}: CanvasSvgLayerProps) {
	const canvas = useCanvas();

	const ref = useRef<SVGSVGElement>(null);
	useRerasterize(ref);

	useEffect(() => {
		return react(`canvas svg layer [${id}] viewbox`, () => {
			const { min, max } = canvas.limits.value;
			if (ref.current) {
				ref.current.setAttribute(
					'viewBox',
					`${min.x} ${min.y} ${max.x - min.x} ${max.y - min.y}`,
				);
			}
		});
	}, [canvas, ref]);

	const { min, max } = canvas.limits.value;

	return (
		<>
			<style>
				{`
        #${id} > * {
          pointer-events: auto;
        }
      `}
			</style>
			<svg
				className={className}
				style={baseStyle}
				id={id}
				ref={ref}
				viewBox={`${min.x} ${min.y} ${max.x - min.x} ${max.y - min.y}`}
			>
				{children}
			</svg>
		</>
	);
}

export function SvgPortal({
	children,
	layerId,
}: {
	children: ReactNode;
	layerId: string;
}) {
	const layer = document.getElementById(layerId);
	if (!layer) {
		console.debug('Layer not found', layerId);
		return null;
	}
	return createPortal(children, layer);
}
