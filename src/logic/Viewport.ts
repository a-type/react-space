import { EventSubscriber, preventDefault } from '@a-type/utils';
import { Size, Vector2, RectLimits, Box } from '../types.js';
import {
	addVectors,
	clamp,
	clampVector,
	multiplyVector,
	subtractVectors,
} from './math.js';

const MIN_POSSIBLE_ZOOM = 0.000001;

export interface ViewportConfig {
	/** Supply a starting zoom value. Default 1 */
	defaultZoom?: number;
	/** Supply a starting center position. Default 0,0 */
	defaultCenter?: Vector2;
	/** Restrict pan movement to certain boundaries. Default is canvasLimits if those exist,
	 * otherwise unbounded.
	 */
	panLimits?: RectLimits;
	/**
	 * There are two ways to limit pan position:
	 * "center" simply clamps the center of the screen to the provided panLimits boundary
	 * "viewport" enforces that the closest edge of the viewport must not exceed the boundary
	 * Default is "center"
	 */
	panLimitMode?: 'center' | 'viewport';
	/**
	 * Restrict zooming to certain boundaries. Default min is 'fit', max 2.
	 * "min" has a special value, 'fit', which will ensure that at least
	 * one axis of the content fits the viewport at all times. A percentage number can be
	 * supplied instead to set a specific minimum zoom level.
	 */
	zoomLimits?: {
		min: number | 'fit';
		max: number;
	};
	/**
	 * Start the Viewport already bound to an existing DOM element. This
	 * can be set later using bindElement. Defaults to window.
	 */
	boundElement?: HTMLElement;
}

// removes some optional annotations as they are filled by defaults.
type InternalViewportConfig = Omit<
	ViewportConfig,
	'zoomLimits' | 'boundElement' | 'defaultZoom' | 'canvas'
> & {
	defaultZoom: number;
	zoomLimits: { min: number | 'fit'; max: number };
};

/**
 * Event origins are included in change events to indicate what
 * kind of operation caused the change. This helps animation code
 * determine what kind of easing to apply to the movement -
 *  - direct movement is usually very tight or not eased at all
 *  - control movement is triggered indirectly by control interaction
 *    (like zoom buttons) and usually has tighter easing
 *  - animation movement comes from app events and may have long easing
 *    curves to help the user interpret the change since they didn't
 *    originate it
 */
export type ViewportEventOrigin = 'direct' | 'control' | 'animation';

export type ViewportEvents = {
	zoomChanged(zoom: number, origin: ViewportEventOrigin): void;
	zoomSettled(zoom: number, origin: ViewportEventOrigin): void;
	centerChanged(center: Readonly<Vector2>, origin: ViewportEventOrigin): void;
	centerSettled(center: Readonly<Vector2>, origin: ViewportEventOrigin): void;
	/** Fired when the size of the bound element changes */
	sizeChanged(size: Size): void;
	/** Fired when the size of the canvas changes */
	canvasChanged(size: RectLimits): void;
};

/**
 * Viewport handles all the logic of managing a 2d viewport with pan & zoom which
 * renders spatial content on a larger plane. Viewport handles the math required
 * to determine boundaries on panning, converts screen coordinates to "world" coordinates,
 * and holds the state for the target values of both the zoom and camera center position.
 *
 * Viewport does NOT do any easing of values, it just computes the target values.
 * Easing is left up to the actual view code (in our case React). Rendering code
 * should set up easing between target values as those values change in Viewport.
 *
 * To that end Viewport implements a few events which can be listened to for
 * when the camera properties change.
 */
export class Viewport extends EventSubscriber<ViewportEvents> {
	private _center: Vector2 = { x: 0, y: 0 };
	private _zoom = 1;
	_config: InternalViewportConfig;
	// initialized in a helper method, bypassing
	// strict initialization checking...
	private _boundElement: HTMLElement = null as any;
	private _boundElementSize: Size = { width: 0, height: 0 };
	private _boundElementOffset: Vector2 = { x: 0, y: 0 };
	private handleBoundElementResize = ([entry]: ResizeObserverEntry[]) => {
		const box = entry.target.getBoundingClientRect();
		this.setBoundElementSize(entry.contentRect, {
			x: box.left,
			y: box.top,
		});
	};
	private _boundElementResizeObserver = new ResizeObserver(
		this.handleBoundElementResize,
	);
	private zoomFitMin = MIN_POSSIBLE_ZOOM;

	constructor({ boundElement, ...config }: ViewportConfig) {
		super();

		if (config.defaultCenter) {
			this._center = config.defaultCenter;
		}
		// intentionally not !== undefined - we ignore 0 too.
		if (config.defaultZoom) {
			this._zoom = config.defaultZoom;
		}

		this._config = {
			defaultZoom: 1,
			zoomLimits: { min: 'fit', max: 2 },
			panLimitMode: 'center',
			...config,
		};

		this.bindOrDefault(boundElement ?? null);

		// @ts-ignore for debugging
		window.viewport = this;
	}

