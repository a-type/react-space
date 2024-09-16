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
import {
	applyGestureState,
	gestureStateToInput,
	isTouchEvent,
} from '../../logic/gestureUtils.js';
import {
	gestureState,
	resetGestureState,
} from '../gestures/useGestureState.js';
import { useCanvas } from './CanvasProvider.js';
import { CanvasGestureInput } from '../../logic/Canvas.js';
import { AutoPan } from '../../logic/AutoPan.js';
import { addVectors, roundVector } from '../../logic/math.js';
import { Vector2 } from '../../types.js';

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

				applyGestureState(gestureInputRef.current, state);
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

				applyGestureState(gestureInputRef.current, state);

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
				applyGestureState(gestureInputRef.current, state);
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
		delta: { x: 0, y: 0 },
		distance: { x: 0, y: 0 },
		targetId: undefined,
	});

	const reset = useCallback(() => {
		console.log('RESET');
		ref.current.alt = false;
		ref.current.shift = false;
		ref.current.ctrlOrMeta = false;
		ref.current.intentional = false;
		ref.current.screenPosition = { x: 0, y: 0 };
		ref.current.delta = { x: 0, y: 0 };
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
			canvas.onObjectDrag(gestureInputRef.current);
		});
	}, [autoPan, canvas, displace, gestureInputRef]);

	return autoPan;
}

function displace(screenPosition: Vector2, grabDisplacement: Vector2) {
	return roundVector(addVectors(screenPosition, grabDisplacement));
}
