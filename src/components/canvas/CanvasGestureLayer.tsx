import { useGesture } from '@use-gesture/react';
import {
	forwardRef,
	HTMLAttributes,
	MutableRefObject,
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

	const gestureInputRef = useGestureInput();
	const autoPan = useAutoPan(gestureInputRef);

	const bindPassiveGestures = useGesture(
		{
			onDragStart: (state) => {
				console.debug('drag start', 'canvas');
				gestureDetails.current.isTouch = isTouchEvent(state.event);
				gestureDetails.current.buttons = state.buttons;

				applyGestureState(gestureInputRef.current, state, canvas.gestureState);
				if (gestureState.claimType === 'object' && gestureState.claimedBy) {
					console.debug(`gesture claimed by ${gestureState.claimedBy}`);
					// TODO: simplify? seems like redundant handoff between states.
					gestureInputRef.current.targetId = gestureState.claimedBy;
					canvas.onObjectDragStart(gestureInputRef.current);
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

				applyGestureState(gestureInputRef.current, state, canvas.gestureState);

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
				applyGestureState(gestureInputRef.current, state, canvas.gestureState);
				if (gestureState.claimType === 'object' && gestureState.claimedBy) {
					console.debug(
						`drag complete. gesture claimed by ${gestureState.claimedBy}`,
					);
					autoPan.update(state.xy);
					canvas.onObjectDragEnd(gestureInputRef.current);
					// this gesture was claimed, but it's now over.
					// we don't take action but we do reset the claim status
					resetGestureState();
					return;
				} else {
					const info = gestureStateToInput(state);

					// tap is triggered either by left click, or on touchscreens.
					// tap must fire before drag end.
					if (
						state.tap &&
						(isCanvasDrag(gestureDetails.current) || isTouchEvent(state.event))
					) {
						canvas.onCanvasTap(info);
					}

					if (isCanvasDrag(gestureDetails.current) || canvas.tools.boxSelect) {
						canvas.onCanvasDragEnd(info);
					}
				}

				// reset gesture details
				gestureDetails.current.buttons = 0;
				gestureDetails.current.isTouch = false;
				canvas.gestureState.containerCandidate = null;
				canvas.gestureState.displacement.x = 0;
				canvas.gestureState.displacement.y = 0;

				gestureInputRef.current.targetId = undefined;
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
	return useRef<CanvasGestureInput>({
		alt: false,
		shift: false,
		ctrlOrMeta: false,
		intentional: false,
		screenPosition: { x: 0, y: 0 },
		delta: { x: 0, y: 0 },
		distance: { x: 0, y: 0 },
		targetId: undefined,
	});
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
			// FIXME: allocation
			gestureInputRef.current.screenPosition = displace(
				cursorPosition,
				canvas.gestureState.displacement,
			);
			canvas.onObjectDrag(gestureInputRef.current);
		});
	}, [autoPan, canvas, displace, gestureInputRef]);

	return autoPan;
}

function displace(screenPosition: Vector2, grabDisplacement: Vector2) {
	return roundVector(addVectors(screenPosition, grabDisplacement));
}
