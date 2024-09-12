import { atom, Atom } from 'signia';
import { Size } from '../types.js';

export class ElementSizeTracker {
	readonly size: Atom<Size> = atom('element size', { width: 0, height: 0 });
	private element: Element | null = null;

	bind = (element: Element | null) => {
		if (this.element) {
			this.resizeObserver.unobserve(this.element);
		}
		this.element = element;
		if (this.element) {
			this.resizeObserver.observe(this.element);
		}

		const box = this.element?.getBoundingClientRect();
		this.size.set({
			width: box?.width ?? 0,
			height: box?.height ?? 0,
		});
	};

	private handleElementResize = ([entry]: ResizeObserverEntry[]) => {
		this.size.set({
			width: entry.borderBoxSize[0].inlineSize,
			height: entry.borderBoxSize[0].blockSize,
		});
	};
	private resizeObserver = new ResizeObserver(this.handleElementResize);
}
