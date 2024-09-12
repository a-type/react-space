import { CSSProperties, ReactNode } from 'react';
import { Canvas } from '../../logic/Canvas.js';
import { CanvasGestureLayer } from './CanvasGestureLayer.js';
import { CanvasProvider } from './CanvasProvider.js';

export interface CanvasRootProps {
	children?: ReactNode;
	canvas: Canvas;
}

const baseStyle: CSSProperties = {
	position: 'relative',
	touchAction: 'none',
};

export const CanvasRoot = ({ children, canvas }: CanvasRootProps) => {
	return (
		<CanvasProvider value={canvas}>
			<CanvasGestureLayer
				ref={canvas.bind}
				style={{
					...baseStyle,
					// @ts-ignore
					'--grid-size': `${
						canvas.snapIncrement > 1 ? canvas.snapIncrement : 24
					}px`,
				}}
			>
				{children}
			</CanvasGestureLayer>
		</CanvasProvider>
	);
};
