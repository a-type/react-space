import { CSSProperties, ReactNode } from 'react';
import { disableDragProps } from './CanvasObjectDragHandle.jsx';
import { stopPropagation } from '@a-type/utils';

export interface CanvasOverlayProps {
	className?: string;
	children?: ReactNode;
}

const baseStyle: CSSProperties = {
	position: 'absolute',
	touchAction: 'none',
	pointerEvents: 'none',
	inset: 0,
};

export function CanvasOverlay({ children, ...rest }: CanvasOverlayProps) {
	return (
		<div
			{...disableDragProps}
			style={baseStyle}
			// prevent cancellation further down
			onContextMenu={stopPropagation}
			{...rest}
		>
			{children}
		</div>
	);
}

const contentBaseStyle: CSSProperties = {
	pointerEvents: 'auto',
};

export function CanvasOverlayContent({
	children,
	...rest
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div style={contentBaseStyle} {...rest}>
			{children}
		</div>
	);
}
