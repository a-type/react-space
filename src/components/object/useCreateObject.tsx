import {
	Ref,
	RefObject,
	useCallback,
	useEffect,
	useRef,
	useSyncExternalStore,
} from 'react';
import { Atom, transact } from 'signia';
import { useAtom } from 'signia-react';
import {
	BoundsRegistryEntry,
	RegistryTransformInit,
} from '../../logic/BoundsRegistry.js';
import {
	Canvas,
	CanvasGestureEvent,
	CanvasGestureInfo,
	CanvasGestureInput,
	ContainerData,
	ObjectData,
} from '../../logic/Canvas.js';
import { isDrag } from '../../logic/gestureUtils.js';
import { subtractVectors } from '../../logic/math.js';
import { TransformInit } from '../../logic/Transform.js';
import { useClaimedGestures } from '../canvas/canvasHooks.js';
import { useCanvas } from '../canvas/CanvasProvider.js';
import { CONTAINER_STATE } from './private.js';

export interface CanvasObject<Metadata = any> {
	id: string;
	ref: Ref<HTMLDivElement>;
	draggingSignal: Atom<boolean>;
	blockInteractionSignal: Atom<boolean>;
	update: (updates: RegistryTransformInit) => void;
	metadataRef: RefObject<Metadata | undefined>;
	entry: BoundsRegistryEntry<ObjectData<Metadata>>;
	[CONTAINER_STATE]: Atom<{ overId: string | null; accepted: boolean }>;
	disableSelect: RefObject<boolean>;
}

const empty = {};

const objectRegistry: Record<string, boolean> = {};

function defaultOnDrag(
	_info: CanvasGestureEvent,
	_self: CanvasObject,
	_canvas: Canvas,
) {}

function defaultOnDrop(
	info: CanvasGestureEvent,
	self: CanvasObject,
	_canvas: Canvas,
) {
	if (info.rejectedContainerId) {
		// if we were rejected by a container, do nothing --
		// this invalidates the move and resets to original position.
	} else {
		self.update({
			parent: info.containerId,
			position: info.position,
		});
	}
}

function defaultOnTap(
	info: CanvasGestureEvent,
	self: CanvasObject,
	canvas: Canvas,
) {
	if (self.disableSelect.current) return;

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
	onDrag,
	onDrop,
	onTap,
	disableSelect: disableSelectValue = false,
}: {
	id: string;
	initialTransform?: RegistryTransformInit;
	metadata?: Metadata;
	onDrag?: (
		event: CanvasGestureEvent,
		self: CanvasObject,
		canvas: Canvas,
	) => void;
	onDrop?: (
		event: CanvasGestureEvent,
		self: CanvasObject,
		canvas: Canvas,
	) => void;
	onTap?: (
		event: CanvasGestureEvent,
		self: CanvasObject,
		canvas: Canvas,
	) => void;
	disableSelect?: boolean;
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

	// I'm kinda using this pattern a lot... might be dangerous.
	const metadataRef = useRef(metadata);
	metadataRef.current = metadata;

	const disableSelect = useRef(disableSelectValue);
	disableSelect.current = disableSelectValue;

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
					disableSelect,
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

	const [gestureEventRef, resetGestureEvent, copyEventFromInput] =
		useGestureEvent();

	// must track this independently of gesture info, because
	// we also need to track and clean up non-accepted container references...
	const containerCandidateRef = useRef<BoundsRegistryEntry<
		ContainerData<any>
	> | null>(null);

	const containerState = useAtom(`${id}: container state`, { overId: null } as {
		overId: string | null;
		accepted: boolean;
	});

	// should this be stabilized?
	const object = {
		id,
		ref: entry.ref,
		draggingSignal,
		blockInteractionSignal,
		metadataRef,
		entry,
		update,
		disableSelect,
		[CONTAINER_STATE]: containerState,
	};

	useClaimedGestures(
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

				copyEventFromInput(input);
				gestureEventRef.current.defaultPrevented = false;
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
				copyEventFromInput(input);
				gestureEventRef.current.defaultPrevented = false;
				// update position (local position will be overridden in container check below)
				gestureEventRef.current.position = entry.transform.worldPosition.value;

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
					// also update object's own state
					containerState.set({ overId: container.id, accepted });
					if (accepted) {
						// add container to gesture info
						gestureEventRef.current.containerId = container.id;
					} else {
						gestureEventRef.current.rejectedContainerId = container.id;
					}
					// always set, no matter if accepted or not.
					containerCandidateRef.current = container;
				} else {
					if (containerCandidateRef.current) {
						// TODO: repeated often, should be abstracted somewhere
						// reset container's state
						containerCandidateRef.current.data.overState.update((v) => {
							const index = v.findIndex((o) => o.objectId === entry.id);
							if (index !== -1) {
								return v.filter((o) => o.objectId !== entry.id);
							}
							return v;
						});
						// since we've left the container, reset our state
						containerState.set({ overId: null, accepted: false });
						containerCandidateRef.current = null;
					}
					gestureEventRef.current.containerId = undefined;
					gestureEventRef.current.rejectedContainerId = undefined;
				}
				onDrag?.(gestureEventRef.current, object, canvas);
				if (!gestureEventRef.current.defaultPrevented) {
					defaultOnDrag(gestureEventRef.current, object, canvas);
				}
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
				copyEventFromInput(input);
				gestureEventRef.current.defaultPrevented = false;
				draggingSignal.set(false);
				gestureEventRef.current.position = entry.transform.worldPosition.value;

				if (!isDrag(input)) {
					// just in case.
					blockInteractionSignal.set(false);
					onTap?.(gestureEventRef.current, object, canvas);
					if (!gestureEventRef.current.defaultPrevented) {
						defaultOnTap(gestureEventRef.current, object, canvas);
					}
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
					}
					transact(() => {
						onDrop?.(gestureEventRef.current, object, canvas);
						if (!gestureEventRef.current.defaultPrevented) {
							defaultOnDrop(gestureEventRef.current, object, canvas);
						}
						entry.transform.discardGestureOffset();
					});
				}

				// reset for next gesture
				resetGestureEvent();
				containerCandidateRef.current = null;
			},
		},
		id,
	);

	return object;
}

function useGestureEvent() {
	const ref = useRef<CanvasGestureEvent>({
		alt: false,
		ctrlOrMeta: false,
		shift: false,
		distance: { x: 0, y: 0 },
		intentional: false,
		targetId: '',
		containerId: undefined,
		position: { x: 0, y: 0 },
		inputType: 'unknown',
		preventDefault: () => {
			ref.current.defaultPrevented = true;
		},
		defaultPrevented: false,
	});

	const reset = useCallback(() => {
		ref.current.alt = false;
		ref.current.ctrlOrMeta = false;
		ref.current.shift = false;
		ref.current.distance = { x: 0, y: 0 };
		ref.current.intentional = false;
		ref.current.targetId = '';
		ref.current.containerId = undefined;
		ref.current.rejectedContainerId = undefined;
		ref.current.position = { x: 0, y: 0 };
		ref.current.inputType = 'unknown';
		ref.current.defaultPrevented = false;
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
