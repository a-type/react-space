import { useGesture } from '@use-gesture/react';
import { forwardRef, HTMLAttributes, useRef } from 'react';
import { gestureStateToInput, isTouchEvent } from '../../logic/gestureUtils.js';
import { gestureState } from '../gestures/useGestureState.js';
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
	const bindPassiveGestures = useGesture(
		{
			onDrag: (state) => {
				if (!state.last) {
					gestureDetails.current.buttons = state.buttons;
					gestureDetails.current.isTouch = isTouchEvent(state.event);
				}

				// ignore claimed gestures
				if (gestureState.claimedBy) {
					return;
				}

				const input = gestureStateToInput(state);
				// TODO: move the 'box select' tool override somewhere that
				// makes sense. might want to have this element simply report
				// gesture info to Canvas and let other logic interpret that
				// into pan or drag.
				if (isCanvasDrag(gestureDetails.current) || canvas.tools.boxSelect) {
					if (!state.last) {
						gestureState.claimedBy = 'canvas';
						canvas.onCanvasDrag(input);
					}
				}
			},
			onDragStart: (state) => {
				gestureDetails.current.isTouch = isTouchEvent(state.event);
				gestureDetails.current.buttons = state.buttons;

				if (gestureState.claimedBy) {
					// ignore claimed gestures
					console.debug(
						`drag start. gesture claimed by ${gestureState.claimedBy}`,
					);
					return;
				}

				if (isCanvasDrag(gestureDetails.current) || canvas.tools.boxSelect) {
					canvas.onCanvasDragStart(gestureStateToInput(state));
					return;
				}
			},
			onDragEnd: (state) => {
				if (gestureState.claimedBy) {
					console.debug(
						`drag complete. gesture claimed by ${gestureState.claimedBy}`,
					);
					// this gesture was claimed, but it's now over.
					// we don't take action but we do reset the claim status
					gestureState.claimedBy = null;
					return;
				} else {
					console.debug(`drag complete, no claims. processing on viewport.`);
				}

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

				gestureDetails.current.buttons = 0;
				gestureDetails.current.isTouch = false;
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
