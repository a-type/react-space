import { HTMLAttributes, useEffect, useRef, useSyncExternalStore } from 'react';
import { Container } from './containerHooks.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { ContainerProvider } from './containerHooks.js';
import { useMaybeObject } from '../object/Object.js';
import { useMergedRef } from '../../hooks.js';

export interface ContainerAreaProps extends HTMLAttributes<HTMLDivElement> {
	value: Container;
}

/**
 * A space inside an Object where other Objects can be placed.
 * Within this space, Objects are positioned locally -- that is, relative to the
 * ObjectContainer's origin.
 */
export function ContainerArea({ value, ...rest }: ContainerAreaProps) {
	const canvas = useCanvas();
	const object = useMaybeObject();

	const entry = useSyncExternalStore(
		(cb) =>
			canvas.bounds.subscribe('entryReplaced', (id) => {
				if (id === value.id) cb();
			}),
		() =>
			canvas.bounds.get(value.id) ??
			canvas.bounds.register(
				value.id,
				{ parent: object?.id },
				{
					type: 'container',
					accepts: value.accepts,
					priority: value.priority,
					overState: value.overState,
				},
			),
	);
	useEffect(() => {
		const objectEntry = object ? canvas.bounds.get(object.id) : null;
		entry.transform.apply({
			parent: objectEntry?.transform ?? null,
		});
	}, [canvas, entry, object]);

	const positionRef = useRef<HTMLDivElement>(null);
	const finalRef = useMergedRef<HTMLDivElement>(positionRef, entry.ref);

	useEffect(() => {
		const el = positionRef.current;
		if (!el) return;
		// if the parent has a border width, we need to offset the position,
		// as the border width is not taken into account for offsetLeft/offsetTop
		const parent = el.offsetParent as HTMLElement;
		if (!parent) return;
		const parentStyle = getComputedStyle(parent);
		const parentBorderLeft = parseFloat(parentStyle.borderLeftWidth);
		const parentBorderTop = parseFloat(parentStyle.borderTopWidth);
		const position = {
			x: el.offsetLeft + parentBorderLeft,
			y: el.offsetTop + parentBorderTop,
		};
		entry.transform.setPosition(position);
	}, [entry]);

	return (
		<ContainerProvider value={value}>
			<div ref={finalRef} {...rest} />
		</ContainerProvider>
	);
}
