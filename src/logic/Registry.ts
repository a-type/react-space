import { EventSubscriber } from '@a-type/utils';
import { SpatialHash } from './SpatialHash.js';
import { Atom, react, Signal } from 'signia';
import { Box, Size, Vector2 } from '../types.js';

export abstract class BoundsRegistryEntry {
	cleanup: () => void = () => {};
	private _element: Element | null = null;
	get element() {
		return this._element;
	}
	onElementChange: (
		id: string,
		element: Element | null,
		prev: Element | null,
	) => void = () => {};

	constructor(
		readonly id: string,
		readonly origin: Signal<Vector2>,
		readonly size: Atom<Size>,
	) {}

	track = (callback: (id: string, origin: Vector2, size: Size) => void) => {
		this.cleanup = react('object bounds change', () => {
			callback(this.id, this.origin.value, this.size.value);
		});
	};

	ref = (element: Element | null) => {
		const prev = this.element;
		this._element = element;
		this.onElementChange(this.id, element, prev);
	};
}

export type BoundsRegistryEvents = {
	observedChange: () => void;
	entryReplaced: (id: string) => void;
	elementChanged: (id: string, element: Element | null) => void;
};

export class BoundsRegistry<
	T extends BoundsRegistryEntry,
	RegisterParams extends any[],
> extends EventSubscriber<BoundsRegistryEvents> {
	protected entries: Map<string, T> = new Map();
	private deregistered = new Set<string>();
	private sizeObserver: ResizeObserver;
	private spatialHash = new SpatialHash<string>(100);
	private spatialHashRecomputeTimers = new Map<string, any>();

	constructor(
		private config: {
			init: (id: string, ...params: RegisterParams) => T;
		},
	) {
		super();
		this.sizeObserver = new ResizeObserver(this.handleDOMChanges);
	}

	register(id: string, ...params: RegisterParams) {
		this.deregistered.delete(id);

		let entry = this.entries.get(id);
		if (!entry) {
			entry = this.config.init(id, ...params);
			entry.track(this.onEntryChange);
			entry.onElementChange = this.onElementChange;
			this.entries.set(id, entry);
			this.emit('entryReplaced', id);
		}

		this.updateHash(id, entry.origin.value, entry.size.value);

		return entry;
	}

	private onEntryChange = (id: string, origin: Vector2, size: Size) => {
		this.debouncedUpdateHash(id, origin, size);
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

	updateHash = (objectId: string, origin: Vector2, size: Size) => {
		const x = origin.x;
		const y = origin.y;
		const width = size.width;
		const height = size.height;

		this.spatialHash.replace(objectId, { x, y, width, height });
	};

	private debouncedUpdateHash = (
		objectId: string,
		origin: Vector2,
		size: Size,
	) => {
		clearTimeout(this.spatialHashRecomputeTimers.get(objectId));
		this.spatialHashRecomputeTimers.set(
			objectId,
			setTimeout(() => {
				this.updateHash(objectId, origin, size);
			}, 500),
		);
	};

	private cleanupDeregistered = () => {
		for (const id of this.deregistered) {
			const entry = this.entries.get(id);
			if (entry) {
				entry.cleanup();
				this.onDeregister(entry);
				this.spatialHash.remove(id);
			}
			this.entries.delete(id);
			// @ts-ignore
			this.emit('entryReplaced', id);
		}
		this.deregistered.clear();
	};

	protected onDeregister(entry: T) {}

	get(id: string) {
		return this.entries.get(id);
	}

	get ids() {
		return Array.from(this.entries.keys());
	}

	observeElement = (id: string, element: Element | null) => {
		const entry = this.get(id);

		if (element === null) {
			entry?.size.set({ width: 0, height: 0 });
			return;
		}

		element.setAttribute('data-observed-object-id', id);
		this.sizeObserver.observe(element);
		entry?.size.set({
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
			const bounds = entry.borderBoxSize[0];
			const registration = this.entries.get(objectId);
			if (registration) {
				// x/y are not helpful here
				registration.size.set({
					width: bounds.inlineSize,
					height: bounds.blockSize,
				});
			}
		});
	};

	getIntersections = (box: Box, threshold: number) => {
		const nearby = this.spatialHash.queryByRect(box);
		const intersections = new Set<string>();
		for (const id of nearby) {
			if (this.intersects(id, box, threshold)) {
				intersections.add(id);
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
	intersects = (objectId: string, box: Box, threshold: number) => {
		const objectOrigin = this.getOrigin(objectId);
		const objectSize = this.getSize(objectId);

		if (!objectOrigin || !objectSize) return false;

		const objectX = objectOrigin.value.x;
		const objectY = objectOrigin.value.y;
		const objectWidth = objectSize.value.width;
		const objectHeight = objectSize.value.height;

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
			return intersectionArea / objectHeight > threshold;
		} else if (objectHeight === 0) {
			// box must enclose the object vertically
			if (objectY > boxBottomRight.y || objectY < boxTopLeft.y) return false;

			// this becomes a line containment check
			const intersectionArea = Math.max(
				0,
				Math.min(objectBottomRight.x, boxBottomRight.x) -
					Math.max(objectX, boxTopLeft.x),
			);
			return intersectionArea / objectWidth > threshold;
		}

		// ensure this isn't 0 as it's used as a divisor (although we should be safe here)
		const testArea = Math.max(Number.MIN_VALUE, objectWidth * objectHeight);
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
	 * Get the instantaenous bounding box of an object.
	 */
	getCurrentBounds = (objectId: string): Box | null => {
		const origin = this.getOrigin(objectId);
		const size = this.getSize(objectId);

		if (!origin && !size) {
			return null;
		}

		const bounds: Box = {
			x: 0,
			y: 0,
			width: 0,
			height: 0,
		};

		if (origin) {
			bounds.x = origin.value.x;
			bounds.y = origin.value.y;
		}
		if (size) {
			bounds.width = size.value.width;
			bounds.height = size.value.height;
		}

		return bounds;
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

	getEntry = (objectId: string) => {
		return this.entries.get(objectId);
	};

	getSize = (objectId: string) => {
		return this.entries.get(objectId)?.size ?? null;
	};

	getOrigin = (objectId: string) => {
		return this.entries.get(objectId)?.origin ?? null;
	};
}
