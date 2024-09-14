import { EventSubscriber } from '@a-type/utils';
import { SpatialHash } from './SpatialHash.js';
import { Atom, react, Signal } from 'signia';
import { Box, Size, Vector2 } from '../types.js';
import { Transform, TransformInit } from './Transform.js';

export interface BoundsEntryData {
	type: string;
}

export class BoundsRegistryEntry<TData extends BoundsEntryData> {
	cleanup: () => void = () => {};
	_element: Element | null = null;
	get element() {
		return this._element;
	}

	constructor(
		readonly id: string,
		readonly transform: Transform,
		public data: TData,
		onEntryChange: (id: string, bounds: Box) => void,
		private onElementChange: (
			id: string,
			element: Element | null,
			prev: Element | null,
		) => void,
	) {
		console.log('BoundsRegistryEntry created for', id);
		this.cleanup = react(`${id} entry change`, () => {
			onEntryChange(id, transform.bounds.value);
		});
	}

	ref = (element: Element | null) => {
		const prev = this.element;
		this._element = element;
		this.onElementChange(this.id, element, prev);
	};

	updateFromResize(entry: ResizeObserverEntry) {
		const bounds = entry.borderBoxSize[0];
		this.transform.size.set({
			width: bounds.inlineSize,
			height: bounds.blockSize,
		});
	}

	setData = (data: TData) => {
		this.data = data;
	};
}

export type BoundsRegistryEvents = {
	observedChange: () => void;
	entryReplaced: (id: string) => void;
	elementChanged: (id: string, element: Element | null) => void;
};

export type RegistryTransformInit = Omit<TransformInit, 'initialParent'> & {
	initialParent?: string | null;
};

export class BoundsRegistry<
	TDataTypes extends BoundsEntryData,
