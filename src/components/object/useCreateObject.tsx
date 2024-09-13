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

	const [positionStyle, positionSpring] = useSpring(() => ({
		...initialPosition,
		config: SPRINGS.QUICK,
	}));

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

	useEffect(() => {
		const unsub = react('update position spring', () => {
			// if (isDraggingRef.current) {
			positionSpring.set(entry.transform.origin.value);
			// } else {
			// 	positionSpring.start(entry.transform.origin.value);
			// }
		});

		return () => {
			unsub();
		};
	}, [entry, isDraggingRef, positionSpring]);

	const move = useCallback(
		(position: Vector2) => {
			const entry = canvas.bounds.get(id);
			if (!entry) {
				throw new Error(`object ${id} not found in bounds`);
			}
			entry?.transform.position.set(position);
		},
		[canvas, id],
	);

	const pickupSpring = useSpring({
		value: isDragging ? 1 : 0,
		config: SPRINGS.WOBBLY,
	});

	useObjectGestures(
		{
			onDragStart(info) {
				if (vectorLength(info.distance) > 5) {
					startDragging();
				}
			},
			onDrag(info) {
				if (vectorLength(info.distance) > 5) {
					startDragging();
				}
				onDrag?.(info);
				move(info.worldPosition);
			},
			onDragEnd(info) {
				stopDragging();
				onDrop?.(info);
			},
		},
		id,
	);

	const style = {
		transform: to(
			[positionStyle.x, positionStyle.y, pickupSpring.value],
			(x, y, grabEffect) =>
				`translate(${x}px, ${y}px) scale(${1 + 0.05 * grabEffect})`,
		),
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
