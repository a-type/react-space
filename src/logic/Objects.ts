import { Atom, atom, Computed, computed } from 'signia';
import { Size, Vector2 } from '../types.js';
import { BoundsRegistry, BoundsRegistryEntry } from './BoundsRegistry.js';
import { MutableRefObject } from 'react';

export class Objects extends BoundsRegistry<
	ObjectBoundsEntry,
	[MutableRefObject<any>, Vector2, { parentContainerId?: string }]
> {
	constructor() {
		super({
			init: (objectId, metadata, initialPosition, parentConfig) =>
				new ObjectBoundsEntry(
					objectId,
					atom('origin', initialPosition || { x: 0, y: 0 }),
					atom('size', { width: 0, height: 0 }),
					metadata,
					parentConfig,
				),
			update: (entry, metadata, initialPosition, parentConfig) => {
				entry.metadata.current = metadata;
				entry.origin.set(initialPosition);
				entry.parentId = parentConfig.parentContainerId;
			},
		});
	}
}

class ObjectBoundsEntry extends BoundsRegistryEntry {
	readonly center: Computed<Vector2>;
	constructor(
		readonly id: string,
		readonly origin: Atom<Vector2>,
		readonly size: Atom<Size>,
		readonly metadata: MutableRefObject<any>,
		parentConfig: { parentContainerId?: string },
	) {
		super(id, origin, size, parentConfig.parentContainerId);
		this.center = computed<Vector2>('center', () => ({
			x: origin.value.x + size.value.width / 2,
			y: origin.value.y + size.value.height / 2,
		}));
	}
}
