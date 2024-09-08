import { createContext, CSSProperties, useCallback, useRef } from 'react';
import { useCanvas } from './CanvasProvider.jsx';
import { Size } from './types.js';
import { Viewport } from './Viewport.js';
import {
	useKeyboardControls,
	useViewportGestureControls,
} from './viewportHooks.js';
import { useMergedRef } from '../hooks.js';

export function useViewport() {
	const canvas = useCanvas();
	return canvas.viewport;
}

export const ViewportContext = createContext<Viewport | null>(null);

export interface ViewportProviderProps {
	children?: React.ReactNode;
	minZoom?: number;
	maxZoom?: number;
	defaultZoom?: number;
	canvasSize?: Size | null;
}

const baseStyle: CSSProperties = {
	width: '100%',
	height: '100%',
	flex: 1,
	overflow: 'hidden',
	userSelect: 'none',
	cursor: 'move',
	position: 'relative',
	touchAction: 'none',
	contain: 'strict',
};

export const ViewportRoot = ({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) => {
	const viewport = useViewport();
	const ref = useRef<HTMLDivElement>(null);

	const viewportProps = useViewportGestureControls(viewport, ref);

	const keyboardProps = useKeyboardControls(viewport);

	const finalRef = useMergedRef<HTMLDivElement>(
		ref,
		keyboardProps.ref,
		viewport.bindElement,
	);

	return (
		<div
			className={className}
			style={baseStyle}
			{...viewportProps}
			{...keyboardProps}
			ref={finalRef}
		>
			{children}
		</div>
	);
};
