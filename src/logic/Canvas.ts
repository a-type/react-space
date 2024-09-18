import { EventSubscriber } from '@a-type/utils';
import { MutableRefObject, RefObject } from 'react';
import { atom, Atom, react } from 'signia';
import { proxy } from 'valtio';
import { Box, RectLimits, Vector2 } from '../types.js';
import { BoundsRegistry, BoundsRegistryEntry } from './BoundsRegistry.js';
import { clampVector } from './math.js';
import { Selections } from './Selections.js';
import { Viewport } from './Viewport.js';

export interface CanvasConfig {
	limits?: RectLimits;
	viewport: Viewport;
	autoUpdateViewport?: boolean;
}

export interface CanvasGestureInfo {
	shift: boolean;
	alt: boolean;
	ctrlOrMeta: boolean;
	inputType: 'mouse1' | 'mouse2' | 'mouse3' | 'touch' | 'unknown';
	/**
	 * Whether the gesture is definitely intentional by the user.
	 */
	intentional: boolean;
	/**
	 * Total movement of gesture
	 */
	distance: Vector2;
	targetId?: string;
	containerId?: string;
	rejectedContainerId?: string;
	position: Vector2;
}
export interface CanvasGestureInput
	extends Omit<
		CanvasGestureInfo,
		'worldPosition' | 'position' | 'containerId'
	> {
	screenPosition: Vector2;
	screenDelta: Vector2;
	pointerWorldPosition: Vector2;
	startPosition: Vector2;
}
export interface CanvasGestureEvent extends CanvasGestureInfo {
	preventDefault: () => void;
	defaultPrevented: boolean;
}
export interface CanvasGestureInputEvent extends CanvasGestureInput {
	preventDefault: () => void;
	defaultPrevented: boolean;
}

export interface SurfaceContainmentEvent<Metadata = any> {
	surfaceId: string;
	surfaceMetadata?: Metadata;
	surfaceBounds: Box;
	ownBounds: Box;
}

const DEFAULT_LIMITS: RectLimits = {
	max: { x: 1_000_000, y: 1_000_000 },
	min: { x: -1_000_000, y: -1_000_000 },
};

export type CanvasEvents = {
	claimedTap: (input: CanvasGestureInput) => void;
	claimedDragStart: (info: CanvasGestureInput) => void;
	claimedDrag: (info: CanvasGestureInput) => void;
	claimedDragEnd: (info: CanvasGestureInput) => void;
	canvasTap: (info: CanvasGestureInfo) => void;
	canvasDragStart: (info: CanvasGestureInfo) => void;
	canvasDrag: (info: CanvasGestureInfo) => void;
	canvasDragEnd: (info: CanvasGestureInfo) => void;
	bound: () => void;
	containerObjectOver: (containerId: string, surfaceId: string) => void;
	containerObjectOut: (containerId: string, surfaceId: string) => void;
};

export type SurfaceData<Metadata = any> = {
	type: 'surface';
	metadata: RefObject<Metadata>;
	disableSelect: RefObject<boolean>;
};

export type ContainerData<Metadata = any> = {
	type: 'container';
	priority: number;
	accepts?: (containmentEvent: SurfaceContainmentEvent<Metadata>) => boolean;
	overState: Atom<{ surfaceId: string | null; accepted: boolean }[]>;
};

export class Canvas<Metadata = any> extends EventSubscriber<CanvasEvents> {
	readonly viewport: Viewport;
	// readonly limits: RectLimits;
	private _element: HTMLDivElement | null = null;
	get element() {
		return this._element;
	}
	readonly gestureLayerRef = {
		current: null,
	} as MutableRefObject<HTMLDivElement | null>;
	readonly limits: Atom<RectLimits>;

	readonly selections = new Selections();
	readonly bounds = new BoundsRegistry<
		SurfaceData<Metadata> | ContainerData<Metadata>
	>();

	readonly tools = proxy({
		dragLocked: false,
		boxSelect: false,
	});

	private _viewportUpdateReact;

	constructor(private options: CanvasConfig) {
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

	clampPosition = (position: Vector2) =>
		clampVector(position, this.limits.value.min, this.limits.value.max);

	private transformGesture = (
		input: CanvasGestureInput,
	): CanvasGestureInput => {
		return input;
	};

	private inputToInfo = (input: CanvasGestureInput): CanvasGestureInfo => {
		input = this.transformGesture(input);
		let pos = this.viewport.viewportToWorld(input.screenPosition);
		return Object.assign(input, {
			worldPosition: pos,
			position: pos,
		});
	};

	onCanvasTap = (info: CanvasGestureInput) => {
		this.emit('canvasTap', this.inputToInfo(info));
	};

	onCanvasDragStart = (info: CanvasGestureInput) => {
		this.emit('canvasDragStart', this.inputToInfo(info));
	};
	onCanvasDrag = (info: CanvasGestureInput) => {
		this.emit('canvasDrag', this.inputToInfo(info));
	};
	onCanvasDragEnd = (info: CanvasGestureInput) => {
		this.emit('canvasDragEnd', this.inputToInfo(info));
	};

	onClaimedTap = (input: CanvasGestureInput) => {
		const gestureInfo = this.transformGesture(input);
		this.emit('claimedTap', gestureInfo);
	};

	onClaimedDragStart = (input: CanvasGestureInput) => {
		const gestureInfo = this.transformGesture(input);
		this.emit('claimedDragStart', gestureInfo);
	};
	onClaimedDrag = (input: CanvasGestureInput) => {
		const gestureInfo = this.transformGesture(input);
		this.emit('claimedDrag', gestureInfo);
	};
	onClaimedDragEnd = (input: CanvasGestureInput) => {
		const gestureInfo = this.transformGesture(input);
		this.emit('claimedDragEnd', gestureInfo);
	};

	getContainerCandidate = (
		entry: BoundsRegistryEntry<SurfaceData<Metadata>>,
		input: CanvasGestureInput,
	) => {
		const data = entry.data;
		if (!data || data.type !== 'surface') {
			return;
		}
		const metadata = data.metadata.current;
		const collisions = this.bounds.getIntersections<ContainerData<Metadata>>(
			entry.transform.bounds.value,
			0.3,
			(data) => data.type === 'container',
		);

		// don't allow surfaces to be contained by their children
		const allowedCollisions = collisions
			.filter((c) => !c.transform.hasParent(entry.id))
			.filter(
				// don't allow container collisions with selected containers (they
				// are moving along with the dragged element, presumably, and
				// changing containment would be confusing.)
				(c) =>
					!c.transform.anyParentIs((parent) => this.selections.has(parent.id)),
			);
		const winningContainer = allowedCollisions
			.sort((a, b) => a.data.priority - b.data.priority)
			.pop();

		const accepted =
			!winningContainer?.data.accepts ||
			winningContainer.data.accepts({
				surfaceId: entry.id,
				surfaceMetadata: metadata ?? undefined,
				surfaceBounds: entry.transform.bounds.value,
				ownBounds: winningContainer.transform.bounds.value,
			});

		if (winningContainer) {
			return { container: winningContainer, accepted };
		}

		return null;
	};

	/**
	 * Gets the position of an surface relative to the viewport
	 */
	getViewportPosition = (surfaceId: string): Vector2 | null => {
		const worldPosition =
			this.bounds.get(surfaceId)?.transform.worldPosition.value;
		if (!worldPosition) return null;
		return this.viewport.worldToViewport(worldPosition);
	};

	dispose = () => {
		this._viewportUpdateReact?.();
	};
}
