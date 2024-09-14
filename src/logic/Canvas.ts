import { EventSubscriber } from '@a-type/utils';
import { RefObject } from 'react';
import { atom, Atom, react } from 'signia';
import { proxy } from 'valtio';
import { Box, RectLimits, Vector2 } from '../types.js';
import { BoundsRegistry, BoundsRegistryEntry } from './BoundsRegistry.js';
import { clampVector, snap } from './math.js';
import { Selections } from './Selections.js';
import { Viewport } from './Viewport.js';

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
	bound: () => void;
	containerObjectOver: (containerId: string, objectId: string) => void;
	containerObjectOut: (containerId: string, objectId: string) => void;
};

export type ObjectData<Metadata> = {
	type: 'object';
	metadata: RefObject<Metadata>;
};

export type ContainerData<Metadata> = {
	type: 'container';
	priority: number;
	accepts?: (containmentEvent: ObjectContainmentEvent<Metadata>) => boolean;
	overState: Atom<{ objectId: string | null; accepted: boolean }>;
};

export class Canvas<Metadata = any> extends EventSubscriber<CanvasEvents> {
	readonly viewport: Viewport;
	// readonly limits: RectLimits;
	private _element: HTMLDivElement | null = null;
	get element() {
		return this._element;
	}
	readonly limits: Atom<RectLimits>;

	readonly selections = new Selections();
	readonly bounds = new BoundsRegistry<
		ObjectData<Metadata> | ContainerData<Metadata>
	>();

	readonly tools = proxy({
		dragLocked: false,
		boxSelect: false,
	});

	readonly gestureState = {
		displacement: { x: 0, y: 0 },
		containerCandidate: null as BoundsRegistryEntry<ContainerData<any>> | null,
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
		const bounds = this.bounds.getCurrentContainer();
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
		if (!info.targetId) return;
		const gestureInfo = this.transformGesture(info);
		const entry = this.bounds.get(info.targetId);
		if (entry) {
			this.updateContainer(info.targetId, entry as any, gestureInfo);
		}
		this.emit('objectDragStart', gestureInfo);
	};
	onObjectDrag = (info: CanvasGestureInput) => {
		if (!info.targetId) return;
		const gestureInfo = this.transformGesture(info);
		const entry = this.bounds.get(info.targetId);
		if (entry) {
			this.updateContainer(info.targetId, entry as any, gestureInfo);
			// FIXME: kinda messy. required to position the bounds of the dragged
			// object so that it's back in global space
			entry.transform.parent.set(null);
		}
		this.emit('objectDrag', gestureInfo);
	};
	onObjectDragEnd = (info: CanvasGestureInput) => {
		if (!info.targetId) return;

		const gestureInfo = this.transformGesture(info, true);
		if (this.gestureState.containerCandidate) {
			// FIXME: kinda messy.
			const entry = this.bounds.get(info.targetId);
			if (entry) {
				this.updateContainer(info.targetId, entry as any, gestureInfo);
			}
			this.gestureState.containerCandidate?.data.overState.set({
				objectId: null,
				accepted: false,
			});
			this.gestureState.containerCandidate = null;
		}
		this.emit('objectDragEnd', gestureInfo);
	};

	private updateContainer = (
		objectId: string,
		entry: BoundsRegistryEntry<ObjectData<Metadata>>,
		info: CanvasGestureInfo,
	) => {
		const data = entry?.data;
		if (!data || data.type !== 'object') {
			return;
		}
		const metadata = data.metadata.current;
		const collisions = this.bounds.getIntersections<ContainerData<Metadata>>(
			entry.transform.bounds.value,
			0.3,
			(data) => data.type === 'container',
		);

		// don't allow objects to be contained by their children
		const allowedCollisions = collisions.filter(
			(c) => !c.transform.hasParent(objectId),
		);
		const winningContainer = allowedCollisions
			.sort((a, b) => a.data.priority - b.data.priority)
			.pop();

		const accepted =
			!winningContainer?.data.accepts ||
			winningContainer.data.accepts({
				objectId,
				objectMetadata: metadata ?? undefined,
				objectBounds: entry.transform.bounds.value,
				ownBounds: winningContainer.transform.bounds.value,
				gestureInfo: info,
			});

		if (winningContainer?.id !== this.gestureState.containerCandidate?.id) {
			if (this.gestureState.containerCandidate) {
				this.gestureState.containerCandidate.data.overState.set({
					objectId: null,
					accepted: false,
				});
			}
			if (winningContainer) {
				winningContainer.data.overState.set({
					objectId,
					accepted,
				});
			}
			this.gestureState.containerCandidate = winningContainer ?? null;
		}
		if (winningContainer && accepted) {
			info.container = {
				id: winningContainer.id,
				relativePosition: {
					x:
						entry.transform.bounds.value.x -
						winningContainer.transform.worldOrigin.value.x,
					y:
						entry.transform.bounds.value.y -
						winningContainer.transform.worldOrigin.value.y,
				},
			};
		}
	};

	/**
	 * Gets the position of an object relative to the viewport
	 */
	getViewportPosition = (objectId: string): Vector2 | null => {
		const worldPosition =
			this.bounds.get(objectId)?.transform.worldPosition.value;
		if (!worldPosition) return null;
		return this.viewport.worldToViewport(worldPosition);
	};

	dispose = () => {
		this._viewportUpdateReact?.();
	};
}
