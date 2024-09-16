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
import {
	CanvasGestureInfo,
	CanvasGestureInput,
	ContainerData,
	ObjectData,
} from '../../logic/Canvas.js';
import { Size, Vector2 } from '../../types.js';
import { useObjectGestures } from '../canvas/canvasHooks.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { CONTAINER_STATE } from './private.js';
import { BoundsRegistryEntry } from '../../logic/BoundsRegistry.js';
import { addVectors, subtractVectors, vectorLength } from '../../logic/math.js';

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
			entry.transform.setPosition(position);
		},
		[entry],
	);

	const [gestureInfoRef, resetGestureInfo, copyInfoFrom] = useGestureInfo();

	// must track this independently of gesture info, because
	// we also need to track and clean up non-accepted container references...
	const containerCandidateRef = useRef<BoundsRegistryEntry<
		ContainerData<any>
	> | null>(null);

	const containerState = useAtom(`${id}: container state`, { overId: null } as {
		overId: string | null;
	});

	useObjectGestures(
		{
			onDragStart(input) {
				// if any parent is included in selection, ignore this gesture entirely
				// (parent will move us)
				if (
					entry.transform.anyParentIs((parent) =>
						canvas.selections.has(parent.id),
					)
				) {
					return;
				}

				// if user grabs an object that's not part of the active selection,
				// clear the selection
				if (!canvas.selections.has(id)) {
					if (input.shift || input.ctrlOrMeta) {
						canvas.selections.add(id);
					} else {
						canvas.selections.set([]);
					}
				}

				draggingSignal.set(true);
				entry.transform.setGestureOffset(input.distance);
				entry.transform.setParent(null);
				copyInfoFrom(input);
			},
			onDrag(input) {
				// if any parent is included in selection, ignore this gesture entirely
				// (parent will move us)
				if (
					entry.transform.anyParentIs((parent) =>
						canvas.selections.has(parent.id),
					)
				) {
					return;
				}

				entry.transform.setGestureOffset(input.distance);
				if (vectorLength(input.distance) > 5) {
					blockInteractionSignal.set(true);
				}
				copyInfoFrom(input);

				// update position (local position will be overridden in container check below)
				gestureInfoRef.current.worldPosition =
					entry.transform.worldPosition.value;
				gestureInfoRef.current.position = gestureInfoRef.current.worldPosition;

				// check if this object intersects a container
				const containerCandidate = canvas.getContainerCandidate(entry, input);
				if (containerCandidate) {
					const { container, accepted } = containerCandidate;
					// for any previous container, clear its state
					if (
						containerCandidateRef.current &&
						containerCandidateRef.current.id !== container.id
					) {
						containerCandidateRef.current.data.overState.update((v) =>
							v.filter((o) => o.objectId !== entry.id),
						);
					}
					// update container's state to indicate this object is a candidate.
					container.data.overState.update((v) => {
						const existing = v.findIndex((o) => o.objectId === entry.id);
						if (existing !== -1) {
							v[existing] = { objectId: entry.id, accepted };
							// I think reallocating is required for signal to update.
							return [...v];
						}
						return [...v, { objectId: entry.id, accepted }];
					});
					if (accepted) {
						// also update object's own state
						containerState.set({ overId: container.id });
						// add container to gesture info
						gestureInfoRef.current.containerId = container.id;
						gestureInfoRef.current.position = subtractVectors(
							entry.transform.worldPosition.value,
							container.transform.worldOrigin.value,
						);
					}
					// always set, no matter if accepted or not.
					containerCandidateRef.current = container;
				} else {
					if (containerCandidateRef.current) {
						// FIXME: repeated often, should be abstracted somewhere
						// reset container's state
						containerCandidateRef.current.data.overState.update((v) =>
							v.filter((o) => o.objectId !== entry.id),
						);
					}
					gestureInfoRef.current.containerId = undefined;
				}
				onDrag?.(gestureInfoRef.current);
			},
			onDragEnd(input) {
				// if any parent is included in selection, ignore this gesture entirely
				// (parent will move us)
				if (
					entry.transform.anyParentIs((parent) =>
						canvas.selections.has(parent.id),
					)
				) {
					return;
				}

				draggingSignal.set(false);
				entry.transform.applyGestureOffset();
				// wait a moment longer to unblock interaction
				setTimeout(() => {
					blockInteractionSignal.set(false);
				}, 100);

				copyInfoFrom(input);
				gestureInfoRef.current.worldPosition =
					entry.transform.worldPosition.value;
				gestureInfoRef.current.position = gestureInfoRef.current.worldPosition;

				const container = containerCandidateRef.current;
				if (container) {
					// reset container's state
					container.data.overState.update((v) =>
						v.filter((o) => o.objectId !== entry.id),
					);

					// one more computation for good measure (but only if accepted)
					if (gestureInfoRef.current.containerId === container.id) {
						gestureInfoRef.current.position = subtractVectors(
							entry.transform.worldPosition.value,
							container.transform.worldOrigin.value,
						);
					}
				}

				onDrop?.(gestureInfoRef.current);

				// reset for next gesture
				resetGestureInfo();
				containerCandidateRef.current = null;
			},
		},
		id,
	);

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

function useGestureInfo() {
	const ref = useRef<CanvasGestureInfo>({
		alt: false,
		ctrlOrMeta: false,
		shift: false,
		distance: { x: 0, y: 0 },
		delta: { x: 0, y: 0 },
		intentional: false,
		worldPosition: { x: 0, y: 0 },
		targetId: '',
		containerId: undefined,
		position: { x: 0, y: 0 },
	});

	const reset = useCallback(() => {
		ref.current.alt = false;
		ref.current.ctrlOrMeta = false;
		ref.current.shift = false;
		ref.current.distance = { x: 0, y: 0 };
		ref.current.delta = { x: 0, y: 0 };
		ref.current.intentional = false;
		ref.current.worldPosition = { x: 0, y: 0 };
		ref.current.targetId = '';
		ref.current.containerId = undefined;
		ref.current.position = { x: 0, y: 0 };
	}, []);

	const copyFrom = useCallback((info: CanvasGestureInput) => {
		ref.current.alt = info.alt;
		ref.current.ctrlOrMeta = info.ctrlOrMeta;
		ref.current.shift = info.shift;
		ref.current.distance = info.distance;
		ref.current.delta = info.delta;
		ref.current.intentional = info.intentional;
		ref.current.targetId = info.targetId;
	}, []);

	return [ref, reset, copyFrom] as const;
}
