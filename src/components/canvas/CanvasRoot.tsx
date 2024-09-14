import { CSSProperties, ReactNode, useCallback, useEffect } from 'react';
import { Canvas } from '../../logic/Canvas.js';
import { CanvasGestureLayer } from './CanvasGestureLayer.js';
import { CanvasProvider } from './CanvasProvider.js';
import { useStableCallback } from '../../hooks.js';

export interface CanvasRootProps {
	children?: ReactNode;
	canvas: Canvas;
	onTap?: () => void;
}

const baseStyle: CSSProperties = {
	position: 'relative',
	touchAction: 'none',
};

export const CanvasRoot = ({ children, canvas, onTap }: CanvasRootProps) => {
	const defaultOnTap = useCallback(() => {
		canvas.selections.clear();
	}, [canvas]);
	const stableOnTap = useStableCallback(onTap || defaultOnTap);
	useEffect(() => {
		return canvas.subscribe('canvasTap', stableOnTap);
	}, [stableOnTap, canvas]);
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
