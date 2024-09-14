import {
	Ref,
	RefObject,
	useCallback,
	useEffect,
	useRef,
	useSyncExternalStore,
} from 'react';
import { Atom } from 'signia';
import { useAtom } from 'signia-react';
import { CanvasGestureInfo, ObjectData } from '../../logic/Canvas.js';
import { Size, Vector2 } from '../../types.js';
import { useObjectGestures } from '../canvas/canvasHooks.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { CONTAINER_STATE } from './private.js';
import { BoundsRegistryEntry } from '../../logic/BoundsRegistry.js';

export interface CanvasObject<Metadata = any> {
	id: string;
	ref: Ref<HTMLDivElement>;
	containerId: string | null;
	draggingSignal: Atom<boolean>;
	move: (position: Vector2) => void;
	metadataRef: RefObject<Metadata | undefined>;
	entry: BoundsRegistryEntry<ObjectData<Metadata>>;
	[CONTAINER_STATE]: Atom<{ overId: string | null }>;
}

export function useCreateObject<Metadata = any>({
	id,
	containerId = null,
	initialPosition,
	getOrigin,
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
	getOrigin?: (position: Vector2, size: Size) => Vector2;
}): CanvasObject<Metadata> {
	const canvas = useCanvas();

	const draggingSignal = useAtom(`${id} dragging signal`, false);

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
					getOrigin,
				},
				{ type: 'object', metadata: metadataRef },
			) as BoundsRegistryEntry<ObjectData<Metadata>>,
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

	useObjectGestures(
		{
			onDragStart(info) {
				draggingSignal.set(true);
				move(info.worldPosition);
			},
			onDrag(info) {
				move(info.worldPosition);
				onDrag?.(info);
			},
			onDragEnd(info) {
				draggingSignal.set(false);
				onDrop?.(info);
			},
		},
		id,
	);

	const containerState = useAtom(`${id}: container state`, { overId: null });

	return {
		id,
		ref: entry.ref,
		containerId,
		draggingSignal,
		metadataRef,
		entry,
		move,
		[CONTAINER_STATE]: containerState,
	};
}
