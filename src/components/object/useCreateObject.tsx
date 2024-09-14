import { to, useSpring } from '@react-spring/web';
import {
	Ref,
	useCallback,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react';
import { Atom, react } from 'signia';
import { useAtom } from 'signia-react';
import { SPRINGS } from '../../constants.js';
import { CanvasGestureInfo } from '../../logic/Canvas.js';
import { vectorLength } from '../../logic/math.js';
import { Vector2 } from '../../types.js';
import { useObjectGestures } from '../canvas/canvasHooks.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { CONTAINER_STATE } from './private.js';
import { useMaybeContainer } from '../container/containerHooks.js';

export interface CanvasObject {
	id: string;
	ref: Ref<HTMLDivElement>;
	style: any;
	containerId: string | null;
	isDragging: boolean;
	move: (position: Vector2) => void;
	[CONTAINER_STATE]: Atom<{ overId: string | null }>;
}

export function useCreateObject<Metadata = any>({
	id,
	containerId = null,
	initialPosition,
	metadata,
	onDrag,
	onDrop,
}: {
	id: string;
	containerId?: string | null;
	initialPosition: Vector2;
	metadata?: Metadata;
	onDrag?: (event: CanvasGestureInfo) => void;
	onDrop?: (event: CanvasGestureInfo) => void;
}): CanvasObject {
	const canvas = useCanvas();

	const { isDragging, isDraggingRef, startDragging, stopDragging } =
		useDragging();

	const metadataRef = useRef(metadata);
	metadataRef.current = metadata;
	const entry = useSyncExternalStore(
		(cb) =>
			canvas.bounds.subscribe('entryReplaced', (objId) => {
				if (id === objId) cb();
			}),
		() =>
			canvas.bounds.register(
				id,
				{
					id,
					initialParent: containerId,
					initialPosition,
				},
				{ type: 'object', metadata: metadataRef },
			),
	);

	useEffect(() => {
		const container = containerId ? canvas.bounds.get(containerId) : null;
		entry.transform.apply({
			id: entry.id, // TODO: not this
			initialParent: container?.transform ?? null,
			initialPosition,
		});
	}, [containerId, initialPosition, entry, canvas]);

	const move = useCallback(
		(position: Vector2) => {
			entry.transform.position.set(position);
		},
		[entry],
	);

	const pickupSpring = useSpring({
		value: isDragging ? 1 : 0,
		config: SPRINGS.WOBBLY,
	});

	useObjectGestures(
		{
			onDragStart(info) {
				startDragging();
				move(info.worldPosition);
			},
			onDrag(info) {
				startDragging();
				move(info.worldPosition);
				onDrag?.(info);
			},
			onDragEnd(info) {
				stopDragging();
				onDrop?.(info);
			},
		},
		id,
	);

	const style = {
		// transform: to(
		// 	[pickupSpring.value],
		// 	(grabEffect) =>
		// 		`translate(var(--x), var(--y)) scale(${1 + 0.05 * grabEffect})`,
		// ),
		cursor: isDragging ? 'grabbing' : 'inherit',
	};

	const containerState = useAtom(`${id}: container state`, { overId: null });

	return {
		id,
		ref: entry.ref,
		style,
		containerId,
		isDragging,
		move,
		[CONTAINER_STATE]: containerState,
	};
}

function useDragging() {
	const [isDragging, setIsDragging] = useState(false);
	const isDraggingRef = useRef(isDragging);
	const startDragging = useCallback(() => {
		isDraggingRef.current = true;
		setIsDragging(true);
	}, []);
	const stopDragging = useCallback(() => {
		isDraggingRef.current = false;
		// we leave this flag on for a few ms - the "drag" gesture
		// basically has a fade-out effect where it continues to
		// block gestures internal to the drag handle for a bit even
		// after releasing
		// FIXME: avoid race condition / concurrency problem here by
		// using a debounced value?
		setTimeout(setIsDragging, 100, false);
	}, []);

	return {
		isDragging,
		isDraggingRef,
		startDragging,
		stopDragging,
	};
}
