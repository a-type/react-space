import { CSSProperties, useEffect, useMemo, useRef } from 'react';
import { react } from 'signia';
import { useRerasterize } from '../../logic/rerasterizeSignal.js';
import { useCanvas } from './CanvasProvider.js';

export interface CanvasBackgroundProps {
	children?: React.ReactNode;
	imageUrl?: string | null;
	color?: string;
	className?: string;
}

const baseStyle: CSSProperties = {
	position: 'absolute',
	touchAction: 'none',
	backgroundRepeat: 'repeat',
	zIndex: 0,
};

/**
 * Renders a rectangle inside a viewport which stretches to the bounds of the
 * enclosed canvas. For convenience, you can pass imageUrl or color (or both),
 * or you can render children.
 */
export const CanvasBackground = ({
	children,
	imageUrl,
	color,
	...rest
}: CanvasBackgroundProps) => {
	const canvas = useCanvas();

	const ref = useRef<HTMLDivElement>(null);
	useRerasterize(ref);

	useEffect(() => {
		return react('canvas wallpaper size', () => {
			if (ref.current) {
				const { min, max } = canvas.limits.value;
				ref.current.style.width = `${max.x - min.x}px`;
				ref.current.style.height = `${max.y - min.y}px`;
			}
		});
	}, [canvas, ref]);

	const style = useMemo(() => {
		return {
			...baseStyle,
			backgroundColor: color,
			backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
			width: canvas.limits.value.max.x - canvas.limits.value.min.x,
			height: canvas.limits.value.max.y - canvas.limits.value.min.y,
			left: 0,
			top: 0,
			transform: `translate(-50%, -50%)`,
		};
	}, [imageUrl, canvas, color]);

	return (
		<div style={style} ref={ref} {...rest}>
			{children}
		</div>
	);
};
