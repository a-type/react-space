import { EventSubscriber } from '@a-type/utils';
import { clampVector, snap } from './math.js';
import { ObjectBounds } from './ObjectBounds.js';
import { Selections } from './Selections.js';
import { Box, RectLimits, Vector2 } from '../types.js';
import { Viewport, ViewportConfig, ViewportEventOrigin } from './Viewport.js';
import { proxy } from 'valtio';
import { Container } from './Container.js';

export interface CanvasOptions {
	/** Snaps items to a world-unit grid after dropping them - defaults to 1. */
	positionSnapIncrement?: number;
	limits?: RectLimits;
	viewportConfig?: Omit<ViewportConfig, 'canvas'>;
}

export interface CanvasGestureInfo {
	shift: boolean;
	alt: boolean;
	ctrlOrMeta: boolean;
	intentional: boolean;
	delta: Vector2;
	distance: Vector2;
	worldPosition: Vector2;
	targetId?: string;
	container?: {
		id: string;
		relativePosition: Vector2;
	};
}

export interface ObjectContainmentEvent<Metadata> {
	objectId: string;
	objectMetadata?: Metadata;
	objectBounds: Box;
	ownBounds: Box;
	gestureInfo: CanvasGestureInfo;
}

export interface ObjectRegistration<Metadata> {
	canContain?: (containmentEvent: ObjectContainmentEvent<Metadata>) => boolean;
	containerPriority?: number;
}

export interface CanvasGestureInput
	extends Omit<CanvasGestureInfo, 'worldPosition'> {
	screenPosition: Vector2;
}

const DEFAULT_LIMITS: RectLimits = {
	max: { x: 1_000_000, y: 1_000_000 },
	min: { x: -1_000_000, y: -1_000_000 },
};

export type CanvasEvents = {
	objectDragStart: (info: CanvasGestureInfo) => void;
	objectDrag: (info: CanvasGestureInfo) => void;
	objectDragEnd: (info: CanvasGestureInfo) => void;
	canvasTap: (info: CanvasGestureInfo) => void;
	canvasDragStart: (info: CanvasGestureInfo) => void;
	canvasDrag: (info: CanvasGestureInfo) => void;
	canvasDragEnd: (info: CanvasGestureInfo) => void;
	resize: (size: RectLimits) => void;
	objectElementChange: (objectId: string, element: Element | null) => void;
	[k: `containerRegistered:${string}`]: (container: Container | null) => void;
	bound: () => void;
};

export class Canvas<Metadata = any> extends EventSubscriber<CanvasEvents> {
	readonly viewport: Viewport;
	readonly limits: RectLimits;
	private _element: HTMLDivElement | null = null;
	get element() {
		return this._element;
	}

	readonly bounds = new ObjectBounds();
	readonly selections = new Selections();

	readonly objectElements = new Map<string, Element>();
	readonly objectMetadata = new Map<string, Metadata>();
	readonly containers = new Map<string, Container>();

	readonly tools = proxy({
		dragLocked: false,
		boxSelect: false,
	});

	readonly gestureState = {
		claimedBy: null as string | null,
		containerCandidate: null as Container | null,
	};

	private _positionSnapIncrement = 1;

	constructor(options?: CanvasOptions) {
		super();
		this.viewport = new Viewport({ ...options?.viewportConfig, canvas: this });
		this.limits = options?.limits ?? DEFAULT_LIMITS;
		// @ts-ignore for debugging...
		window.canvas = this;
		this._positionSnapIncrement = options?.positionSnapIncrement ?? 1;
	}

	get snapIncrement() {
		return this._positionSnapIncrement;
	}

	get boundary() {
		return {
			x: this.limits.min.x,
			y: this.limits.min.y,
			width: this.limits.max.x - this.limits.min.x,
			height: this.limits.max.y - this.limits.min.y,
		};
	}

	get center() {
		return {
			x: (this.limits.max.x + this.limits.min.x) / 2,
			y: (this.limits.max.y + this.limits.min.y) / 2,
		};
	}

	bind = (element: HTMLDivElement) => {
		this._element = element;
		this.emit('bound');
	};

	snapPosition = (position: Vector2) => ({
		x: snap(position.x, this._positionSnapIncrement),
		y: snap(position.y, this._positionSnapIncrement),
	});

	clampPosition = (position: Vector2) =>
		clampVector(position, this.limits.min, this.limits.max);

	resize = (size: RectLimits) => {
		this.limits.min = size.min;
		this.limits.max = size.max;
		this.emit('resize', size);
	};

	private transformGesture = (
		{ screenPosition, delta, ...rest }: CanvasGestureInput,
		snap?: boolean,
	): CanvasGestureInfo => {
		let pos = this.viewport.viewportToWorld(screenPosition);
		if (snap) {
			pos = this.snapPosition(pos);
		}
		return Object.assign(rest, {
			worldPosition: pos,
			delta: this.viewport.viewportDeltaToWorld(delta),
		});
	};

	resetGestureState = () => {
		this.gestureState.claimedBy = null;
		this.gestureState.containerCandidate = null;
	};

	onCanvasTap = (info: CanvasGestureInput) => {
		this.emit('canvasTap', this.transformGesture(info));
	};

	onCanvasDragStart = (info: CanvasGestureInput) => {
		this.emit('canvasDragStart', this.transformGesture(info));
	};

	onCanvasDrag = (info: CanvasGestureInput) => {
		this.emit('canvasDrag', this.transformGesture(info));
	};

