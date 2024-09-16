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
import { Canvas, CanvasGestureInput } from '../../logic/Canvas.js';
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

export interface CanvasGestureLayerProps
	extends Omit<HTMLAttributes<HTMLDivElement>, 'onDrag' | 'onDragEnd'> {
	onDrag?: (info: CanvasGestureInput, canvas: Canvas) => boolean | void;
	onDragEnd?: (info: CanvasGestureInput, canvas: Canvas) => boolean | void;
	onTap?: (info: CanvasGestureInput, canvas: Canvas) => boolean | void;
}

export const CanvasGestureLayer = forwardRef<
	HTMLDivElement,
	CanvasGestureLayerProps
>(function CanvasGestureLayer({ onDrag, onDragEnd, onTap, ...props }, ref) {
	const gestureProps = useCanvasGestures({ onDrag, onDragEnd, onTap });
	return <div ref={ref} {...props} {...gestureProps} />;
});

function defaultOnDrag(info: CanvasGestureInput, canvas: Canvas) {
	if (info.inputType === 'mouse3') {
		canvas.viewport.relativePan(
			canvas.viewport.viewportDeltaToWorld(
				multiplyVector(info.screenDelta, -1),
			),
		);
	}
}

function defaultOnTap(info: CanvasGestureInput, canvas: Canvas) {
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

	const [gestureInputRef, resetGestureInput] = useGestureInput();
	const autoPan = useAutoPan(gestureInputRef);

	const bindPassiveGestures = useGesture(
		{
			onDragStart: (state) => {
				gestureDetails.current.isTouch = isTouchEvent(state.event);
				gestureDetails.current.buttons = state.buttons;

				gestureInputRef.current.inputType = 'unknown';
				if (isTouchEvent(state.event)) {
					gestureInputRef.current.inputType = 'touch';
				} else if (isMouseEvent(state.event)) {
					if (isLeftButton(state.buttons)) {
						gestureInputRef.current.inputType = 'mouse1';
					} else if (isRightButton(state.buttons)) {
						gestureInputRef.current.inputType = 'mouse2';
					} else if (isMiddleButton(state.buttons)) {
						gestureInputRef.current.inputType = 'mouse3';
					}
				}

				const worldPosition = canvas.viewport.viewportToWorld({
					x: state.xy[0],
					y: state.xy[1],
				});
				gestureInputRef.current.startPosition = worldPosition;

				applyGestureState(gestureInputRef.current, state, worldPosition);
				if (gestureState.claimType === 'object' && gestureState.claimedBy) {
					// TODO: simplify? seems like redundant handoff between states.
					gestureInputRef.current.targetId = gestureState.claimedBy;
					canvas.onObjectDragStart(gestureInputRef.current);
					autoPan.start(state.xy);
				} else {
					// claim unclaimed gestures by the time they reach the canvas
					gestureInputRef.current.targetId = undefined;
					claimGesture('canvas');
					canvas.onCanvasDragStart(gestureInputRef.current);
				}
			},
			onDrag: (state) => {
				if (!state.last) {
					gestureDetails.current.buttons = state.buttons;
					gestureDetails.current.isTouch = isTouchEvent(state.event);
				}

				applyGestureState(
					gestureInputRef.current,
					state,
					canvas.viewport.viewportToWorld({
						x: state.xy[0],
						y: state.xy[1],
					}),
				);

				if (gestureState.claimType === 'object' && gestureState.claimedBy) {
					autoPan.update(state.xy);
					canvas.onObjectDrag(gestureInputRef.current);
				} else {
					if (isDrag(gestureInputRef.current)) {
						canvas.onCanvasDrag(gestureInputRef.current);
						const preventDefault = !!onDrag?.(gestureInputRef.current, canvas);
						if (!preventDefault) {
							defaultOnDrag(gestureInputRef.current, canvas);
						}
					}
				}
			},
			onDragEnd: (state) => {
				applyGestureState(
					gestureInputRef.current,
					state,
					canvas.viewport.viewportToWorld({
						x: state.xy[0],
						y: state.xy[1],
					}),
				);
				if (gestureState.claimType === 'object' && gestureState.claimedBy) {
					if (state.tap) {
						canvas.onObjectTap(gestureInputRef.current);
					}
					canvas.onObjectDragEnd(gestureInputRef.current);
					// this gesture was claimed, but it's now over.
					// we don't take action but we do reset the claim status
					resetGestureState();
				} else {
					// tap is triggered either by left click, or on touchscreens.
					// tap must fire before drag end.
					if (isDrag(gestureInputRef.current)) {
						canvas.onCanvasDragEnd(gestureInputRef.current);
						const preventDefault = !!onDragEnd?.(
							gestureInputRef.current,
							canvas,
						);
						if (!preventDefault) {
							defaultOnDrag(gestureInputRef.current, canvas);
						}
					} else {
						canvas.onCanvasTap(gestureInputRef.current);
						const preventDefault = !!onTap?.(gestureInputRef.current, canvas);
						if (!preventDefault) {
							defaultOnTap(gestureInputRef.current, canvas);
						}
					}
				}

				// reset gesture details
				gestureDetails.current.buttons = 0;
				gestureDetails.current.isTouch = false;

				autoPan.stop();
				resetGestureInput();
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

function useGestureInput() {
	const ref = useRef<CanvasGestureInput>({
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
	});

	const reset = useCallback(() => {
		ref.current.alt = false;
		ref.current.shift = false;
		ref.current.ctrlOrMeta = false;
		ref.current.intentional = false;
		ref.current.screenPosition = { x: 0, y: 0 };
		ref.current.distance = { x: 0, y: 0 };
		ref.current.targetId = undefined;
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
			gestureInputRef.current.distance = subtractVectors(
				canvas.viewport.viewportToWorld(cursorPosition),
				gestureInputRef.current.startPosition,
			);
			canvas.onObjectDrag(gestureInputRef.current);
		});
	}, [autoPan, canvas, displace, gestureInputRef]);

	return autoPan;
}

function displace(screenPosition: Vector2, grabDisplacement: Vector2) {
	return roundVector(addVectors(screenPosition, grabDisplacement));
}
