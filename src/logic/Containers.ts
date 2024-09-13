import { Container } from '../components/container/containerHooks.js';
import { Atom, atom } from 'signia';
import { BoundsRegistry, BoundsRegistryEntry } from './BoundsRegistry.js';
import { Vector2 } from '../types.js';

export class Containers extends BoundsRegistry<
	ContainerEntry,
	[Container, { parentId?: string }]
> {
	constructor() {
		super({
			init: (id, container, parentConfig) =>
				new ContainerEntry(id, container, parentConfig),
			update: (entry, container, parentConfig) => {
				entry.container = container;
				entry.parentId = parentConfig.parentId;
			},
		});
	}
}

class ContainerEntry extends BoundsRegistryEntry {
	private mutableOrigin;
	constructor(
		id: string,
		public container: Container,
		parentConfig: { parentId?: string },
	) {
		super(
			id,
			atom('container origin', { x: 0, y: 0 }),
			atom('container size', { width: 0, height: 0 }),
			parentConfig.parentId,
		);
		this.mutableOrigin = this.origin as Atom<Vector2>;
	}

	updateFromResize(entry: ResizeObserverEntry) {
		super.updateFromResize(entry);
		this.mutableOrigin.set({
			x: (entry.target as HTMLElement).offsetLeft,
			y: (entry.target as HTMLElement).offsetTop,
		});
	}
}