	private setBoundElementSize = (size: Size, offset?: Vector2) => {
		this._boundElementSize = size;
		if (offset) {
			this._boundElementOffset = offset;
		}
		// computed as the minimum zoom level where one axis of the bounds
		// takes up the entire viewport. if pan limits are unbounded, it
		// defaults to MIN_POSSIBLE_ZOOM
		if (this.config.panLimits) {
			this.zoomFitMin = Math.min(
				this._boundElementSize.width /
					(this.config.panLimits.max.x - this.config.panLimits.min.x),
				this._boundElementSize.height /
					(this.config.panLimits.max.y - this.config.panLimits.min.y),
			);
		} else {
			this.zoomFitMin = MIN_POSSIBLE_ZOOM;
		}
		this.emit('sizeChanged', size);
	};

	private bindOrDefault = (element: HTMLElement | null) => {
		if (this._boundElement && this._boundElement !== element) {
			this._boundElementResizeObserver.unobserve(this._boundElement);
			this._boundElement.removeAttribute('data-viewport');
		}
		if (typeof window === 'undefined') {
			// SSR context - simulate an element client rect and ignore
			// the element size monitoring. Size is arbitrary.
			this.setBoundElementSize({
				width: 2400,
				height: 2400,
			});
		} else {
			this._boundElement = element ?? document.documentElement;
			this._boundElement.setAttribute('data-viewport', 'true');
			this._boundElementResizeObserver.observe(this._boundElement);
			if (element) {
				const box = element.getBoundingClientRect();
				this.setBoundElementSize(
					{
						width: element.clientWidth,
						height: element.clientHeight,
					},
					{
						x: box.left,
						y: box.top,
					},
				);
			} else {
				this.setBoundElementSize({
					width: window.innerWidth,
					height: window.innerHeight,
				});
			}
		}

		document.addEventListener('gesturestart', preventDefault);
		document.addEventListener('gesturechange', preventDefault);
	};

	/** Public getters for core values */

	/**
	 * The zoom value of the camera - higher means things look bigger.
	 */
	get zoomValue() {
		return this._zoom;
	}

	get zoomMin() {
		if (this.config.zoomLimits.min === 'fit') {
			return this.zoomFitMin;
		}
		return this.config.zoomLimits.min;
	}

	get zoomMax() {
		return this.config.zoomLimits.max;
	}

	/**
	 * The center coordinate of the camera's focus, in "world" space.
	 */
	get center() {
		return this._center as Readonly<Vector2>;
	}

	get topLeft() {
		return this.viewportToWorld(this._boundElementOffset);
	}

	get config() {
		return this._config;
	}

	/**
	 * The size, in pixels, of the viewport element.
	 */
	get elementSize() {
		return this._boundElementSize as Readonly<Size>;
	}

	/**
	 * The size in world units of the visible space
	 * in the viewport
	 */
	get size() {
		return {
			width: this._boundElementSize.width / this.zoomValue,
			height: this._boundElementSize.height / this.zoomValue,
		};
	}

	get element() {
		return this._boundElement;
	}

	/** Convenience getters for internal calculation */

	private get halfViewportWidth() {
		return this._boundElementSize.width / 2;
	}

	private get halfViewportHeight() {
		return this._boundElementSize.height / 2;
	}

	/**
	 * This should be called any time the screen viewport size changes
	 * (like window size change, DOM layout change, etc)
	 */
	bindElement = (element: HTMLElement | null) => {
		this.bindOrDefault(element);
	};

	dispose = () => {
		document.removeEventListener('gesturestart', preventDefault);
		document.removeEventListener('gesturechange', preventDefault);
	};

	updateConfig = (config: Partial<ViewportConfig>) => {
		this._config = {
			...this._config,
			...config,
		};
	};

