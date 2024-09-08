import * as React from 'react';
import { useCanvasRect } from './canvasHooks.js';
import { useRerasterize } from './rerasterizeSignal.js';

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
	const canvasRect = useCanvasRect();

	const ref = React.useRef<HTMLDivElement>(null);
	useRerasterize(ref);

	const style = React.useMemo(() => {
		return {
			...baseStyle,
			backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
			width: canvasRect.width,
			height: canvasRect.height,
			left: 0,
			top: 0,
			transform: `translate(-50%, -50%)`,
		};
	}, [imageUrl, canvasRect]);

	return (
		<div style={style} ref={ref} {...rest}>
			{children}
		</div>
	);
};
