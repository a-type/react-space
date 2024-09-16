import { useGesture } from '@use-gesture/react';
import {
	createContext,
	CSSProperties,
	HTMLAttributes,
	useContext,
	useEffect,
	useRef,
} from 'react';
import { useComputed, useValue } from 'signia-react';
import { useMergedRef } from '../../hooks.js';
import { BoundsRegistryEntry } from '../../logic/BoundsRegistry.js';
import { CanvasGestureInfo, ObjectData } from '../../logic/Canvas.js';
import { useRerasterize } from '../../logic/rerasterizeSignal.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { ContainerPortal } from '../container/ContainerPortal.js';
import { gestureState } from '../gestures/useGestureState.js';
import { CONTAINER_STATE } from './private.js';
import { useLiveElementPosition } from './signalHooks.js';
import { CanvasObject } from './useCreateObject.js';
import { react } from 'signia';

export interface ObjectProps extends HTMLAttributes<HTMLDivElement> {
	value: CanvasObject<any>;
}

const baseStyle: CSSProperties = {
	position: 'absolute',
	touchAction: 'none',
};

export const Object = function Object({
	value,
	children,
	style: userStyle,
	...rest
}: ObjectProps) {
	const ref = useRef<HTMLDivElement>(null);
	useRerasterize(ref);

	const entry = value.entry;

	const style: CSSProperties = {
		...baseStyle,
		...userStyle,
	};

	const renderProps = useObjectRendering(value, entry);

	const finalRef = useMergedRef<HTMLDivElement>(
		ref,
		value.ref,
		renderProps.ref,
	);

	const containerState = value[CONTAINER_STATE].value;

	// FIXME: this state is being set during invocation of register,
	// because the transform parent is updated.
	const parent = useValue(
		'parent id',
		() => entry.transform.parent.value?.id ?? null,
		[entry],
	);

	return (
		<ContainerPortal containerId={parent}>
			<ObjectContext.Provider value={value}>
				<div
					ref={finalRef}
					style={{
						...style,
						...renderProps.style,
					}}
					{...rest}
					data-object-over={!!containerState.overId}
				>
					{children}
				</div>
			</ObjectContext.Provider>
		</ContainerPortal>
	);
};

const ObjectContext = createContext<CanvasObject<any> | null>(null);

export function useObject() {
	const val = useContext(ObjectContext);
	if (!val) {
		throw new Error('useObject must be used inside an Object');
	}
	return val;
}

export function useMaybeObject() {
	return useContext(ObjectContext);
}

function useObjectRendering(
	object: CanvasObject,
	entry: BoundsRegistryEntry<ObjectData<any>>,
) {
	const renderedPosition = useComputed(
		`object ${object.id} rendered position`,
		() => {
			const dragging = object.draggingSignal.value;
			const origin = entry?.transform.origin.value;
			const worldOrigin = entry?.transform.worldOrigin.value;

			if (dragging) {
				return worldOrigin;
			}
			return origin;
		},
		[object, entry],
	);

	const positionProps =
		useLiveElementPosition<HTMLDivElement>(renderedPosition);

	// while we're here, add additional style data
	const draggingSignal = object.draggingSignal;
	const containerState = object[CONTAINER_STATE];
	useEffect(() => {
		return react('object pickup', () => {
			const dragging = draggingSignal.value;
			const overId = !!containerState.value.overId;

			const element = positionProps.ref.current;
			if (element) {
				element.setAttribute('data-dragging', dragging ? 'true' : 'false');
				element.setAttribute('data-over', overId ? 'true' : 'false');
				element.style.setProperty('--dragging', dragging ? '1' : '0');
				element.style.setProperty('--over', overId ? '1' : '0');
			}
		});
	}, [draggingSignal, containerState, positionProps.ref]);

	return positionProps;
}
