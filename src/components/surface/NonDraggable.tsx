import { Slot } from '@radix-ui/react-slot';
import { HTMLAttributes } from 'react';
import { disableDragProps } from './SurfaceHandle.js';

export interface NonDraggableProps extends HTMLAttributes<HTMLDivElement> {
	asChild?: boolean;
}

export function NonDraggable({ asChild, ...props }: NonDraggableProps) {
	const Comp = asChild ? Slot : 'div';
	return <Comp {...props} {...disableDragProps} />;
}
