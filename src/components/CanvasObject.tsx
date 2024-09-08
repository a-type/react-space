import { animated, Interpolation, to, useSpring } from '@react-spring/web';
import {
	createContext,
	CSSProperties,
	HTMLAttributes,
	ReactNode,
	RefObject,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	useIsSelected,
	useLiveObjectOrigin,
	useObjectGestures,
	useRegister,
} from './canvasHooks.js';
import { useCanvas } from './CanvasProvider.jsx';
import { SPRINGS } from '../constants.js';
import {
	addVectors,
	snapshotLiveVector,
	subtractVectors,
	vectorDistance,
	vectorLength,
} from '../logic/math.js';
import { useRerasterize } from '../logic/rerasterizeSignal.js';
import { Vector2 } from '../types.js';
import { useGesture } from '@use-gesture/react';
import {
	CanvasGestureInfo,
	ObjectContainmentEvent,
	ObjectRegistration,
} from '../logic/Canvas.js';
import { useMergedRef } from '../hooks.js';
import { preventDefault } from '@a-type/utils';
import { createPortal } from 'react-dom';

export interface CanvasObjectRootProps extends HTMLAttributes<HTMLDivElement> {
	canvasObject: CanvasObject;
	onTap?: (info: CanvasGestureInfo) => void;
}

const baseStyle: CSSProperties = {
	position: 'absolute',
	touchAction: 'none',
};

export function CanvasObjectRoot({
	children,
	canvasObject,
	onTap,
	style,
	...rest
}: CanvasObjectRootProps) {
	const ref = useRef<HTMLDivElement>(null);
	useRerasterize(ref);
	// useHideOffscreen(ref);

	const register = useRegister(
		canvasObject.id,
		canvasObject.metadata,
		canvasObject.registration,
	);
	const finalRef = useMergedRef(ref, register);

	const canvas = useCanvas();
	const bind = useGesture({
		onDragEnd: (info) => {
			if (info.tap) {
				canvas.gestureState.claimedBy = canvasObject.id;
				onTap?.({
					alt: info.altKey,
					ctrlOrMeta: info.ctrlKey || info.metaKey,
					delta: canvas.viewport.viewportDeltaToWorld({
						x: info.delta[0],
						y: info.delta[1],
					}),
					intentional: true,
					shift: info.shiftKey,
					worldPosition: canvas.viewport.viewportToWorld({
						x: info.xy[0],
						y: info.xy[1],
					}),
					targetId: canvasObject.id,
				});
			}
		},
	});

	return (
		<ContainerPortal
			containerId={canvasObject.containerId}
			disabled={canvasObject.isDragging}
		>
			<CanvasObjectContext.Provider value={canvasObject}>
				<animated.div
					ref={finalRef}
					// this is blocking undo keybinds...
					// onKeyDown={stopPropagation}
					// onKeyUp={stopPropagation}
					onDragStart={preventDefault}
					onDragEnd={preventDefault}
					onDrag={preventDefault}
					{...canvasObject.rootProps}
					style={{
						...baseStyle,
						...style,
						...canvasObject.rootProps.style,
					}}
					{...bind()}
					{...rest}
				>
					{children}
				</animated.div>
			</CanvasObjectContext.Provider>
		</ContainerPortal>
	);
}

export interface CanvasObject {
	isDragging: boolean;
	rootProps: any;
	moveTo: (position: Vector2, interpolate?: boolean) => void;
	id: string;
	metadata: any;
	registration: ObjectRegistration<any>;
	containerId: string | null;
}

const CanvasObjectContext = createContext<CanvasObject | null>(null);

export function useCanvasObjectContext() {
	const ctx = useContext(CanvasObjectContext);
	if (!ctx)
		throw new Error(
			'useCanvasObject must be called inside a CanvasObjectProvider',
		);

	return ctx;
}

export interface CanvasObjectDragEvent {
	info: CanvasGestureInfo;
	worldPosition: Vector2;
	containerPosition?: Vector2;
}

