import { CSSProperties, useEffect, useState } from 'react';
import { Container, ContainmentEvent } from '../../logic/Container.js';
import { useObject } from './Object.js';
import { useCanvas } from '../CanvasProvider.js';
import { CONTAINER_STATE } from './private.js';

export interface ObjectContainerProps {
	id?: string;
	accept: (containmentEvent: ContainmentEvent<any>) => boolean;
	priority?: number;
	className?: string;
	style?: CSSProperties;
}

/**
 * A space inside an Object where other Objects can be placed.
 * Within this space, Objects are positioned locally -- that is, relative to the
 * ObjectContainer's origin.
 */
export function ObjectContainer({
	id,
	accept,
	priority,
	...rest
}: ObjectContainerProps) {
	const object = useObject();
	const defaultedId = id ?? object.id;
	const [container] = useState(() => {
		return new Container({
			id: defaultedId,
			accept,
			priority,
			onCandidateStateChange: (id) => {
				object[CONTAINER_STATE].set({ overId: id });
			},
		});
	});
	const canvas = useCanvas();
	useEffect(
		() => canvas.registerContainer({ id: defaultedId, container }),
		[canvas, id, container],
	);

	return <div ref={container.ref} {...rest} />;
}
