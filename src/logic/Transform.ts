import { atom, Atom, computed, Computed, Signal } from 'signia';
import { Box, Size, Vector2 } from '../types.js';

export interface TransformInit {
	id: string;
	initialPosition?: Vector2;
	initialSize?: Size;
	initialParent?: Transform | null;
	getOrigin?: (position: Vector2, size: Size) => Vector2;
}

export class Transform {
	readonly id: string;
	/**
	 * Position is a user-settable property that represents the
	 * object's relative position to its parent container.
	 */
	position: Atom<Vector2>;
	/**
	 * Size is a user-settable property that represents the
	 * object's size.
	 */
	size: Atom<Size>;
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
	parent: Atom<Transform | null>;
	/**
	 * A final computed property that represents the object's
	 * origin in the world.
	 */
	worldOrigin: Computed<Vector2>;
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
		this.position = atom(`${id} position`, initialPosition);
		this.size = atom(`${id} size`, initialSize);
		this.parent = atom(`${id} parent`, initialParent);
		this.computeOrigin = getOrigin;
		this.origin = computed(`${id} computed origin`, () => {
			return (
				this.computeOrigin?.(this.position.value, this.size.value) ??
				this.position.value
			);
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
		if (init.initialPosition) this.position.set(init.initialPosition);
		if (init.initialSize) this.size.set(init.initialSize);
		if (init.initialParent !== undefined) this.parent.set(init.initialParent);
		this.computeOrigin = init.getOrigin;
	};

	hasParent = (otherId: string): boolean => {
		const parent = this.parent.value;
		if (!parent) return false;
		if (parent.id === otherId) return true;
		return parent.hasParent(otherId);
	};
}
