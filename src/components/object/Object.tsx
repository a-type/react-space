import {
	createContext,
	CSSProperties,
	HTMLAttributes,
	useContext,
	useEffect,
	useRef,
} from 'react';
import { react } from 'signia';
import { useComputed, useValue } from 'signia-react';
import { useMergedRef } from '../../hooks.js';
import { BoundsRegistryEntry } from '../../logic/BoundsRegistry.js';
import { ObjectData } from '../../logic/Canvas.js';
import { useRerasterize } from '../../logic/rerasterizeSignal.js';
import { ContainerPortal } from '../container/ContainerPortal.js';
import { CONTAINER_STATE } from './private.js';
import { useLiveElementPosition } from './signalHooks.js';
import { CanvasObject } from './useCreateObject.js';
import { animated } from '@react-spring/web';

export interface ObjectProps extends HTMLAttributes<HTMLDivElement> {
	value: CanvasObject<any>;
	/**
	 * A content wrapping element is rendered to ensure any styling
	 * changes you apply to the object don't interfere with critical
	 * layout properties. You can disable this with this prop, but
	 * you should avoid applying any CSS properties like transform!
	 */
	disableContentWrapper?: boolean;
}

const baseStyle: CSSProperties = {
	position: 'absolute',
	touchAction: 'none',
};

const contentStyle: CSSProperties = {
	position: 'relative',
};

export const Object = function Object({
	value,
	children,
	style: userStyle,
	disableContentWrapper,
	...rest
}: ObjectProps) {
	const ref = useRef<HTMLDivElement>(null);
	useRerasterize(ref);

	const entry = value.entry;

	const style: CSSProperties =
		disableContentWrapper ?
			{
				...baseStyle,
				...userStyle,
			}
		:	baseStyle;

	const renderProps = useObjectRendering(value, entry);

	const finalRef = useMergedRef<HTMLDivElement>(
		ref,
		value.ref,
		renderProps.ref,
	);

	const containerState = value[CONTAINER_STATE].value;

	const parent = useValue(
		'parent id',
		() => entry.transform.parent.value?.id ?? null,
		[entry],
	);

	return (
		<ContainerPortal containerId={parent}>
			<ObjectContext.Provider value={value}>
				<animated.div
					ref={finalRef}
					style={{
						...style,
						...renderProps.style,
					}}
					{...(disableContentWrapper ? rest : {})}
					data-container-over={!!containerState.overId}
					data-container-accepted={!!containerState.accepted}
				>
					{disableContentWrapper ?
						children
					:	<div
							data-purpose="object-content"
							style={contentStyle}
							data-container-over={!!containerState.overId}
							data-container-accepted={!!containerState.accepted}
							{...rest}
						>
							{children}
						</div>
					}
				</animated.div>
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

	const positionProps = useLiveElementPosition<HTMLDivElement>(
		renderedPosition,
		object.disableAnimationSignal,
	);

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