export function useCanvasObject({
	initialPosition,
	objectId,
	zIndex = 0,
	onDrop,
	onDrag,
	metadata,
	canContain,
	containerPriority,
	containerId = null,
}: {
	initialPosition: Vector2;
	objectId: string;
	onDrop?: (event: CanvasObjectDragEvent) => any;
	onDrag?: (event: CanvasObjectDragEvent) => any;
	zIndex?: number;
	metadata?: any;
	canContain?: (event: ObjectContainmentEvent<any>) => boolean;
	containerPriority?: number;
	containerId?: string | null;
}) {
	const canvas = useCanvas();

	const [isDragging, setIsDragging] = useState(false);
	const [positionStyle, positionSpring] = useSpring(() => initialPosition);

	const pickupSpring = useSpring({
		value: isDragging ? 1 : 0,
		config: SPRINGS.WOBBLY,
	});

	/**
	 * ONLY MOVES THE VISUAL NODE.
	 * Update the actual backing data to make real movements.
	 * This should be hooked up to backing data changes.
	 */
	const moveTo = useCallback(
		(position: Vector2) => {
			positionSpring.start({
				x: position.x,
				y: position.y,
			});
		},
		[objectId, positionSpring],
	);

	// FIXME: find a better place to do this?
	useEffect(
		() => canvas.bounds.registerOrigin(objectId, positionStyle),
		[canvas, objectId],
	);

	const { selected } = useIsSelected(objectId);

	const eventRef = useRef<CanvasObjectDragEvent>({
		info: {
			alt: false,
			ctrlOrMeta: false,
			delta: { x: 0, y: 0 },
			intentional: false,
			shift: false,
			worldPosition: { x: 0, y: 0 },
			targetId: objectId,
		},
		worldPosition: { x: 0, y: 0 },
	});

	useObjectGestures({
		onDragStart: (info) => {
			if (!selected && info.targetId !== objectId) return;
			positionSpring.set(
				addVectors(snapshotLiveVector(positionStyle), info.delta),
			);
			if (vectorLength(info.delta) > 5) {
				setIsDragging(true);
			}
		},
		onDrag: (info) => {
			if (!selected && info.targetId !== objectId) return;
			const finalPosition = addVectors(
				snapshotLiveVector(positionStyle),
				info.delta,
			);
			eventRef.current.info = info;
			eventRef.current.worldPosition = finalPosition;
			eventRef.current.containerPosition = undefined;
			if (info.containerId) {
				const containerOrigin = canvas.bounds.getOrigin(info.containerId);
				if (containerOrigin) {
					eventRef.current.containerPosition = subtractVectors(
						finalPosition,
						snapshotLiveVector(containerOrigin),
					);
				}
			}
			onDrag?.(eventRef.current);
			positionSpring.set(finalPosition);
			if (vectorLength(info.delta) > 5) {
				setIsDragging(true);
			}
		},
		onDragEnd: async (info) => {
			if (!selected && info.targetId !== objectId) return;
			const finalPosition = canvas.snapPosition(
				addVectors(snapshotLiveVector(positionStyle), info.delta),
			);
			eventRef.current.info = info;
			eventRef.current.worldPosition = finalPosition;
			eventRef.current.containerPosition = undefined;
			if (info.containerId) {
				const containerOrigin = canvas.bounds.getOrigin(info.containerId);
				if (containerOrigin) {
					eventRef.current.containerPosition = subtractVectors(
						finalPosition,
						snapshotLiveVector(containerOrigin),
					);
				}
			}
			onDrop?.(eventRef.current);
			// animate to final position
			positionSpring.start(finalPosition);
			// we leave this flag on for a few ms - the "drag" gesture
			// basically has a fade-out effect where it continues to
			// block gestures internal to the drag handle for a bit even
			// after releasing
			setTimeout(setIsDragging, 100, false);
			// update the spatial hash now that the object is settled
			canvas.bounds.updateHash(objectId);
		},
	});

	const parentLivePosition = useLiveObjectOrigin(containerId);

	const canvasObject: CanvasObject = useMemo(() => {
		let transform: Interpolation<string>;
		/**
		 * Translate to the correct position, offset by origin,
		 * and apply a subtle bouncing scale effect when picked
		 * up or dropped.
		 */
		if (parentLivePosition) {
			transform = to(
				[
					positionStyle.x,
					positionStyle.y,
					parentLivePosition.x,
					parentLivePosition.y,
					pickupSpring.value,
				],
				(xv, yv, px, py, grabEffect) =>
					`translate(${xv + px}px, ${yv + py}px) scale(${1 + 0.05 * grabEffect})`,
			);
		} else {
			transform = to(
				[positionStyle.x, positionStyle.y, pickupSpring.value],
				(xv, yv, grabEffect) =>
					`translate(${xv}px, ${yv}px) scale(${1 + 0.05 * grabEffect})`,
			);
		}

		const rootProps = {
			style: {
				transform,
				zIndex,
				cursor: isDragging ? 'grab' : 'inherit',
			},
		};

		return {
			isDragging,
			rootProps,
			moveTo,
			id: objectId,
			metadata,
			registration: {
				canContain,
				containerPriority,
			},
			containerId,
		};
	}, [
		positionStyle,
		pickupSpring,
		zIndex,
		isDragging,
		objectId,
		containerId,
		parentLivePosition,
	]);

	return canvasObject;
}

export function useContainerCandidate(objectId: string) {
	const canvas = useCanvas();
	const [isContainerCandidate, setIsContainerCandidate] = useState(false);
	useEffect(() => {
		return canvas.subscribe('containerCandidateChange', (candidate) => {
			setIsContainerCandidate(candidate === objectId);
		});
	}, [objectId]);

	return isContainerCandidate;
}

function useHideOffscreen(ref: RefObject<HTMLDivElement | null>) {
	useEffect(() => {
		if (!ref.current) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) {
					ref.current?.style.setProperty('visibility', 'hidden');
				} else {
					ref.current?.style.setProperty('visibility', 'visible');
				}
			},
			{
				root: null,
				rootMargin: '0px',
				threshold: 0,
			},
		);

		observer.observe(ref.current);

		return () => {
			observer.disconnect();
		};
	}, [ref]);
}

const ContainerPortal = ({
	children,
	containerId,
	disabled,
}: {
	children: ReactNode;
	containerId: string | null;
	disabled?: boolean;
}) => {
	const canvas = useCanvas();
	const [containerElement, setContainerElement] = useState<Element | null>(
		() => (containerId ? canvas.objectElements.get(containerId) || null : null),
	);
	useEffect(() => {
		return canvas.subscribe('objectElementChange', (objectId, element) => {
			console.log('objectElementChange', objectId, element);
			if (objectId === containerId) {
				setContainerElement(element);
			}
		});
	}, [containerId, canvas]);

	if (disabled) return children;
	if (containerId && !containerElement) {
		console.warn('ContainerPortal: container not found', containerId);
		return null;
	}
	if (!containerElement) return children;

	return createPortal(children, containerElement);
};
