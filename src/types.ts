import { Atom, Signal } from 'signia';

export type Vector2 = {
	x: number;
	y: number;
};

export type Size = {
	width: number;
	height: number;
};

export type RectLimits = {
	min: Vector2;
	max: Vector2;
};

export type LiveVector2 = Signal<Vector2>;
export type LiveSize = Atom<Size>;

export type Box = Vector2 & Size;
export type LiveBox = Atom<Box>;
