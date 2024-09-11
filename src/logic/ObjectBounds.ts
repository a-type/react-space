import { Atom, atom, Computed, computed } from 'signia';
import { Size, Vector2 } from '../types.js';
import { BoundsRegistry, BoundsRegistryEntry } from './Registry.js';

export class ObjectBounds extends BoundsRegistry<
	ObjectBoundsEntry,
	[any, Vector2]
> {
	constructor() {
		super({
			init: (objectId: string, metadata: any, initialPosition?: Vector2) =>
				new ObjectBoundsEntry(
					objectId,
					atom('origin', initialPosition || { x: 0, y: 0 }),
					atom('size', { width: 0, height: 0 }),
					metadata,
				),
		});
	}
}

class ObjectBoundsEntry extends BoundsRegistryEntry {
	readonly center: Computed<Vector2>;
	constructor(
		readonly id: string,
		readonly origin: Atom<Vector2>,
		readonly size: Atom<Size>,
		readonly metadata: any,
	) {
		super(id, origin, size);
		this.center = computed<Vector2>('center', () => ({
			x: origin.value.x + size.value.width / 2,
			y: origin.value.y + size.value.height / 2,
		}));
	}
}
