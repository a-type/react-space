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
	BoundsRegistryEntry,
	RegistryTransformInit,
} from '../../logic/BoundsRegistry.js';
import {
	Canvas,
	CanvasGestureInfo,
	CanvasGestureInput,
	ContainerData,
	ObjectData,
} from '../../logic/Canvas.js';
import { isDrag } from '../../logic/gestureUtils.js';
import { subtractVectors } from '../../logic/math.js';
import { TransformInit } from '../../logic/Transform.js';
import { useObjectGestures } from '../canvas/canvasHooks.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { CONTAINER_STATE } from './private.js';

export interface CanvasObject<Metadata = any> {
	id: string;
	ref: Ref<HTMLDivElement>;
	draggingSignal: Atom<boolean>;
	blockInteractionSignal: Atom<boolean>;
	update: (updates: Omit<RegistryTransformInit, 'size'>) => void;
	metadataRef: RefObject<Metadata | undefined>;
	entry: BoundsRegistryEntry<ObjectData<Metadata>>;
	[CONTAINER_STATE]: Atom<{ overId: string | null }>;
}

const empty = {};

const objectRegistry: Record<string, boolean> = {};

function defaultOnDrag(info: CanvasGestureInfo, self: CanvasObject) {}

function defaultOnDrop(info: CanvasGestureInfo, self: CanvasObject) {
	self.update({
		parent: info.containerId,
		position: info.worldPosition,
	});
}

function defaultOnTap(
	info: CanvasGestureInfo,
	self: CanvasObject,
	canvas: Canvas,
) {
	if (info.shift || info.ctrlOrMeta) {
		canvas.selections.add(self.id);
	} else {
		canvas.selections.set([self.id]);
	}
}

