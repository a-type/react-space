import {
	Children,
	cloneElement,
	CSSProperties,
	ReactElement,
	ReactNode,
	useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { useObject } from './Object.js';

export interface ObjectDragImpostorProps {
	children: (state: { hidden: boolean }) => ReactElement;
}

export function ObjectDragImpostor({ children }: ObjectDragImpostorProps) {
	const object = useObject();
	const canvas = useCanvas();
	const element = useSyncExternalStore(
		(cb) => canvas.subscribe('bound', cb),
		() => canvas.element,
	);

	return (
		<>
			{children({ hidden: object.isDragging })}
			{object.isDragging &&
				element &&
				createPortal(children({ hidden: false }), element)}
		</>
	);
}