> extends EventSubscriber<BoundsRegistryEvents> {
	protected entries: Map<string, BoundsRegistryEntry<TDataTypes>> = new Map();
	private deregistered = new Set<string>();
	private sizeObserver: ResizeObserver;
	private spatialHash = new SpatialHash<string>(100);
	private spatialHashRecomputeTimers = new Map<string, any>();

	constructor() {
		super();
		this.sizeObserver = new ResizeObserver(this.handleDOMChanges);
	}

	register(id: string, transformInit: RegistryTransformInit, data: TDataTypes) {
		this.deregistered.delete(id);

		const parentEntry =
			transformInit.initialParent ?
				this.get(transformInit.initialParent)
			:	null;

		let entry = this.entries.get(id);
		if (!entry) {
			entry = new BoundsRegistryEntry(
				id,
				new Transform({
					...transformInit,
					initialParent: parentEntry?.transform,
				}),
				data,
				this.onEntryChange,
				this.onElementChange,
			);
			this.entries.set(id, entry);
			this.emit('entryReplaced', id);
		} else {
			entry.transform.apply({
				...transformInit,
				initialParent: parentEntry?.transform,
			});
			entry.setData(data);
		}

		return entry;
	}

	private onEntryChange = (id: string, bounds: Box) => {
		this.debouncedUpdateHash(id, bounds);
	};

	private onElementChange = (
		id: string,
		current: Element | null,
		prev: Element | null,
	) => {
		if (prev) {
			this.unobserveElement(prev);
		}
		if (current) {
			this.observeElement(id, current);
		}
		this.emit('elementChanged', id, current);
	};

	deregister = (id: string) => {
		this.deregistered.add(id);
		setTimeout(this.cleanupDeregistered, 100);
	};

	updateHash = (objectId: string, bounds: Box) => {
		this.spatialHash.replace(objectId, bounds);
	};

	private debouncedUpdateHash = (objectId: string, bounds: Box) => {
		clearTimeout(this.spatialHashRecomputeTimers.get(objectId));
		this.spatialHashRecomputeTimers.set(
			objectId,
			setTimeout(() => {
				this.updateHash(objectId, bounds);
			}, 500),
		);
	};

	private cleanupDeregistered = () => {
		for (const id of this.deregistered) {
			const entry = this.entries.get(id);
			if (entry) {
				entry.cleanup();
				this.spatialHash.remove(id);
			}
			this.entries.delete(id);
			// @ts-ignore
			this.emit('entryReplaced', id);
		}
		this.deregistered.clear();
	};

	get(id: string) {
		return this.entries.get(id);
	}

	get ids() {
		return Array.from(this.entries.keys());
	}

	observeElement = (id: string, element: Element | null) => {
		const entry = this.get(id);

		if (element === null) {
			entry?.transform.size.set({ width: 0, height: 0 });
			return;
		}

		element.setAttribute('data-observed-object-id', id);
		this.sizeObserver.observe(element);
		entry?.transform.size.set({
			width: element.clientWidth,
			height: element.clientHeight,
		});
		this.emit('observedChange');
		return () => void this.sizeObserver.unobserve(element);
	};

	unobserveElement = (el: Element) => {
		const id = el.getAttribute('data-observed-object-id');
		if (id) {
			this.emit('observedChange');
			this.sizeObserver.unobserve(el);
		}
	};

	private handleDOMChanges = (entries: ResizeObserverEntry[]) => {
		entries.forEach((entry) => {
			const objectId = entry.target.getAttribute('data-observed-object-id');
			if (!objectId) return;
			const registration = this.entries.get(objectId);
			if (registration) {
				// x/y are not helpful here
				registration.updateFromResize(entry);
			}
		});
	};

	getIntersections = <T extends TDataTypes>(
		box: Box,
		threshold: number,
		filter?: (data: TDataTypes) => boolean,
	) => {
		const nearby = this.spatialHash.queryByRect(box);
		const intersections = new Array<BoundsRegistryEntry<T>>();
		for (const id of nearby) {
			const entry = this.get(id);
			if (!entry) continue;
			if (filter && !filter(entry.data)) continue;

			if (this.intersects(entry, box, threshold)) {
				intersections.push(entry as unknown as BoundsRegistryEntry<T>);
			}
		}
		return intersections;
	};

	getObjectIntersections = (objectId: string, threshold: number) => {
		const objectBounds = this.getCurrentBounds(objectId);
		if (!objectBounds) return new Set<string>();
		return this.getIntersections(objectBounds, threshold);
	};

	hitTest = (point: Vector2) => {
		return this.getIntersections(
			{
				...point,
				width: 0,
				height: 0,
			},
			0,
		);
	};

	/**
	 * Determines if an object intersects with a box area.
	 * Threshold is a positive percentage required to pass intersection;
	 * 0 means any part intersects, 1 means the object must be fully enclosed.
	 */
	intersects = (
		entry: BoundsRegistryEntry<any>,
		box: Box,
		threshold: number,
	) => {
		const objectX = entry.transform.bounds.value.x;
		const objectY = entry.transform.bounds.value.y;
		const objectWidth = entry.transform.bounds.value.width;
		const objectHeight = entry.transform.bounds.value.height;

		const objectBottomRight = {
			x: objectX + objectWidth,
			y: objectY + objectHeight,
		};

		if (box.width === 0 && box.height === 0) {
			// this becomes a point containment check and always passes if true
			return (
				box.x >= objectX &&
				box.x <= objectBottomRight.x &&
				box.y >= objectY &&
				box.y <= objectBottomRight.y
			);
		}

		const boxTopLeft = {
			x: box.x,
			y: box.y,
		};
		const boxBottomRight = {
			x: boxTopLeft.x + box.width,
			y: boxTopLeft.y + box.height,
		};

		if (objectWidth === 0) {
			// box must enclose the object horizontally
			if (objectX > boxBottomRight.x || objectX < boxTopLeft.x) return false;

			// this becomes a line containment check
			const intersectionArea = Math.max(
				0,
				Math.min(objectBottomRight.y, boxBottomRight.y) -
					Math.max(objectY, boxTopLeft.y),
			);
			return intersectionArea / box.height > threshold;
		} else if (objectHeight === 0) {
			// box must enclose the object vertically
			if (objectY > boxBottomRight.y || objectY < boxTopLeft.y) return false;

			// this becomes a line containment check
			const intersectionArea = Math.max(
				0,
				Math.min(objectBottomRight.x, boxBottomRight.x) -
					Math.max(objectX, boxTopLeft.x),
			);
			return intersectionArea / box.width > threshold;
		}

		// ensure this isn't 0 as it's used as a divisor (although we should be safe here)
		const testArea = Math.max(
			Number.MIN_VALUE,
			Math.min(box.width * box.height, objectWidth * objectHeight),
		);
		const intersectionArea =
			Math.max(
				0,
				Math.min(objectBottomRight.x, boxBottomRight.x) -
					Math.max(objectX, boxTopLeft.x),
			) *
			Math.max(
				0,
				Math.min(objectBottomRight.y, boxBottomRight.y) -
					Math.max(objectY, boxTopLeft.y),
			);

		return intersectionArea / testArea > threshold;
	};

	/**
	 * Get the instantaneous bounding box of an object.
	 */
	getCurrentBounds = (objectId: string): Box | null => {
		const entry = this.get(objectId);
		return entry?.transform.bounds.value ?? null;
	};

	/**
	 * Gets the instantaneous rectangle describing the outer
	 * limits of all tracked objects
	 */
	getCurrentContainer = () => {
		const ids = this.ids;
		let container = this.getCurrentBounds(ids[0]);
		if (!container) {
			return null;
		}

		for (let i = 1; i < ids.length; i++) {
			const bounds = this.getCurrentBounds(ids[i]);
			if (!bounds) {
				continue;
			}

			container = {
				x: Math.min(container.x, bounds.x),
				y: Math.min(container.y, bounds.y),
				width: Math.max(container.width, bounds.x - container.x + bounds.width),
				height: Math.max(
					container.height,
					bounds.y - container.y + bounds.height,
				),
			};
		}

		return container;
	};
}