export function useCreateObject<Metadata = any>({
	id,
	initialTransform = empty,
	metadata,
	onDrag = defaultOnDrag,
	onDrop = defaultOnDrop,
	onTap = defaultOnTap,
}: {
	id: string;
	initialTransform?: Omit<RegistryTransformInit, 'size'>;
	metadata?: Metadata;
	onDrag?: (
		event: CanvasGestureInfo,
		self: CanvasObject,
		canvas: Canvas,
	) => void;
	onDrop?: (
		event: CanvasGestureInfo,
		self: CanvasObject,
		canvas: Canvas,
	) => void;
	onTap?: (
		event: CanvasGestureInfo,
		self: CanvasObject,
		canvas: Canvas,
	) => void;
}): CanvasObject<Metadata> {
	const canvas = useCanvas();

	useEffect(() => {
		if (objectRegistry[id]) {
			console.warn(
				`Object with ID ${id} already exists in the canvas. This is not allowed and will cause bizarre behavior.`,
			);
		} else {
			objectRegistry[id] = true;
			return () => {
				delete objectRegistry[id];
			};
		}
	}, [id]);

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
			(canvas.bounds.get(id) ??
				canvas.bounds.register(id, initialTransform, {
					type: 'object',
					metadata: metadataRef,
				})) as BoundsRegistryEntry<ObjectData<Metadata>>,
	);

	const update = useCallback(
		(changes: RegistryTransformInit) => {
			const changesAsFulfilled: Omit<TransformInit, 'id'> = changes as any;
			if (changes.parent) {
				const parent = canvas.bounds.get(changes.parent);
				if (!parent) {
					console.warn(
						`Cannot update parent of object ${entry.id} to ${changes.parent}; container with that ID was not found in the canvas.`,
					);
					changesAsFulfilled.parent = null;
				} else if (parent?.data.type !== 'container') {
					console.warn(
						`Cannot update parent of object ${entry.id} to ${changes.parent}; object with that ID is not a container.`,
					);
					changesAsFulfilled.parent = null;
				} else {
					changesAsFulfilled.parent = parent?.transform ?? null;
				}
			}
			entry.transform.apply(changesAsFulfilled);
		},
		[entry, canvas],
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

				// DO THESE EVERY GESTURE FRAME...
				copyInfoFrom(input);
				// update position (local position will be overridden in container check below)
				gestureInfoRef.current.worldPosition =
					entry.transform.worldPosition.value;
				gestureInfoRef.current.position = gestureInfoRef.current.worldPosition;

				if (!isDrag(input)) {
					return;
				}

				// FROM HERE ON, ONLY CONFIRMED DRAGS.
				entry.transform.setParent(null);
				draggingSignal.set(true);
				blockInteractionSignal.set(true);

				entry.transform.setGestureOffset(input.distance);

				// check if this object intersects a container
				const containerCandidate = canvas.getContainerCandidate(entry, input);
				if (containerCandidate) {
					const { container, accepted } = containerCandidate;
					// for any previous container, clear its state
					if (
						containerCandidateRef.current &&
						containerCandidateRef.current.id !== container.id
					) {
						containerCandidateRef.current.data.overState.update((v) => {
							const index = v.findIndex((o) => o.objectId === entry.id);
							if (index !== -1) {
								return v.filter((o) => o.objectId !== entry.id);
							}
							return v;
						});
					}
					// update container's state to indicate this object is a candidate.
					container.data.overState.update((v) => {
						const existing = v.findIndex((o) => o.objectId === entry.id);
						if (existing !== -1) {
							if (v[existing].accepted === accepted) {
								// no change, no need to update.
								return v;
							}
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
						containerCandidateRef.current.data.overState.update((v) => {
							const index = v.findIndex((o) => o.objectId === entry.id);
							if (index !== -1) {
								return v.filter((o) => o.objectId !== entry.id);
							}
							return v;
						});
						// since we've left the container, reset our state
						containerState.set({ overId: null });
						containerCandidateRef.current = null;
					}
					gestureInfoRef.current.containerId = undefined;
				}
				(onDrag ?? defaultOnDrag)(gestureInfoRef.current, object, canvas);
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

				// DO THESE EVERY GESTURE FRAME...
				copyInfoFrom(input);
				draggingSignal.set(false);
				entry.transform.applyGestureOffset();
				gestureInfoRef.current.worldPosition =
					entry.transform.worldPosition.value;
				gestureInfoRef.current.position = gestureInfoRef.current.worldPosition;

				if (!isDrag(input)) {
					// just in case.
					blockInteractionSignal.set(false);
					onTap?.(gestureInfoRef.current, object, canvas);
					return;
				} else {
					// ONLY ON CONFIRMED DRAGS.

					// wait a moment longer to unblock interaction
					setTimeout(() => {
						blockInteractionSignal.set(false);
					}, 100);

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
					(onDrop ?? defaultOnDrop)(gestureInfoRef.current, object, canvas);
				}

				// reset for next gesture
				resetGestureInfo();
				containerCandidateRef.current = null;
			},
		},
		id,
	);

	const object = {
		id,
		ref: entry.ref,
		draggingSignal,
		blockInteractionSignal,
		metadataRef,
		entry,
		update,
		[CONTAINER_STATE]: containerState,
	};

	return object;
}

function useGestureInfo() {
	const ref = useRef<CanvasGestureInfo>({
		alt: false,
		ctrlOrMeta: false,
		shift: false,
		distance: { x: 0, y: 0 },
		intentional: false,
		worldPosition: { x: 0, y: 0 },
		targetId: '',
		containerId: undefined,
		position: { x: 0, y: 0 },
		inputType: 'unknown',
	});

	const reset = useCallback(() => {
		ref.current.alt = false;
		ref.current.ctrlOrMeta = false;
		ref.current.shift = false;
		ref.current.distance = { x: 0, y: 0 };
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
		ref.current.intentional = info.intentional;
		ref.current.targetId = info.targetId;
	}, []);

	return [ref, reset, copyFrom] as const;
}
