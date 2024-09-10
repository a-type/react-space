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
import { track } from 'signia-react';
import { AutoPan } from '../../logic/AutoPan.js';
import { CanvasGestureInput } from '../../logic/Canvas.js';
import { applyGestureState } from '../../logic/gestureUtils.js';
import { addVectors, roundVector, subtractVectors } from '../../logic/math.js';
import { Vector2 } from '../../types.js';
import { useDragLocked } from '../canvasHooks.js';
import { useCanvas } from '../CanvasProvider.js';
import { useObject } from './Object.js';

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
	const bindDragHandle = useDragHandle(disabled);

	/**
	 * This handler prevents click events from firing within the draggable handle
	 * if the user was dragging during the gesture - for example we don't want to
	 * click a link if the user is dragging it when they release the mouse.
	 */
	const onClickCapture = useCallback(
		(ev: React.MouseEvent) => {
			if (obj.isDragging) {
				ev.preventDefault();
				ev.stopPropagation();
			}
		},
		[obj.isDragging],
	);

	const style = useMemo(
		() => ({
			...baseStyle,
			cursor:
				disabled ? 'inherit'
				: obj.isDragging ? 'grabbing'
				: 'grab',
		}),
		[disabled, obj.isDragging],
	);

	return (
		<div
			style={style}
			{...bindDragHandle()}
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
	const canvas = useCanvas();
	const object = useObject();
	const dragLocked = useDragLocked();

	const [grabDisplacementRef, displace] = useDisplacement();
	const gestureInputRef = useGestureInput(object.id);
	const autoPan = useAutoPan(displace, gestureInputRef);

	return useGesture(
		{
			onDragStart: (state) => {
				if (isUnacceptableGesture(state.event)) {
					state.cancel();
					return;
				}
				// claim this gesture for this object
				canvas.gestureState.claimedBy = object.id;

				const screenPosition = { x: state.xy[0], y: state.xy[1] };
				autoPan.update(screenPosition);

				const currentObjectPosition = canvas.getViewportPosition(object.id);
				if (currentObjectPosition) {
					const displacement = subtractVectors(
						currentObjectPosition,
						screenPosition,
					);
					grabDisplacementRef.current.x = displacement.x;
					grabDisplacementRef.current.y = displacement.y;
				}

				applyGestureState(gestureInputRef.current, state);
				gestureInputRef.current.screenPosition = displace(screenPosition);

				canvas.onObjectDragStart(gestureInputRef.current);
			},
			onDrag: (state) => {
				if (
					isUnacceptableGesture(state.event) ||
					canvas.gestureState.claimedBy !== object.id
				) {
					state.cancel();
					return;
				}

				const screenPosition = { x: state.xy[0], y: state.xy[1] };
				autoPan.update(screenPosition);

				applyGestureState(gestureInputRef.current, state);
				gestureInputRef.current.screenPosition = displace(screenPosition);
				canvas.onObjectDrag(gestureInputRef.current);
			},
			onDragEnd: (state) => {
				if (
					isUnacceptableGesture(state.event) ||
					canvas.gestureState.claimedBy !== object.id
				) {
					state.cancel();
					return;
				}

				// don't claim taps. let parents handle them.
				if (state.tap) {
					console.debug(`${object.id} is abandoning claim on tap gesture`);
					canvas.gestureState.claimedBy = null;
					state.cancel();
					return;
				}

				const screenPosition = { x: state.xy[0], y: state.xy[1] };
				autoPan.update(screenPosition);

				applyGestureState(gestureInputRef.current, state);
				gestureInputRef.current.screenPosition = displace(screenPosition);
				canvas.onObjectDragEnd(gestureInputRef.current);
			},
		},
		{
			drag: {
				preventDefault: true,
			},
			enabled: !dragLocked && !disabled,
		},
	);
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
