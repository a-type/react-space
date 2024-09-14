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
import { addVectors, vectorLength } from '../../logic/math.js';

export interface CanvasObject<Metadata = any> {
	id: string;
	ref: Ref<HTMLDivElement>;
	containerId: string | null;
	draggingSignal: Atom<boolean>;
	blockInteractionSignal: Atom<boolean>;
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
	const blockInteractionSignal = useAtom(
		`${id} block interaction signal`,
		false,
	);

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
				move(addVectors(entry.transform.position.value, info.delta));
			},
			onDrag(info) {
				move(addVectors(entry.transform.position.value, info.delta));
				if (vectorLength(info.distance) > 5) {
					console.log('block interaction');
					blockInteractionSignal.set(true);
				}
				onDrag?.(info);
			},
			onDragEnd(info) {
				draggingSignal.set(false);
				// wait a moment longer to unblock interaction
				setTimeout(() => {
					console.log('release interaction');
					blockInteractionSignal.set(false);
				}, 100);
				// convert world position to this object -- for multi-object
				// drags, world position only applies to the 'target' object.
				const customInfo = {
					...info,
					worldPosition: entry.transform.position.value,
				};
				onDrop?.(customInfo);
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
		blockInteractionSignal,
		metadataRef,
		entry,
		move,
		[CONTAINER_STATE]: containerState,
	};
}
