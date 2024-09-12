import { EventSubscriber } from '@a-type/utils';
import { clampVector, snap } from './math.js';
import { Objects } from './Objects.js';
import { Selections } from './Selections.js';
import { Box, RectLimits, Vector2 } from '../types.js';
import { Viewport, ViewportEventOrigin } from './Viewport.js';
import { proxy } from 'valtio';
import { Container } from './Container.js';
import { Containers } from './Containers.js';
import { ElementSizeTracker } from './ElementSizeTracker.js';
import { atom, Atom, computed, react, Signal } from 'signia';

export interface CanvasOptions {
	/** Snaps items to a world-unit grid after dropping them - defaults to 1. */
	positionSnapIncrement?: number;
	limits?: RectLimits;
	viewport: Viewport;
	autoUpdateViewport?: boolean;
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
	[k: `containerRegistered:${string}`]: (container: Container | null) => void;
	bound: () => void;
};

export class Canvas<Metadata = any> extends EventSubscriber<CanvasEvents> {
	readonly viewport: Viewport;
	// readonly limits: RectLimits;
	private _element: HTMLDivElement | null = null;
	get element() {
		return this._element;
	}
	readonly limits: Atom<RectLimits>;

	readonly objects = new Objects();
	readonly containers = new Containers();
	readonly selections = new Selections();

	readonly tools = proxy({
		dragLocked: false,
		boxSelect: false,
	});

	readonly gestureState = {
		containerCandidate: null as Container | null,
	};

	private _positionSnapIncrement = 1;
	private _viewportUpdateReact;

	constructor(private options: CanvasOptions) {
		super();
		this.viewport = options.viewport;
		this.limits = atom('canvas limits', options?.limits ?? DEFAULT_LIMITS);
		if (options.autoUpdateViewport ?? true) {
			this._viewportUpdateReact = react(
				'canvas auto-update viewport pan limits',
				() => {
					this.viewport.updateConfig({
						panLimits: this.limits.value,
					});
				},
			);
		}
		// @ts-ignore for debugging...
		window.canvas = this;
		this._positionSnapIncrement = options?.positionSnapIncrement ?? 1;
	}

	get snapIncrement() {
		return this._positionSnapIncrement;
	}

	bind = (element: HTMLDivElement) => {
		this._element = element;
		this.emit('bound');
	};

	resize = (size: RectLimits) => {
		this.limits.set(size);
	};

	resizeToFitContent = (padding = 0) => {
		const bounds = this.objects.getCurrentContainer();
		if (bounds) {
			const maxHorizontal = Math.max(
				Math.abs(bounds.x),
				Math.abs(bounds.x + bounds.width),
			);
			const maxVertical = Math.max(
				Math.abs(bounds.y),
				Math.abs(bounds.y + bounds.height),
			);
			const min = {
				x: -maxHorizontal - padding,
				y: -maxVertical - padding,
			};
			const max = {
				x: maxHorizontal + padding,
				y: maxVertical + padding,
			};
			this.limits.set({ min, max });
		}
	};

	snapPosition = (position: Vector2) => ({
		x: snap(position.x, this._positionSnapIncrement),
		y: snap(position.y, this._positionSnapIncrement),
	});

	clampPosition = (position: Vector2) =>
		clampVector(position, this.limits.value.min, this.limits.value.max);

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
		const currentBounds = this.objects.getCurrentBounds(info.targetId);
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
			const currentBounds = this.objects.getCurrentBounds(info.targetId);
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
			const metadata = this.objects.get(objectId)?.metadata;
			const collisions = this.containers.getIntersections(objectBounds, 0.3);
			let candidatePriority = -1;
			let winningContainer: Container | null = null;
			let winningContainerBounds: Box | null = null;
			for (const collision of collisions) {
				const entry = this.containers.get(collision);
				if (!entry) continue;
				const containerBounds = this.objects.getCurrentBounds(collision);
				if (!containerBounds) continue;
				const containmentEvent: ObjectContainmentEvent<Metadata> = {
					objectId,
					objectMetadata: metadata,
					objectBounds,
					ownBounds: containerBounds,
					gestureInfo: info,
				};
				if (
					entry.container.accepts(containmentEvent) &&
					(entry.container.priority || 0) > candidatePriority
				) {
					winningContainer = entry.container;
					winningContainerBounds = containerBounds;
					candidatePriority = entry.container.priority || 0;
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
	 * Gets the position of an object relative to the viewport
	 */
	getViewportPosition = (objectId: string): Vector2 | null => {
		const worldPosition = this.objects.get(objectId)?.origin.value;
		if (!worldPosition) return null;
		return this.viewport.worldToViewport(worldPosition);
	};

	dispose = () => {
		this._viewportUpdateReact?.();
	};
}
