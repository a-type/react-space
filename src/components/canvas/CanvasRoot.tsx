import { CSSProperties, ReactNode, useEffect } from 'react';
import { react } from 'signia';
import { Canvas } from '../../logic/Canvas.js';
import {
	CanvasGestureLayer,
	CanvasGestureLayerProps,
} from './CanvasGestureLayer.js';
import { CanvasProvider } from './CanvasProvider.js';

export interface CanvasRootProps extends CanvasGestureLayerProps {
	children?: ReactNode;
	canvas: Canvas;
}

const baseStyle: CSSProperties = {
	position: 'relative',
	touchAction: 'none',
	width: `calc(var(--canvas-max-x,0) - var(--canvas-min-x,0))`,
	height: `calc(var(--canvas-max-y,0) - var(--canvas-min-y,0))`,
	cursor: 'crosshair',
};

const centererStyle: CSSProperties = {
	overflow: 'visible',
	position: 'absolute',
	top: '50%',
	left: '50%',
	width: 0,
	height: 0,
};

export const CanvasRoot = ({
	children,
	canvas,
	style: userStyle,
	...props
}: CanvasRootProps) => {
	useEffect(() => {
		return react('canvas root limits', () => {
			const limits = canvas.limits.value;
			canvas.element?.style.setProperty('--canvas-min-x', `${limits.min.x}px`);
			canvas.element?.style.setProperty('--canvas-min-y', `${limits.min.y}px`);
			canvas.element?.style.setProperty('--canvas-max-x', `${limits.max.x}px`);
			canvas.element?.style.setProperty('--canvas-max-y', `${limits.max.y}px`);
		});
	}, [canvas]);

	return (
		<CanvasProvider value={canvas}>
			<CanvasGestureLayer
				data-purpose="canvas-root"
				ref={canvas.bind}
				{...props}
				style={{
					...userStyle,
					// override user styles -- all base styles are vital to function.
					...baseStyle,
				}}
			>
				<div data-purpose="centerer" style={centererStyle}>
					{children}
				</div>
			</CanvasGestureLayer>
		</CanvasProvider>
	);
};