	/**
	 * Transforms a pixel position into world coordinates. Optionally
	 * you can clamp the coordinate to the canvas bounds, if they exist.
	 */
	viewportToWorld = (screenPoint: Vector2) => {
		// This was a bit trial-and-error, but:
		// 1. subtract half of the window size
		//      Imagine the viewport was centered at 0,0 in world space (the center of the window
		//      is exactly at the center of the room). if the user
		//      moved an object toward the upper left corner of their screen,
		//      that would logically be in negative world coordinate space -
		//      however, screen coordinates are only positive from the top left corner.
		//      this is basically the part that converts from a top-left to a center-based
		//      positioning system.
		// 2. scale based on inverse zoom (divide by zoom)
		//      scaling for zoom is necessary - imagine if you are at 0.5x zoom and you move
		//      the object 10 pixels to the left - you are actually moving 20 pixels of world
		//      space because the world is half-size.
		// 3. subtract the pan of the canvas
		//      subtracting the pan value accommodates for the fact that pan moves the world
		//      independently of the visible screen space, so we need to add that offset in.
		//      this is done OUTSIDE of the zoom scaling because the pan coordinate is already
		//      in world space and doesn't need to be adjusted for zoom.
		const transformedPoint = {
			x:
				(screenPoint.x - this._boundElementOffset.x - this.halfViewportWidth) /
					this.zoomValue +
				this.center.x,
			y:
				(screenPoint.y - this._boundElementOffset.y - this.halfViewportHeight) /
					this.zoomValue +
				this.center.y,
		};
		return transformedPoint;
	};

	/**
	 * Converts a world point to a viewport (screen, pixel) point. The point
	 * will be relative to the viewport element. This is the inverse of
	 * viewportToWorld.
	 */
	worldToViewport = (worldPoint: Vector2) => {
		return {
			x:
				(worldPoint.x - this.center.x) * this.zoomValue +
				this.halfViewportWidth +
				this._boundElementOffset.x,
			y:
				(worldPoint.y - this.center.y) * this.zoomValue +
				this.halfViewportHeight +
				this._boundElementOffset.y,
		};
	};

	/**
	 * Converts a delta vector (a distance representation) from
	 * viewport (screen, pixel) space to world space
	 */
	viewportDeltaToWorld = (screenDelta: Vector2) => {
		return {
			x: screenDelta.x / this.zoomValue,
			y: screenDelta.y / this.zoomValue,
		};
	};

	/**
	 * Converts a delta vector (a distance representation) from
	 * world space to viewport (screen, pixel) space
	 */
	worldDeltaToViewport = (worldDelta: Vector2) => {
		return {
			x: worldDelta.x * this.zoomValue,
			y: worldDelta.y * this.zoomValue,
		};
	};

	worldSizeToViewport = (worldSize: Size) => {
		return {
			width: worldSize.width * this.zoomValue,
			height: worldSize.height * this.zoomValue,
		};
	};

	/**
	 * Clamps the pan position if limits are provided.
	 * @param panPosition Proposed pan position, in world coordinates
	 */
	private clampPanPosition = (panPosition: Vector2) => {
		if (this.config.panLimits) {
			if (this.config.panLimitMode === 'viewport') {
				const worldViewportHalfWidth = this.halfViewportWidth / this.zoomValue;
				const worldViewportHalfHeight =
					this.halfViewportHeight / this.zoomValue;
				const worldViewportWidth =
					this._boundElementSize.width / this.zoomValue;
				const worldViewportHeight =
					this._boundElementSize.height / this.zoomValue;
				const clampSize = {
					width: this.config.panLimits.max.x - this.config.panLimits.min.x,
					height: this.config.panLimits.max.y - this.config.panLimits.min.y,
				};
				const worldCenter = {
					x: this.config.panLimits.min.x + clampSize.width / 2,
					y: this.config.panLimits.min.y + clampSize.height / 2,
				};

				// there are different rules depending on if the viewport is visually larger
				// than the canvas, or vice versa. when the viewport is larger than the canvas
				// we still let the user move around a little bit, until the edge of the
				// canvas touches the far edge of the screen.
				let minX = this.config.panLimits.min.x + worldViewportHalfWidth;
				let maxX = this.config.panLimits.max.x - worldViewportHalfWidth;
				if (worldViewportWidth > clampSize.width) {
					minX = worldCenter.x - (worldViewportWidth - clampSize.width) / 2;
					maxX = worldCenter.x + (worldViewportWidth - clampSize.width) / 2;
				}
				let minY = this.config.panLimits.min.y + worldViewportHalfHeight;
				let maxY = this.config.panLimits.max.y - worldViewportHalfHeight;
				if (worldViewportHeight > clampSize.height) {
					minY = worldCenter.y - (worldViewportHeight - clampSize.height) / 2;
					maxY = worldCenter.y + (worldViewportHeight - clampSize.height) / 2;
				}
				return clampVector(
					panPosition,
					{ x: minX, y: minY },
					{ x: maxX, y: maxY },
				);
			}
			// simpler center-based clamping
			return clampVector(
				panPosition,
				this.config.panLimits.min,
				this.config.panLimits.max,
			);
		}
		return panPosition;
	};

