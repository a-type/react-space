import * as React from 'react';
import { react } from 'signia';
import { useRerasterize } from '../../logic/rerasterizeSignal.js';
import { useCanvas } from './CanvasProvider.js';

export interface IViewportWallpaperProps {
	children?: React.ReactNode;
	imageUrl?: string | null;
	color?: string;
	className?: string;
}

const baseStyle: React.CSSProperties = {
	position: 'absolute',
	touchAction: 'none',
	backgroundRepeat: 'repeat',
	zIndex: 0,
};

/**
 * Renders a wallpaper inside a viewport which stretches to the bounds of the
 * enclosed canvas.
 */
export const CanvasWallpaper: React.FC<IViewportWallpaperProps> = ({
	children,
	imageUrl,
	...rest
}) => {
	const canvas = useCanvas();

	const ref = React.useRef<HTMLDivElement>(null);
	useRerasterize(ref);

	React.useEffect(() => {
		return react('canvas wallpaper size', () => {
			if (ref.current) {
				const { min, max } = canvas.limits.value;
				ref.current.style.width = `${max.x - min.x}px`;
				ref.current.style.height = `${max.y - min.y}px`;
			}
		});
	}, [canvas, ref]);

	const style = React.useMemo(() => {
		return {
			...baseStyle,
			backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
			width: canvas.limits.value.max.x - canvas.limits.value.min.x,
			height: canvas.limits.value.max.y - canvas.limits.value.min.y,
			left: 0,
			top: 0,
			transform: `translate(-50%, -50%)`,
		};
	}, [imageUrl, canvas]);

	return (
		<div style={style} ref={ref} {...rest}>
			{children}
		</div>
	);
};
