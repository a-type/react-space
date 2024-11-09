import { useGesture } from '@use-gesture/react';
import {
	forwardRef,
	HTMLAttributes,
	MutableRefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from 'react';
import { AutoPan } from '../../logic/AutoPan.js';
import {
	Canvas,
	CanvasGestureInput,
	CanvasGestureInputEvent,
} from '../../logic/Canvas.js';
import {
	applyGestureState,
	isDrag,
	isLeftButton,
	isMiddleButton,
	isMouseEvent,
	isRightButton,
	isTouchEvent,
} from '../../logic/gestureUtils.js';
import {
	addVectors,
	multiplyVector,
	roundVector,
	subtractVectors,
} from '../../logic/math.js';
import { Vector2 } from '../../types.js';
import {
	claimGesture,
	gestureState,
	resetGestureState,
} from '../gestures/useGestureState.js';
import { useCanvas } from './CanvasProvider.js';
import { useMergedRef } from '../../hooks.js';

export interface CanvasGestureLayerProps
	extends Omit<HTMLAttributes<HTMLDivElement>, 'onDrag' | 'onDragEnd'> {
	onDrag?: (info: CanvasGestureInputEvent, canvas: Canvas) => void;
	onDragEnd?: (info: CanvasGestureInputEvent, canvas: Canvas) => void;
	onTap?: (info: CanvasGestureInputEvent, canvas: Canvas) => void;
}

export const CanvasGestureLayer = forwardRef<
	HTMLDivElement,
	CanvasGestureLayerProps
>(function CanvasGestureLayer({ onDrag, onDragEnd, onTap, ...props }, ref) {
	const gestureProps = useCanvasGestures({ onDrag, onDragEnd, onTap });
	const canvas = useCanvas();
	const finalRef = useMergedRef(ref, canvas.gestureLayerRef);
	return <div ref={finalRef} {...props} {...gestureProps} />;
});

function defaultOnDrag(info: CanvasGestureInputEvent, canvas: Canvas) {
	if (info.inputType === 'mouse3') {
		canvas.gestureLayerRef.current?.style.setProperty('cursor', 'grabbing');
		canvas.viewport.relativePan(
			canvas.viewport.viewportDeltaToWorld(
				multiplyVector(info.screenDelta, -1),
			),
		);
	}
}
function defaultOnDragEnd(info: CanvasGestureInputEvent, canvas: Canvas) {
	canvas.gestureLayerRef.current?.style.setProperty('cursor', 'crosshair');
}

function defaultOnTap(info: CanvasGestureInputEvent, canvas: Canvas) {
	if (!info.shift) {
		canvas.selections.clear();
	}
}

function useCanvasGestures({
	onDrag,
	onDragEnd,
	onTap,
}: Pick<CanvasGestureLayerProps, 'onDrag' | 'onDragEnd' | 'onTap'> = {}) {
	const canvas = useCanvas();
	const gestureDetails = useRef({
		buttons: 0,
		isTouch: false,
	});

	const [gestureInputEventRef, resetGestureInputEvent] = useGestureInputEvent();
	const autoPan = useAutoPan(gestureInputEventRef);

	const bindPassiveGestures = useGesture(
		{
			onDragStart: (state) => {
				gestureDetails.current.isTouch = isTouchEvent(state.event);
				gestureDetails.current.buttons = state.buttons;
				gestureInputEventRef.current.defaultPrevented = false;

				gestureInputEventRef.current.inputType = 'unknown';
				if (isTouchEvent(state.event)) {
					gestureInputEventRef.current.inputType = 'touch';
				} else if (isMouseEvent(state.event)) {
					if (isLeftButton(state.buttons)) {
						gestureInputEventRef.current.inputType = 'mouse1';
					} else if (isRightButton(state.buttons)) {
						gestureInputEventRef.current.inputType = 'mouse2';
					} else if (isMiddleButton(state.buttons)) {
						gestureInputEventRef.current.inputType = 'mouse3';
					}
				}

				const worldPosition = canvas.viewport.viewportToWorld({
					x: state.xy[0],
					y: state.xy[1],
				});
				gestureInputEventRef.current.startPosition = worldPosition;

				applyGestureState(gestureInputEventRef.current, state, worldPosition);
				if (isObjectOrToolGestureClaim() && gestureState.claimedBy) {
					gestureInputEventRef.current.targetId = gestureState.claimedBy;
					canvas.onClaimedDragStart(gestureInputEventRef.current);
					autoPan.start(state.xy);
				} else {
					// claim unclaimed gestures by the time they reach the canvas
					gestureInputEventRef.current.targetId = undefined;
					claimGesture('canvas');
					canvas.onCanvasDragStart(gestureInputEventRef.current);
				}
			},
			onDrag: (state) => {
				if (!state.last) {
					gestureDetails.current.buttons = state.buttons;
					gestureDetails.current.isTouch = isTouchEvent(state.event);
				}
				gestureInputEventRef.current.defaultPrevented = false;

				applyGestureState(
					gestureInputEventRef.current,
					state,
					canvas.viewport.viewportToWorld({
						x: state.xy[0],
						y: state.xy[1],
					}),
				);

				if (isObjectOrToolGestureClaim() && gestureState.claimedBy) {
					autoPan.update(state.xy);
					canvas.onClaimedDrag(gestureInputEventRef.current);
				} else {
					if (isDrag(gestureInputEventRef.current)) {
						canvas.onCanvasDrag(gestureInputEventRef.current);
						onDrag?.(gestureInputEventRef.current, canvas);
						if (!gestureInputEventRef.current.defaultPrevented) {
							defaultOnDrag(gestureInputEventRef.current, canvas);
						}
					}
				}
			},
			onDragEnd: (state) => {
				gestureInputEventRef.current.defaultPrevented = false;
				applyGestureState(
					gestureInputEventRef.current,
					state,
					canvas.viewport.viewportToWorld({
						x: state.xy[0],
						y: state.xy[1],
					}),
				);
				const isQualifiedTap =
					state.tap &&
					(gestureInputEventRef.current.inputType === 'touch' ||
						gestureInputEventRef.current.inputType === 'mouse1');
				if (isObjectOrToolGestureClaim() && gestureState.claimedBy) {
					if (isQualifiedTap) {
						canvas.onClaimedTap(gestureInputEventRef.current);
					}
					canvas.onClaimedDragEnd(gestureInputEventRef.current);
					// this gesture was claimed, but it's now over.
					// we don't take action but we do reset the claim status
					resetGestureState();
				} else {
					// tap is triggered either by left click, or on touchscreens.
					// tap must fire before drag end.
					if (isDrag(gestureInputEventRef.current)) {
						canvas.onCanvasDragEnd(gestureInputEventRef.current);
						onDragEnd?.(gestureInputEventRef.current, canvas);
						if (!gestureInputEventRef.current.defaultPrevented) {
							defaultOnDragEnd(gestureInputEventRef.current, canvas);
						}
					} else if (isQualifiedTap) {
						canvas.onCanvasTap(gestureInputEventRef.current);
						onTap?.(gestureInputEventRef.current, canvas);
						if (!gestureInputEventRef.current.defaultPrevented) {
							defaultOnTap(gestureInputEventRef.current, canvas);
						}
					}
				}

				// reset gesture details
				gestureDetails.current.buttons = 0;
				gestureDetails.current.isTouch = false;
				gestureDetails.current.isTouch = false;

				autoPan.stop();
				resetGestureInputEvent();
			},
			onContextMenu: ({ event }) => {
				event.preventDefault();
			},
		},
		{
			drag: {
				pointer: {
					buttons: [1, 2, 4],
				},
			},
		},
	);

	return bindPassiveGestures();
}

function useGestureInputEvent() {
	const ref = useRef<CanvasGestureInputEvent>({
		alt: false,
		shift: false,
		ctrlOrMeta: false,
		intentional: false,
		screenPosition: { x: 0, y: 0 },
		distance: { x: 0, y: 0 },
		targetId: undefined,
		startPosition: { x: 0, y: 0 },
		inputType: 'unknown',
		screenDelta: { x: 0, y: 0 },
		pointerWorldPosition: { x: 0, y: 0 },
		defaultPrevented: false,
		touchesCount: 0,
		preventDefault() {
			ref.current.defaultPrevented = true;
		},
	});

	const reset = useCallback(() => {
		ref.current.alt = false;
		ref.current.shift = false;
		ref.current.ctrlOrMeta = false;
		ref.current.intentional = false;
		ref.current.screenPosition = { x: 0, y: 0 };
		ref.current.distance = { x: 0, y: 0 };
		ref.current.targetId = undefined;
		ref.current.startPosition = { x: 0, y: 0 };
		ref.current.inputType = 'unknown';
		ref.current.screenDelta = { x: 0, y: 0 };
		ref.current.pointerWorldPosition = { x: 0, y: 0 };
		ref.current.defaultPrevented = false;
		ref.current.touchesCount = 0;
	}, []);
	return [ref, reset] as const;
}

function useAutoPan(gestureInputRef: MutableRefObject<CanvasGestureInput>) {
	const canvas = useCanvas();
	const autoPan = useMemo(
		() => new AutoPan(canvas.viewport),
		[canvas.viewport],
	);

	useEffect(() => {
		return autoPan.subscribe('pan', ({ cursorPosition }) => {
			if (!cursorPosition) return;
			gestureInputRef.current.screenPosition = cursorPosition;
			gestureInputRef.current.pointerWorldPosition =
				canvas.viewport.viewportToWorld(cursorPosition);
			gestureInputRef.current.distance = subtractVectors(
				gestureInputRef.current.pointerWorldPosition,
				gestureInputRef.current.startPosition,
			);
			canvas.onClaimedDrag(gestureInputRef.current);
		});
	}, [autoPan, canvas, displace, gestureInputRef]);

	return autoPan;
}

function displace(screenPosition: Vector2, grabDisplacement: Vector2) {
	return roundVector(addVectors(screenPosition, grabDisplacement));
}

function isObjectOrToolGestureClaim() {
	return (
		gestureState.claimType === 'surface' || gestureState.claimType === 'tool'
	);
}
