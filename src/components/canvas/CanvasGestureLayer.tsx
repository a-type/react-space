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
import { CanvasGestureInput } from '../../logic/Canvas.js';
import { applyGestureState, isTouchEvent } from '../../logic/gestureUtils.js';
import { addVectors, roundVector, subtractVectors } from '../../logic/math.js';
import { Vector2 } from '../../types.js';
import {
	gestureState,
	resetGestureState,
} from '../gestures/useGestureState.js';
import { useCanvas } from './CanvasProvider.js';

export interface CanvasGestureLayerProps
	extends HTMLAttributes<HTMLDivElement> {}

export const CanvasGestureLayer = forwardRef<
	HTMLDivElement,
	CanvasGestureLayerProps
>(function CanvasGestureLayer(props, ref) {
	const gestureProps = useCanvasGestures();
	return <div ref={ref} {...props} {...gestureProps} />;
});

function isCanvasDrag({
	isTouch,
	buttons,
}: {
	isTouch: boolean;
	buttons: number;
}) {
	return !!(buttons & 1) && !isTouch;
}

function useCanvasGestures() {
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
					gestureInputRef.current.targetId = undefined;
					if (isCanvasDrag(gestureDetails.current) || canvas.tools.boxSelect) {
						canvas.onCanvasDragStart(gestureInputRef.current);
						return;
					}
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

				if (gestureInputRef.current.targetId) {
					autoPan.update(state.xy);
					canvas.onObjectDrag(gestureInputRef.current);
				} else {
					if (isCanvasDrag(gestureDetails.current) || canvas.tools.boxSelect) {
						if (!state.last) {
							canvas.onCanvasDrag(gestureInputRef.current);
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
					canvas.onObjectDragEnd(gestureInputRef.current);
					// this gesture was claimed, but it's now over.
					// we don't take action but we do reset the claim status
					resetGestureState();
				} else {
					// tap is triggered either by left click, or on touchscreens.
					// tap must fire before drag end.
					if (
						state.tap &&
						(isCanvasDrag(gestureDetails.current) || isTouchEvent(state.event))
					) {
						canvas.onCanvasTap(gestureInputRef.current);
					}

					if (isCanvasDrag(gestureDetails.current) || canvas.tools.boxSelect) {
						canvas.onCanvasDragEnd(gestureInputRef.current);
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
