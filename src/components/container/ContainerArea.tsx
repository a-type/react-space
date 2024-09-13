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
			canvas.bounds.register(
				value.id,
				{ id: value.id, initialParent: object?.id },
				{
					type: 'container',
					accepts: value.accepts,
					priority: value.priority,
				},
			),
	);

	const positionRef = useRef<HTMLDivElement>(null);
	const finalRef = useMergedRef<HTMLDivElement>(positionRef, entry.ref);

	useEffect(() => {
		const el = positionRef.current;
		if (!el) return;
		entry.transform.position.set({
			x: el.offsetLeft,
			y: el.offsetTop,
		});
	}, [entry]);

	return (
		<ContainerProvider value={value}>
			<div ref={finalRef} {...rest} />
		</ContainerProvider>
	);
}
