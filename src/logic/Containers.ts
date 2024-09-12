import { Container } from './Container.js';
import { atom } from 'signia';
import { BoundsRegistry, BoundsRegistryEntry } from './BoundsRegistry.js';

export class Containers extends BoundsRegistry<ContainerEntry, [Container]> {
	constructor() {
		super({
			init: (id, container) => new ContainerEntry(id, container),
		});
	}
}

class ContainerEntry extends BoundsRegistryEntry {
	constructor(
		id: string,
		readonly container: Container,
	) {
		super(
			id,
			atom('origin', { x: 0, y: 0 }),
			atom('size', { width: 0, height: 0 }),
		);
	}
}