	/**
	 * Adjusts the zoom of the viewport camera. Optionally you can provide a
	 * focal point (in screen coordinates) and it will keep that point at the same screen position while
	 * zooming instead of zooming straight to the center of the viewport
	 * @param zoomValue the new zoom factor
	 * @param centroid a screen coordinate position which should remain visually stable during the zoom
	 */
	zoom = (
		zoomValue: number,
		{
			origin = 'direct',
			centroid,
			gestureComplete = true,
		}: {
			centroid?: Vector2;
			origin?: ViewportEventOrigin;
			gestureComplete?: boolean;
		} = {},
	) => {
		// the pan position is also updated to keep the focal point in the same screen position
		if (centroid) {
			// the objective is to keep the focal point at the same logical position onscreen -
			// i.e. if your mouse is the focal point and it's hovering over an avatar, that avatar
			// should remain under your mouse as you zoom in!

			// start out by recording the world position of the focal point before zoom
			const priorFocalWorldPoint = this.viewportToWorld(centroid);
			// then apply the zoom
			this._zoom = clamp(
				zoomValue,
				this.config.zoomLimits.min === 'fit' ?
					this.zoomFitMin
				:	this.config.zoomLimits.min,
				this.config.zoomLimits.max,
			);
			// now determine the difference, in screen pixels, between the old focal point
			// and the world point it used to be "over"
			const priorFocalScreenPoint = this.worldToViewport(priorFocalWorldPoint);
			const screenDifference = subtractVectors(priorFocalScreenPoint, centroid);
			// convert that difference to world units and apply it as a relative pan
			this.relativePan(this.viewportDeltaToWorld(screenDifference), {
				origin,
				gestureComplete,
			});
		} else {
			this._zoom = clamp(
				zoomValue,
				this.config.zoomLimits.min === 'fit' ?
					this.zoomFitMin
				:	this.config.zoomLimits.min,
				this.config.zoomLimits.max,
			);
			// apply a pan with the current pan position to recalculate pan
			// boundaries from the new zoom and enforce them
			this.pan(this.center, { origin, gestureComplete });
		}
		this.emit('zoomChanged', this.zoomValue, origin);
		if (gestureComplete) {
			this.emit('zoomSettled', this.zoomValue, origin);
		}
	};

	/**
	 * Adjusts the zoom of the viewport camera relative to the current value. See doZoom
	 * for details on parameters.
	 */
	relativeZoom = (
		zoomDelta: number,
		details: {
			origin?: ViewportEventOrigin;
			centroid?: Vector2;
			gestureComplete?: boolean;
		},
	) => {
		this.zoom(this.zoomValue + zoomDelta, details);
	};

	/**
	 * Pans the camera across the canvas to reach a target center point.
	 * The coordinates accepted are in "world" units!
	 * To convert from screen pixels (like mouse position), use .viewportToWorld before
	 * passing in your position.
	 *
	 * @param {Vector2} worldPosition the position in world coordinates to pan to
	 */
	pan = (
		worldPosition: Vector2,
		{
			origin = 'direct',
			gestureComplete = true,
		}: { origin?: ViewportEventOrigin; gestureComplete?: boolean } = {},
	) => {
		this._center = this.clampPanPosition(worldPosition);
		this.emit('centerChanged', this.center, origin);
		if (gestureComplete) {
			this.emit('centerSettled', this.center, origin);
		}
	};

	/**
	 * Pans the camera around the canvas using displacement relative to the current
	 * center position, in "world" units. To convert a displacement from screen pixels
	 * (like mouse position delta), use .viewportDeltaToWorld.
	 *
	 * See doPan for details on parameters.
	 */
	relativePan = (
		worldDelta: Vector2,
		details?: { origin?: ViewportEventOrigin; gestureComplete?: boolean },
	) => {
		this.pan(addVectors(this.center, worldDelta), details);
	};

	/**
	 * Pans and zooms at the same time - a convenience shortcut to
	 * zoom while moving the camera to a certain point. Both values
	 * are absolute - see .doZoom and .doPan for more details on behavior
	 * and parameters.
	 */
	move = (
		worldPosition: Vector2,
		zoomValue: number,
		info: { origin?: ViewportEventOrigin; gestureComplete?: boolean } = {},
	) => {
		this.pan(worldPosition, info);
		this.zoom(zoomValue, info);
	};

	/**
	 * Does the best it can to fit the provided area onscreen.
	 * Area is in world units.
	 */
	fitOnScreen = (
		bounds: Box,
		{
			origin = 'control',
			margin = 10,
		}: { origin?: ViewportEventOrigin; margin?: number } = {},
	) => {
		const width = bounds.width;
		const height = bounds.height;
		const zoom = Math.min(
			this.elementSize.width / (width + margin),
			this.elementSize.height / (height + margin),
		);
		const center = {
			x: bounds.x + width / 2,
			y: bounds.y + height / 2,
		};
		this.move(center, zoom, { origin });
	};
}
