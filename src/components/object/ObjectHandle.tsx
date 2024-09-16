import { isMiddleClick, isRightClick, stopPropagation } from '@a-type/utils';
import {
	CSSProperties,
	HTMLAttributes,
	PointerEvent,
	SyntheticEvent,
	useCallback,
} from 'react';
import { track, useValue } from 'signia-react';
import { useDragLocked } from '../canvas/canvasHooks.js';
import {
	GestureClaimDetail,
	useClaimGesture,
} from '../gestures/useGestureState.js';
import { useObject } from './Object.js';
import { Slot } from '@radix-ui/react-slot';

export interface ObjectHandleProps extends HTMLAttributes<HTMLDivElement> {
	disabled?: boolean;
	asChild?: boolean;
}

const baseStyle: CSSProperties = {
	touchAction: 'none',
};

export const ObjectHandle = track(function ObjectHandle({
	disabled,
	style: userStyle,
	asChild,
	...rest
}: ObjectHandleProps) {
	const obj = useObject();
	const handleProps = useDragHandle(disabled);

	/**
	 * This handler prevents click events from firing within the draggable handle
	 * if the user was dragging during the gesture - for example we don't want to
	 * click a link if the user is dragging it when they release the mouse.
	 */
	const onClickCapture = useCallback(
		(ev: React.MouseEvent) => {
			if (obj.blockInteractionSignal.value) {
				ev.preventDefault();
				ev.stopPropagation();
			}
		},
		[obj],
	);

	const dragging = useValue(obj.draggingSignal);
	const style = {
		...baseStyle,
		...userStyle,
		cursor:
			disabled ? 'inherit'
			: dragging ? 'grabbing'
			: 'grab',
	};

	const Component = asChild ? Slot : 'div';

	return (
		<Component
			style={style}
			onClickCapture={onClickCapture}
			{...handleProps()}
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
	const object = useObject();
	const dragLocked = useDragLocked();

	return useClaimGesture(
		'object',
		object.id,
		(event) => {
			// don't override other object claims
			if (event.existingClaimType === 'object') return false;
			if (dragLocked || disabled) return false;
			if (isUnacceptableGesture(event)) return false;
			return true;
		},
		{ overrideOtherClaim: true },
	);
}

function isUnacceptableGesture(event: GestureClaimDetail) {
	if (event.isRightMouse || event.isMiddleMouse) return true;
	if (event.target && event.target instanceof HTMLElement) {
		const element = event.target;
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
