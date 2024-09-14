import {
	createContext,
	CSSProperties,
	HTMLAttributes,
	useContext,
	useRef,
} from 'react';
import { CanvasObject } from './useCreateObject.js';
import { useRerasterize } from '../../logic/rerasterizeSignal.js';
import { useMergedRef } from '../../hooks.js';
import { useGesture } from '@use-gesture/react';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { CanvasGestureInfo, ObjectData } from '../../logic/Canvas.js';
import { ContainerPortal } from '../container/ContainerPortal.js';
import { track, useComputed, useValue } from 'signia-react';
import { CONTAINER_STATE } from './private.js';
import { gestureState } from '../gestures/useGestureState.js';
import { useDefiniteObjectEntry } from '../canvas/canvasHooks.js';
import { useLiveElementPosition } from './signalHooks.js';
import { BoundsRegistryEntry } from '../../logic/BoundsRegistry.js';

export interface ObjectProps extends HTMLAttributes<HTMLDivElement> {
	value: CanvasObject<any>;
	onTap?: (info: CanvasGestureInfo) => void;
}

const baseStyle: CSSProperties = {
	position: 'absolute',
	touchAction: 'none',
};

export const Object = function Object({
	value,
	onTap,
	children,
	style: userStyle,
	...rest
}: ObjectProps) {
	const ref = useRef<HTMLDivElement>(null);
	useRerasterize(ref);

	const canvas = useCanvas();
	const entry = value.entry;

	const bind = useGesture({
		onDragEnd: (state) => {
			if (state.tap) {
				gestureState.claimedBy = value.id;
				const info: CanvasGestureInfo = {
					alt: state.altKey,
					ctrlOrMeta: state.ctrlKey || state.metaKey,
					shift: state.shiftKey,
					distance: canvas.viewport.viewportDeltaToWorld({
						x: state.offset[0],
						y: state.offset[1],
					}),
					delta: canvas.viewport.viewportDeltaToWorld({
						x: state.delta[0],
						y: state.delta[1],
					}),
					intentional: true,
					worldPosition: canvas.viewport.viewportToWorld({
						x: state.xy[0],
						y: state.xy[1],
					}),
					targetId: value.id,
				};
				onTap?.(info);
			}
		},
	});

	const style: CSSProperties = {
		...baseStyle,
		...userStyle,
	};

	const positionProps = useObjectRenderedPosition(value, entry);

	const finalRef = useMergedRef<HTMLDivElement>(
		ref,
		value.ref,
		positionProps.ref,
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
						...positionProps.style,
					}}
					{...bind()}
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

function useObjectRenderedPosition(
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

	return useLiveElementPosition<HTMLDivElement>(renderedPosition);
}
