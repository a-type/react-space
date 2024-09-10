import { EventSubscriber } from '@a-type/utils';
import { Atom, atom, Computed, computed, react } from 'signia';
import { Box, LiveSize, LiveVector2, Size, Vector2 } from '../types.js';
import { SpatialHash } from './SpatialHash.js';

export class ObjectBounds extends EventSubscriber<{
	observedChange: () => void;
	entryReplaced: (id: string) => void;
}> {
	private entries: Map<string, ObjectBoundsEntry> = new Map();
	private objectReactionUnsubscribes: Map<string, () => void> = new Map();
	private sizeObserver;
	private spatialHash = new SpatialHash<string>(100);
	private spatialHashRecomputeTimers = new Map<string, any>();
	private deregistered = new Set<string>();

	constructor() {
		super();
		this.sizeObserver = new ResizeObserver(this.handleDOMChanges);
	}

	getSize = (objectId: string) => {
		return this.entries.get(objectId)?.size ?? null;
	};

	getOrigin = (objectId: string) => {
		return this.entries.get(objectId)?.origin ?? null;
	};

	getCenter = (objectId: string) => {
		return this.entries.get(objectId)?.center ?? null;
	};

	getEntry = (objectId: string) => {
		return this.entries.get(objectId);
	};

	get ids() {
		return Array.from(this.entries.keys());
	}

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

	observeElement = (objectId: string, element: Element | null) => {
		const entry = this.register(objectId);

		console.log('observing element', objectId, element);

		// supports React <19 refs
		if (element === null) {
			entry.size.set({ width: 0, height: 0 });
			return;
		}

		element.setAttribute('data-observed-object-id', objectId);
		this.sizeObserver.observe(element);
		// seed initial state
		entry.size.set({
			width: element.clientWidth,
			height: element.clientHeight,
		});
		return () => void this.sizeObserver.unobserve(element);
	};

	unobserve = (el: Element) => {
		const objectId = el.getAttribute('data-observed-object-id');
		if (objectId) {
			this.emit('observedChange');
			this.sizeObserver.unobserve(el);
		}
	};

	register = (objectId: string, initialPosition?: Vector2) => {
		this.deregistered.delete(objectId);

		let entry = this.entries.get(objectId);
		if (!entry) {
			console.log(
				'initializing new bounds entry for',
				objectId,
				'at',
				initialPosition,
			);
			entry = new ObjectBoundsEntry(
				objectId,
				atom(`${objectId} origin`, initialPosition || { x: 0, y: 0 }),
				atom(`${objectId} size`, { width: 0, height: 0 }),
				this.onEntryChange,
			);
			this.entries.set(objectId, entry);
			this.emit('entryReplaced', objectId);
		}

		this.updateHash(objectId, entry.origin.value, entry.size.value);

		return entry;
	};

	deregister = (objectId: string) => {
		console.log('deregistering', objectId, 'soon');
		this.deregistered.add(objectId);
		setTimeout(this.cleanupDeregistered, 100);
	};

	private cleanupDeregistered = () => {
		for (const objectId of this.deregistered) {
			const entry = this.entries.get(objectId);
			if (entry) {
				entry.cleanup();
				this.entries.delete(objectId);
				this.emit('entryReplaced', objectId);
			}
			this.objectReactionUnsubscribes.delete(objectId);
			this.spatialHash.remove(objectId);
			console.log('deregistered', objectId);
		}
		this.deregistered.clear();
	};

	private onEntryChange = (id: string, origin: Vector2, size: Size) => {
		this.debouncedUpdateHash(id, origin, size);
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
}

class ObjectBoundsEntry {
	readonly center: Computed<Vector2>;
	readonly cleanup: () => void;
	constructor(
		readonly id: string,
		readonly origin: Atom<Vector2>,
		readonly size: Atom<Size>,
		onChange: (id: string, origin: Vector2, size: Size) => void,
	) {
		this.origin = origin;
		this.size = size;
		this.center = computed<Vector2>('center', () => ({
			x: origin.value.x + size.value.width / 2,
			y: origin.value.y + size.value.height / 2,
		}));
		this.cleanup = react('object bounds change', () => {
			onChange(this.id, this.origin.value, this.size.value);
		});
	}
}
