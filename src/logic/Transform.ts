import { atom, Atom, computed, Computed, Signal, whyAmIRunning } from 'signia';
import { Box, Size, Vector2 } from '../types.js';
import { addVectors, sizesEqual, vectorsEqual } from './math.js';

export interface TransformInit {
	id: string;
	initialPosition?: Vector2;
	initialSize?: Size;
	initialParent?: Transform | null;
	getOrigin?: (position: Vector2, size: Size) => Vector2;
}

export class Transform {
	readonly id: string;

	inputs: Atom<{
		position: Vector2;
		gestureOffset: Vector2;
		size: Size;
		parent: Transform | null;
	}>;
	/**
	 * Position is a user-settable property that represents the
	 * object's relative position to its parent container.
	 */
	position: Computed<Vector2>;
	/**
	 * Gesture offset is a property that represents the offset
	 * of the object's position due to a gesture (like dragging).
	 */
	gestureOffset: Computed<Vector2>;
	/**
	 * Size is a user-settable property that represents the
	 * object's size.
	 */
	size: Computed<Size>;
	/**
	 * Origin is a computed property that represents the
	 * object's top-left corner relative to the parent container.
	 *
	 * It's the same as position in top-left aligned objects,
	 * but can be customized by the user to change how the
	 * object is positioned (like an object centered on its
	 * position)
	 */
	origin: Signal<Vector2>;
	/**
	 * Parent is a signal that represents the object's parent
	 * container.
	 */
	parent: Computed<Transform | null>;
	/**
	 * A final computed property that represents the object's
	 * origin in the world.
	 */
	worldOrigin: Computed<Vector2>;
	/**
	 * A final computed property that represents the object's
	 * position in the world.
	 */
	worldPosition: Computed<Vector2>;
	/**
	 * The world origin combined with size to form a bounding box.
	 */
	bounds: Computed<Box>;
	/**
	 * The center of the bounds.
	 */
	center: Computed<Vector2>;

	private computeOrigin:
		| ((position: Vector2, size: Size) => Vector2)
		| undefined = undefined;

	constructor({
		initialPosition = { x: 0, y: 0 },
		initialSize = { width: 0, height: 0 },
		getOrigin,
		initialParent = null,
		id,
	}: TransformInit) {
		this.id = id;
		this.inputs = atom(`${id} inputs`, {
			position: initialPosition,
			gestureOffset: { x: 0, y: 0 },
			size: initialSize,
			parent: initialParent,
		});
		this.position = computed(`${id} position`, () => {
			return this.inputs.value.position;
		});
		this.gestureOffset = computed(`${id} gesture offset`, () => {
			return this.inputs.value.gestureOffset;
		});
		this.size = computed(`${id} size`, () => {
			return this.inputs.value.size;
		});
		this.parent = computed(`${id} parent`, () => {
			return this.inputs.value.parent;
		});
		this.computeOrigin = getOrigin;
		this.origin = computed(`${id} computed origin`, () => {
			const position = this.position.value;
			const offset = this.gestureOffset.value;
			const size = this.size.value;
			const base = this.computeOrigin?.(position, size) ?? position;
			return {
				x: base.x + offset.x,
				y: base.y + offset.y,
			};
		});
		this.worldOrigin = computed(`${id} world origin`, () => {
			const parent = this.parent.value;
			const origin = this.origin.value;
			if (!parent) return origin;
			const parentOrigin = parent.worldOrigin.value;
			return {
				x: parentOrigin.x + origin.x,
				y: parentOrigin.y + origin.y,
			};
		});
		this.worldPosition = computed(`${id} world position`, () => {
			const parent = this.parent.value;
			const position = this.position.value;
			const offset = this.gestureOffset.value;
			if (!parent) return position;
			const parentOrigin = parent.worldOrigin.value;
			return {
				x: parentOrigin.x + position.x + offset.x,
				y: parentOrigin.y + position.y + offset.y,
			};
		});
		this.bounds = computed(`${id} bounds`, () => {
			const origin = this.worldOrigin.value;
			const size = this.size.value;
			return {
				x: origin.x,
				y: origin.y,
				width: size.width,
				height: size.height,
			};
		});
		this.center = computed(`${id} center`, () => {
			const bounds = this.bounds.value;
			return {
				x: bounds.x + bounds.width / 2,
				y: bounds.y + bounds.height / 2,
			};
		});
	}

	apply = (init: TransformInit) => {
		if (init.initialParent === this) {
			throw new Error(`Cannot set parent of ${this.id} to self`);
		}
		if (init.initialPosition) this.setPosition(init.initialPosition);
		if (init.initialSize) this.setSize(init.initialSize);
		if (init.initialParent !== undefined) this.setParent(init.initialParent);
		if (init.getOrigin) {
			this.computeOrigin = init.getOrigin;
		}
	};

	hasParent = (otherId: string): boolean => {
		const parent = this.parent.value;
		if (!parent) return false;
		if (parent.id === otherId) return true;
		return parent.hasParent(otherId);
	};

	anyParentIs = (predicate: (transform: Transform) => boolean): boolean => {
		const parent = this.parent.value;
		if (!parent) return false;
		if (predicate(parent)) return true;
		return parent.anyParentIs(predicate);
	};

	setPosition = (position: Vector2) => {
		this.inputs.update((inputs) => ({
			...inputs,
			gestureOffset: { x: 0, y: 0 },
			position: position,
		}));
	};

	setSize = (size: Size) => {
		this.inputs.update((inputs) => ({
			...inputs,
			size,
		}));
	};

	setGestureOffset = (offset: Vector2) => {
		this.inputs.update((inputs) => ({
			...inputs,
			gestureOffset: offset,
		}));
	};

	setParent = (parent: Transform | null) => {
		this.inputs.update((inputs) => {
			const prevParent = inputs.parent;
			if (prevParent === parent) return inputs;
			if (parent && parent.hasParent(this.id)) {
				throw new Error(
					`Cannot set parent of ${this.id} to child ${parent.id}`,
				);
			}
			// transform position to be relative to new parent or global if no new parent
			const position = this.worldPosition.value;
			const parentPosition = parent?.worldPosition.value ?? { x: 0, y: 0 };
			const newPosition = {
				x: position.x - parentPosition.x,
				y: position.y - parentPosition.y,
			};
			return {
				...inputs,
				parent: parent,
				position: newPosition,
			};
		});
	};

	applyGestureOffset = () => {
		this.inputs.update((inputs) => ({
			...inputs,
			position: addVectors(inputs.position, inputs.gestureOffset),
			gestureOffset: { x: 0, y: 0 },
		}));
	};
}
