import { isMiddleClick, isRightClick, stopPropagation } from '@a-type/utils';
import { useGesture } from '@use-gesture/react';
import {
	CSSProperties,
	HTMLAttributes,
	MutableRefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from 'react';
import { track, useValue } from 'signia-react';
import { AutoPan } from '../../logic/AutoPan.js';
import { CanvasGestureInput } from '../../logic/Canvas.js';
import { applyGestureState } from '../../logic/gestureUtils.js';
import { addVectors, roundVector, subtractVectors } from '../../logic/math.js';
import { Vector2 } from '../../types.js';
import { useDragLocked } from '../canvas/canvasHooks.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { useObject } from './Object.js';
import { gestureState } from '../gestures/useGestureState.js';

export interface ObjectHandleProps extends HTMLAttributes<HTMLDivElement> {
	disabled?: boolean;
}

const baseStyle: CSSProperties = {
	touchAction: 'none',
};

export const ObjectHandle = track(function ObjectHandle({
	disabled,
	...rest
}: ObjectHandleProps) {
	const obj = useObject();
	const handleRef = useDragHandle(disabled);

	/**
	 * This handler prevents click events from firing within the draggable handle
	 * if the user was dragging during the gesture - for example we don't want to
	 * click a link if the user is dragging it when they release the mouse.
	 */
	const onClickCapture = useCallback(
		(ev: React.MouseEvent) => {
			if (obj.draggingSignal.value) {
				ev.preventDefault();
				ev.stopPropagation();
			}
		},
		[obj],
	);

	const dragging = useValue(obj.draggingSignal);
	const style = useMemo(
		() => ({
			...baseStyle,
			cursor:
				disabled ? 'inherit'
				: dragging ? 'grabbing'
				: 'grab',
		}),
		[disabled, dragging],
	);

	return (
		<div
			style={style}
			ref={handleRef}
			onClickCapture={onClickCapture}
			{...rest}
		/>
	);
});

const stopPropagationProps = {
	onPointerDown: stopPropagation,
	onPointerMove: stopPropagation,
	onPointerUp: stopPropagation,
	onTouchStart: stopPropagation,
	onTouchMove: stopPropagation,
	onTouchEnd: stopPropagation,
	onMouseDown: stopPropagation,
	onMouseMove: stopPropagation,
	onMouseUp: stopPropagation,
};

export const disableDragProps = {
	'data-no-drag': true,
	...stopPropagationProps,
};

function useDragHandle(disabled = false) {
	const ref = useRef<HTMLDivElement>(null);
	const canvas = useCanvas();
	const object = useObject();
	const dragLocked = useDragLocked();

	useGesture(
		{
			onDragStart: (state) => {
				console.debug('drag start', object.id);
				if (dragLocked) return;

				if (isUnacceptableGesture(state.event)) {
					return;
				}

				// claim this gesture for this object
				gestureState.claimedBy = object.id;

				// set up displacement
				const screenPosition = { x: state.xy[0], y: state.xy[1] };
				const currentObjectPosition = canvas.getViewportPosition(object.id);
				if (currentObjectPosition) {
					const displacement = subtractVectors(
						currentObjectPosition,
						screenPosition,
					);
					canvas.gestureState.displacement = displacement;
				}
			},
		},
		{
			drag: {
				preventDefault: true,
				eventOptions: {
					passive: false,
				},
			},
			enabled: !dragLocked && !disabled,
			target: ref,
		},
	);

	return ref;
}

function useDisplacement() {
	const grabDisplacementRef = useRef<Vector2>({ x: 0, y: 0 });
	const displace = useCallback((screenPosition: Vector2) => {
		// FIXME: multiple allocations here
		return roundVector(addVectors(screenPosition, grabDisplacementRef.current));
	}, []);

	return [grabDisplacementRef, displace] as const;
}

function useGestureInput(id: string) {
	return useRef<CanvasGestureInput>({
		alt: false,
		shift: false,
		ctrlOrMeta: false,
		intentional: false,
		screenPosition: { x: 0, y: 0 },
		delta: { x: 0, y: 0 },
		distance: { x: 0, y: 0 },
		targetId: id,
	});
}

function useAutoPan(
	displace: (screenPosition: Vector2) => Vector2,
	gestureInputRef: MutableRefObject<CanvasGestureInput>,
) {
	const canvas = useCanvas();
	const autoPan = useMemo(
		() => new AutoPan(canvas.viewport),
		[canvas.viewport],
	);

	useEffect(() => {
		return autoPan.subscribe('pan', ({ cursorPosition }) => {
			if (!cursorPosition) return;
			gestureInputRef.current.screenPosition = displace(cursorPosition);
			canvas.onObjectDrag(gestureInputRef.current);
		});
	}, [autoPan, canvas, displace, gestureInputRef]);

	return autoPan;
}

function isUnacceptableGesture(event: PointerEvent | Event) {
	if ('button' in event && (isRightClick(event) || isMiddleClick(event)))
		return true;
	if (event?.target) {
		const element = event?.target as HTMLElement;
		// look up the element tree for a hidden or no-drag element to see if dragging is allowed
		// here.
		const dragPrevented =
			element.getAttribute('aria-hidden') === 'true' ||
			element.getAttribute('data-no-drag') === 'true' ||
			!!element.closest('[data-no-drag="true"], [aria-hidden="true"]');
		// BUGFIX: a patch which is intended to prevent a bug where opening a menu
		// or other popover from within a draggable allows dragging by clicking anywhere
		// on the screen, since the whole screen is covered by a click-blocker element
		// ignore drag events which target an aria-hidden element
		if (dragPrevented) {
			return true;
		}
	}
}
