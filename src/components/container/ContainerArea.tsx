import { HTMLAttributes, useSyncExternalStore } from 'react';
import { Container } from './containerHooks.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { ContainerProvider } from './containerHooks.js';
import { useMaybeObject } from '../object/Object.js';

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
			canvas.containers.subscribe('entryReplaced', (id) => {
				if (id === value.id) cb();
			}),
		() => canvas.containers.register(value.id, value, { parentId: object?.id }),
	);

	return (
		<ContainerProvider value={value}>
			<div ref={entry.ref} {...rest} />
		</ContainerProvider>
	);
}
