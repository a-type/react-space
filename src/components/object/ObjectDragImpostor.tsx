import {
	CSSProperties,
	ReactElement,
	Ref,
	useRef,
	useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { useMergedRef } from '../../hooks.js';
import { useObjectEntry } from '../canvas/canvasHooks.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { useObject } from './Object.js';
import { useLiveElementPosition } from './signalHooks.js';

export interface ObjectDragImpostorProps {
	children: (state: {
		style: CSSProperties;
		ref: Ref<HTMLDivElement>;
	}) => ReactElement;
	externalRealRef: Ref<HTMLDivElement>;
}

export function ObjectDragImpostor({
	children,
	externalRealRef,
}: ObjectDragImpostorProps) {
	const object = useObject();
	const canvas = useCanvas();
	const element = useSyncExternalStore(
		(cb) => canvas.subscribe('bound', cb),
		() => canvas.element,
	);

	// the actual object and drag impostor get slightly different styles.
	// the drag impostor always renders at worldOrigin, whereas the
	// real object renders at origin, local to its container.
	const realRef = useRef<HTMLDivElement>(null);
	const impostorRef = useRef<HTMLDivElement>(null);

	const objectEntry = useObjectEntry(object.id);
	useLiveElementPosition(realRef, objectEntry?.transform.origin);
	useLiveElementPosition(impostorRef, objectEntry?.transform.worldOrigin);

	const finalRealRef = useMergedRef(realRef, externalRealRef);

	const realStyle: CSSProperties = {
		visibility: object.isDragging ? 'hidden' : 'visible',
		transform: 'translate(var(--x), var(--y))',
		// @ts-ignore
		'--x': (objectEntry?.transform.origin.value.x ?? 0) + 'px',
		'--y': (objectEntry?.transform.origin.value.y ?? 0) + 'px',
	};
	const impostorStyle: CSSProperties = {
		visibility: object.isDragging ? 'visible' : 'hidden',
		transform: 'translate(var(--x), var(--y))',
		// @ts-ignore
		'--x': (objectEntry?.transform.worldOrigin.value.x ?? 0) + 'px',
		'--y': (objectEntry?.transform.worldOrigin.value.y ?? 0) + 'px',
	};

	return (
		<>
			{children({ style: realStyle, ref: finalRealRef })}
			{object.isDragging &&
				element &&
				createPortal(
					children({ style: impostorStyle, ref: impostorRef }),
					element,
				)}
		</>
	);
}