	onCanvasDragEnd = (info: CanvasGestureInput) => {
		this.emit('canvasDragEnd', this.transformGesture(info));
	};

	onObjectDragStart = (info: CanvasGestureInput) => {
		this.emit('objectDragStart', this.transformGesture(info));
	};

	onObjectDrag = (info: CanvasGestureInput) => {
		if (!info.targetId) return;
		const gestureInfo = this.transformGesture(info);
		const currentBounds = this.bounds.getCurrentBounds(info.targetId);
		if (currentBounds) {
			// FIXME: doesn't really work -- when an object is already inside
			// a container, its reported world position from this gesture
			// is wrong (since it was computed from container-relative position)
			this.updateContainer(info.targetId, currentBounds, gestureInfo);
		}
		this.emit('objectDrag', gestureInfo);
	};
	onObjectDragEnd = (info: CanvasGestureInput) => {
		if (!info.targetId) return;

		const gestureInfo = this.transformGesture(info, true);
		if (this.gestureState.containerCandidate) {
			// FIXME: kinda messy.
			const currentBounds = this.bounds.getCurrentBounds(info.targetId);
			if (currentBounds) {
				this.updateContainer(info.targetId, currentBounds, gestureInfo);
			}
			this.gestureState.containerCandidate.setCandidateState(null);
		}
		this.emit('objectDragEnd', gestureInfo);
	};

	private updateContainer = (
		objectId: string,
		objectBounds: Box,
		info: CanvasGestureInfo,
	) => {
		if (objectBounds) {
			const metadata = this.objectMetadata.get(objectId);
			const collisions = this.bounds.getIntersections(objectBounds, 0.3);
			let candidatePriority = -1;
			let winningContainer: Container | null = null;
			let winningContainerBounds: Box | null = null;
			for (const collision of collisions) {
				const container = this.containers.get(collision);
				if (!container) continue;
				const containerBounds = this.bounds.getCurrentBounds(collision);
				if (!containerBounds) continue;
				const containmentEvent: ObjectContainmentEvent<Metadata> = {
					objectId,
					objectMetadata: metadata,
					objectBounds,
					ownBounds: containerBounds,
					gestureInfo: info,
				};
				if (
					container.accepts(containmentEvent) &&
					(container.priority || 0) > candidatePriority
				) {
					winningContainer = container;
					winningContainerBounds = containerBounds;
					candidatePriority = container.priority || 0;
				}
			}
			if (winningContainer !== this.gestureState.containerCandidate) {
				this.gestureState.containerCandidate?.setCandidateState(null);
				winningContainer?.setCandidateState(objectId);
				this.gestureState.containerCandidate = winningContainer;
			}
			if (winningContainer) {
				info.container = {
					id: winningContainer.id,
					relativePosition:
						winningContainerBounds ?
							{
								x: objectBounds.x - winningContainerBounds.x,
								y: objectBounds.y - winningContainerBounds.y,
							}
						:	{ x: 0, y: 0 },
				};
			}
		}
	};

	/**
	 * Gets the instantaneous position of an object.
	 */
	getPosition = (objectId: string): Vector2 | null => {
		return this.getLiveOrigin(objectId)?.value ?? null;
	};

	getCenter = (objectId: string): Vector2 | null => {
		return this.getLiveCenter(objectId)?.value ?? null;
	};

	getLiveOrigin = (objectId: string) => this.bounds.getOrigin(objectId);
	getLiveSize = (objectId: string) => this.bounds.getSize(objectId);
	getLiveCenter = (objectId: string) => this.bounds.getCenter(objectId);

	/**
	 * Gets the position of an object relative to the viewport
	 */
	getViewportPosition = (objectId: string): Vector2 | null => {
		const worldPosition = this.getPosition(objectId);
		if (!worldPosition) return null;
		return this.viewport.worldToViewport(worldPosition);
	};

	registerElement = ({
		objectId,
		element,
		metadata,
	}: {
		objectId: string;
		element: Element | null;
		metadata?: Metadata;
	}) => {
		if (element) {
			this.objectElements.set(objectId, element);
			this.bounds.observeElement(objectId, element);
			if (metadata) {
				this.objectMetadata.set(objectId, metadata);
			}
		} else {
			this.objectMetadata.delete(objectId);
			const el = this.objectElements.get(objectId);
			if (el) {
				this.bounds.unobserve(el);
				this.objectElements.delete(objectId);
			}
		}
		this.emit('objectElementChange', objectId, element);
	};

	registerContainer = ({
		id,
		container,
	}: {
		id: string;
		container: Container | null;
	}) => {
		if (container) {
			this.containers.set(id, container);
		} else {
			this.containers.delete(id);
		}
		this.emit(`containerRegistered:${id}`, container);
	};

	zoomToFitAll = (
		options: { origin?: ViewportEventOrigin; margin?: number } = {},
	) => {
		const bounds = this.bounds.getCurrentContainer();
		if (bounds) {
			this.viewport.fitOnScreen(bounds, options);
		} else {
			this.viewport.doMove(this.center, 1, options);
		}
	};

	zoomToFit = (
		objectId: string,
		options: { origin?: ViewportEventOrigin; margin?: number } = {},
	) => {
		const bounds = this.bounds.getCurrentBounds(objectId);
		if (bounds) {
			this.viewport.fitOnScreen(bounds, options);
		}
	};

	dispose = () => {};
}
